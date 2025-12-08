#!/bin/bash

# Start GPU Worker for RMA distributed system

set -e

cd "$(dirname "$0")/gpu-worker"

echo "🚀 Starting RMA GPU Worker"
echo "=========================="
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker first."
    exit 1
fi

# Check for NVIDIA GPU
if ! command -v nvidia-smi &> /dev/null; then
    echo "⚠️  nvidia-smi not found. GPU may not be available."
    echo ""
fi

# Check NVIDIA Container Runtime
if ! docker run --rm --gpus all nvidia/cuda:11.8.0-base-ubuntu22.04 nvidia-smi > /dev/null 2>&1; then
    echo "❌ NVIDIA Container Runtime not working."
    echo ""
    echo "Install NVIDIA Container Toolkit:"
    echo "  distribution=\$(. /etc/os-release;echo \$ID\$VERSION_ID)"
    echo "  curl -s -L https://nvidia.github.io/nvidia-docker/gpgkey | sudo apt-key add -"
    echo "  curl -s -L https://nvidia.github.io/nvidia-docker/\$distribution/nvidia-docker.list | sudo tee /etc/apt/sources.list.d/nvidia-docker.list"
    echo "  sudo apt-get update && sudo apt-get install -y nvidia-container-toolkit"
    echo "  sudo systemctl restart docker"
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

# Display GPU info
echo "GPU Information:"
nvidia-smi --query-gpu=name,memory.total --format=csv,noheader
echo ""

# Display configuration
echo "Configuration:"
echo "  Coordinator: https://api.rmatool.org.uk"
echo "  Tunnel: Enabled"
echo "  Service: vllm-service:8000"
echo ""

# Build and start
echo "🔨 Building worker image..."
docker compose build

echo ""
echo "▶️  Starting worker container..."
docker compose up -d

echo ""
echo "✅ GPU Worker started!"
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
