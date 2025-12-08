# RAG Service Worker Container
# Adapted from existing RAG service with coordinator integration

FROM python:3.11-slim

WORKDIR /app

# Copy existing RAG service code
COPY ../../services/rag-service/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Add coordinator communication dependency
RUN pip install --no-cache-dir requests

# Copy RAG service code
COPY ../../services/rag-service/app.py .
COPY ../../services/rag-service/*.py ./

# Copy coordinator integration
COPY ../vllm/coordinator_integration.py ./coordinator_integration.py

# Environment variables
ENV COORDINATOR_URL=""
ENV WORKER_ID=""
ENV OLLAMA_URL="http://localhost:11434"
ENV CHROMADB_HOST="localhost"
ENV CHROMADB_PORT="8000"

EXPOSE 8102

# Start both RAG service and coordinator integration
CMD python coordinator_integration.py & python app.py
