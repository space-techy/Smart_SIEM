"""
FastAPI backend to receive Wazuh alerts via custom integration hook.
Prints incoming JSON and returns 200 OK.
"""
import json
import os
from datetime import datetime
from typing import Any, Dict

from fastapi import FastAPI, HTTPException, Header, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

# Configuration from environment
BACKEND_KEY = os.getenv("BACKEND_KEY", "devkey")
PORT = int(os.getenv("PORT", "8081"))
HOST = os.getenv("HOST", "0.0.0.0")

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
    # Extract timestamp
    ts = extract_field(alert_data, "_source.timestamp", "@timestamp")
    if not ts:
        ts = datetime.utcnow().isoformat() + "Z"
    
    # Extract agent info
    agent = extract_field(
        alert_data, 
        "_source.agent.name", 
        "_source.agent.id"
    )
    if not agent:
        agent = "-"
    
    # Extract rule level
    rule_level = extract_field(alert_data, "_source.rule.level")
    if rule_level is None:
        rule_level = "-"
    
    # Extract description
    desc = extract_field(
        alert_data,
        "_source.rule.description",
        "_source.full_log"
    )
    if not desc:
        desc = "-"
    
    # Truncate description to 120 chars and remove newlines
    desc_str = str(desc).replace("\n", " ").replace("\r", "")[:120]
    
    return f'[WAZUH] ts={ts} agent={agent} level={rule_level} desc="{desc_str}"'


@app.get("/")
def home():
    """Home endpoint."""
    return {"message": "Welcome to the Wazuh Alert Receiver"}

@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"ok": True}


@app.post("/events")
async def receive_event(request: Request, authorization: str | None = Header(None)):
    """
    Receive Wazuh alert events.
    Requires Bearer token authentication.
    """
    # Verify authorization
    verify_token(authorization)
    
    # Parse JSON body (accept any structure)
    try:
        alert_data = await request.json()
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON")
    
    # Print concise console line
    console_line = format_console_line(alert_data)
    print(console_line)
    
    # Print full JSON (pretty)
    print(json.dumps(alert_data, indent=2))
    print()  # Empty line for readability
    
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn
    print(f"Starting Wazuh Alert Receiver on {HOST}:{PORT}")
    print(f"Using BACKEND_KEY: {'*' * (len(BACKEND_KEY) - 4)}{BACKEND_KEY[-4:]}")
    uvicorn.run(app, host=HOST, port=PORT)

