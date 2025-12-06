# GPU Worker Container
# Runs worker agent with GPU support for LLM inference
# Models are downloaded at worker spin-up, not build time

FROM nvidia/cuda:12.1.0-base-ubuntu22.04

WORKDIR /app

# Install Python and dependencies
RUN apt-get update && apt-get install -y \
    python3.11 \
    python3-pip \
    curl \
    wget \
    && rm -rf /var/lib/apt/lists/*

# Install cloudflared
RUN wget -q https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb \
    && dpkg -i cloudflared-linux-amd64.deb \
    && rm cloudflared-linux-amd64.deb

# Install Python dependencies
RUN pip3 install --no-cache-dir \
    requests==2.31.0 \
    psutil==5.9.6 \
    docker==7.0.0 \
    gputil==1.4.0

# Copy worker agent and model download script
COPY worker_agent.py .
COPY ../../scripts/download-models.sh /usr/local/bin/download-models.sh
RUN chmod +x /usr/local/bin/download-models.sh

# Environment variables
ENV COORDINATOR_URL=https://api.rmatool.org.uk
ENV PYTHONUNBUFFERED=1
ENV NVIDIA_VISIBLE_DEVICES=all
ENV NVIDIA_DRIVER_CAPABILITIES=compute,utility

# Model cache directories (can be volume mounted)
ENV MODEL_CACHE_DIR=/models
ENV HF_HOME=/models/huggingface
ENV OLLAMA_MODELS=/models/ollama
ENV VLLM_CACHE=/models/vllm

# GPU configuration
ENV MIN_GPU_MEMORY_GB=8
ENV WORKER_TYPE=gpu-worker

# Create model cache directories
RUN mkdir -p /models/huggingface /models/ollama /models/vllm /var/log

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

# Run worker agent
CMD ["python3", "worker_agent.py", "--coordinator", "${COORDINATOR_URL}"]
