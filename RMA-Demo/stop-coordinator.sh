#!/bin/bash

# Stop RMA Coordinator and Cloudflare Tunnel

echo "🛑 Stopping RMA Coordinator..."

if [ -f ".coordinator.pid" ]; then
    source .coordinator.pid

    if [ ! -z "$COORDINATOR_PID" ]; then
        if ps -p $COORDINATOR_PID > /dev/null; then
            echo "  Stopping coordinator (PID: $COORDINATOR_PID)..."
            kill $COORDINATOR_PID
            echo "  ✅ Coordinator stopped"
        else
            echo "  ⚠️  Coordinator process not running"
        fi
    fi

    if [ ! -z "$TUNNEL_PID" ]; then
        if ps -p $TUNNEL_PID > /dev/null; then
            echo "  Stopping tunnel (PID: $TUNNEL_PID)..."
            kill $TUNNEL_PID
            echo "  ✅ Tunnel stopped"
        else
            echo "  ⚠️  Tunnel process not running"
        fi
    fi

    rm .coordinator.pid
else
    echo "⚠️  No PID file found. Searching for processes..."

    # Try to find and kill coordinator
    COORDINATOR_PID=$(pgrep -f "uvicorn app.main:app")
    if [ ! -z "$COORDINATOR_PID" ]; then
        echo "  Found coordinator (PID: $COORDINATOR_PID)"
        kill $COORDINATOR_PID
        echo "  ✅ Coordinator stopped"
    fi

    # Try to find and kill tunnel
    TUNNEL_PID=$(pgrep -f "cloudflared tunnel.*rma-api")
    if [ ! -z "$TUNNEL_PID" ]; then
        echo "  Found tunnel (PID: $TUNNEL_PID)"
        kill $TUNNEL_PID
        echo "  ✅ Tunnel stopped"
    fi
fi

echo ""
echo "✅ Shutdown complete"
