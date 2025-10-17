#!/bin/bash

# Stop script for shared Ollama + RAG Demo
# Usage: ./stop-rag-demo.sh [--full]

echo "=========================================="
echo "Stopping Services"
echo "=========================================="
echo ""

# Stop RAG demo
echo "Stopping RAG demo..."
cd OllamaRAGDemo
docker compose down
cd ..
echo "✓ RAG demo stopped"
echo ""

# Check if we should stop Ollama too
if [ "$1" == "--full" ]; then
    echo "Stopping shared Ollama service..."
    docker compose -f docker-compose.ollama.yml down
    echo "✓ Ollama service stopped"
    echo ""
    echo "All services stopped."
    echo "Models are preserved in Docker volume 'shared_ollama_models'"
else
    echo "Shared Ollama service is still running (use --full to stop it)"
    echo ""
    echo "✓ RAG demo stopped, Ollama still available for other apps"
fi

echo ""
echo "To start again: ./start-rag-demo.sh"
