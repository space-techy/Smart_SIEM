#!/bin/bash
# Simple script to start MongoDB for Wazuh Alert Receiver
# Usage: ./start-mongodb.sh

echo "================================================"
echo "Starting MongoDB for Wazuh Alert Receiver"
echo "================================================"
echo ""

# Check if docker compose is available
if command -v docker compose &> /dev/null; then
    DOCKER_COMPOSE="docker compose"
elif command -v docker-compose &> /dev/null; then
    DOCKER_COMPOSE="docker-compose"
else
    echo "❌ Error: Docker Compose is not installed"
    echo "Please install Docker Compose first"
    exit 1
fi

echo "🐳 Starting MongoDB container..."
$DOCKER_COMPOSE up -d

echo ""
echo "⏳ Waiting for MongoDB to be ready..."
sleep 3

echo ""
echo "================================================"
echo "✅ MongoDB is ready!"
echo "================================================"
echo ""
echo "Connection URL: mongodb://localhost:27017"
echo ""
echo "Quick commands:"
echo "  Stop MongoDB:    docker compose stop"
echo "  Start MongoDB:   docker compose start"
echo "  View logs:       docker compose logs -f mongodb"
echo "  Remove all:      docker compose down -v"
echo ""

