#!/bin/bash
# Start RMA Demo with proper environment variables for external access

set -e

cd "$(dirname "$0")"

echo "🚀 Starting RMA Demo with external IP access..."
echo "📍 Server will be accessible at: http://192.168.5.70:3000"
echo ""

# Load environment variables from .env
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# Start all services
docker compose -f docker-compose.local-parsing.yml up -d

echo ""
echo "✅ Services started!"
echo ""
echo "Access points:"
echo "  Frontend:        http://192.168.5.70:3000"
echo "  Upload Service:  http://192.168.5.70:8103"
echo "  Notes Service:   http://192.168.5.70:8100"
echo "  Doc Processor:   http://192.168.5.70:8101"
echo "  RAG Service:     http://192.168.5.70:8102"
echo "  Client RAG:      http://192.168.5.70:8104"
echo "  Ollama:          http://192.168.5.70:11434"
echo ""
echo "📊 View logs:"
echo "  docker compose -f docker-compose.local-parsing.yml logs -f"
echo ""
echo "🛑 Stop services:"
echo "  docker compose -f docker-compose.local-parsing.yml down"
