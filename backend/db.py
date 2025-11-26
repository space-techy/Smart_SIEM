"""
MongoDB database operations for Wazuh alerts.
"""
import hashlib
import os
from datetime import datetime, timezone
from typing import Dict, Any

from dateutil import parser as date_parser
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorCollection
from pymongo.errors import DuplicateKeyError

# Configuration
MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = "siem"
COLLECTION_NAME = "alerts"

# Global singleton client instance (only ONE connection for entire app)
_client: AsyncIOMotorClient | None = None
_client_initialized: bool = False


def get_client() -> AsyncIOMotorClient:
    """
    Get MongoDB async client instance (SINGLETON pattern).
    Only creates ONE client for the entire application lifecycle.
    Motor handles connection pooling internally.
    """
    global _client, _client_initialized
    
    if _client is None:
        print(f"[DB] Creating MongoDB client (singleton) connecting to: {MONGO_URL}")
        _client = AsyncIOMotorClient(
            MONGO_URL,
            maxPoolSize=10,  # Limit connection pool size
            minPoolSize=1,
            serverSelectionTimeoutMS=5000
        )
        _client_initialized = True
        print("[DB] ✓ MongoDB client created successfully (this should only happen ONCE)")
    
    return _client


def get_collection(collection_name: str = COLLECTION_NAME) -> AsyncIOMotorCollection:
    """Get a collection from the database."""
    client = get_client()
    return client[DB_NAME][collection_name]


async def ensure_indexes() -> None:
    """Create indexes for the alerts collection."""
    collection = get_collection()
    
    # Create indexes with proper naming
    indexes = [
        (("timestamp", -1), "idx_timestamp"),
        ([("rule.level", -1), ("timestamp", -1)], "idx_rule_level_timestamp"),
        ([("agent.id", 1), ("timestamp", -1)], "idx_agent_id_timestamp"),
        ([("rule.groups", 1), ("timestamp", -1)], "idx_rule_groups_timestamp"),
    ]
    
    for idx_spec, idx_name in indexes:
        try:
            await collection.create_index(idx_spec, name=idx_name)
        except Exception as e:
            print(f"[DB] Warning: Could not create index {idx_name}: {e}")
    
    # Optional text index for full_log
    try:
        await collection.create_index([("full_log", "text")], name="idx_full_log_text")
    except Exception:
        pass  # Index might already exist
    
    print(f"[DB] Indexes ensured on {DB_NAME}.{COLLECTION_NAME}")


def compute_id(alert: Dict[str, Any]) -> str:
    """
    Compute a stable _id for the alert.
    Prefer alert["id"] if present and non-empty.
    Otherwise, build from timestamp|agent.id|rule.id|full_log[:80].
    """
    # Try to use alert's native id first
    alert_id = alert.get("id")
    if alert_id and str(alert_id).strip():
        return str(alert_id)
    
    # Build composite id from key fields
    timestamp = alert.get("timestamp", "")
    agent_id = alert.get("agent", {}).get("id", "")
    rule_id = alert.get("rule", {}).get("id", "")
    full_log = alert.get("full_log", "")[:80]
    
    composite = f"{timestamp}|{agent_id}|{rule_id}|{full_log}"
    return hashlib.sha1(composite.encode()).hexdigest()


def normalize_timestamp(alert: Dict[str, Any]) -> None:
    """
    Normalize timestamp to ISO8601 with timezone (Z).
    Stores both timestamp_raw (original) and timestamp (normalized).
    Handles formats like +0000 (no colon) or Z.
    Mutates the alert dict in-place.
    """
    original_ts = alert.get("timestamp", "")
    alert["timestamp_raw"] = original_ts
    
    if not original_ts:
        # No timestamp, use current time
        alert["timestamp"] = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
        return
    
    try:
        # Parse timestamp (dateutil handles many formats including +0000)
        dt = date_parser.parse(original_ts)
        
        # Convert to UTC if timezone-aware
        if dt.tzinfo is not None:
            dt = dt.astimezone(timezone.utc)
        else:
            # Assume UTC if no timezone
            dt = dt.replace(tzinfo=timezone.utc)
        
        # Format as ISO8601 with Z
        alert["timestamp"] = dt.isoformat().replace("+00:00", "Z")
    except Exception as e:
        # Fallback: keep original and use current time
        print(f"[DB] Warning: Failed to parse timestamp '{original_ts}': {e}")
        alert["timestamp"] = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


async def insert_alert(alert: Dict[str, Any]) -> tuple[bool, str]:
    """
    Insert alert into MongoDB.
    Returns (success: bool, message: str).
    Handles duplicates gracefully.
    """
    collection = get_collection()
    
    try:
        # Normalize timestamp
        normalize_timestamp(alert)
        
        # Compute stable _id
        doc_id = compute_id(alert)
        
        # Add server-side metadata
        alert["_id"] = doc_id
        alert["ingested_at"] = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
        
        # Insert
        await collection.insert_one(alert)
        return True, f"Inserted alert {doc_id}"
    
    except DuplicateKeyError:
        # Already exists - idempotent
        return True, f"Duplicate alert {doc_id} (ignored)"
    
    except Exception as e:
        return False, f"DB error: {str(e)}"


async def close_client() -> None:
    """Close MongoDB client connection (singleton cleanup)."""
    global _client, _client_initialized
    if _client:
        print("[DB] Closing MongoDB client connection...")
        _client.close()
        _client = None
        _client_initialized = False
        print("[DB] ✓ MongoDB client closed")


# ============================================================================
# ML SETTINGS AND PREDICTIONS
# ============================================================================

async def get_settings() -> Dict[str, Any] | None:
    """Get ML settings from database."""
    collection = get_collection("settings")
    settings = await collection.find_one({"_id": "ml_settings"})
    return settings


async def update_settings(patch: Dict[str, Any]) -> Dict[str, Any]:
    """Update ML settings (upsert)."""
    collection = get_collection("settings")
    await collection.update_one(
        {"_id": "ml_settings"},
        {"$set": patch},
        upsert=True
    )
    # Return updated settings
    return await get_settings() or patch


async def insert_prediction(
    event_id: str,
    label: str,
    score: float,
    version: str
) -> None:
    """
    Store ML prediction for an event.
    Updates the alert document with prediction fields.
    """
    alerts_collection = get_collection("alerts")
    await alerts_collection.update_one(
        {"_id": event_id},
        {
            "$set": {
                "predicted_label": label,
                "predicted_score": score,
                "model_version": version,
                "predicted_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
            }
        }
    )


async def load_training_rows() -> tuple:
    """
    Load training data from malicious and safe collections.
    Returns (malicious_cursor, safe_cursor) for streaming.
    """
    malicious_collection = get_collection("malicious")
    safe_collection = get_collection("safe")
    
    # Return cursors for efficient streaming
    malicious_cursor = malicious_collection.find()
    safe_cursor = safe_collection.find()
    
    return (malicious_cursor, safe_cursor)

