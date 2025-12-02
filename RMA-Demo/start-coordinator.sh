#!/bin/bash

# Start RMA Coordinator with Cloudflare Tunnel
# This script starts both the coordinator service and the tunnel

set -e

# Check if tunnel config exists
if [ ! -f "tunnel-api.yml" ]; then
    echo "❌ Tunnel config not found. Run ./setup-api-tunnel.sh first"
    exit 1
fi

# Check if coordinator service exists
if [ ! -d "coordinator-service" ]; then
    echo "❌ Coordinator service directory not found"
    exit 1
fi

echo "🚀 Starting RMA Coordinator with Cloudflare Tunnel"
echo "=================================================="
echo ""

# Start coordinator in background
echo "📡 Starting coordinator service..."
cd coordinator-service

# Create virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    echo "📦 Creating virtual environment..."
    python3 -m venv venv

    echo "📦 Installing dependencies..."
    ./venv/bin/pip install --upgrade pip
    ./venv/bin/pip install -r requirements.txt
else
    # Check if dependencies are installed
    if ! ./venv/bin/python -c "import uvicorn" 2>/dev/null; then
        echo "📦 Installing dependencies..."
        ./venv/bin/pip install -r requirements.txt
    fi
fi

echo "✅ Using virtual environment at coordinator-service/venv"

# Start coordinator using venv python
nohup ./venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8080 > ../coordinator.log 2>&1 &
COORDINATOR_PID=$!
echo "✅ Coordinator started (PID: $COORDINATOR_PID)"
echo "   Logs: tail -f coordinator.log"

# Wait for coordinator to be ready
echo ""
echo "⏳ Waiting for coordinator to be ready..."
sleep 3

# Test coordinator
if curl -s http://localhost:8080/health > /dev/null 2>&1; then
    echo "✅ Coordinator is healthy"
else
    echo "⚠️  Coordinator may not be ready yet, continuing anyway..."
fi

cd ..

# Start tunnel
echo ""
echo "🔒 Starting Cloudflare Tunnel..."
TUNNEL_NAME=$(grep "^tunnel:" tunnel-api.yml | awk '{print $2}')

nohup cloudflared tunnel --config tunnel-api.yml run rma-api > tunnel.log 2>&1 &
TUNNEL_PID=$!
echo "✅ Tunnel started (PID: $TUNNEL_PID)"
echo "   Logs: tail -f tunnel.log"

# Wait for tunnel to establish
echo ""
echo "⏳ Waiting for tunnel to establish..."
sleep 5

echo ""
echo "🎉 RMA Coordinator is now running!"
echo ""
echo "Coordinator: http://localhost:8080"
echo "Public API:  https://api.rmatool.org.uk"
echo ""
echo "Process IDs:"
echo "  Coordinator: $COORDINATOR_PID"
echo "  Tunnel:      $TUNNEL_PID"
echo ""
echo "To stop:"
echo "  kill $COORDINATOR_PID $TUNNEL_PID"
echo ""
echo "Or use: ./stop-coordinator.sh"
echo ""
echo "Test the deployment:"
echo "  curl https://api.rmatool.org.uk/health"
echo ""

# Save PIDs for stop script
cat > .coordinator.pid << EOF
COORDINATOR_PID=$COORDINATOR_PID
TUNNEL_PID=$TUNNEL_PID
EOF

echo "✅ Ready to accept worker connections!"
