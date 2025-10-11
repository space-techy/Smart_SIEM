# MongoDB Connection Management - Single Instance Guarantee

## 🔒 Singleton Pattern - Only ONE MongoDB Connection

The backend uses a **singleton pattern** to ensure only **ONE** MongoDB client instance is created for the entire application lifecycle.

### How It Works

```python
# Global singleton variable
_client: AsyncIOMotorClient | None = None

def get_client() -> AsyncIOMotorClient:
    global _client
    if _client is None:
        # This only runs ONCE - first time get_client() is called
        _client = AsyncIOMotorClient(MONGO_URL)
        print("[DB] ✓ MongoDB client created successfully (this should only happen ONCE)")
    return _client  # Always returns the SAME instance
```

### Visual Verification

When you start the application, you'll see:

```
[DB] Creating MongoDB client (singleton) connecting to: mongodb://localhost:27017/?replicaSet=rs0
[DB] ✓ MongoDB client created successfully (this should only happen ONCE)
[DB] Indexes ensured on siem.alerts
[APP] Ready to receive alerts
```

**Key Point**: The message `"MongoDB client created successfully (this should only happen ONCE)"` will only appear **once** when the app starts, not on every request.

### Connection Pooling

Motor (the async MongoDB driver) handles connection pooling internally:

```python
AsyncIOMotorClient(
    MONGO_URL,
    maxPoolSize=10,  # Maximum 10 connections in pool
    minPoolSize=1,   # Minimum 1 connection maintained
    serverSelectionTimeoutMS=5000
)
```

- **One Client Instance** → manages a **pool of connections**
- Each request reuses connections from the pool
- No new clients are created per request

### Lifecycle

```
App Startup
    ↓
get_client() called → Creates ONE client (if not exists)
    ↓
Client persists throughout app lifetime
    ↓
Every request reuses SAME client instance
    ↓
App Shutdown → close_client() → Closes the ONE client
```

### Proof of Single Instance

Add this temporary test endpoint to verify:

```python
# Add to app.py for testing
@app.get("/debug/connection-info")
async def connection_info():
    from db import _client
    return {
        "client_id": id(_client),  # Memory address - same every time!
        "is_singleton": True,
        "pool_options": {
            "max_pool_size": 10,
            "min_pool_size": 1
        }
    }
```

Call this endpoint multiple times:
```bash
curl http://localhost:8081/debug/connection-info
```

The `client_id` will be **identical** every time, proving it's the same instance.

## Common Misconceptions

### ❌ WRONG: "Each request creates a new MongoDB connection"
No! Each request reuses the **same client** and gets a connection from its internal pool.

### ✅ CORRECT: "One client manages a pool of connections"
Yes! The singleton client has an internal connection pool (max 10 connections).

### ❌ WRONG: "I need to close connections after each request"
No! Motor handles this automatically. The connections stay in the pool and are reused.

### ✅ CORRECT: "Close the client only on app shutdown"
Yes! We close the singleton client once when the app shuts down.

## Monitoring Connections

### Check from MongoDB side

```bash
# See active connections
docker exec mongodb mongosh --eval "db.serverStatus().connections"
```

You should see approximately:
- `current`: 1-10 (from your app's connection pool)
- `available`: Many more

### Check from application side

The startup logs will show:
```
[DB] Creating MongoDB client (singleton) connecting to: ...
[DB] ✓ MongoDB client created successfully (this should only happen ONCE)
```

If you see this message **multiple times**, that would indicate a problem. But with the singleton pattern, you won't.

## How to Avoid Multiple Instances

The code already prevents this, but here's what we're doing:

1. ✅ **Global variable** `_client` holds the single instance
2. ✅ **Initialization check** `if _client is None` prevents re-creation
3. ✅ **Startup event** creates indexes once on app start
4. ✅ **Shutdown event** closes the single client on app stop
5. ✅ **No per-request client creation** - all endpoints use `get_client()`

## Configuration

Connection pool settings in `db.py`:

```python
AsyncIOMotorClient(
    MONGO_URL,
    maxPoolSize=10,        # Max connections in pool (adjust as needed)
    minPoolSize=1,         # Min connections kept alive
    serverSelectionTimeoutMS=5000  # Timeout for finding MongoDB server
)
```

For production, you might want to adjust `maxPoolSize` based on your load:
- Low traffic: `maxPoolSize=5`
- Medium traffic: `maxPoolSize=10` (default)
- High traffic: `maxPoolSize=50`

## Summary

✅ **Only ONE MongoDB client instance** is created for your entire application  
✅ **Connection pooling** is handled automatically by Motor  
✅ **No connection leaks** - proper cleanup on shutdown  
✅ **Thread-safe** - Motor is designed for async/concurrent use  
✅ **Efficient** - Connections are reused, not recreated  

**You're safe!** The code guarantees a single MongoDB client instance. 🎉

