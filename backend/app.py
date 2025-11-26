"""
FastAPI backend to receive Wazuh alerts via custom integration hook.
Persists alerts to MongoDB with ML predictions and returns 200 OK.
"""
import json
import os
from datetime import datetime
from typing import Any, Dict

from fastapi import FastAPI, HTTPException, Header, Request
from fastapi.middleware.cors import CORSMiddleware

from db import (
    ensure_indexes, insert_alert, close_client, get_collection,
    get_settings, update_settings, insert_prediction
)

# Configuration from environment
BACKEND_KEY = os.getenv("BACKEND_KEY", "devkey")
PORT = int(os.getenv("PORT", "8081"))
HOST = os.getenv("HOST", "0.0.0.0")
PRINT_FULL_JSON = os.getenv("PRINT_FULL_JSON", "false").lower() == "true"

app = FastAPI(title="Wazuh Alert Receiver", version="1.0.0")

# CORS - allow all origins for testing
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def verify_token(authorization: str | None = Header(None)) -> None:
    """Verify Bearer token authorization."""
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing Authorization header")
    
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid Authorization format")
    
    token = authorization.replace("Bearer ", "")
    if token != BACKEND_KEY:
        raise HTTPException(status_code=401, detail="Invalid token")


def extract_field(data: Dict[str, Any], *paths: str) -> Any:
    """Extract nested field defensively from dict using dot-notation paths."""
    for path in paths:
        try:
            value = data
            for key in path.split("."):
                value = value[key]
            if value:  # Return first non-empty value
                return value
        except (KeyError, TypeError, AttributeError):
            continue
    return None


def format_console_line(alert_data: Dict[str, Any]) -> str:
    """Format a concise single-line summary of the alert."""
    # Extract timestamp (raw Wazuh alert format, not Kibana _source wrapper)
    ts = extract_field(alert_data, "timestamp", "@timestamp", "_source.timestamp")
    if not ts:
        ts = datetime.utcnow().isoformat() + "Z"
    
    # Extract agent info
    agent = extract_field(
        alert_data, 
        "agent.name", 
        "agent.id",
        "_source.agent.name",
        "_source.agent.id"
    )
    if not agent:
        agent = "-"
    
    # Extract rule level
    rule_level = extract_field(alert_data, "rule.level", "_source.rule.level")
    if rule_level is None:
        rule_level = "-"
    
    # Extract description
    desc = extract_field(
        alert_data,
        "rule.description",
        "full_log",
        "_source.rule.description",
        "_source.full_log"
    )
    if not desc:
        desc = "-"
    
    # Truncate description to 120 chars and remove newlines
    desc_str = str(desc).replace("\n", " ").replace("\r", "")[:120]
    
    return f'[WAZUH] ts={ts} agent={agent} level={rule_level} desc="{desc_str}"'


@app.on_event("startup")
async def startup_event():
    """Initialize database, ML model, and scheduler on startup."""
    import asyncio
    
    print("[APP] Starting Wazuh Alert Receiver with ML...")
    
    # Initialize database indexes
    await ensure_indexes()
    
    # Load ML model
    try:
        from model_wrapper import get_model
        model = get_model()
        
        if model.is_loaded():
            print("[APP] ✓ ML model loaded successfully")
            
            # Run FORCE backfill in background (re-predict ALL alerts)
            async def run_backfill():
                await asyncio.sleep(5)  # Wait 5s for system to be ready
                from backfill import backfill_predictions
                print("[APP] ✓ Starting FORCE backfill (will re-predict all alerts)...")
                await backfill_predictions(force=True)  # ← FORCE MODE ON!
            
            asyncio.create_task(run_backfill())
            print("[APP] ✓ Force backfill scheduled (will run in 5s)")
        else:
            print("[APP] ⚠ ML model not loaded")
    except Exception as e:
        print(f"[APP] ⚠ ML model error: {e}")
    
    # Start scheduler
    try:
        from scheduler import start_scheduler
        await start_scheduler()
        print("[APP] ✓ Scheduler started")
    except Exception as e:
        print(f"[APP] ⚠ Scheduler error: {e}")
    
    print("[APP] ✓ Ready to receive alerts with ML predictions")


