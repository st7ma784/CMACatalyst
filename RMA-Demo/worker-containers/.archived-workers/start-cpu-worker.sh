#!/bin/bash

# Start CPU Worker for RMA distributed system

set -e

cd "$(dirname "$0")/cpu-worker"

echo "🚀 Starting RMA CPU Worker"
echo "=========================="
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker first."
    exit 1
fi

# Check if cloudflared is installed
if ! command -v cloudflared &> /dev/null; then
    echo "⚠️  cloudflared not found. Install it for tunnel support:"
    echo "   wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb"
    echo "   sudo dpkg -i cloudflared-linux-amd64.deb"
    echo ""
    echo "Continuing anyway (worker will use IP address)..."
    echo ""
fi

# Check if network exists, create if not
if ! docker network inspect rma-network > /dev/null 2>&1; then
    echo "📡 Creating Docker network: rma-network"
    docker network create rma-network
fi

# Display configuration
echo "Configuration:"
echo "  Coordinator: https://api.rmatool.org.uk"
echo "  Tunnel: Enabled"
echo "  Service: upload-service:8103"
echo ""

# Build and start
echo "🔨 Building worker image..."
docker compose build

echo ""
echo "▶️  Starting worker container..."
docker compose up -d

echo ""
echo "✅ CPU Worker started!"
echo ""
echo "View logs:"
echo "  docker compose logs -f"
echo ""
echo "Stop worker:"
echo "  docker compose down"
echo ""
echo "Worker status:"
docker compose ps

echo ""
echo "🔍 Watching logs for registration (Ctrl+C to exit)..."
echo ""
sleep 2
docker compose logs -f
