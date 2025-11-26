# ML Integration Implementation Summary

## ✅ Files Created

### Core ML Modules
1. **`features.py`** - Feature extraction (9 features matching trained model)
2. **`model_runtime.py`** - Thread-safe model loading and prediction
3. **`trainer.py`** - Retraining logic with MongoDB data
4. **`scheduler.py`** - APScheduler for periodic retraining

### Updates
5. **`db.py`** - Added ML helpers (settings, predictions, training data)
6. **`app.py`** - Integrated ML predictions + new endpoints
7. **`requirements.txt`** - Added ML dependencies

### Documentation & Scripts
8. **`ML_README.md`** - Complete ML documentation
9. **`setup_ml.sh/.bat`** - Setup scripts
10. **`test_ml.sh`** - Test suite
11. **`models/.gitkeep`** - Models directory placeholder

## 🎯 Implementation Details

### Feature Extraction (`features.py`)
- Extracts 9 features from Wazuh alerts
- Handles both raw alerts and `_source` wrapper
- Defensive handling of missing fields
- **Features**: agent_name, srcuser, decoder_name, program_name, rule_groups, rule_description, rule_level, hour_of_day, day_of_week

### Model Runtime (`model_runtime.py`)
- **Thread-safe singleton** pattern
- Atomic model reloading without downtime
- Configurable classification threshold
- Returns predictions with confidence scores
- Graceful degradation if model unavailable

### Trainer (`trainer.py`)
- Loads training data from `malicious` and `safe` collections
- Trains RandomForest with same pipeline as `final_model.py`
- Validates minimum samples (20 total, 5 per class)
- **Promotion logic**: Only promotes if F1 improves by >2%
- Saves versioned models: `authclf-YYYYMMDD-HHMMSS.joblib`
- Atomically updates `models/current.joblib`
- Stores metadata in `models` collection

### Scheduler (`scheduler.py`)
- APScheduler background jobs
- Configurable retraining interval
- Automatic model reload after promotion
- Can enable/disable via settings
- Reschedules when settings change

### Database Updates (`db.py`)
Added:
- `get_settings()` / `update_settings()` - ML configuration
- `insert_prediction()` - Store predictions in alerts
- `load_training_rows()` - Stream training data

### App Integration (`app.py`)

#### Startup
1. Load ML model from `models/current.joblib`
2. Start scheduler with settings from MongoDB
3. Initialize indexes

#### `/events` Endpoint
After inserting alert:
1. Extract features
2. Run ML prediction
3. Store prediction fields: `predicted_label`, `predicted_score`, `model_version`, `predicted_at`
4. **Auto-classify** if enabled and score >= threshold
   - Copies to `malicious` collection
   - Updates `label` field
   - Sets `auto_classified: true`

#### New ML Endpoints

**GET /api/settings**
- Get current ML configuration
- Returns defaults if not set

**PUT /api/settings**
- Update ML settings
- Auto-reschedules retraining
- Updates threshold in model_runtime

**POST /ml/reload**
- Manually reload model
- Optional version path
- Hot-swap without downtime

**POST /ml/train**
- Manually trigger retraining
- Trains on labeled data
- Auto-reloads if promoted

**GET /ml/status**
- Model info (version, loaded status)
- Scheduler status (running, next run)
- Training data counts (malicious, safe)

## 🚀 Setup Instructions

### 1. Prepare Model

```bash
cd backend
# Copy your trained model
cp ../models/final_model.py models/
cp /path/to/malware_model.joblib models/current.joblib
```

### 2. Install Dependencies

```bash
pip install -r requirements.txt
```

### 3. Start Backend

```bash
BACKEND_KEY=devkey uvicorn app:app --host 0.0.0.0 --port 8081 --reload
```

Expected output:
```
[APP] Starting Wazuh Alert Receiver with ML...
[DB] Creating MongoDB client (singleton)...
[DB] ✓ MongoDB client created successfully
[DB] Indexes ensured on siem.alerts
[ML] ✓ Model loaded successfully: current.joblib
[SCHEDULER] ✓ Background scheduler started
[SCHEDULER] ✓ Retraining scheduled every 24 hours
[APP] ✓ Ready to receive alerts with ML predictions
```

## 🧪 Testing Workflow

### Step 1: Check ML Status

```bash
curl http://localhost:8081/ml/status \
  -H "Authorization: Bearer devkey"
```