@app.on_event("shutdown")
async def shutdown_event():
    """Close database connection and stop scheduler on shutdown."""
    print("[APP] Shutting down...")
    
    # Stop scheduler
    try:
        from scheduler import stop_scheduler
        stop_scheduler()
    except Exception as e:
        print(f"[APP] Warning: Failed to stop scheduler: {e}")
    
    # Close database
    await close_client()


@app.get("/")
def home():
    """Home endpoint."""
    return {"message": "Welcome to the Wazuh Alert Receiver"}


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"ok": True}


@app.get("/api/alerts")
async def get_alerts(limit: int = 100, skip: int = 0):
    """
    Get alerts from MongoDB.
    Returns alerts in a format suitable for the frontend.
    """
    from db import get_collection
    
    try:
        collection = get_collection()
        
        # Get alerts sorted by timestamp (newest first)
        cursor = collection.find().sort("timestamp", -1).skip(skip).limit(limit)
        alerts = await cursor.to_list(length=limit)
        
        # Transform MongoDB alerts to frontend format
        transformed_alerts = []
        for alert in alerts:
            # Convert ObjectId to string for JSON serialization
            alert["_id"] = str(alert["_id"])
            transformed_alerts.append(alert)
        
        return {
            "status": "ok",
            "count": len(transformed_alerts),
            "alerts": transformed_alerts
        }
    
    except Exception as e:
        print(f"[ERROR] Failed to fetch alerts: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch alerts: {str(e)}")


@app.get("/api/alerts/count")
async def get_alerts_count():
    """Get total count of alerts in database."""
    from db import get_collection
    
    try:
        collection = get_collection()
        count = await collection.count_documents({})
        
        return {
            "status": "ok",
            "count": count
        }
    
    except Exception as e:
        print(f"[ERROR] Failed to count alerts: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to count alerts: {str(e)}")


@app.post("/classify")
async def classify_alert(request: Request, authorization: str | None = Header(None)):
    """
    Classify an alert as malicious or safe.
    Moves alert to appropriate collection and updates label.
    """
    # Verify authorization
    verify_token(authorization)
    
    from db import get_collection
    from datetime import datetime, timezone
    
    try:
        body = await request.json()
        alert_id = body.get("_id")
        label = body.get("label")
        
        if not alert_id:
            raise HTTPException(status_code=400, detail="Missing _id field")
        
        if label not in ["malicious", "safe"]:
            raise HTTPException(status_code=400, detail="label must be 'malicious' or 'safe'")
        
        # Get collections
        alerts_collection = get_collection("alerts")
        malicious_collection = get_collection("malicious")
        safe_collection = get_collection("safe")
        
        # Find the alert
        alert = await alerts_collection.find_one({"_id": alert_id})
        
        if not alert:
            raise HTTPException(status_code=404, detail=f"Alert {alert_id} not found")
        
        # Add classification metadata
        alert["label"] = label
        alert["labeled_at"] = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
        
        # Insert into appropriate collection (idempotent)
        target_collection = malicious_collection if label == "malicious" else safe_collection
        opposite_collection = safe_collection if label == "malicious" else malicious_collection
        
        # Remove from opposite collection if it exists
        await opposite_collection.delete_one({"_id": alert_id})
        
        # Insert/update in target collection
        await target_collection.replace_one(
            {"_id": alert_id},
            alert,
            upsert=True
        )
        
        # Update the original alert in alerts collection
        await alerts_collection.update_one(
            {"_id": alert_id},
            {
                "$set": {
                    "label": label,
                    "labeled_at": alert["labeled_at"]
                }
            }
        )
        
        print(f"[CLASSIFY] Alert {alert_id} classified as {label}")
        
        return {
            "ok": True,
            "alertId": alert_id,
            "label": label
        }
    
    except HTTPException:
        raise
    except Exception as e:
        print(f"[ERROR] Classification failed: {e}")
        raise HTTPException(status_code=500, detail=f"Classification failed: {str(e)}")


