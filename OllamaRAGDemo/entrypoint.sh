#!/bin/bash

# Start Ollama in the background
ollama serve &

# Wait for Ollama to be ready
echo "Waiting for Ollama to start..."
sleep 5

# Pull the default model (llama2 or llama3.2)
echo "Pulling llama3.2 model..."
ollama pull llama3.2

# Pull embedding model for RAG
echo "Pulling nomic-embed-text model for embeddings..."
ollama pull nomic-embed-text

# Run document ingestion if documents exist
if [ -d "/documents" ] && [ "$(ls -A /documents)" ]; then
    echo "Processing documents into vector store..."
    python3 /app/ingest_documents.py
fi

# Start the RAG application
echo "Starting RAG application..."
python3 /app/rag_app.py
