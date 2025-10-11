# Wazuh Alert Receiver - FastAPI Backend

A FastAPI backend to receive Wazuh alerts via custom integration hook. Persists alerts to MongoDB with idempotency and returns 200 OK.

## Features

- **POST /events** - Receive and persist Wazuh alerts (Bearer token protected)
- **GET /health** - Health check endpoint
- **MongoDB persistence** - Stores alerts with idempotency (duplicate detection)
- **Indexing** - Automatic index creation for fast queries
- **Timestamp normalization** - Handles various timestamp formats
- CORS enabled (allow-all for testing)
- Console logging with concise summary

## Requirements

- Python 3.11+
- FastAPI
- Uvicorn
- MongoDB 7+
- Motor (async MongoDB driver)

## Installation

### 1. Setup MongoDB in Docker

**🚀 Super Easy Way (Recommended for Beginners):**

```bash
cd backend
docker compose up -d
```

That's it! MongoDB is running with persistent storage.

See [SETUP_EASY.md](SETUP_EASY.md) for the easiest step-by-step guide.

**📘 Manual Way (Advanced Users):**

```bash
# Create persistent volume
docker volume create mongodb_data

# Run MongoDB
docker run -d \
  --name mongodb \
  -p 27017:27017 \
  -v mongodb_data:/data/db \
  mongo:7
```

See [MONGODB_SETUP.md](MONGODB_SETUP.md) for detailed MongoDB setup and management.

### 2. Install Python dependencies

```bash
cd backend
pip install -r requirements.txt
```

### 3. Configure environment

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` with your values:

- `BACKEND_KEY` - Bearer token for authentication (default: "devkey")
- `MONGO_URL` - MongoDB connection string (default: "mongodb://localhost:27017/?replicaSet=rs0")
- `PORT` - Server port (default: 8081)
- `HOST` - Server host (default: 0.0.0.0)
- `PRINT_FULL_JSON` - Print full JSON body (default: false)

## Running

Make sure MongoDB is running first (see MONGODB_SETUP.md).

### Development mode

```bash
# Load env vars and run
export $(cat .env | xargs) && uvicorn app:app --host 0.0.0.0 --port 8081 --reload
```

Or directly:

```bash
BACKEND_KEY=devkey MONGO_URL=mongodb://localhost:27017 uvicorn app:app --host 0.0.0.0 --port 8081 --reload
```

### Production mode

```bash
export $(cat .env | xargs) && uvicorn app:app --host 0.0.0.0 --port 8081 --workers 4
```

Or with a strong token:

```bash
BACKEND_KEY=PUT_A_STRONG_RANDOM_TOKEN MONGO_URL=mongodb://localhost:27017 uvicorn app:app --host 0.0.0.0 --port 8081 --workers 4
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

### Send test alert (using sample file)

```bash
curl -X POST http://127.0.0.1:8081/events \
  -H "Authorization: Bearer devkey" \
  -H "Content-Type: application/json" \
  -d @sample_alert.json
```

Or inline:

```bash
curl -X POST http://127.0.0.1:8081/events \
  -H "Authorization: Bearer devkey" \
  -H "Content-Type: application/json" \
  -d '{
    "timestamp": "2025-10-11T13:29:01.520+0000",
    "rule": {
      "level": 5,
      "description": "PAM: User login failed.",
      "id": "5503"
    },
    "agent": {"id":"001","name":"localagentvm","ip":"10.0.2.15"},
    "id": "1760189341.394888",
    "full_log": "Oct 11 13:28:57 nikpat-VirtualBox sudo[6005]: pam_unix(sudo:auth): authentication failure..."
  }'
```

Expected response:
```json
{"status": "ok"}
```

Expected console output:
```
[WAZUH] ts=2025-10-11T13:29:01.520+0000 agent=localagentvm level=5 desc="PAM: User login failed."
[OK] Inserted alert 1760189341.394888
```

