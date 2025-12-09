#!/bin/bash
# Quick rebuild and restart script for edge coordinator stack

set -e

echo "🔧 Rebuilding and restarting edge coordinator stack..."
echo ""

# Stop everything
echo "1. Stopping current stack..."
docker compose -f edge-coordinator-fixed.yml down 2>/dev/null || docker-compose -f edge-coordinator.yml down 2>/dev/null || true

# Clean up old containers
echo "2. Cleaning up old containers..."
docker rm -f edge-coordinator edge-local-worker edge-tunnel edge-registrar 2>/dev/null || true

# Rebuild worker with fixes
echo "3. Rebuilding worker image (this may take a few minutes)..."
cd worker-containers/universal-worker
docker build -f Dockerfile.optimized -t universal-worker:local --no-cache .
cd ../..

echo ""
echo "4. Starting new stack..."
# Use fixed compose file with local build
cat > edge-coordinator-local.yml <<'EOF'
version: '3.8'

services:
  coordinator:
    image: ghcr.io/st7ma784/cmacatalyst/coordinator:latest
    container_name: edge-coordinator
    restart: unless-stopped
    network_mode: host
    environment:
      - HOST=0.0.0.0
      - PORT=8080
      - DHT_PORT=8468
      - DHT_ENABLED=true
      - NODE_ENV=production
      - HEARTBEAT_TIMEOUT_SECONDS=300
      - WORKER_TIMEOUT_SECONDS=600
    dns:
      - 1.1.1.1
      - 8.8.8.8
    healthcheck:
      test: ["CMD", "python3", "-c", "import urllib.request; urllib.request.urlopen('http://localhost:8080/health').read()"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 10s

  local-worker:
    image: universal-worker:local
    container_name: edge-local-worker
    restart: unless-stopped
    network_mode: host
    environment:
      - WORKER_TYPE=auto
      - COORDINATOR_URL=http://localhost:8080
      - USE_TUNNEL=false
      - WORKER_ID=edge-local-worker
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: all
              capabilities: [gpu]
    dns:
      - 1.1.1.1
      - 8.8.8.8
    depends_on:
      coordinator:
        condition: service_healthy
EOF

docker compose -f edge-coordinator-local-build.yml up -d

echo ""
echo "5. Waiting for services to start (10 seconds)..."
sleep 10

echo ""
echo "6. Registering coordinator with edge router..."
./register-coordinator.sh || echo "⚠️  Manual registration may be needed"

echo ""
echo "7. Waiting for worker to start (20 seconds)..."
sleep 20

echo ""
echo "8. Checking container status..."
docker ps | grep -E "edge-coordinator|edge-local-worker|edge-tunnel"

echo ""
echo "9. Running diagnostic..."
./diagnose-routing.sh 2>&1 | head -100

echo ""
echo "================================================"
echo "✅ Rebuild complete!"
echo ""
echo "To check status: docker logs -f edge-local-worker"
echo "To test routing: ./diagnose-routing.sh"
echo "================================================"