Expected:
```json
{
  "ok": true,
  "model": {
    "loaded": true,
    "version": "current.joblib",
    "threshold": 0.5
  },
  "scheduler": {
    "running": true,
    "jobs": [...]
  },
  "training_data": {
    "malicious": 0,
    "safe": 0,
    "total": 0
  }
}
```

### Step 2: Send Test Alert

```bash
curl -X POST http://localhost:8081/events \
  -H "Authorization: Bearer devkey" \
  -H "Content-Type: application/json" \
  -d @sample_alert.json
```

Check logs:
```
[WAZUH] ts=2025-10-11T13:29:01.520+0000 agent=localagentvm level=5 desc="PAM: User login failed."
[OK] Inserted alert 1760189341.394888
[ML] Predicted: malicious (score: 0.873, version: current.joblib)
```

Verify in MongoDB:
```bash
docker exec mongodb mongosh --eval "
  db.getSiblingDB('siem').alerts.findOne({}, {
    predicted_label: 1,
    predicted_score: 1,
    model_version: 1,
    predicted_at: 1
  })
"
```

### Step 3: Classify Alerts Manually

```bash
# Classify as malicious
curl -X POST http://localhost:8081/classify \
  -H "Authorization: Bearer devkey" \
  -H "Content-Type: application/json" \
  -d '{"_id": "1760189341.394888", "label": "malicious"}'

# Classify as safe
curl -X POST http://localhost:8081/classify \
  -H "Authorization: Bearer devkey" \
  -H "Content-Type: application/json" \
  -d '{"_id": "another_alert_id", "label": "safe"}'
```

Repeat until you have at least 20 samples (10 malicious, 10 safe).

### Step 4: Trigger Training

```bash
curl -X POST http://localhost:8081/ml/train \
  -H "Authorization: Bearer devkey"
```

Expected response:
```json
{
  "ok": true,
  "result": {
    "promoted": true,
    "version": "authclf-20250113-1430.joblib",
    "metrics": {
      "accuracy": 0.95,
      "precision": 0.93,
      "recall": 0.96,
      "f1_score": 0.94
    },
    "message": "Model promoted to production (F1: 0.94)"
  }
}
```

### Step 5: Enable Auto-Classification

```bash
curl -X PUT http://localhost:8081/api/settings \
  -H "Authorization: Bearer devkey" \
  -H "Content-Type: application/json" \
  -d '{
    "auto_classify": true,
    "confidence_threshold": 0.85,
    "retrain_interval_hours": 12
  }'
```

Now alerts with score >= 0.85 are automatically classified as malicious!

### Step 6: Verify Auto-Classification

Send another alert:
```bash
curl -X POST http://localhost:8081/events \
  -H "Authorization: Bearer devkey" \
  -H "Content-Type: application/json" \
  -d @sample_alert.json
```

Check logs:
```
[ML] Predicted: malicious (score: 0.873, version: authclf-20250113-1430.joblib)
[ML] Auto-classifying as malicious (score: 0.873 >= 0.850)
[ML] ✓ Auto-classified alert 1760189341.394888 as malicious
```

Verify in `malicious` collection:
```bash
docker exec mongodb mongosh --eval "
  db.getSiblingDB('siem').malicious.countDocuments()
"
```

## 📊 MongoDB Collections

### `siem.alerts`
All alerts with predictions:
```json
{
  "_id": "1760189341.394888",
  "rule": {...},
  "agent": {...},
  "predicted_label": "malicious",
  "predicted_score": 0.873,
  "model_version": "authclf-20250113-1430.joblib",
  "predicted_at": "2025-01-13T14:30:00Z",
  "label": "malicious",  // if classified
  "labeled_at": "2025-01-13T14:35:00Z",
  "auto_classified": true  // if auto-classified
}
```

### `siem.malicious`
Training data (malicious samples):
```json
{
  "_id": "...",
  // full alert document
  "label": "malicious",
  "labeled_at": "..."
}
```

### `siem.safe`
Training data (safe samples):
```json
{
  "_id": "...",
  // full alert document
  "label": "benign",
  "labeled_at": "..."
}
```

### `siem.settings`
ML configuration:
```json
{
  "_id": "ml_settings",
  "retrain_interval_hours": 24,
  "confidence_threshold": 0.85,
  "auto_classify": false,
  "scheduler_enabled": true
}
```

### `siem.models`
Model metadata:
```json
{
  "version": "authclf-20250113-1430.joblib",
  "path": "models/authclf-20250113-1430.joblib",
  "metrics": {"accuracy": 0.95, "f1_score": 0.94, ...},
  "is_production": true,
  "promoted_at": "2025-01-13T14:30:00Z",
  "training_samples": 50
}
```

