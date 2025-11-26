"""
Model versioning system - like Git for ML models.
Tracks all model versions, allows rollback, and maintains history.
"""
import os
import shutil
import json
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
import joblib
from pathlib import Path


MODELS_DIR = "models"
VERSIONS_DIR = os.path.join(MODELS_DIR, "versions")
METADATA_FILE = os.path.join(MODELS_DIR, "versions.json")
CURRENT_MODEL = os.path.join(MODELS_DIR, "current.joblib")


def ensure_directories():
    """Create necessary directories if they don't exist."""
    os.makedirs(MODELS_DIR, exist_ok=True)
    os.makedirs(VERSIONS_DIR, exist_ok=True)


def get_version_filename(version_id: Optional[str] = None) -> str:
    """Generate version filename with timestamp."""
    if version_id:
        return f"model-{version_id}.joblib"
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    return f"model-{timestamp}.joblib"


def save_model_version(
    pipeline,
    metrics: Dict[str, float],
    training_samples: int,
    notes: str = ""
) -> Dict[str, Any]:
    """
    Save a new model version with metadata.
    
    Returns:
        {
            "version_id": str,
            "filename": str,
            "path": str,
            "metrics": dict,
            "created_at": str,
            "is_production": bool
        }
    """
    ensure_directories()
    
    # Generate version
    version_id = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    filename = get_version_filename(version_id)
    version_path = os.path.join(VERSIONS_DIR, filename)
    
    # Save model
    joblib.dump(pipeline, version_path)
    print(f"[VERSIONING] Saved model version: {version_path}")
    
    # Load existing versions metadata
    versions = load_all_versions()
    
    # Mark previous production as not production
    for v in versions:
        if v.get("is_production", False):
            v["is_production"] = False
            v["promoted_until"] = datetime.now(timezone.utc).isoformat()
    
    # Create new version metadata
    version_metadata = {
        "version_id": version_id,
        "filename": filename,
        "path": version_path,
        "metrics": metrics,
        "training_samples": training_samples,
        "notes": notes,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "is_production": True,
        "promoted_at": datetime.now(timezone.utc).isoformat()
    }
    
    # Add to versions list
    versions.append(version_metadata)
    
    # Save metadata
    save_versions_metadata(versions)
    
    # Promote to production (copy to current.joblib)
    promote_version(version_id)
    
    return version_metadata


def promote_version(version_id: str) -> bool:
    """
    Promote a version to production (current.joblib).
    Returns True if successful.
    """
    ensure_directories()
    
    versions = load_all_versions()
    version = next((v for v in versions if v["version_id"] == version_id), None)
    
    if not version:
        print(f"[VERSIONING] ERROR: Version {version_id} not found")
        return False
    
    version_path = version["path"]
    
    if not os.path.exists(version_path):
        print(f"[VERSIONING] ERROR: Model file not found: {version_path}")
        return False
    
    # Mark all as not production
    for v in versions:
        if v.get("is_production", False):
            v["is_production"] = False
            v["promoted_until"] = datetime.now(timezone.utc).isoformat()
    
    # Mark this as production
    version["is_production"] = True
    version["promoted_at"] = datetime.now(timezone.utc).isoformat()
    
    # Copy to current.joblib (atomic operation)
    temp_path = CURRENT_MODEL + ".tmp"
    shutil.copy2(version_path, temp_path)
    os.replace(temp_path, CURRENT_MODEL)
    
    # Save metadata
    save_versions_metadata(versions)
    
    print(f"[VERSIONING] ✓ Promoted version {version_id} to production")
    return True


def load_all_versions() -> List[Dict[str, Any]]:
    """Load all version metadata from file."""
    if not os.path.exists(METADATA_FILE):
        return []
    
    try:
        with open(METADATA_FILE, 'r') as f:
            return json.load(f)
    except Exception as e:
        print(f"[VERSIONING] Warning: Could not load versions metadata: {e}")
        return []


def save_versions_metadata(versions: List[Dict[str, Any]]):
    """Save version metadata to file."""
    ensure_directories()
    
    # Sort by created_at (newest first)
    versions.sort(key=lambda x: x.get("created_at", ""), reverse=True)
    
    with open(METADATA_FILE, 'w') as f:
        json.dump(versions, f, indent=2)


def get_production_version() -> Optional[Dict[str, Any]]:
    """Get the current production version."""
    versions = load_all_versions()
    return next((v for v in versions if v.get("is_production", False)), None)


def get_version(version_id: str) -> Optional[Dict[str, Any]]:
    """Get a specific version by ID."""
    versions = load_all_versions()
    return next((v for v in versions if v["version_id"] == version_id), None)


def list_versions(limit: int = 50) -> List[Dict[str, Any]]:
    """List all versions, sorted by date (newest first)."""
    versions = load_all_versions()
    return versions[:limit]


def delete_version(version_id: str) -> bool:
    """
    Delete a version (cannot delete production version).
    Returns True if successful.
    """
    versions = load_all_versions()
    version = next((v for v in versions if v["version_id"] == version_id), None)
    
    if not version:
        return False
    
    if version.get("is_production", False):
        print(f"[VERSIONING] ERROR: Cannot delete production version")
        return False
    
    # Delete file
    if os.path.exists(version["path"]):
        os.remove(version["path"])
        print(f"[VERSIONING] Deleted model file: {version['path']}")
    
    # Remove from metadata
    versions = [v for v in versions if v["version_id"] != version_id]
    save_versions_metadata(versions)
    
    print(f"[VERSIONING] ✓ Deleted version {version_id}")
    return True


def get_version_file_size(version_path: str) -> int:
    """Get file size in bytes."""
    if os.path.exists(version_path):
        return os.path.getsize(version_path)
    return 0

