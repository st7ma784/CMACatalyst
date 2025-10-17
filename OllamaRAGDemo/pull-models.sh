#!/bin/bash
# Pull required Ollama models for enhanced RAG

set -e

echo "==================================="
echo "OllamaRAGDemo - Enhanced Model Setup"
echo "==================================="

OLLAMA_BASE_URL="${OLLAMA_BASE_URL:-http://ollama:11434}"

# Wait for Ollama to be ready
echo "Waiting for Ollama service to be ready..."
MAX_RETRIES=30
RETRY_COUNT=0

until curl -s "$OLLAMA_BASE_URL/api/tags" > /dev/null 2>&1; do
    RETRY_COUNT=$((RETRY_COUNT + 1))
    if [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
        echo "❌ Ollama service did not become ready in time"
        exit 1
    fi
    echo "  Waiting... (attempt $RETRY_COUNT/$MAX_RETRIES)"
    sleep 5
done

echo "✓ Ollama service is ready"
echo ""

# Pull LLaVA vision model for document processing
echo "Pulling LLaVA vision model (llava:7b)..."
echo "This enables superior PDF and image understanding"
echo "First time may take 5-10 minutes..."
ollama pull llava:7b || echo "⚠ Warning: Could not pull llava:7b"

# Pull Llama2 for text processing
echo ""
echo "Pulling Llama2 for text processing..."
ollama pull llama2 || echo "⚠ Warning: Could not pull llama2"

# Pull nomic-embed-text for embeddings
echo ""
echo "Pulling Nomic Embed Text for vector embeddings..."
ollama pull nomic-embed-text || echo "⚠ Warning: Could not pull nomic-embed-text"

echo ""
echo "==================================="
echo "✓ Model setup complete!"
echo "==================================="
echo ""
echo "Available models:"
ollama list || echo "Could not list models"
echo ""
echo "Enhanced RAG Features:"
echo "  ✓ LLaVA vision model - Superior PDF/image understanding"
echo "  ✓ Llama2 - Advanced text processing"
echo "  ✓ Nomic Embed - High-quality embeddings"
echo ""
echo "Document processing will use:"
echo "  1. LLaVA for PDFs and images (best quality)"
echo "  2. BeautifulSoup for HTML"
echo "  3. Direct text loading for TXT files"
echo ""
