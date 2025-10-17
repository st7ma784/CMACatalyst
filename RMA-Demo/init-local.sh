#!/bin/bash
# RMA-Demo Initialization Script with LOCAL Parsing
# Privacy-first configuration (no cloud services)

set -e

echo "========================================="
echo "RMA-Demo Initialization (Local Parsing)"
echo "========================================="
echo ""
echo "This setup uses:"
echo "  ✅ Local LLaVA vision models"
echo "  ✅ On-premises document processing"
echo "  ✅ No cloud API calls"
echo "  ✅ GDPR compliant"
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

  # Enable local parsing
  echo "" >> .env
  echo "# Local Document Parsing (Privacy-First)" >> .env
  echo "USE_LOCAL_PARSING=true" >> .env
  echo "VISION_MODEL=llava:13b" >> .env

  echo ""
  echo "✓ Created .env file with local parsing enabled"
  echo "  LlamaParse API key is NOT required"
  echo ""
fi

# Create directories
echo "Creating data directories..."
mkdir -p manuals data/uploads data/vectorstore

# Start services using local parsing config
echo ""
echo "Starting Docker services (local parsing config)..."
docker-compose -f docker-compose.local-parsing.yml up -d

echo ""
echo "Waiting for Ollama to start..."
sleep 15

# Pull Ollama models
echo ""
echo "Pulling Ollama models (this may take a while)..."
echo "Pulling llama3.2 (text model)..."
docker exec rma-ollama ollama pull llama3.2

echo ""
echo "Pulling llava:13b (vision model for document processing)..."
echo "⚠️  This is a 7-8 GB download and may take 10-20 minutes"
docker exec rma-ollama ollama pull llava:13b

echo "Pulling nomic-embed-text (for RAG)..."
docker exec rma-ollama ollama pull nomic-embed-text

echo ""
echo "========================================="
echo "Initialization Complete!"
echo "========================================="
echo ""
echo "Services running:"
echo "  - Frontend:        http://localhost:3000"
echo "  - Notes Service:   http://localhost:8100"
echo "  - Doc Processor:   http://localhost:8101 (LOCAL PARSING)"
echo "  - RAG Service:     http://localhost:8102"
echo "  - Upload Service:  http://localhost:8103"
echo "  - Ollama:          http://localhost:11434"
echo ""
echo "Document Processing:"
echo "  ✅ Using LLaVA vision model (local)"
echo "  ✅ All documents processed on-premises"
echo "  ✅ No external API calls"
echo "  ✅ GDPR compliant"
echo ""
echo "Models loaded:"
echo "  - llama3.2 (text generation)"
echo "  - llava:13b (vision/document understanding)"
echo "  - nomic-embed-text (embeddings)"
echo ""
echo "Default credentials:"
echo "  Username: admin"
echo "  Password: admin123"
echo ""
echo "Next steps:"
echo "  1. Add PDF manuals to ./manuals/"
echo "  2. Ingest manuals: ./scripts/ingest-manuals.sh"
echo "  3. Open http://localhost:3000"
echo ""
echo "Test document processing:"
echo "  curl http://localhost:8101/capabilities | jq"
echo "  curl -X POST http://localhost:8101/process -F 'file=@test.pdf'"
echo ""
echo "View logs:"
echo "  docker-compose -f docker-compose.local-parsing.yml logs -f"
echo ""
echo "Stop services:"
echo "  docker-compose -f docker-compose.local-parsing.yml down"