## ⚙️ Configuration

### Environment Variables
```bash
MODEL_PATH=models/current.joblib   # Model location
THRESHOLD=0.5                       # Default classification threshold
BACKEND_KEY=devkey                  # API authentication
```

### MongoDB Settings
Update via `/api/settings`:
- `retrain_interval_hours` - How often to retrain (default: 24)
- `confidence_threshold` - Auto-classify threshold (default: 0.85)
- `auto_classify` - Enable auto-classification (default: false)
- `scheduler_enabled` - Enable periodic retraining (default: true)

## 🔄 Workflow

```
1. Wazuh → /events → Alert stored
                ↓
2. Feature extraction (9 features)
                ↓
3. ML prediction (label + score)
                ↓
4. Store prediction in alert
                ↓
5. If auto_classify && score >= threshold:
   → Copy to malicious collection
   → Update label field
                ↓
6. Analyst reviews → /classify → Training data
                ↓
7. Periodic retraining (24h default)
                ↓
8. Model promotion if F1 improves >2%
                ↓
9. Hot-reload new model
                ↓
10. Loop to step 1
```

## 🎯 Key Features

✅ **Real-time predictions** on every alert  
✅ **Thread-safe** model loading  
✅ **Hot-swapping** without downtime  
✅ **Auto-classification** for high-confidence predictions  
✅ **Periodic retraining** on labeled data  
✅ **Model versioning** with rollback capability  
✅ **Human-in-the-loop** feedback  
✅ **Defensive feature extraction**  
✅ **Atomic file operations**  
✅ **Comprehensive logging**  

## 🛡️ Guard Rails

✅ Feature names/order match trained model  
✅ Missing fields handled defensively (empty strings/0)  
✅ Atomic `current.joblib` updates (temp → rename)  
✅ Thread-safe model reloading  
✅ Minimum sample validation (20 total, 5 per class)  
✅ F1 improvement threshold (2%)  
✅ Prediction failures don't block alert ingestion  
✅ Bearer token authentication on all endpoints  

## 📈 Monitoring

### Check Logs
```bash
# ML events
grep "\[ML\]" backend.log

# Training events
grep "\[TRAINER\]" backend.log

# Scheduler events
grep "\[SCHEDULER\]" backend.log
```

### Check MongoDB
```bash
# Training data counts
docker exec mongodb mongosh --eval "
  print('Malicious:', db.getSiblingDB('siem').malicious.countDocuments());
  print('Safe:', db.getSiblingDB('siem').safe.countDocuments());
"

# Check predictions
docker exec mongodb mongosh --eval "
  db.getSiblingDB('siem').alerts.find({predicted_label: {$exists: true}}).count()
"

# Check auto-classifications
docker exec mongodb mongosh --eval "
  db.getSiblingDB('siem').alerts.find({auto_classified: true}).count()
"
```

### Check Model Files
```bash
ls -lh backend/models/
# current.joblib - Production model
# authclf-*.joblib - Versioned models
```

## 🚨 Troubleshooting

### Model Not Loading
**Symptom**: `[APP] ⚠ ML model not loaded`  
**Solution**: Copy trained model to `models/current.joblib`

### Insufficient Training Data
**Symptom**: `[TRAINER] ValueError: Insufficient training data`  
**Solution**: Classify more alerts via `/classify` (need ≥20 samples)

### Prediction Failures
**Symptom**: `[ML] Warning: Prediction failed`  
**Solution**: Check model file, feature extraction, logs for details

### Feature Mismatch
**Symptom**: Predictions fail with shape mismatch  
**Solution**: Ensure features match trained model exactly

## 📚 References

- `ML_README.md` - Complete documentation
- `final_model.py` - Original training script
- `test_ml.sh` - Test suite
- API docs: http://localhost:8081/docs

## ✅ Implementation Complete!

All requested features implemented:
- ✅ Feature extraction matching joblib
- ✅ Thread-safe model runtime
- ✅ Retraining with MongoDB data
- ✅ Scheduler with configurable intervals
- ✅ Auto-classification for high confidence
- ✅ Hot-swapping without downtime
- ✅ ML endpoints (settings, train, reload, status)
- ✅ Integration with existing `/classify`
- ✅ Comprehensive logging
- ✅ Guard rails and validation

Ready for testing! 🚀

