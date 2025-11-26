#!/bin/bash
# Test script for ML integration

API_URL="http://localhost:8081"
API_KEY="devkey"

echo "======================================"
echo "ML Integration Test Suite"
echo "======================================"
echo ""

# Test 1: Health Check
echo "1. Testing health endpoint..."
curl -s $API_URL/health | jq .
echo ""

# Test 2: ML Status
echo "2. Checking ML status..."
curl -s $API_URL/ml/status \
  -H "Authorization: Bearer $API_KEY" | jq .
echo ""

# Test 3: Get Settings
echo "3. Getting ML settings..."
curl -s $API_URL/api/settings \
  -H "Authorization: Bearer $API_KEY" | jq .
echo ""

# Test 4: Send Test Alert
echo "4. Sending test alert..."
if [ -f "sample_alert.json" ]; then
    curl -s -X POST $API_URL/events \
      -H "Authorization: Bearer $API_KEY" \
      -H "Content-Type: application/json" \
      -d @sample_alert.json | jq .
    echo ""
else
    echo "⚠ sample_alert.json not found, skipping"
fi

# Test 5: Check Alert with Prediction
echo "5. Checking alerts with predictions..."
echo "Run in MongoDB:"
echo '  docker exec mongodb mongosh --eval "db.getSiblingDB('"'"'siem'"'"').alerts.findOne({}, {predicted_label: 1, predicted_score: 1, model_version: 1})"'
echo ""

# Test 6: Classify an Alert
echo "6. To classify an alert manually:"
echo '  curl -X POST '$API_URL'/classify \'
echo '    -H "Authorization: Bearer '$API_KEY'" \'
echo '    -H "Content-Type: application/json" \'
echo '    -d '"'"'{"_id": "ALERT_ID", "label": "malicious"}'"'"
echo ""

# Test 7: Training
echo "7. To trigger training (need at least 20 labeled samples):"
echo '  curl -X POST '$API_URL'/ml/train \'
echo '    -H "Authorization: Bearer '$API_KEY'"'
echo ""

# Test 8: Update Settings
echo "8. To update ML settings:"
echo '  curl -X PUT '$API_URL'/api/settings \'
echo '    -H "Authorization: Bearer '$API_KEY'" \'
echo '    -H "Content-Type: application/json" \'
echo '    -d '"'"'{"auto_classify": true, "confidence_threshold": 0.85}'"'"
echo ""

echo "======================================"
echo "Test Complete!"
echo "======================================"

