#!/bin/bash
# Ollama Vision Entrypoint Script
# Pulls vision/OCR models on startup
# Used by: OCR Service, Doc Processor, Client RAG

# Start Ollama daemon in background
echo "🎨 Starting Ollama Vision Service..."
/usr/bin/ollama serve > /tmp/ollama-vision.log 2>&1 &
OLLAMA_PID=$!

# Wait for Ollama to be ready
echo "⏳ Waiting for Vision Ollama API to be ready (up to 120 seconds)..."
for i in {1..120}; do
  if curl -s -f http://localhost:11434/api/tags >/dev/null 2>&1; then
    echo "✅ Vision Ollama API is ready!"
    break
  fi
  if [ $((i % 10)) -eq 0 ]; then
    echo "  Still waiting... ($i/120 seconds)"
  fi
  sleep 1
done

# Function to check if model exists and is available
model_exists() {
  local model=$1
  local tags=$(curl -s http://localhost:11434/api/tags 2>/dev/null || echo "{}")
  echo "$tags" | grep -qi "\"name\": \"$model" && echo "true" || echo "false"
}

# Pull required vision models
echo ""
echo "╔════════════════════════════════════════════════════╗"
echo "║      PULLING REQUIRED VISION/OCR MODELS            ║"
echo "╚════════════════════════════════════════════════════╝"
echo ""

# Vision model: llava (LLaVA NeXT for document understanding)
echo "1️⃣  Checking llava:7b (LLaVA NeXT Vision Model)..."
if [ "$(model_exists 'llava')" = "false" ]; then
  echo "   ⬇️  Pulling llava:7b (first run, ~5-10 minutes)..."
  echo "   📖 Used by: Document Processor, OCR Service"
  ollama pull llava:7b
  echo "   ✅ llava:7b ready"
else
  echo "   ✅ llava:7b already available"
fi

# Embedding model (for document chunking/understanding)
echo ""
echo "2️⃣  Checking nomic-embed-text (Embedding Model)..."
if [ "$(model_exists 'nomic-embed')" = "false" ]; then
  echo "   ⬇️  Pulling nomic-embed-text (first run, ~2 minutes)..."
  echo "   📖 Used by: RAG similarity search, document classification"
  ollama pull nomic-embed-text:latest
  echo "   ✅ nomic-embed-text ready"
else
  echo "   ✅ nomic-embed-text already available"
fi

echo ""
echo "╔════════════════════════════════════════════════════╗"
echo "║  ✅ ALL VISION MODELS ARE READY                    ║"
echo "║  🚀 Vision Ollama is now fully initialized        ║"
echo "║  📌 Listening on http://0.0.0.0:11434             ║"
echo "║  🎯 Used by: OCR Service, Doc Processor, Client   ║"
echo "╚════════════════════════════════════════════════════╝"
echo ""

# Keep the container alive by waiting for the Ollama daemon
wait $OLLAMA_PID
