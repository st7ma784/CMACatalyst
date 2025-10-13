#!/bin/bash

# Ollama initialization script
set -e

echo "Starting Ollama initialization..."

# Wait for Ollama service to be ready
until curl -f http://localhost:11434/api/version; do
    echo "Waiting for Ollama service to start..."
    sleep 5
done

echo "Ollama service is ready. Pulling models..."

# Pull required models
echo "Pulling llama2:7b..."
ollama pull llama2:7b

echo "Pulling codellama:7b..."
ollama pull codellama:7b

echo "Pulling mistral:7b..."
ollama pull mistral:7b

echo "Pulling nomic-embed-text for embeddings..."
ollama pull nomic-embed-text

echo "All models downloaded successfully!"

# Keep container running
tail -f /dev/null