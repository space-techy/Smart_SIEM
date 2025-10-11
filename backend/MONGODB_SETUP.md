# MongoDB Setup Guide

This guide shows you how to run MongoDB in Docker with **persistent data storage** (data survives container restarts).

## Quick Start - MongoDB in Docker with Persistent Volume

### 1. Run MongoDB with Replica Set (Persistent Storage)

```bash
# Create a Docker volume for persistent storage
docker volume create mongodb_data

# Run MongoDB with persistent volume
docker run -d \
  --name mongodb \
  -p 27017:27017 \
  -v mongodb_data:/data/db \
  mongo:7
```

### 2. Verify MongoDB is Running

```bash
# Check container status
docker ps | grep mongodb

# Check MongoDB is responding
docker exec mongodb mongosh --eval "db.adminCommand('ping')"
```

Expected output:
```
{ ok: 1 }
```

## Managing MongoDB Container

### Stop MongoDB (data persists)
```bash
docker stop mongodb
```

### Start MongoDB again (data is preserved)
```bash
docker start mongodb
```

### View MongoDB logs
```bash
docker logs mongodb -f
```

### Remove MongoDB container (data still persists in volume)
```bash
docker stop mongodb
docker rm mongodb

# To start again with same data, run the docker run command from step 1
```

### Remove MongoDB data volume (WARNING: deletes all data)
```bash
docker volume rm mongodb_data
```

## Connection Strings

### From your host machine (Python app running locally)
```
MONGO_URL=mongodb://localhost:27017
```

### From inside Docker network
```
MONGO_URL=mongodb://mongodb:27017
```

## Verifying Data Persistence

1. Insert some data:
```bash
docker exec mongodb mongosh --eval "
  use siem;
  db.alerts.insertOne({test: 'data', timestamp: new Date()});
  db.alerts.countDocuments();
"
```

2. Stop the container:
```bash
docker stop mongodb
```

3. Start it again:
```bash
docker start mongodb
```

4. Check the data is still there:
```bash
docker exec mongodb mongosh --eval "
  use siem;
  db.alerts.countDocuments();
  db.alerts.find({test: 'data'}).limit(1);
"
```

## Inspecting Alerts

### Count alerts
```bash
docker exec mongodb mongosh --eval "db.getSiblingDB('siem').alerts.countDocuments()"
```

### View latest alerts
```bash
docker exec mongodb mongosh --eval "
  db.getSiblingDB('siem').alerts.find().sort({timestamp: -1}).limit(5).pretty()
"
```

### Check indexes
```bash
docker exec mongodb mongosh --eval "db.getSiblingDB('siem').alerts.getIndexes()"
```

### Clear all alerts (for testing)
```bash
docker exec mongodb mongosh --eval "db.getSiblingDB('siem').alerts.deleteMany({})"
```

## Backup and Restore

### Backup database
```bash
docker exec mongodb mongodump --db siem --out /dump
docker cp mongodb:/dump ./mongodb_backup
```

### Restore database
```bash
docker cp ./mongodb_backup mongodb:/dump
docker exec mongodb mongorestore /dump
```

## Troubleshooting

### MongoDB won't start
```bash
# Check logs
docker logs mongodb

# Common issue: port 27017 already in use
# Solution: stop existing MongoDB or use different port
docker run -d --name mongodb -p 27018:27017 -v mongodb_data:/data/db mongo:7
# Then use: MONGO_URL=mongodb://localhost:27018
```

### Connection refused from Python app
```bash
# Check MongoDB is listening
docker exec mongodb mongosh --eval "db.adminCommand({connectionStatus: 1})"

# Check your MONGO_URL in .env
cat .env
```

## Production Recommendations

For production use, consider:

1. **Authentication**: Add username/password
```bash
docker run -d \
  --name mongodb \
  -p 27017:27017 \
  -v mongodb_data:/data/db \
  -e MONGO_INITDB_ROOT_USERNAME=admin \
  -e MONGO_INITDB_ROOT_PASSWORD=strongpassword \
  mongo:7 \
  --replSet rs0 \
  --bind_ip_all
```

2. **Resource Limits**:
```bash
docker run -d \
  --name mongodb \
  -p 27017:27017 \
  -v mongodb_data:/data/db \
  --memory="2g" \
  --cpus="2" \
  mongo:7 \
  --replSet rs0 \
  --bind_ip_all
```

3. **Health Checks**: Add `--health-cmd` to docker run

4. **Monitoring**: Use MongoDB Atlas or self-hosted monitoring tools

5. **Backups**: Set up automated backups with cron jobs

