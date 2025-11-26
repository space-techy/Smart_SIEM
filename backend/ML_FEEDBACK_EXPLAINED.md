# ML Feedback Page - Real vs Mock Metrics

## 🔄 How It Works Now (REAL DATA!)

### Before (Mock Data)
❌ The metrics were **just UI state** - fake calculations based on hardcoded mock data  
❌ No connection to actual ML model performance  
❌ Numbers changed only when you clicked buttons in the UI  

### After (Real ML Evaluation)
✅ **Real metrics** calculated from **MongoDB data**  
✅ Compares **ML predictions** vs **human labels**  
✅ Shows **actual model performance** on your data  
✅ Updates when you classify more alerts  

---

## 📊 What the ML Feedback Page Shows Now

### 1️⃣ **Real Model Accuracy** (from MongoDB)

The backend queries your database:

```javascript
// Query: Find all alerts with BOTH prediction AND human label
db.alerts.find({
  predicted_label: {$exists: true},  // ML predicted this
  label: {$exists: true}              // Human classified this
})
```

Then compares:
```
ML said: "malicious" (score: 0.87)
Human said: "malicious"
→ ✅ CORRECT!

ML said: "benign" (score: 0.32)
Human said: "malicious"
→ ❌ INCORRECT!
```

### 2️⃣ **Real Metrics Calculated**

```python
# From your actual MongoDB data!
accuracy = correct_predictions / total_evaluated
precision = true_positives / (true_positives + false_positives)
recall = true_positives / (true_positives + false_negatives)
f1_score = 2 * (precision * recall) / (precision + recall)
```

**Example Output:**
```json
{
  "evaluated": 45,
  "metrics": {
    "accuracy": 0.911,      // 91.1% correct
    "precision": 0.875,     // 87.5% precision
    "recall": 0.933,        // 93.3% recall
    "f1_score": 0.903,      // 90.3% F1
    "correct": 41,
    "incorrect": 4,
    "by_class": {
      "malicious": {
        "correct": 28,      // Model correctly predicted 28 malicious
        "incorrect": 2,     // Model missed 2 malicious
        "total": 30
      },
      "safe": {
        "correct": 13,      // Model correctly predicted 13 safe
        "incorrect": 2,     // Model wrongly called 2 safe as malicious
        "total": 15
      }
    }
  }
}
```

---

## 🎯 Example Scenario

### Initial State: No Labels Yet

**ML Feedback Page Shows:**
```
Model Accuracy: 0%
(No alerts with both predictions and human labels)
```

### After Classifying 10 Alerts

You classify 10 alerts in the Dashboard:
- 7 malicious
- 3 safe

**Backend GET /ml/evaluate:**
```javascript
// Finds 10 alerts with both predicted_label and label
// Compares them:
ML predicted: [M, M, M, M, S, M, S, M, M, S]
Human said:   [M, M, M, S, S, M, S, M, M, S]
                         ❌              ❌
// 2 incorrect out of 10 = 80% accuracy
```

**ML Feedback Page Shows:**
```
Model Accuracy: 80.0%
Correct Predictions: 8
Incorrect Predictions: 2
F1 Score: 85.7%

Real ML performance (evaluated on 10 labeled alerts)
```

### After Classifying 50 Alerts

**ML Feedback Page Shows:**
```
Model Accuracy: 92.0%
Correct Predictions: 46
Incorrect Predictions: 4
F1 Score: 91.2%

Real ML performance (evaluated on 50 labeled alerts)
```

---

## 🎨 What You See in the UI

### Top Section: Performance Cards

```
┌─────────────────────────────────────────────────────────────┐
│  Model Accuracy     Correct Preds    Incorrect     Unclassified │
│     92.0%               46               4              35       │
│  Real ML perf     Mal: 30 | Safe: 16  F1: 91.2%    Awaiting   │
└─────────────────────────────────────────────────────────────┘
```

### New Section: Detailed Metrics (Blue Card)

```
┌─────────────────────────────────────────────────────────────┐
│  ✓ Real ML Model Performance on 50 Labeled Alerts           │
├─────────────────────────────────────────────────────────────┤
│  Accuracy    Precision     Recall      F1 Score              │
│   92.00%      89.50%      94.20%       91.80%               │
├─────────────────────────────────────────────────────────────┤
│  Evaluated on alerts with both ML predictions and human     │
│  labels from MongoDB                                        │
│  [Refresh Metrics] button                                   │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔍 How to Use It

### Step 1: Send Alerts
```bash
curl -X POST http://localhost:8081/events \
  -H "Authorization: Bearer devkey" \
  -d @sample_alert.json
