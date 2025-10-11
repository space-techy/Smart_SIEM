# 🚀 Super Easy Setup - For Beginners

Get MongoDB running in **ONE command**! No manual volume creation, no replica set initialization needed.

## Prerequisites

- Docker installed ([Get Docker Desktop](https://www.docker.com/products/docker-desktop))
- That's it! 🎉

## Option 1: Using Helper Script (Recommended)

### For Linux/Mac:

```bash
cd backend
chmod +x start-mongodb.sh
./start-mongodb.sh
```

### For Windows:

```cmd
cd backend
start-mongodb.bat
```

**Done!** MongoDB is running with persistent storage. Skip to [Step 2: Install Python Dependencies](#step-2-install-python-dependencies).

## Option 2: Using Docker Compose Directly

### Single Command:

```bash
cd backend
docker compose up -d
```

That's it! This will:
- ✅ Create a persistent volume automatically
- ✅ Start MongoDB
- ✅ Keep your data safe (survives restarts)

### Verify it's running:

```bash
docker compose ps
```

Expected output:
```
NAME                 IMAGE     STATUS    PORTS
wazuh_mongodb        mongo:7   Up        0.0.0.0:27017->27017/tcp
```

## Step 2: Install Python Dependencies

```bash
pip install -r requirements.txt
```

## Step 3: Run the Backend

```bash
BACKEND_KEY=devkey MONGO_URL=mongodb://localhost:27017 uvicorn app:app --host 0.0.0.0 --port 8081 --reload
```

Or use the `.env` file:

```bash
cp .env.example .env
# Edit .env if needed
export $(cat .env | xargs) && uvicorn app:app --host 0.0.0.0 --port 8081 --reload
```

## Step 4: Test It!

```bash
# Health check
curl http://localhost:8081/health

# Send test alert
curl -X POST http://localhost:8081/events \
  -H "Authorization: Bearer devkey" \
  -H "Content-Type: application/json" \
  -d @sample_alert.json
```

## Managing MongoDB

### Stop MongoDB (data is safe)
```bash
docker compose stop
```

### Start MongoDB again
```bash
docker compose start
```

### View logs
```bash
docker compose logs -f mongodb
```

### Restart MongoDB
```bash
docker compose restart mongodb
```

### Remove everything (including data)
```bash
docker compose down -v
```

⚠️ **Warning**: The `-v` flag deletes the volume and ALL your data!

## Where is My Data?

Your data is stored in a Docker volume named `wazuh_backend_mongodb_data`.

### Check volume info:
```bash
docker volume inspect wazuh_backend_mongodb_data
```

### Backup your data:
```bash
docker compose exec mongodb mongodump --out /dump
docker compose cp mongodb:/dump ./backup
```

### Restore from backup:
```bash
docker compose cp ./backup mongodb:/dump
docker compose exec mongodb mongorestore /dump
```

## Troubleshooting

### Port 27017 already in use

Someone else is using that port. Check what's running:

**Windows:**
```cmd
netstat -ano | findstr :27017
```

**Linux/Mac:**
```bash
lsof -i :27017
```

**Solution 1**: Stop the other MongoDB service  
**Solution 2**: Change the port in `docker-compose.yml`:

```yaml
ports:
  - "27018:27017"  # Change 27017 to 27018
```

Then use: `MONGO_URL=mongodb://localhost:27018`

### MongoDB won't start

```bash
# Check logs
docker compose logs mongodb

# Try removing and starting fresh
docker compose down -v
docker compose up -d
```

### Cannot connect from Python app

```bash
# Check MongoDB is running
docker compose ps

# Check MongoDB is healthy
docker compose exec mongodb mongosh --eval "db.adminCommand('ping')"

# Check from Python side - make sure MONGO_URL is correct
echo $MONGO_URL  # Should be: mongodb://localhost:27017
```

## Complete Example Session

```bash
# 1. Start MongoDB
cd backend
docker compose up -d

# 2. Wait a moment for startup
sleep 3

# 3. Install Python packages
pip install -r requirements.txt

# 4. Start the backend
BACKEND_KEY=devkey MONGO_URL=mongodb://localhost:27017 \
  uvicorn app:app --host 0.0.0.0 --port 8081 --reload

# 5. In another terminal, test it
curl http://localhost:8081/health
curl -X POST http://localhost:8081/events \
  -H "Authorization: Bearer devkey" \
  -H "Content-Type: application/json" \
  -d @sample_alert.json

# 6. Check data in MongoDB
docker compose exec mongodb mongosh --eval "db.getSiblingDB('siem').alerts.countDocuments()"
```

## That's It! 🎉

You now have:
- ✅ MongoDB running in Docker
- ✅ Persistent storage (survives restarts)
- ✅ FastAPI backend connected
- ✅ Alerts being saved to database

## Next Steps

- Configure Wazuh to send alerts to `http://your-server:8081/events`
- Set a strong `BACKEND_KEY` in production
- Read [README.md](README.md) for full documentation
- Read [MONGODB_SETUP.md](MONGODB_SETUP.md) for advanced MongoDB management

