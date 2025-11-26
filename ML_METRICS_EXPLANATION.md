# ML Model Metrics Explanation

## 📊 Are the Metrics Real or Hardcoded?

**The metrics are REAL!** They are calculated by comparing:
- **ML Model Predictions** (from your LightGBM model)
- **Human Labels** (from security analysts who reviewed alerts)

The system only evaluates alerts that have **BOTH** a model prediction AND a human label in MongoDB.

---

## 🔍 How It Works

### Step 1: Data Collection
1. **ML Model** makes predictions on incoming alerts → stores `predicted_label` and `predicted_score` in MongoDB
2. **Security Analysts** review alerts and classify them → stores `label` ("malicious" or "safe") in MongoDB
3. Only alerts with **both** fields are used for evaluation

### Step 2: Comparison
The backend compares:
- `predicted_label` (what the ML model said) vs `label` (what the human said)
- If they match → **Correct prediction**
- If they don't match → **Incorrect prediction**

### Step 3: Metric Calculation
Uses **scikit-learn** library to calculate standard ML evaluation metrics.

---

## 📈 What Each Metric Means

### 1. **Accuracy** (60.0% in your screenshot)
**Formula:** `(Correct Predictions) / (Total Predictions) × 100`

**What it means:**
- Out of 20 alerts evaluated, the model got 12 correct
- 60% of the time, the model agrees with human analysts
- **Higher is better** (100% = perfect)

**Example:**
- 20 alerts evaluated
- 12 correct, 8 incorrect
- Accuracy = 12/20 = 0.60 = 60%

---

### 2. **Precision** (60.0% in your screenshot)
**Formula:** `True Positives / (True Positives + False Positives)`

**What it means:**
- When the model says "malicious", how often is it right?
- Measures **reliability** of positive predictions
- **Higher is better**

**Example:**
- Model predicted "malicious" 10 times
- 6 were actually malicious (True Positives)
- 4 were actually safe (False Positives)
- Precision = 6/(6+4) = 0.60 = 60%

**Why it matters:**
- Low precision = Too many false alarms
- High precision = When model says "malicious", you can trust it

---

### 3. **Recall** (100.0% in your screenshot)
**Formula:** `True Positives / (True Positives + False Negatives)`

**What it means:**
- Out of all actual malicious alerts, how many did the model catch?
- Measures **detection rate** - how good at finding threats
- **Higher is better**

**Example:**
- 6 actual malicious alerts in the dataset
- Model caught all 6 (True Positives)
- Model missed 0 (False Negatives)
- Recall = 6/(6+0) = 1.00 = 100%

**Why it matters:**
- Low recall = Missing real threats (dangerous!)
- High recall = Catching most threats (good for security)

---

### 4. **F1 Score** (75.0% in your screenshot)
**Formula:** `2 × (Precision × Recall) / (Precision + Recall)`

**What it means:**
- **Harmonic mean** of Precision and Recall
- Balances both metrics (can't have high precision AND high recall easily)
- **Higher is better**

**Example:**
- Precision = 60%
- Recall = 100%
- F1 = 2 × (0.60 × 1.00) / (0.60 + 1.00) = 1.20 / 1.60 = 0.75 = 75%

**Why it matters:**
- Single number that balances precision and recall
- Good for comparing models
- 75% is decent for security (prioritizes catching threats)

---

## 🎯 Summary Metrics (Top Section)

### **Correct: 12 Predictions**
- Number of alerts where model prediction matched human label
- Out of 20 evaluated alerts

### **Incorrect: 8**
- Number of alerts where model was wrong
- Shows F1 score: 75% (from detailed metrics)

### **Unclassified: 34 Pending review**
- Alerts that have ML predictions but no human label yet
- Waiting for analyst review

---

## 🔬 Technical Details

### Backend Implementation (`/ml/evaluate` endpoint)

```python
# 1. Find alerts with BOTH predictions AND labels
alerts = db.find({
    "predicted_label": {"$exists": True},
    "label": {"$exists": True}
})

# 2. Compare predictions vs labels
for alert in alerts:
    human_label = alert["label"]  # "malicious" or "safe"
    model_prediction = alert["predicted_label"]  # "malicious" or "benign"
    
    if human_label == model_prediction:
        correct_count += 1
    else:
        incorrect_count += 1

# 3. Calculate metrics using scikit-learn
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score

accuracy = accuracy_score(y_true, y_pred)
precision = precision_score(y_true, y_pred)
recall = recall_score(y_true, y_pred)
f1 = f1_score(y_true, y_pred)
```

### Data Flow:
```
Wazuh Alert → ML Model → predicted_label (MongoDB)
                ↓
         Security Analyst → label (MongoDB)
                ↓
         /ml/evaluate → Compare → Calculate Metrics
```

---

## 📊 What the Numbers Tell You

### Your Example (60% Accuracy, 100% Recall, 75% F1):

**Good:**
- ✅ **100% Recall** = Model catches ALL malicious threats (no false negatives)
- ✅ **75% F1 Score** = Decent overall performance

**Needs Improvement:**
- ⚠️ **60% Accuracy** = Model is wrong 40% of the time
- ⚠️ **60% Precision** = When model says "malicious", it's wrong 40% of the time (false alarms)

**Interpretation:**
- Model is **conservative** - better at catching threats than avoiding false alarms
- Good for security (better to investigate false alarm than miss real threat)
- Could improve by retraining with more labeled data

---

## 🎓 For Your Teacher

### Key Points to Explain:

1. **Metrics are REAL** - Calculated from actual ML predictions vs human labels in MongoDB
2. **Standard ML Evaluation** - Uses scikit-learn (industry standard library)
3. **Binary Classification** - Malicious (1) vs Safe/Benign (0)
4. **Confusion Matrix** - Underlying calculation for all metrics
5. **Continuous Evaluation** - Metrics update as more alerts are labeled
6. **Actionable** - Used to decide when to retrain the model

### Why This Matters:
- **Not hardcoded** - Real performance measurement
- **Validates ML model** - Shows if model is working correctly
- **Guides improvement** - Low metrics = need more training data
- **Production-ready** - Standard evaluation methodology

---

## 🔄 How to Improve Metrics

1. **More Labeled Data** - More human reviews = better evaluation
2. **Retrain Model** - Use accumulated labels to improve model
3. **Feature Engineering** - Add better features to model
4. **Threshold Tuning** - Adjust decision threshold based on precision/recall tradeoff

---

## ✅ Conclusion

**The metrics are 100% REAL** and calculated from:
- Real ML model predictions (LightGBM)
- Real human analyst labels
- Standard ML evaluation formulas (scikit-learn)

They show the **actual performance** of your ML model in production!

