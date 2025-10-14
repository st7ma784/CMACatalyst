#!/bin/bash

# Stop script for all demos
# Usage: ./stop-all-demos.sh [--full]

echo "=========================================="
echo "Stopping Services"
echo "=========================================="
echo ""

# Stop OCR demo
echo "Stopping OCR demo..."
cd OCRDemo
docker compose down
cd ..
echo "✓ OCR demo stopped"
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
    docker-compose -f docker-compose.ollama.yml down
    echo "✓ Ollama service stopped"
    echo ""
    echo "All services stopped."
    echo "Models are preserved in Docker volume 'shared_ollama_models'"
else
    echo "Shared Ollama service is still running (use --full to stop it)"
    echo ""
    echo "✓ Demo apps stopped, Ollama still available"
fi

echo ""
echo "To start again:"
echo "  ./start-all-demos.sh  # Start everything"
echo "  ./start-rag-demo.sh   # Just RAG demo"
