# ML Integration Documentation

## Overview

This backend integrates an end-to-end ML pipeline for automatic threat classification with human-in-the-loop feedback.

## Architecture

```
Wazuh Alert → /events → Feature Extraction → ML Prediction → MongoDB
                ↓                                ↓
           Stored with                    Auto-classify
           predictions                    (if confident)
                ↓
        Human Review → /classify → Training Data
                                         ↓
                                  Periodic Retraining
                                         ↓
                                   Model Promotion
```

## Setup

### 1. Prepare ML Model

Place your trained model in the `models/` directory:

```bash
# Copy your trained model
cp /path/to/malware_model.joblib backend/models/current.joblib
```

The model must be a scikit-learn pipeline with:
- Input: 9 features (agent_name, srcuser, decoder_name, program_name, rule_groups, rule_description, rule_level, hour_of_day, day_of_week)
- Output: `predict_proba()` with classes [benign, malicious]

### 2. Install Dependencies

```bash
cd backend
pip install -r requirements.txt
```

### 3. Start Backend

```bash
BACKEND_KEY=devkey uvicorn app:app --host 0.0.0.0 --port 8081 --reload
```

## Features

### 1. Automatic ML Predictions

Every alert received via `/events` is automatically:
1. **Feature extracted** - 9 features matching the trained model
2. **Predicted** - Model outputs label (malicious/benign) and confidence score
3. **Stored** - Predictions saved in `alerts` collection:
   ```json
   {
     "_id": "...",
     "predicted_label": "malicious",
     "predicted_score": 0.87,
     "model_version": "current.joblib",
     "predicted_at": "2025-01-13T10:30:45Z"
   }
   ```

### 2. Auto-Classification

Configure via `/api/settings`:

```json
{
  "auto_classify": true,
  "confidence_threshold": 0.85
}
```

When enabled, alerts with `predicted_score >= 0.85` are automatically moved to the `malicious` collection.

### 3. Human-in-the-Loop

Analysts review predictions and provide corrections via `/classify`:

```bash
POST /classify
{
  "_id": "1760189341.394888",
  "label": "malicious"  # or "safe"
}
```

Classified alerts are stored in:
- `siem.malicious` - Malicious alerts (training data)
- `siem.safe` - Safe/benign alerts (training data)

### 4. Periodic Retraining

The scheduler automatically retrains the model:

```json
{
  "retrain_interval_hours": 24,
  "scheduler_enabled": true
}
```

Training process:
1. Load labeled data from `malicious` and `safe` collections
2. Extract features and train RandomForest classifier
3. Evaluate on test set
4. Promote if F1 score improves by >2%
5. Save as `models/authclf-YYYYMMDD-HHMMSS.joblib`
6. Atomically update `models/current.joblib`
7. Hot-reload model without downtime

## API Endpoints

### ML Management

#### GET /ml/status
Get ML system status (model info, scheduler, training data counts)

```bash
curl http://localhost:8081/ml/status \
  -H "Authorization: Bearer devkey"
```

#### GET /api/settings
Get current ML settings

```bash
curl http://localhost:8081/api/settings \
  -H "Authorization: Bearer devkey"
```

#### PUT /api/settings
Update ML settings

```bash
curl -X PUT http://localhost:8081/api/settings \
  -H "Authorization: Bearer devkey" \
  -H "Content-Type: application/json" \
  -d '{
    "retrain_interval_hours": 12,
    "confidence_threshold": 0.90,
    "auto_classify": true
  }'
```

#### POST /ml/reload
Manually reload model

```bash
curl -X POST http://localhost:8081/ml/reload \
  -H "Authorization: Bearer devkey" \
  -H "Content-Type: application/json" \
  -d '{"version_path": "models/authclf-20250113-1430.joblib"}'
```

#### POST /ml/train
Manually trigger retraining

```bash
curl -X POST http://localhost:8081/ml/train \
  -H "Authorization: Bearer devkey"
```

## Testing Workflow

### 1. Seed Training Data

First, classify some alerts manually to create initial training data:

```bash
# Classify alert as malicious
curl -X POST http://localhost:8081/classify \
  -H "Authorization: Bearer devkey" \
  -H "Content-Type: application/json" \
  -d '{"_id": "alert1", "label": "malicious"}'

# Classify alert as safe
curl -X POST http://localhost:8081/classify \
  -H "Authorization: Bearer devkey" \
  -H "Content-Type: application/json" \
  -d '{"_id": "alert2", "label": "safe"}'
```

