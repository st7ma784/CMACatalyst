FROM python:3.11-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy requirements first for better caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Create model cache directory
RUN mkdir -p /app/models
ENV TRANSFORMERS_CACHE=/app/models
ENV HF_HOME=/app/models

# Copy application code
COPY . .

# Create non-root user
RUN useradd -m -u 1000 translator && chown -R translator:translator /app
USER translator

EXPOSE 8003

HEALTHCHECK --interval=30s --timeout=30s --start-period=120s --retries=3 \
    CMD curl -f http://localhost:8003/health || exit 1

CMD ["python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8003"]