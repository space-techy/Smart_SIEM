#!/bin/bash
# Setup script for ML integration

echo "======================================"
echo "ML Integration Setup"
echo "======================================"
echo ""

# Check if models directory exists
if [ ! -d "models" ]; then
    mkdir -p models
    echo "✓ Created models/ directory"
fi

# Check for existing malware_model.joblib
if [ -f "models/malware_model.joblib" ]; then
    echo "✓ Found models/malware_model.joblib"
    
    # Copy to current.joblib if it doesn't exist
    if [ ! -f "models/current.joblib" ]; then
        cp models/malware_model.joblib models/current.joblib
        echo "✓ Copied to models/current.joblib"
    else
        echo "⚠ models/current.joblib already exists (not overwriting)"
    fi
else
    echo "⚠ models/malware_model.joblib not found"
    echo "  Please copy your trained model to:"
    echo "  backend/models/malware_model.joblib"
    echo "  OR"
    echo "  backend/models/current.joblib"
fi

echo ""
echo "======================================"
echo "Installing Python Dependencies"
echo "======================================"
echo ""

# Install dependencies
pip install -r requirements.txt

echo ""
echo "======================================"
echo "Setup Complete!"
echo "======================================"
echo ""
echo "To start the backend with ML:"
echo "  BACKEND_KEY=devkey uvicorn app:app --host 0.0.0.0 --port 8081 --reload"
echo ""
echo "Check ML status:"
echo "  curl http://localhost:8081/ml/status -H 'Authorization: Bearer devkey'"
echo ""
echo "See ML_README.md for full documentation"
echo ""

