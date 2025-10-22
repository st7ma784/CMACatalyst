#!/bin/bash
# Ollama entrypoint with automatic model initialization
# Ensures required models are available before accepting requests

set -e

echo "🚀 Starting Ollama with automatic model initialization..."

# Start Ollama in the background
/bin/ollama serve &
OLLAMA_PID=$!

# Wait for Ollama to be ready (increased timeout for model loading)
echo "⏳ Waiting for Ollama to start..."
MAX_ATTEMPTS=60
ATTEMPT=0

while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
    if curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
        echo "✅ Ollama is ready!"
        break
    fi
    ATTEMPT=$((ATTEMPT + 1))
    if [ $((ATTEMPT % 5)) -eq 0 ]; then
        echo "   Still waiting... ($ATTEMPT/$MAX_ATTEMPTS)"
    fi
    sleep 2
done

# Check if Ollama started successfully
if ! curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
    echo "⚠️  Ollama health check failed after $MAX_ATTEMPTS attempts, but continuing..."
    echo "   Ollama may still be loading models. Services will retry connections."
fi

# Required models
REQUIRED_MODELS=("llava:7b" "llama3.2" "nomic-embed-text")

echo ""
echo "📦 Checking required models..."

for model in "${REQUIRED_MODELS[@]}"; do
    echo "Checking: $model"
    if ollama list | grep -q "$model"; then
        echo "  ✅ $model already available"
    else
        echo "  📥 Pulling $model..."
        ollama pull "$model" || echo "  ⚠️  Warning: Failed to pull $model"
    fi
done

echo ""
echo "✅ Model initialization complete!"
echo ""
echo "📊 Available models:"
ollama list
echo ""
echo "🎉 Ollama is ready to serve requests!"

# Keep the script running and monitor Ollama
wait $OLLAMA_PID