@app.get("/classify/{alert_id}")
async def get_classification(alert_id: str, authorization: str | None = Header(None)):
    """
    Get classification label for an alert.
    """
    # Verify authorization
    verify_token(authorization)
    
    from db import get_collection
    
    try:
        alerts_collection = get_collection("alerts")
        alert = await alerts_collection.find_one({"_id": alert_id})
        
        if not alert:
            raise HTTPException(status_code=404, detail=f"Alert {alert_id} not found")
        
        return {
            "ok": True,
            "alertId": alert_id,
            "label": alert.get("label"),
            "labeled_at": alert.get("labeled_at")
        }
    
    except HTTPException:
        raise
    except Exception as e:
        print(f"[ERROR] Failed to get classification: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get classification: {str(e)}")


@app.post("/events")
async def receive_event(request: Request, authorization: str | None = Header(None)):
    """
    Receive Wazuh alert events.
    Requires Bearer token authentication.
    Persists to MongoDB with ML predictions and optional auto-classification.
    """
    # Verify authorization
    verify_token(authorization)
    
    # Parse JSON body (accept any structure)
    try:
        alert_data = await request.json()
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON")
    
    # Print concise console line (before DB insert to show original data)
    console_line = format_console_line(alert_data)
    print(console_line)
    
    # Optional: Print full JSON (controlled by env var)
    if PRINT_FULL_JSON:
        print(json.dumps(alert_data, indent=2))
        print()
    
    # Persist to MongoDB
    # Note: We pass a copy to preserve original for potential retry logic
    alert_copy = alert_data.copy()
    success, message = await insert_alert(alert_copy)
    
    if not success:
        print(f"[ERROR] {message}")
        raise HTTPException(status_code=502, detail="Database error")
    
    # Log success (minimal)
    if "Inserted" in message:
        print(f"[OK] {message}")
    
    # ===== ML PREDICTION =====
    try:
        from model_wrapper import get_model
        from db import compute_id
        
        model = get_model()
        
        if model.is_loaded():
            # Get alert ID
            alert_id = compute_id(alert_copy)
            
            # Predict using full pipeline
            pred = model.predict(alert_copy)
            
            if "error" not in pred:
                # Store prediction
                await insert_prediction(
                    event_id=alert_id,
                    label=pred["label"],
                    score=pred["score"],
                    version=pred["version"]
                )
                
                print(f"[ML] Predicted: {pred['label']} (score: {pred['score']:.3f})")
                
                # Optional auto-classification
                settings = await get_settings()
                if settings and settings.get("auto_classify", False):
                    threshold = float(settings.get("confidence_threshold", 0.85))
                    
                    if pred["label"] == "malicious" and pred["score"] >= threshold:
                        print(f"[ML] Auto-classifying (score >= {threshold})")
                        
                        alert_copy["label"] = "malicious"
                        alert_copy["labeled_at"] = datetime.now().isoformat()
                        alert_copy["auto_classified"] = True
                        
                        malicious_collection = get_collection("malicious")
                        await malicious_collection.replace_one(
                            {"_id": alert_id},
                            alert_copy,
                            upsert=True
                        )
                        
                        await get_collection("alerts").update_one(
                            {"_id": alert_id},
                            {"$set": {
                                "label": "malicious",
                                "labeled_at": alert_copy["labeled_at"],
                                "auto_classified": True
                            }}
                        )
                        
                        print(f"[ML] ✓ Auto-classified as malicious")
            else:
                print(f"[ML] Prediction error: {pred['error']}")
        else:
            print("[ML] Model not loaded, skipping prediction")
            
    except Exception as e:
        print(f"[ML] Warning: Prediction failed: {e}")
        # Don't fail the request if prediction fails
    
    return {"status": "ok"}


@app.get("/api/settings")
async def get_ml_settings(authorization: str | None = Header(None)):
    """
    Get current ML settings.
    """
    verify_token(authorization)
    
    settings = await get_settings()
    
    if not settings:
        # Return defaults
        return {
            "retrain_interval_value": 24,
            "retrain_interval_unit": "hours",
            "confidence_threshold": 0.85,
            "auto_classify": False,
            "scheduler_enabled": True
        }
    
    # Convert legacy format to new format
    if "retrain_interval_hours" in settings and "retrain_interval_value" not in settings:
        settings["retrain_interval_value"] = settings["retrain_interval_hours"]
        settings["retrain_interval_unit"] = "hours"
    
    return settings


