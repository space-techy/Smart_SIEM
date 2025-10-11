# Wazuh Alert Receiver - FastAPI Backend

A minimal FastAPI backend to receive Wazuh alerts via custom integration hook. Prints incoming JSON to console and returns 200 OK.

## Features

- **POST /events** - Receive Wazuh alerts (Bearer token protected)
- **GET /health** - Health check endpoint
- CORS enabled (allow-all for testing)
- Console logging with concise summary + full JSON output
- No storage - just logging for now

## Requirements

- Python 3.11+
- FastAPI
- Uvicorn

## Installation

```bash
pip install -r requirements.txt
```

## Configuration

Configure via environment variables:

- `BACKEND_KEY` - Bearer token for authentication (default: "devkey")
- `PORT` - Server port (default: 8081)
- `HOST` - Server host (default: 0.0.0.0)

## Running

### Development mode

```bash
BACKEND_KEY=devkey uvicorn app:app --host 0.0.0.0 --port 8081
```

Or with hot reload:

```bash
BACKEND_KEY=devkey uvicorn app:app --host 0.0.0.0 --port 8081 --reload
```

### Production mode

```bash
BACKEND_KEY=PUT_A_STRONG_RANDOM_TOKEN uvicorn app:app --host 0.0.0.0 --port 8081 --workers 4
```

## Testing

### Health check

```bash
curl http://127.0.0.1:8081/health
```

Expected response:
```json
{"ok": true}
```

### Send test alert

```bash
curl -X POST http://127.0.0.1:8081/events \
  -H "Authorization: Bearer devkey" \
  -H "Content-Type: application/json" \
  -d '{
    "_source":{
      "timestamp":"2025-09-23T17:48:19.409Z",
      "agent":{"id":"001","name":"localagentvm","ip":"10.0.2.15"},
      "rule":{"id":"5503","level":5,"description":"PAM: User login failed."},
      "decoder":{"name":"pam"},
      "full_log":"pam_unix(sudo:auth): authentication failure ..."
    }
  }'
```

Expected response:
```json
{"status": "ok"}
```

Expected console output:
```
[WAZUH] ts=2025-09-23T17:48:19.409Z agent=localagentvm level=5 desc="PAM: User login failed."
{
  "_source": {
    "timestamp": "2025-09-23T17:48:19.409Z",
    "agent": {
      "id": "001",
      "name": "localagentvm",
      "ip": "10.0.2.15"
    },
    "rule": {
      "id": "5503",
      "level": 5,
      "description": "PAM: User login failed."
    },
    "decoder": {
      "name": "pam"
    },
    "full_log": "pam_unix(sudo:auth): authentication failure ..."
  }
}
```

### Test authentication

Without token (should fail with 401):
```bash
curl -X POST http://127.0.0.1:8081/events \
  -H "Content-Type: application/json" \
  -d '{"test": "data"}'
```

With wrong token (should fail with 401):
```bash
curl -X POST http://127.0.0.1:8081/events \
  -H "Authorization: Bearer wrongtoken" \
  -H "Content-Type: application/json" \
  -d '{"test": "data"}'
```

## API Documentation

Once the server is running, visit:
- Swagger UI: http://127.0.0.1:8081/docs
- ReDoc: http://127.0.0.1:8081/redoc

## Output Format

For each received alert, the server prints:

1. **Concise summary line:**
   ```
   [WAZUH] ts=<timestamp> agent=<agent_name> level=<rule_level> desc="<first 120 chars>"
   ```

2. **Full JSON body** (pretty-printed with 2-space indent)

## Field Extraction

The concise summary line extracts fields defensively:

- **timestamp**: `_source.timestamp` → `@timestamp` → current time
- **agent**: `_source.agent.name` → `_source.agent.id` → "-"
- **rule_level**: `_source.rule.level` → "-"
- **description**: `_source.rule.description` → `_source.full_log` → "-"

## Security Notes

⚠️ **For production use:**

1. Set a strong random token: `BACKEND_KEY=<strong-random-token>`
2. Use HTTPS/TLS (deploy behind nginx or use SSL certificates)
3. Restrict CORS to known origins
4. Consider rate limiting
5. Add request validation/sanitization as needed

## Integration with Wazuh

Configure your Wazuh integration hook to POST alerts to:
```
http://<your-server>:8081/events
```

Include the Authorization header:
```
Authorization: Bearer <your-backend-key>
```

