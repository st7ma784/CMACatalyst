#!/bin/bash
# RMA-Demo Initialization Script

set -e

echo "========================================="
echo "RMA-Demo Initialization"
echo "========================================="
echo ""

# Check prerequisites
echo "Checking prerequisites..."
command -v docker >/dev/null 2>&1 || { echo "Docker is required but not installed. Aborting." >&2; exit 1; }
command -v docker-compose >/dev/null 2>&1 || { echo "Docker Compose is required but not installed. Aborting." >&2; exit 1; }

# Create .env if it doesn't exist
if [ ! -f .env ]; then
  echo "Creating .env file from template..."
  cp .env.example .env

  # Generate JWT secret
  JWT_SECRET=$(openssl rand -hex 32)
  sed -i "s/your-secure-jwt-secret-here/${JWT_SECRET}/" .env

  echo ""
  echo "✓ Created .env file"
  echo "⚠️  Please edit .env and add your LLAMA_PARSE_API_KEY"
  echo ""
fi

# Create directories
echo "Creating data directories..."
mkdir -p manuals data/uploads data/vectorstore

# Start services
echo ""
echo "Starting Docker services..."
docker-compose up -d

echo ""
echo "Waiting for Ollama to start..."
sleep 10

# Pull Ollama models
echo ""
echo "Pulling Ollama models (this may take a while)..."
echo "Pulling llama3.2..."
docker exec rma-ollama ollama pull llama3.2

echo "Pulling nomic-embed-text..."
docker exec rma-ollama ollama pull nomic-embed-text

echo ""
echo "========================================="
echo "Initialization Complete!"
echo "========================================="
echo ""
echo "Services running:"
echo "  - Frontend:        http://localhost:3000"
echo "  - Notes Service:   http://localhost:8100"
echo "  - Doc Processor:   http://localhost:8101"
echo "  - RAG Service:     http://localhost:8102"
echo "  - Upload Service:  http://localhost:8103"
echo "  - Ollama:          http://localhost:11434"
echo ""
echo "Default credentials:"
echo "  Username: admin"
echo "  Password: admin123"
echo ""
echo "Next steps:"
echo "  1. Edit .env and add LLAMA_PARSE_API_KEY"
echo "  2. Add PDF manuals to ./manuals/"
echo "  3. Ingest manuals: ./scripts/ingest-manuals.sh"
echo "  4. Open http://localhost:3000"
echo ""
echo "To stop services: docker-compose down"
echo "To view logs: docker-compose logs -f"