```
→ Alert gets **ML prediction** automatically

### Step 2: Classify Alerts (in UI or via API)
- Go to Dashboard or ML Feedback
- Click "Malicious" or "Safe"
- This creates **human labels**

### Step 3: View Real Metrics
- Open ML Feedback page
- See **real accuracy** calculated from MongoDB
- Shows how well the model matches human judgment

### Step 4: Refresh Metrics
Click "Refresh Metrics" button to recalculate based on latest data

---

## 📊 What Gets Evaluated

### Alerts Included in Metrics:
✅ Have `predicted_label` (ML ran on them)  
✅ Have `label` (human classified them)  

### Alerts NOT Included:
❌ Only ML prediction (no human label yet)  
❌ Only human label (no ML prediction)  
❌ Neither (old data before ML)  

### Example Query:
```javascript
// These alerts are evaluated
{
  "_id": "alert1",
  "predicted_label": "malicious",  // ✓ ML said malicious
  "predicted_score": 0.87,
  "label": "malicious",            // ✓ Human said malicious
  "labeled_at": "..."
}
// Result: ✅ CORRECT (match)

{
  "_id": "alert2",
  "predicted_label": "benign",     // ✓ ML said safe
  "predicted_score": 0.23,
  "label": "malicious",            // ✓ Human said malicious
  "labeled_at": "..."
}
// Result: ❌ INCORRECT (mismatch) - FALSE NEGATIVE
```

---

## 🎯 Real-World Example

### Your MongoDB After 1 Week:

```
siem.alerts: 100 total alerts
  - 60 have predicted_label (ML ran)
  - 45 have label (human classified)
  - 40 have BOTH → These 40 are evaluated!
  
Results:
  - 36/40 correct = 90% accuracy ✅
  - 4/40 incorrect = model needs improvement
```

**ML Feedback Page Shows:**
```
Model Accuracy: 90.0%
Evaluated on 40 labeled alerts from MongoDB

Breakdown:
- Malicious: 25 correct, 2 incorrect
- Safe: 11 correct, 2 incorrect
```

---

## ✨ Key Benefits

### 1. **Real Performance Tracking**
- See how your model actually performs
- Not fake UI numbers

### 2. **Historical Data Works**
- Evaluates all existing MongoDB data
- Not just current session

### 3. **Continuous Monitoring**
- Click "Refresh Metrics" anytime
- See if model improves after retraining

### 4. **Actionable Insights**
- High incorrect count → Need more training data
- Low accuracy → Model needs retraining
- F1 score trends → Track improvements over time

---

## 🧪 Test It

```bash
# 1. Send alerts (they get predictions)
curl -X POST http://localhost:8081/events \
  -H "Authorization: Bearer devkey" \
  -d @sample_alert.json

# 2. Classify some alerts (creates labels)
curl -X POST http://localhost:8081/classify \
  -H "Authorization: Bearer devkey" \
  -d '{"_id": "alert_id", "label": "malicious"}'

# 3. Evaluate model
curl http://localhost:8081/ml/evaluate \
  -H "Authorization: Bearer devkey"
```

**Response:**
```json
{
  "ok": true,
  "evaluated": 15,
  "metrics": {
    "accuracy": 0.867,
    "precision": 0.85,
    "recall": 0.90,
    "f1_score": 0.874,
    "correct": 13,
    "incorrect": 2,
    "by_class": {
      "malicious": {"correct": 9, "incorrect": 1, "total": 10},
      "safe": {"correct": 4, "incorrect": 1, "total": 5}
    }
  },
  "misclassified_samples": [
    {
      "id": "...",
      "human_label": "malicious",
      "predicted_label": "benign",
      "predicted_score": 0.23,
      "correct": false
    }
  ]
}
```

---

## 📈 What You Can Do With Real Metrics

### Monitor Model Health
- Track accuracy over time
- See if retraining improves performance

### Find Problem Cases
- `misclassified_samples` shows worst mistakes
- Focus analyst review on error-prone cases

### Tune Threshold
- If too many false positives → increase threshold
- If too many false negatives → decrease threshold

### Decide When to Retrain
- Low F1 score → Time to retrain with more data
- High accuracy → Model is working well

---

## 🎉 Summary

**Before:** Fake metrics, UI-only calculations  
**After:** Real ML evaluation on MongoDB data  

The ML Feedback page now shows:
✅ **Real accuracy** from model vs human labels  
✅ **Actual performance** on your MongoDB data  
✅ **Precision, Recall, F1** scores  
✅ **Confusion matrix** breakdown  
✅ **Per-class** performance (malicious vs safe)  
✅ **Top misclassified** samples for review  

**Your ML Feedback page is now a real performance monitoring dashboard!** 🚀

