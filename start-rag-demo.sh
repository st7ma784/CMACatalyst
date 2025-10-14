#!/bin/bash

# Startup script for shared Ollama + RAG Demo
# Usage: ./start-rag-demo.sh

set -e

echo "=========================================="
echo "Starting Shared Ollama + RAG Demo"
echo "=========================================="
echo ""

# Check if we're in the right directory
if [ ! -f "docker-compose.ollama.yml" ]; then
    echo "Error: docker-compose.ollama.yml not found"
    echo "Please run this script from /home/user/CMACatalyst"
    exit 1
fi

# Step 1: Start shared Ollama service
echo "Step 1: Starting shared Ollama service..."
docker compose -f docker-compose.ollama.yml up -d

echo "Waiting for Ollama to be ready..."
sleep 5

# Check if Ollama is responding
until curl -sf http://localhost:11434/api/tags > /dev/null 2>&1; do
    echo "Waiting for Ollama..."
    sleep 2
done
echo "✓ Ollama service is ready!"
echo ""

# Step 2: Pull required models
echo "Step 2: Ensuring models are available..."
echo "Pulling llama3.2 (this may take a few minutes on first run)..."
docker exec shared-ollama-service ollama pull llama3.2 2>&1 | grep -E "(pulling|success|already)" || true

echo "Pulling nomic-embed-text..."
docker exec shared-ollama-service ollama pull nomic-embed-text 2>&1 | grep -E "(pulling|success|already)" || true
echo "✓ Models ready!"
echo ""

# Step 3: Start RAG demo
echo "Step 3: Starting RAG demo application..."
cd OllamaRAGDemo
docker compose up -d
cd ..
echo "✓ RAG demo started!"
echo ""

# Wait for RAG app to be ready
echo "Waiting for RAG app to initialize..."
sleep 5

# Step 4: Ingest documents
echo "Step 4: Checking document ingestion..."
if [ -d "OllamaRAGDemo/data/vectorstore" ] && [ "$(ls -A OllamaRAGDemo/data/vectorstore 2>/dev/null)" ]; then
    echo "Vector store already exists. To re-ingest, run:"
    echo "  rm -rf OllamaRAGDemo/data/vectorstore"
    echo "  docker-compose -f OllamaRAGDemo/docker-compose.yml restart"
else
    echo "Ingesting documents (this may take 1-2 minutes)..."
    docker compose -f OllamaRAGDemo/docker-compose.yml exec -T rag-app python3 /app/ingest_documents.py
    echo "✓ Documents ingested!"
fi
echo ""

echo "=========================================="
echo "✓ Setup Complete!"
echo "=========================================="
echo ""
echo "Services running:"
echo "  • Shared Ollama:  http://localhost:11434"
echo "  • RAG Demo:       http://localhost:8000"
echo ""
echo "To check status:"
echo "  docker ps | grep -E '(ollama|rag)'"
echo ""
echo "To view logs:"
echo "  docker logs shared-ollama-service"
echo "  docker logs rag-demo-app"
echo ""
echo "To stop:"
echo "  ./stop-rag-demo.sh"
echo ""
echo "Ready for your demo! 🚀"
