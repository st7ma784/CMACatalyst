#!/bin/bash

# Quick stop script for local development
set -e

echo "🛑 Stopping CMA System Local Development Environment"
echo "===================================================="

# Stop all services
docker-compose -f docker-compose.local.yml down

echo "🧹 Cleaning up stopped containers..."
docker container prune -f

echo "✅ All services stopped"
echo ""
echo "💡 To start again, run: ./scripts/local-gpu-deploy.sh"
echo "🗑️  To remove all data: docker-compose -f docker-compose.local.yml down -v"