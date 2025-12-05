#!/bin/bash
# Stop local coordinator and worker system

echo "🛑 Stopping RMA Local Worker System"
echo ""

# Stop worker container
if docker ps -q -f name=rma-worker-local > /dev/null 2>&1; then
    echo "📦 Stopping worker container..."
    docker stop rma-worker-local
    docker rm rma-worker-local
    echo "✅ Worker stopped"
else
    echo "ℹ️  No worker container running"
fi

# Stop coordinator
if curl -s http://localhost:8080/health > /dev/null 2>&1; then
    echo "📦 Stopping coordinator..."
    pkill -f "uvicorn app:app --host 0.0.0.0 --port 8080" || true
    sleep 2
    echo "✅ Coordinator stopped"
else
    echo "ℹ️  Coordinator not running"
fi

# Clean up log files
if [ -f coordinator.log ]; then
    echo "🧹 Cleaning up logs..."
    rm -f coordinator.log
fi

echo ""
echo "✅ System stopped"
