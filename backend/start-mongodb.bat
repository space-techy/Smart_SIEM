@echo off
REM Simple script to start MongoDB for Wazuh Alert Receiver (Windows)
REM Usage: start-mongodb.bat

echo ================================================
echo Starting MongoDB for Wazuh Alert Receiver
echo ================================================
echo.

REM Check if docker compose is available
where docker >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo Error: Docker is not installed
    echo Please install Docker Desktop first
    exit /b 1
)

echo Starting MongoDB container...
docker compose up -d

echo.
echo Waiting for MongoDB to be ready...
timeout /t 3 /nobreak >nul

echo.
echo ================================================
echo MongoDB is ready!
echo ================================================
echo.
echo Connection URL: mongodb://localhost:27017
echo.
echo Quick commands:
echo   Stop MongoDB:    docker compose stop
echo   Start MongoDB:   docker compose start
echo   View logs:       docker compose logs -f mongodb
echo   Remove all:      docker compose down -v
echo.

