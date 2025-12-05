#!/bin/bash
# Start local coordinator and worker system for testing

set -e

echo "🚀 Starting RMA Local Worker System"
echo ""

# Check if coordinator is already running
if curl -s http://localhost:8080/health > /dev/null 2>&1; then
    echo "✅ Coordinator already running at http://localhost:8080"
else
    echo "📦 Starting coordinator..."
    cd services/local-coordinator
    
    # Check if uvicorn is installed
    if ! python3 -c "import uvicorn" 2>/dev/null; then
        echo "   Installing coordinator dependencies..."
        pip3 install -r requirements.txt
    fi
    
    # Start coordinator in background
    nohup python3 -m uvicorn app:app --host 0.0.0.0 --port 8080 > ../../coordinator.log 2>&1 &
    COORDINATOR_PID=$!
    echo "   Coordinator starting (PID: $COORDINATOR_PID)"
    
    # Wait for coordinator to be ready
    echo "   Waiting for coordinator to be ready..."
    for i in {1..30}; do
        if curl -s http://localhost:8080/health > /dev/null 2>&1; then
            echo "✅ Coordinator ready at http://localhost:8080"
            break
        fi
        sleep 1
    done
    
    cd ../..
fi

echo ""
echo "🔧 Building universal worker container..."
cd worker-containers/universal-worker

if docker build -t universal-worker:local . ; then
    echo "✅ Universal worker container built"
else
    echo "❌ Failed to build worker container"
    exit 1
fi

cd ../..

echo ""
echo "🚀 Starting universal worker (auto-detection mode)..."
docker run -d \
    --name rma-worker-local \
    --network host \
    --gpus all \
    -e COORDINATOR_URL=http://localhost:8080 \
    -e WORKER_TYPE=auto \
    -e USE_TUNNEL=false \
    universal-worker:local

echo ""
echo "✅ System started!"
echo ""
echo "📊 View coordinator logs:    tail -f coordinator.log"
echo "📊 View worker logs:         docker logs -f rma-worker-local"
echo "🌐 Coordinator dashboard:    http://localhost:8080/docs"
echo "🔍 Check worker status:      curl http://localhost:8080/api/admin/workers | jq"
echo ""
echo "🛑 To stop:"
echo "   docker stop rma-worker-local && docker rm rma-worker-local"
echo "   kill \$(cat coordinator.pid) 2>/dev/null || pkill -f 'uvicorn app:app'"
