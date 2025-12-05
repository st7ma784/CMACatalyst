#!/bin/bash

# Deploy Local Coordinator
# Eliminates Cloudflare KV limits with self-hosted worker registry

set -e

echo "🚀 Deploying RMA Local Coordinator..."
echo ""

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    echo "   Visit: https://docs.docker.com/get-docker/"
    exit 1
fi

# Check if docker-compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo "❌ docker-compose is not installed. Please install docker-compose first."
    echo "   Visit: https://docs.docker.com/compose/install/"
    exit 1
fi

# Navigate to coordinator directory
cd "$(dirname "$0")"

echo "📦 Building coordinator container..."
docker-compose build

echo ""
echo "🎬 Starting coordinator..."
docker-compose up -d

echo ""
echo "⏳ Waiting for coordinator to be ready..."
sleep 5

# Health check
if curl -f http://localhost:8080/health &> /dev/null; then
    echo "✅ Coordinator is healthy!"
    echo ""
    
    # Show status
    echo "📊 Coordinator Status:"
    curl -s http://localhost:8080/health | python3 -m json.tool
    
    echo ""
    echo "✅ Local coordinator deployed successfully!"
    echo ""
    echo "📍 Next steps:"
    echo ""
    echo "1️⃣  Expose coordinator to internet:"
    echo "   Option A - Cloudflare Tunnel (Recommended):"
    echo "   cloudflared tunnel create rma-coordinator"
    echo "   cloudflared tunnel route dns <tunnel-id> home.rmatool.org.uk"
    echo "   cloudflared tunnel run rma-coordinator"
    echo ""
    echo "   Option B - Reverse Proxy:"
    echo "   Configure nginx to proxy https://home.rmatool.org.uk to localhost:8080"
    echo ""
    echo "2️⃣  Update edge worker to use coordinator:"
    echo "   Set COORDINATOR_URL='https://home.rmatool.org.uk:8080'"
    echo "   Remove KV bindings"
    echo "   Deploy edge worker"
    echo ""
    echo "3️⃣  Point workers to coordinator:"
    echo "   docker run -e COORDINATOR_URL=https://home.rmatool.org.uk:8080 ..."
    echo ""
    echo "📖 Full guide: RMA-Demo/HYBRID_COORDINATOR_ARCHITECTURE.md"
    echo ""
    echo "🔍 Monitoring:"
    echo "   Health: http://localhost:8080/health"
    echo "   Workers: http://localhost:8080/api/admin/workers"
    echo "   Services: http://localhost:8080/api/admin/services"
    echo "   Metrics: http://localhost:8080/metrics"
    echo "   Logs: docker-compose logs -f"
    echo ""
    
else
    echo "❌ Coordinator failed to start properly"
    echo ""
    echo "Check logs with: docker-compose logs"
    exit 1
fi