@app.put("/api/settings")
async def update_ml_settings(request: Request, authorization: str | None = Header(None)):
    """
    Update ML settings.
    Automatically reschedules retraining and updates threshold.
    """
    verify_token(authorization)
    
    try:
        patch = await request.json()
        
        # Update settings in database
        updated_settings = await update_settings(patch)
        
        # Update threshold in model if changed
        if "confidence_threshold" in patch:
            from model_wrapper import set_threshold
            set_threshold(float(patch["confidence_threshold"]))
        
        # Reschedule if interval changed
        if ("retrain_interval_value" in patch or 
            "retrain_interval_unit" in patch or 
            "retrain_interval_hours" in patch or 
            "scheduler_enabled" in patch):
            from scheduler import reschedule_from_settings
            await reschedule_from_settings()
        
        print(f"[API] Settings updated: {patch}")
        
        return {
            "ok": True,
            "settings": updated_settings,
            "message": "Settings updated successfully"
        }
        
    except Exception as e:
        print(f"[API] ERROR: Failed to update settings: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to update settings: {str(e)}")


@app.post("/ml/reload")
async def reload_ml_model(request: Request, authorization: str | None = Header(None)):
    """
    Manually reload ML model.
    Optionally specify a version path to load.
    
    Body: {"version_path": "models/wazuh-lgbm-20250113-1430.joblib"} (optional)
    """
    verify_token(authorization)
    
    try:
        body = await request.json() if request.headers.get("content-length") else {}
        version_path = body.get("version_path")
        
        from model_wrapper import get_model
        
        model = get_model()
        model.reload(version_path)
        
        model_info = model.get_info()
        
        print(f"[API] Model reloaded: {model_info['version']}")
        
        return {
            "ok": True,
            "model": model_info,
            "message": f"Model reloaded: {model_info['version']}"
        }
        
    except Exception as e:
        print(f"[API] ERROR: Failed to reload model: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to reload model: {str(e)}")


@app.post("/ml/backfill")
async def trigger_backfill(
    request: Request,
    authorization: str | None = Header(None)
):
    """
    Manually trigger backfill of predictions for existing alerts.
    
    Body (optional):
    {
        "force": true  // Re-predict ALL alerts (even if already predicted)
    }
    
    Default: Only predicts alerts without predictions
    """
    verify_token(authorization)
    
    try:
        from backfill import backfill_predictions
        
        # Check if force mode requested
        body = {}
        try:
            body = await request.json()
        except:
            pass
        
        force = body.get("force", False)
        
        print(f"[API] Manual backfill triggered (force={force})...")
        result = await backfill_predictions(force=force)
        
        return {
            "ok": True,
            "result": result
        }
        
    except Exception as e:
        print(f"[API] ERROR: Backfill failed: {e}")
        raise HTTPException(status_code=500, detail=f"Backfill failed: {str(e)}")


@app.post("/ml/train")
async def trigger_training(authorization: str | None = Header(None)):
    """
    Manually trigger model retraining.
    Trains on data from malicious and safe collections.
    """
    verify_token(authorization)
    
    try:
        import asyncio
        from trainer import train_and_maybe_promote
        from model_wrapper import get_model
        from db import get_client
        
        print("[API] Manual training triggered...")
        
        client = get_client()
        result = await train_and_maybe_promote(client)
        
        # Reload model if promoted
        if result['promoted']:
            model = get_model()
            model.reload()
            print("[API] ✓ New model loaded")
            
            # Optionally run backfill with new model
            async def run_backfill():
                from backfill import backfill_predictions
                await backfill_predictions()
            
            asyncio.create_task(run_backfill())
            print("[API] ✓ Backfill scheduled")
        
        return {
            "ok": True,
            "result": result
        }
        
    except Exception as e:
        print(f"[API] ERROR: Training failed: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Training failed: {str(e)}")


