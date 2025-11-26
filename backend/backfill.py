"""
Backfill predictions for existing alerts in MongoDB.
Runs on startup to classify all unclassified alerts.
"""
import asyncio
from datetime import datetime, timezone
from typing import Dict, Any
from db import get_collection
from model_wrapper import get_model


async def backfill_predictions(force: bool = False):
    """
    Classify all alerts in MongoDB that don't have predictions yet.
    
    Args:
        force: If True, re-predict ALL alerts (even if already predicted)
    
    Process:
    1. Find all alerts without predicted_label (or all if force=True)
    2. Extract features and predict
    3. Update MongoDB in batches
    
    Returns dict with stats.
    """
    print("[BACKFILL] ========================================")
    print(f"[BACKFILL] Starting backfill (force={force})...")
    
    try:
        model = get_model()
        
        if not model.is_loaded():
            print("[BACKFILL] Model not loaded, skipping backfill")
            return {
                "processed": 0,
                "errors": 0,
                "message": "Model not loaded"
            }
        
        alerts_collection = get_collection("alerts")
        
        # Find alerts based on force flag
        # if force:
        #     # Re-predict ALL alerts
        #     print("[BACKFILL] FORCE mode: Re-predicting ALL alerts...")
        #     cursor = alerts_collection.find({})
        # else:
        #     # Only predict alerts without predictions
        print("[BACKFILL] Finding unclassified alerts...")
        cursor = alerts_collection.find({})
        
        processed = 0
        errors = 0
        batch = []
        batch_size = 100
        
        print("[BACKFILL] Finding unclassified alerts...")
        
        async for alert in cursor:
            try:
                # Get prediction
                pred = model.predict(alert)
                
                if "error" in pred:
                    errors += 1
                    continue
                
                # Prepare update
                batch.append({
                    "_id": alert["_id"],
                    "predicted_label": pred["label"],
                    "predicted_score": pred["score"],
                    "model_version": pred["version"]
                })
                
                # Process in batches for efficiency
                if len(batch) >= batch_size:
                    await _update_batch(alerts_collection, batch)
                    processed += len(batch)
                    print(f"[BACKFILL] Processed {processed} alerts...")
                    batch = []
                    
            except Exception as e:
                errors += 1
                print(f"[BACKFILL] Error processing alert: {e}")
        
        # Process remaining batch
        if batch:
            await _update_batch(alerts_collection, batch)
            processed += len(batch)
        
        print(f"[BACKFILL] ✓ Completed: {processed} processed, {errors} errors")
        print("[BACKFILL] ========================================")
        
        return {
            "processed": processed,
            "errors": errors,
            "message": f"Backfill completed: {processed} alerts classified"
        }
        
    except Exception as e:
        print(f"[BACKFILL] Failed: {e}")
        import traceback
        traceback.print_exc()
        return {
            "processed": 0,
            "errors": 0,
            "message": f"Backfill failed: {str(e)}"
        }


async def _update_batch(collection, batch):
    """Bulk update predictions in MongoDB"""
    timestamp = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    
    for item in batch:
        await collection.update_one(
            {"_id": item["_id"]},
            {"$set": {
                "predicted_label": item["predicted_label"],
                "predicted_score": item["predicted_score"],
                "model_version": item["model_version"],
                "predicted_at": timestamp
            }}
        )


async def backfill_with_auto_classify():
    """
    Backfill predictions and auto-classify high-confidence alerts.
    """
    from db import get_settings, get_collection
    
    settings = await get_settings()
    if not settings or not settings.get("auto_classify", False):
        return await backfill_predictions()
    
    model = get_model()
    if not model.is_loaded():
        return {"processed": 0, "message": "Model not loaded"}
    
    alerts_collection = get_collection("alerts")
    malicious_collection = get_collection("malicious")
    
    cursor = alerts_collection.find({"predicted_label": {"$exists": False}})
    
    processed = 0
    auto_classified = 0
    threshold = float(settings.get("confidence_threshold", 0.85))
    
    async for alert in cursor:
        try:
            pred = model.predict(alert)
            
            # Update prediction
            await alerts_collection.update_one(
                {"_id": alert["_id"]},
                {"$set": {
                    "predicted_label": pred["label"],
                    "predicted_score": pred["score"],
                    "model_version": pred["version"],
                    "predicted_at": datetime.now(timezone.utc).isoformat()
                }}
            )
            
            processed += 1
            
            # Auto-classify if high confidence
            if pred["label"] == "malicious" and pred["score"] >= threshold:
                alert["label"] = "malicious"
                alert["labeled_at"] = datetime.now(timezone.utc).isoformat()
                alert["auto_classified"] = True
                
                await malicious_collection.replace_one(
                    {"_id": alert["_id"]},
                    alert,
                    upsert=True
                )
                
                await alerts_collection.update_one(
                    {"_id": alert["_id"]},
                    {"$set": {
                        "label": "malicious",
                        "labeled_at": alert["labeled_at"],
                        "auto_classified": True
                    }}
                )
                
                auto_classified += 1
                
        except Exception as e:
            print(f"[BACKFILL] Error: {e}")
    
    print(f"[BACKFILL] ✓ Processed {processed}, auto-classified {auto_classified}")
    
    return {
        "processed": processed,
        "auto_classified": auto_classified,
        "message": f"Backfill completed with auto-classification"
    }

