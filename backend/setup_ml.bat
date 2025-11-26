@echo off
REM Setup script for ML integration (Windows)

echo ======================================
echo ML Integration Setup
echo ======================================
echo.

REM Check if models directory exists
if not exist "models" (
    mkdir models
    echo Created models\ directory
)

REM Check for existing malware_model.joblib
if exist "models\malware_model.joblib" (
    echo Found models\malware_model.joblib
    
    REM Copy to current.joblib if it doesn't exist
    if not exist "models\current.joblib" (
        copy models\malware_model.joblib models\current.joblib
        echo Copied to models\current.joblib
    ) else (
        echo models\current.joblib already exists (not overwriting)
    )
) else (
    echo models\malware_model.joblib not found
    echo Please copy your trained model to:
    echo   backend\models\malware_model.joblib
    echo OR
    echo   backend\models\current.joblib
)

echo.
echo ======================================
echo Installing Python Dependencies
echo ======================================
echo.

REM Install dependencies
pip install -r requirements.txt

echo.
echo ======================================
echo Setup Complete!
echo ======================================
echo.
echo To start the backend with ML:
echo   set BACKEND_KEY=devkey
echo   uvicorn app:app --host 0.0.0.0 --port 8081 --reload
echo.
echo Check ML status:
echo   curl http://localhost:8081/ml/status -H "Authorization: Bearer devkey"
echo.
echo See ML_README.md for full documentation
echo.
pause