@app.get("/ml/versions")
async def list_model_versions(
    authorization: str | None = Header(None),
    limit: int = 50
):
    """
    List all model versions with metadata.
    Returns versions sorted by date (newest first).
    """
    verify_token(authorization)
    
    try:
        from model_versioning import list_versions, get_version_file_size
        
        versions = list_versions(limit=limit)
        
        # Add file size to each version
        for version in versions:
            version["file_size_bytes"] = get_version_file_size(version["path"])
            version["file_size_mb"] = round(version["file_size_bytes"] / (1024 * 1024), 2)
        
        return {
            "ok": True,
            "versions": versions,
            "count": len(versions)
        }
        
    except Exception as e:
        print(f"[API] ERROR: Failed to list versions: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to list versions: {str(e)}")


@app.post("/ml/rollback")
async def rollback_model_version(
    request: Request,
    authorization: str | None = Header(None)
):
    """
    Rollback to a previous model version.
    
    Body: {"version_id": "20250113-143000"}
    """
    verify_token(authorization)
    
    try:
        body = await request.json()
        version_id = body.get("version_id")
        
        if not version_id:
            raise HTTPException(status_code=400, detail="version_id is required")
        
        from model_versioning import promote_version, get_version
        from model_wrapper import get_model
        
        # Check if version exists
        version = get_version(version_id)
        if not version:
            raise HTTPException(status_code=404, detail=f"Version {version_id} not found")
        
        # Promote the version
        success = promote_version(version_id)
        if not success:
            raise HTTPException(status_code=500, detail="Failed to rollback")
        
        # Reload model
        model = get_model()
        model.reload()
        
        print(f"[API] Model rolled back to version {version_id}")
        
        return {
            "ok": True,
            "version": version,
            "message": f"Rolled back to version {version_id}"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"[API] ERROR: Failed to rollback: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to rollback: {str(e)}")


@app.get("/ml/status")
async def get_ml_status(authorization: str | None = Header(None)):
    """
    Get ML system status including model info and scheduler status.
    """
    verify_token(authorization)
    
    try:
        from model_wrapper import get_model
        from scheduler import get_scheduler_status
        from db import get_collection
        
        # Get model info
        model = get_model()
        model_info = model.get_info()
        
        # Get scheduler status
        scheduler_status = get_scheduler_status()
        
        # Get production version info
        from model_versioning import get_production_version
        production_version = get_production_version()
        
        # Get training data counts
        malicious_collection = get_collection("malicious")
        safe_collection = get_collection("safe")
        alerts_collection = get_collection("alerts")
        
        malicious_count = await malicious_collection.count_documents({})
        safe_count = await safe_collection.count_documents({})
        
        # Count predicted vs unpredicted alerts
        total_alerts = await alerts_collection.count_documents({})
        predicted_alerts = await alerts_collection.count_documents({
            "predicted_label": {"$exists": True}
        })
        
        return {
            "ok": True,
            "model": model_info,
            "production_version": production_version,
            "scheduler": scheduler_status,
            "training_data": {
                "malicious": malicious_count,
                "safe": safe_count,
                "total": malicious_count + safe_count
            },
            "predictions": {
                "total_alerts": total_alerts,
                "predicted": predicted_alerts,
                "pending": total_alerts - predicted_alerts
            }
        }
        
    except Exception as e:
        print(f"[API] ERROR: Failed to get ML status: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get ML status: {str(e)}")


