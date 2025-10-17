#!/bin/bash

# Wait for Ollama service to be ready
echo "Waiting for Ollama service to be ready..."
until curl -sf http://ollama:11434/api/tags > /dev/null 2>&1; do
    echo "Ollama not ready yet, waiting..."
    sleep 2
done
echo "Ollama service is ready!"

# Ensure models are pulled (including LLaVA for vision)
echo "Ensuring required models are available..."
echo "Pulling LLaVA vision model for enhanced document processing..."
curl -X POST http://ollama:11434/api/pull -d '{"name":"llava:7b"}' 2>/dev/null &
curl -X POST http://ollama:11434/api/pull -d '{"name":"llama2"}' 2>/dev/null &
curl -X POST http://ollama:11434/api/pull -d '{"name":"nomic-embed-text"}' 2>/dev/null &
echo "Models are being pulled in background..."
sleep 10

# Run document ingestion if documents exist and vector store doesn't
if [ -d "/documents" ] && [ "$(ls -A /documents)" ]; then
    if [ ! -d "/data/vectorstore/chroma.sqlite3" ]; then
        echo "Processing documents into vector store with LLaVA vision model..."
        echo "This will provide superior understanding of PDFs and images"
        python3 /app/ingest_documents_enhanced.py
    else
        echo "Vector store already exists, skipping ingestion"
        echo "To re-ingest with enhanced vision model, delete /data/vectorstore and restart"
    fi
else
    echo "No documents found in /documents directory"
fi

# Start the RAG application
echo "Starting RAG application..."
python3 /app/rag_app.py
