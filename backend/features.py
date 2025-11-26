"""
Feature extraction matching the exact LightGBM training pipeline.
Must match the structure from your Jupyter notebook.
"""
from datetime import datetime, timezone
from typing import Dict, Any


def _parse_ts(ts: str) -> datetime:
    """
    Parse Wazuh timestamp: "2025-09-23T17:48:19.409+0000"
    """
    if not ts:
        return datetime.now(timezone.utc)
    
    # Handle +0000 format (no colon in timezone)
    ts = ts.replace("+0000", "+00:00")
    
    # Handle Z format
    if ts.endswith("Z"):
        ts = ts[:-1] + "+00:00"
    
    try:
        return datetime.fromisoformat(ts)
    except Exception:
        return datetime.now(timezone.utc)


def extract_features(alert: Dict[str, Any]) -> Dict[str, Any]:
    """
    Extract features from Wazuh alert matching LightGBM training format.
    
    Features (EXACT order from notebook):
    1. agent_name (categorical)
    2. srcuser (categorical)
    3. decoder_name (categorical)
    4. program_name (categorical)
    5. rule_groups (categorical - semicolon separated)
    6. rule_level (numerical)
    7. hour_of_day (numerical)
    8. day_of_week (numerical)
    9. success (numerical - 0 or 1)
    """
    # Get data (handle both _source wrapper and raw format)
    source = alert.get("_source", alert)
    
    # Extract nested structures safely
    agent = source.get("agent") or {}
    rule = source.get("rule") or {}
    data = source.get("data") or {}
    decoder = source.get("decoder") or {}
    predecoder = source.get("predecoder") or {}
    
    # Parse timestamp
    ts = source.get("timestamp", "")
    dt = _parse_ts(ts) if ts else datetime.now(timezone.utc)
    
    # Process rule groups
    groups = rule.get("groups", [])
    if isinstance(groups, list):
        groups_str = ";".join(groups)
    else:
        groups_str = str(groups)
    
    # Determine success from rule groups
    # success = 1 if "authentication_success" in groups, else 0
    success = 1 if "authentication_success" in groups_str else 0
    
    # Build feature dict (MUST match training order!)
    features = {
        "agent_name": str(agent.get("name", "")),
        "srcuser": str(data.get("srcuser", "")),
        "decoder_name": str(decoder.get("name", "")),
        "program_name": str(predecoder.get("program_name", "")),
        "rule_groups": groups_str,
        "rule_level": int(rule.get("level", 0)),
        "hour_of_day": dt.hour,
        "day_of_week": dt.weekday(),
        "success": success
    }
    
    return features