@app.get("/ml/evaluate")
async def evaluate_model(authorization: str | None = Header(None)):
    """
    Evaluate current ML model on labeled data from MongoDB.
    Returns real accuracy, precision, recall, F1 score.
    
    Compares:
    - Model predictions (predicted_label)
    - Human labels (label field)
    
    Only evaluates alerts that have BOTH predicted_label AND label fields.
    """
    verify_token(authorization)
    
    try:
        from db import get_collection
        from sklearn.metrics import (
            accuracy_score, precision_score, recall_score, 
            f1_score, confusion_matrix, classification_report
        )
        
        alerts_collection = get_collection("alerts")
        
        # Find alerts that have BOTH predictions AND human labels
        cursor = alerts_collection.find({
            "predicted_label": {"$exists": True},
            "label": {"$exists": True}
        })
        
        y_true = []  # Human labels
        y_pred = []  # Model predictions
        alert_details = []
        
        async for alert in cursor:
            # Get human label
            human_label = alert.get("label")  # "malicious" or "safe"
            
            # Get model prediction
            pred_label = alert.get("predicted_label")  # "malicious" or "benign"
            pred_score = alert.get("predicted_score", 0.0)
            
            # Normalize labels to binary (1=malicious, 0=safe/benign)
            human_binary = 1 if human_label == "malicious" else 0
            pred_binary = 1 if pred_label == "malicious" else 0
            
            y_true.append(human_binary)
            y_pred.append(pred_binary)
            
            # Track individual alert for detailed view
            alert_details.append({
                "id": alert.get("_id"),
                "timestamp": alert.get("timestamp"),
                "agent": alert.get("agent", {}).get("name", "unknown"),
                "human_label": human_label,
                "predicted_label": pred_label,
                "predicted_score": pred_score,
                "correct": human_binary == pred_binary
            })
        
        if len(y_true) == 0:
            return {
                "ok": True,
                "evaluated": 0,
                "message": "No alerts with both predictions and human labels found",
                "metrics": None
            }
        
        # Calculate metrics
        accuracy = float(accuracy_score(y_true, y_pred))
        
        # Handle edge case: only one class present
        try:
            precision = float(precision_score(y_true, y_pred, zero_division=0))
            recall = float(recall_score(y_true, y_pred, zero_division=0))
            f1 = float(f1_score(y_true, y_pred, zero_division=0))
        except:
            precision = recall = f1 = 0.0
        
        # Confusion matrix
        cm = confusion_matrix(y_true, y_pred)
        
        # Count correct/incorrect
        correct_count = sum(1 for t, p in zip(y_true, y_pred) if t == p)
        incorrect_count = len(y_true) - correct_count
        
        # Breakdown by class
        malicious_correct = sum(1 for t, p in zip(y_true, y_pred) if t == 1 and p == 1)
        malicious_incorrect = sum(1 for t, p in zip(y_true, y_pred) if t == 1 and p == 0)
        safe_correct = sum(1 for t, p in zip(y_true, y_pred) if t == 0 and p == 0)
        safe_incorrect = sum(1 for t, p in zip(y_true, y_pred) if t == 0 and p == 1)
        
        metrics = {
            "accuracy": accuracy,
            "precision": precision,
            "recall": recall,
            "f1_score": f1,
            "total_evaluated": len(y_true),
            "correct": correct_count,
            "incorrect": incorrect_count,
            "confusion_matrix": {
                "true_negatives": int(cm[0][0]) if cm.shape[0] > 0 else 0,
                "false_positives": int(cm[0][1]) if cm.shape[0] > 1 else 0,
                "false_negatives": int(cm[1][0]) if cm.shape[0] > 1 else 0,
                "true_positives": int(cm[1][1]) if cm.shape[0] > 1 else 0
            },
            "by_class": {
                "malicious": {
                    "correct": malicious_correct,
                    "incorrect": malicious_incorrect,
                    "total": malicious_correct + malicious_incorrect
                },
                "safe": {
                    "correct": safe_correct,
                    "incorrect": safe_incorrect,
                    "total": safe_correct + safe_incorrect
                }
            }
        }
        
        # Sort misclassified alerts (most confident mistakes first)
        misclassified = [a for a in alert_details if not a["correct"]]
        misclassified.sort(key=lambda x: abs(x["predicted_score"] - 0.5), reverse=True)
        
        print(f"[ML EVAL] Evaluated {len(y_true)} alerts: Accuracy={accuracy:.3f}, F1={f1:.3f}")
        
        return {
            "ok": True,
            "evaluated": len(y_true),
            "metrics": metrics,
            "misclassified_samples": misclassified[:10],  # Top 10 mistakes
            "message": f"Evaluated {len(y_true)} alerts with both predictions and labels"
        }
        
    except Exception as e:
        print(f"[API] ERROR: Failed to evaluate model: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to evaluate model: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    print(f"Starting Wazuh Alert Receiver on {HOST}:{PORT}")
    print(f"Using BACKEND_KEY: {'*' * (len(BACKEND_KEY) - 4)}{BACKEND_KEY[-4:]}")
    uvicorn.run(app, host=HOST, port=PORT)

