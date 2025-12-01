#!/bin/bash
# Ollama LLM Entrypoint Script (Language Models Only)
# Pulls language models on startup
# Used by: RAG Service, Notes Service, NER Graph Service
# Vision models are served by separate ollama-vision service

# Start Ollama daemon in background
echo "🤖 Starting Ollama LLM Service (Language Models)..."
/usr/bin/ollama serve > /tmp/ollama-llm.log 2>&1 &
OLLAMA_PID=$!

# Wait for Ollama to be ready
echo "⏳ Waiting for LLM Ollama API to be ready (up to 120 seconds)..."
for i in {1..120}; do
  if curl -s -f http://localhost:11434/api/tags >/dev/null 2>&1; then
    echo "✅ LLM Ollama API is ready!"
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

# Pull required language models
echo ""
echo "╔════════════════════════════════════════════════════╗"
echo "║      PULLING REQUIRED LANGUAGE MODELS              ║"
echo "╚════════════════════════════════════════════════════╝"
echo ""

# Primary model: llama3.2 (Latest, optimized for chat)
echo "1️⃣  Checking llama3.2:latest (Latest Language Model)..."
if [ "$(model_exists 'llama3.2')" = "false" ]; then
  echo "   ⬇️  Pulling llama3.2:latest (first run, ~2-5 minutes)..."
  echo "   📖 Used by: RAG Service, Notes Converter, Chat"
  ollama pull llama3.2:latest
  echo "   ✅ llama3.2:latest ready"
else
  echo "   ✅ llama3.2:latest already available"
fi

# Fallback/Legacy model: llama2 (for backward compatibility)
echo ""
echo "2️⃣  Checking llama2:7b (Fallback Language Model)..."
if [ "$(model_exists 'llama2')" = "false" ]; then
  echo "   ⬇️  Pulling llama2:7b (first run, ~2-5 minutes)..."
  echo "   📖 Used by: Backward compatibility, fallback"
  ollama pull llama2:7b
  echo "   ✅ llama2:7b ready"
else
  echo "   ✅ llama2:7b already available"
fi

echo ""
echo "╔════════════════════════════════════════════════════╗"
echo "║  ✅ ALL LANGUAGE MODELS ARE READY                  ║"
echo "║  🚀 LLM Ollama is now fully initialized           ║"
echo "║  📌 Listening on http://0.0.0.0:11434             ║"
echo "║  🎯 Used by: RAG, Notes, NER Graph Services       ║"
echo "║  👁️  Vision models served by separate service     ║"
echo "╚════════════════════════════════════════════════════╝"
echo ""

# Keep the container alive by waiting for the Ollama daemon
wait $OLLAMA_PID
