#!/bin/bash
# Initialize Ollama with required models for RMA Demo
# This script ensures all necessary models are available before starting services

set -e

echo "🔧 Ollama Model Initialization Script"
echo "======================================"
echo ""

OLLAMA_HOST="${OLLAMA_HOST:-http://localhost:11434}"
MAX_RETRIES=30
RETRY_DELAY=2

# Function to wait for Ollama to be ready
wait_for_ollama() {
    echo "⏳ Waiting for Ollama to be ready..."
    local retries=0
    
    while [ $retries -lt $MAX_RETRIES ]; do
        if curl -s "$OLLAMA_HOST/api/tags" > /dev/null 2>&1; then
            echo "✅ Ollama is ready!"
            return 0
        fi
        
        retries=$((retries + 1))
        echo "   Attempt $retries/$MAX_RETRIES - Ollama not ready yet..."
        sleep $RETRY_DELAY
    done
    
    echo "❌ ERROR: Ollama failed to start after ${MAX_RETRIES} attempts"
    exit 1
}

# Function to check if a model exists
model_exists() {
    local model_name=$1
    curl -s "$OLLAMA_HOST/api/tags" | grep -q "\"name\":\"$model_name\""
}

# Function to pull a model if it doesn't exist
ensure_model() {
    local model_name=$1
    local model_size=$2
    
    echo ""
    echo "📦 Checking model: $model_name"
    
    if model_exists "$model_name"; then
        echo "   ✅ Model already exists: $model_name"
        return 0
    fi
    
    echo "   📥 Pulling model: $model_name ($model_size)"
    echo "   ⏱️  This may take several minutes..."
    
    if curl -X POST "$OLLAMA_HOST/api/pull" -d "{\"name\": \"$model_name\"}" 2>&1 | grep -q "success"; then
        echo "   ✅ Successfully pulled: $model_name"
        return 0
    else
        # Alternative method using ollama CLI
        if command -v ollama >/dev/null 2>&1; then
            ollama pull "$model_name"
            echo "   ✅ Successfully pulled: $model_name"
            return 0
        else
            echo "   ⚠️  Warning: Could not verify pull of $model_name"
            return 1
        fi
    fi
}

# Main execution
echo "Starting model initialization..."
echo ""

# Wait for Ollama to start
wait_for_ollama

# Required models for RMA Demo
echo ""
echo "📋 Required Models:"
echo "   - llava:7b          (4.7 GB)  - Document OCR with vision"
echo "   - llama3.2          (2.0 GB)  - Text generation & analysis"
echo "   - nomic-embed-text  (274 MB)  - Text embeddings for RAG"
echo ""

# Pull each required model
ensure_model "llava:7b" "4.7 GB"
ensure_model "llama3.2" "2.0 GB"
ensure_model "nomic-embed-text" "274 MB"

echo ""
echo "======================================"
echo "✅ Model initialization complete!"
echo ""
echo "📊 Available models:"
curl -s "$OLLAMA_HOST/api/tags" | grep -o '"name":"[^"]*"' | cut -d'"' -f4 | sed 's/^/   - /'
echo ""
echo "🚀 Ready to start services!"
echo "======================================"
