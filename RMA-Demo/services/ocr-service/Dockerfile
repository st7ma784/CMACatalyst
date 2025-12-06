# Dockerfile for OCR Service
# Models download at service spin-up, not build time
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies for document processing
RUN apt-get update && apt-get install -y \
    tesseract-ocr \
    libtesseract-dev \
    poppler-utils \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY app.py .

# Copy model download script (if running standalone)
COPY ../../scripts/download-models.sh /usr/local/bin/download-models.sh 2>/dev/null || true
RUN chmod +x /usr/local/bin/download-models.sh 2>/dev/null || true

# Model cache directories (can be volume mounted)
ENV MODEL_CACHE_DIR=/models
ENV OLLAMA_MODELS=/models/ollama

# Create model cache directories
RUN mkdir -p /models/ollama /var/log

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=120s --retries=3 \
    CMD python -c "import requests; requests.get('http://localhost:8104/health', timeout=5)" || exit 1

# Run service
CMD ["python", "app.py"]