Need at least 20 samples total (5 per class) for training.

### 2. Trigger Training

```bash
curl -X POST http://localhost:8081/ml/train \
  -H "Authorization: Bearer devkey"
```

Check logs for:
```
[TRAINER] Loaded 25 training samples
[TRAINER] Model trained successfully!
[TRAINER] Metrics: {'accuracy': 0.95, 'f1_score': 0.93, ...}
[TRAINER] ✓ Promoted to production: models/current.joblib
[ML] ✓ Model loaded successfully: authclf-20250113-1430.joblib
```

### 3. Send Test Alert

```bash
curl -X POST http://localhost:8081/events \
  -H "Authorization: Bearer devkey" \
  -H "Content-Type: application/json" \
  -d @sample_alert.json
```

Check logs for ML prediction:
```
[ML] Predicted: malicious (score: 0.873, version: authclf-20250113-1430.joblib)
```

Verify in MongoDB:
```bash
docker exec mongodb mongosh --eval "
  db.getSiblingDB('siem').alerts.findOne({}, {
    predicted_label: 1,
    predicted_score: 1,
    model_version: 1
  })
"
```

### 4. Enable Auto-Classification

```bash
curl -X PUT http://localhost:8081/api/settings \
  -H "Authorization: Bearer devkey" \
  -H "Content-Type: application/json" \
  -d '{
    "auto_classify": true,
    "confidence_threshold": 0.85
  }'
```

Now high-confidence predictions (score >= 0.85) are automatically classified as malicious.

### 5. Monitor Scheduler

```bash
curl http://localhost:8081/ml/status \
  -H "Authorization: Bearer devkey"
```

## Model Files

- `models/current.joblib` - Production model (atomic updates)
- `models/authclf-*.joblib` - Versioned models
- `models/malware_model.joblib` - Original trained model (optional)

## Feature Engineering

The model expects 9 features extracted from Wazuh alerts:

| Feature | Type | Description |
|---------|------|-------------|
| agent_name | categorical | Agent/hostname |
| srcuser | categorical | Source user |
| decoder_name | categorical | Log decoder |
| program_name | categorical | Program name |
| rule_groups | categorical | Semicolon-separated groups |
| rule_description | categorical | Rule description |
| rule_level | numerical | Severity level (0-15) |
| hour_of_day | numerical | Hour (0-23) |
| day_of_week | numerical | Weekday (0-6) |

## Configuration

### Environment Variables

```bash
MODEL_PATH=models/current.joblib  # Model file location
THRESHOLD=0.5                      # Classification threshold
BACKEND_KEY=devkey                 # API authentication
```

### MongoDB Settings Document

```json
{
  "_id": "ml_settings",
  "retrain_interval_hours": 24,
  "confidence_threshold": 0.85,
  "auto_classify": false,
  "scheduler_enabled": true
}
```

## Monitoring

Check ML system health:

```bash
# Check logs for ML events
grep "\[ML\]" backend.log

# Check training data
docker exec mongodb mongosh --eval "
  db.getSiblingDB('siem').malicious.countDocuments()
  db.getSiblingDB('siem').safe.countDocuments()
"

# Check model versions
ls -lh backend/models/
```

## Troubleshooting

### Model Not Loading

```
[APP] ⚠ ML model not loaded (predictions will fail)
```

**Solution**: Copy your trained model to `models/current.joblib`

### Insufficient Training Data

```
[TRAINER] ValueError: Insufficient training data: 10 samples (need 20)
```

**Solution**: Classify more alerts manually via `/classify` endpoint

### Prediction Failures

```
[ML] Warning: Prediction failed: Model not loaded
```

**Solution**: Check model file exists and is valid scikit-learn pipeline

## Best Practices

1. **Start with manual classification** - Build training data before enabling auto-classify
2. **Monitor F1 scores** - Ensure model quality before promotion
3. **Review auto-classifications** - Periodically check false positives
4. **Adjust threshold** - Tune confidence_threshold based on precision/recall needs
5. **Version models** - Keep historical versions for rollback if needed

## Security Notes

- ML endpoints require Bearer token authentication
- Model files should be read-only in production
- Monitor for data poisoning attacks via malicious training data
- Implement rate limiting on `/classify` to prevent abuse

