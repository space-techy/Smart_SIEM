# Quick Start Guide

Get up and running in 5 minutes!

## Step 1: Start MongoDB

**🚀 Easy Way (Recommended):**

```bash
cd backend
docker compose up -d
```

Done! MongoDB is running with persistent storage. Continue to Step 2.

**📘 Manual Way:**

```bash
cd backend

# Create persistent volume
docker volume create mongodb_data

# Run MongoDB with replica set
docker run -d \
  --name mongodb \
  -p 27017:27017 \
  -v mongodb_data:/data/db \
  mongo:7

# Wait 3 seconds for MongoDB to start
sleep 3
```

## Step 2: Install Python Dependencies

```bash
cd backend
pip install -r requirements.txt
```

## Step 3: Run the Backend

```bash
BACKEND_KEY=devkey MONGO_URL=mongodb://localhost:27017 uvicorn app:app --host 0.0.0.0 --port 8081 --reload
```

Expected output:
```
[APP] Starting Wazuh Alert Receiver...
[DB] Creating MongoDB client (singleton) connecting to: mongodb://localhost:27017
[DB] ✓ MongoDB client created successfully (this should only happen ONCE)
[DB] Indexes ensured on siem.alerts
[APP] Ready to receive alerts
INFO:     Uvicorn running on http://0.0.0.0:8081 (Press CTRL+C to quit)
```

**Important**: The message `"MongoDB client created successfully (this should only happen ONCE)"` appears **only once** at startup. This proves only ONE MongoDB connection is created, not one per request!

## Step 4: Test It!

### Health Check

```bash
curl http://localhost:8081/health
```

Expected: `{"ok":true}`

### Send Test Alert

```bash
curl -X POST http://localhost:8081/events \
  -H "Authorization: Bearer devkey" \
  -H "Content-Type: application/json" \
  -d @sample_alert.json
```

Expected: `{"status":"ok"}`

Console output:
```
[WAZUH] ts=2025-10-11T13:29:01.520+0000 agent=localagentvm level=5 desc="PAM: User login failed."
[OK] Inserted alert 1760189341.394888
```

### Send Same Alert Again (Test Idempotency)

```bash
curl -X POST http://localhost:8081/events \
  -H "Authorization: Bearer devkey" \
  -H "Content-Type: application/json" \
  -d @sample_alert.json
```

Expected: `{"status":"ok"}` (no duplicate created)

Console output:
```
[WAZUH] ts=2025-10-11T13:29:01.520+0000 agent=localagentvm level=5 desc="PAM: User login failed."
```

Note: No "[OK] Inserted" message because it's a duplicate.

### Verify Data in MongoDB

```bash
# Count documents
docker exec mongodb mongosh --eval "db.getSiblingDB('siem').alerts.countDocuments()"
```

Expected: `1`

```bash
# View the alert
docker exec mongodb mongosh --eval "db.getSiblingDB('siem').alerts.find().pretty()"
```

## Step 5: Clean Up (Optional)

### Stop Backend
Press `CTRL+C` in the terminal running uvicorn.

### Stop MongoDB (data persists)
```bash
docker stop mongodb
```

### Start MongoDB Again (data is preserved)
```bash
docker start mongodb
```

### Remove Everything (including data)
```bash
docker stop mongodb
docker rm mongodb
docker volume rm mongodb_data
```

## Next Steps

- Read [README.md](README.md) for full documentation
- Read [MONGODB_SETUP.md](MONGODB_SETUP.md) for MongoDB management
- Configure Wazuh to send alerts to your endpoint
- Set a strong `BACKEND_KEY` for production
- Enable MongoDB authentication for production

## Troubleshooting

### Port 27017 already in use
```bash
# Check what's using the port
netstat -ano | findstr :27017  # Windows
lsof -i :27017                  # Linux/Mac

# Either stop the existing service or use a different port
docker run -d --name mongodb -p 27018:27017 -v mongodb_data:/data/db mongo:7 --replSet rs0 --bind_ip_all

# Then use: MONGO_URL=mongodb://localhost:27018/?replicaSet=rs0
```

### Cannot connect to MongoDB
```bash
# Check MongoDB is running
docker ps | grep mongodb

# Check MongoDB logs
docker logs mongodb

# Reinitialize replica set
docker exec mongodb mongosh --eval "rs.initiate()"
```

### 401 Unauthorized
Make sure your `BACKEND_KEY` matches in both the server and curl command.

### 502 Database error
Check MongoDB is running and accessible. Check server logs for details.

