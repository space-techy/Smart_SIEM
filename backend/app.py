"""
FastAPI backend to receive Wazuh alerts via custom integration hook.
Persists alerts to MongoDB and returns 200 OK.
"""
import json
import os
from datetime import datetime
from typing import Any, Dict

from fastapi import FastAPI, HTTPException, Header, Request
from fastapi.middleware.cors import CORSMiddleware

from db import ensure_indexes, insert_alert, close_client

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
    """Initialize database indexes on startup."""
    print("[APP] Starting Wazuh Alert Receiver...")
    await ensure_indexes()
    print("[APP] Ready to receive alerts")


@app.on_event("shutdown")
async def shutdown_event():
    """Close database connection on shutdown."""
    print("[APP] Shutting down...")
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
    Persists to MongoDB with idempotency.
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
    # Don't log duplicates to avoid noise
    
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn
    print(f"Starting Wazuh Alert Receiver on {HOST}:{PORT}")
    print(f"Using BACKEND_KEY: {'*' * (len(BACKEND_KEY) - 4)}{BACKEND_KEY[-4:]}")
    uvicorn.run(app, host=HOST, port=PORT)

