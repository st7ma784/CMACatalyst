#!/bin/bash
# Initialize Ollama models for OCR Demo

echo "==================================="
echo "OCR Demo - Model Initialization"
echo "==================================="

# Wait for Ollama to be ready
echo "Waiting for Ollama service to be ready..."
until curl -s http://ollama:11434/api/tags > /dev/null 2>&1; do
    echo "Ollama not ready yet, waiting..."
    sleep 5
done

echo "✓ Ollama service is ready"

# Pull LLaVA vision model (for document understanding)
echo ""
echo "Pulling LLaVA vision model (llava:7b)..."
echo "This may take a few minutes on first run..."
ollama pull llava:7b

# Pull llama2 for text processing
echo ""
echo "Pulling Llama2 model (llama2)..."
ollama pull llama2

echo ""
echo "==================================="
echo "✓ All models downloaded successfully!"
echo "==================================="
echo ""
echo "Available models for OCR Demo:"
echo "  - llava:7b (vision model for document analysis)"
echo "  - llama2 (text processing and extraction)"
echo ""
echo "The OCR Demo will now use:"
echo "  1. LLaVA vision model (preferred) - High accuracy"
echo "  2. Tesseract OCR (fallback) - Improved to 400 DPI"
echo ""