### Test idempotency (send same alert twice)

```bash
# Send first time
curl -X POST http://127.0.0.1:8081/events \
  -H "Authorization: Bearer devkey" \
  -H "Content-Type: application/json" \
  -d @sample_alert.json

# Send again - should deduplicate
curl -X POST http://127.0.0.1:8081/events \
  -H "Authorization: Bearer devkey" \
  -H "Content-Type: application/json" \
  -d @sample_alert.json
```

Both return `{"status": "ok"}`, but only one document is created in MongoDB.

### Verify data in MongoDB

```bash
# Count alerts
docker exec mongodb mongosh --eval "db.getSiblingDB('siem').alerts.countDocuments()"

# View latest alert
docker exec mongodb mongosh --eval "db.getSiblingDB('siem').alerts.find().sort({timestamp: -1}).limit(1).pretty()"

# Check indexes
docker exec mongodb mongosh --eval "db.getSiblingDB('siem').alerts.getIndexes()"
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

2. **Operation result:**
   ```
   [OK] Inserted alert <id>
   ```
   or (on duplicate):
   ```
   (no output - duplicate silently ignored)
   ```

3. **Full JSON body** (optional, only if `PRINT_FULL_JSON=true`)

## MongoDB Schema

### Document Structure

Stored alerts include:

- `_id`: Stable ID (from `alert.id` or SHA1 hash)
- `timestamp`: Normalized ISO8601 with Z
- `timestamp_raw`: Original timestamp string
- `ingested_at`: Server-side ingest timestamp (ISO8601 with Z)
- All original alert fields preserved

### Indexes

Automatically created indexes:

- `{ "timestamp": -1 }` - Sort by time
- `{ "rule.level": -1, "timestamp": -1 }` - Filter by severity
- `{ "agent.id": 1, "timestamp": -1 }` - Filter by agent
- `{ "rule.groups": 1, "timestamp": -1 }` - Filter by rule groups
- `{ "full_log": "text" }` - Text search on logs

### Idempotency

Alerts with the same `_id` are deduplicated:

1. If alert has `id` field, use it as `_id`
2. Otherwise, compute: `SHA1(timestamp|agent.id|rule.id|full_log[:80])`
3. On duplicate, return 200 OK without error

## Field Extraction

The concise summary line extracts fields defensively from the raw Wazuh alert:

- **timestamp**: `timestamp` → `@timestamp` → current time
- **agent**: `agent.name` → `agent.id` → "-"
- **rule_level**: `rule.level` → "-"
- **description**: `rule.description` → `full_log` → "-"

Note: The original implementation expected Kibana `_source` wrapper, but we now accept raw Wazuh alerts.

## Database Management

### Clear all alerts (for testing)
```bash
docker exec mongodb mongosh --eval "db.getSiblingDB('siem').alerts.deleteMany({})"
```

### Query by agent
```bash
docker exec mongodb mongosh --eval "
  db.getSiblingDB('siem').alerts.find({'agent.id': '001'}).count()
"
```

### Query by severity level
```bash
docker exec mongodb mongosh --eval "
  db.getSiblingDB('siem').alerts.find({'rule.level': {\$gte: 7}}).sort({timestamp: -1}).limit(10).pretty()
"
```

## Security Notes

⚠️ **For production use:**

1. Set a strong random token: `BACKEND_KEY=<strong-random-token>`
2. Enable MongoDB authentication (see MONGODB_SETUP.md)
3. Use HTTPS/TLS (deploy behind nginx or use SSL certificates)
4. Restrict CORS to known origins
5. Consider rate limiting
6. Add request validation/sanitization as needed
7. Set up MongoDB backups
8. Use MongoDB Atlas or managed hosting for production

## Integration with Wazuh

Configure your Wazuh integration hook to POST alerts to:
```
http://<your-server>:8081/events
```

Include the Authorization header:
```
Authorization: Bearer <your-backend-key>
```

