# ML Quick Start Guide

## 🚀 5-Minute Setup

### 1. Copy Your Model
```bash
cd backend
cp /path/to/your/malware_model.joblib models/current.joblib
```

### 2. Install & Run
```bash
pip install -r requirements.txt
BACKEND_KEY=devkey uvicorn app:app --host 0.0.0.0 --port 8081 --reload
```

### 3. Verify
```bash
curl http://localhost:8081/ml/status -H "Authorization: Bearer devkey"
```

## ✅ Testing Checklist

### [ ] 1. Send Alert with ML Prediction
```bash
curl -X POST http://localhost:8081/events \
  -H "Authorization: Bearer devkey" \
  -H "Content-Type: application/json" \
  -d @sample_alert.json
```

Look for: `[ML] Predicted: malicious (score: 0.873, version: current.joblib)`

### [ ] 2. Verify Prediction Stored
```bash
docker exec mongodb mongosh --eval "
  db.getSiblingDB('siem').alerts.findOne({}, {
    predicted_label: 1,
    predicted_score: 1
  })
"
```

### [ ] 3. Classify Alerts (Build Training Data)
```bash
# Classify 10+ as malicious
curl -X POST http://localhost:8081/classify \
  -H "Authorization: Bearer devkey" \
  -H "Content-Type: application/json" \
  -d '{"_id": "ALERT_ID", "label": "malicious"}'

# Classify 10+ as safe
curl -X POST http://localhost:8081/classify \
  -H "Authorization: Bearer devkey" \
  -H "Content-Type: application/json" \
  -d '{"_id": "ALERT_ID", "label": "safe"}'
```

### [ ] 4. Trigger Training
```bash
curl -X POST http://localhost:8081/ml/train \
  -H "Authorization: Bearer devkey"
```

Look for: `"promoted": true` and new model version

### [ ] 5. Enable Auto-Classification
```bash
curl -X PUT http://localhost:8081/api/settings \
  -H "Authorization: Bearer devkey" \
  -H "Content-Type: application/json" \
  -d '{
    "auto_classify": true,
    "confidence_threshold": 0.85
  }'
```

### [ ] 6. Verify Auto-Classification
Send another alert and check logs for:
```
[ML] Auto-classifying as malicious (score: 0.873 >= 0.850)
[ML] ✓ Auto-classified alert XXXXX as malicious
```

## 📊 Key Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/ml/status` | GET | System status, training data counts |
| `/api/settings` | GET | Get ML configuration |
| `/api/settings` | PUT | Update ML configuration |
| `/ml/train` | POST | Trigger retraining |
| `/ml/reload` | POST | Reload model |

## 🔧 Common Settings

```json
{
  "retrain_interval_hours": 24,    // How often to retrain
  "confidence_threshold": 0.85,     // Auto-classify threshold
  "auto_classify": false,           // Enable auto-classification
  "scheduler_enabled": true         // Enable periodic retraining
}
```

## 📁 File Structure

```
backend/
├── features.py           # Feature extraction
├── model_runtime.py      # Model loading & prediction
├── trainer.py            # Retraining logic
├── scheduler.py          # Periodic retraining
├── app.py                # FastAPI app (ML integrated)
├── db.py                 # MongoDB helpers (ML additions)
└── models/
    ├── current.joblib    # Production model
    └── authclf-*.joblib  # Versioned models
```

## 🎯 Expected Log Messages

### Startup
```
[APP] Starting Wazuh Alert Receiver with ML...
[ML] ✓ Model loaded successfully: current.joblib
[SCHEDULER] ✓ Retraining scheduled every 24 hours
[APP] ✓ Ready to receive alerts with ML predictions
```

### Alert Received
```
[WAZUH] ts=... agent=... level=5 desc="..."
[OK] Inserted alert XXXXX
[ML] Predicted: malicious (score: 0.873, version: current.joblib)
```

### Auto-Classification
```
[ML] Auto-classifying as malicious (score: 0.873 >= 0.850)
[ML] ✓ Auto-classified alert XXXXX as malicious
```

### Training
```
[TRAINER] Loaded 25 training samples
[TRAINER] Training RandomForest classifier...
[TRAINER] Model trained successfully!
[TRAINER] Metrics: {'accuracy': 0.95, 'f1_score': 0.94}
[TRAINER] ✓ Promoted to production: models/current.joblib
[ML] ✓ Model loaded successfully: authclf-20250113-1430.joblib
```

## 🚨 Troubleshooting

### Model Not Found
```
[APP] ⚠ ML model not loaded (predictions will fail)
```
**Fix**: `cp models/malware_model.joblib models/current.joblib`

### Insufficient Data
```
[TRAINER] ValueError: Insufficient training data: 10 samples (need 20)
```
**Fix**: Classify more alerts via `/classify` endpoint

### Prediction Errors
```
[ML] Warning: Prediction failed: Model not loaded
```
**Fix**: Check model file exists and is valid sklearn pipeline

## 📈 Monitoring Commands

```bash
# Check ML status
curl http://localhost:8081/ml/status \
  -H "Authorization: Bearer devkey" | jq .

# Check training data counts
docker exec mongodb mongosh --eval "
  print('Malicious:', db.getSiblingDB('siem').malicious.countDocuments());
  print('Safe:', db.getSiblingDB('siem').safe.countDocuments());
"

# Check predictions
docker exec mongodb mongosh --eval "
  db.getSiblingDB('siem').alerts.find({
    predicted_label: {\$exists: true}
  }).count()
"

# View logs
tail -f backend.log | grep "\[ML\]"
```

## 🎓 Next Steps

1. **Accumulate Training Data**: Classify 50+ alerts manually
2. **Tune Threshold**: Adjust `confidence_threshold` based on precision/recall
3. **Monitor Performance**: Check F1 scores after retraining
4. **Enable Scheduler**: Set `retrain_interval_hours` to 24 or 12
5. **Review Auto-Classifications**: Periodically check false positives

## 📚 Full Documentation

- `ML_IMPLEMENTATION_SUMMARY.md` - Complete implementation details
- `ML_README.md` - Detailed user guide
- FastAPI docs: http://localhost:8081/docs

---

**Ready!** Your ML integration is complete and functional. 🎉

