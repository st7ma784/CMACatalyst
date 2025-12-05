# Universal Worker Container
# Can run GPU, CPU, or Storage services based on coordinator assignment
# Automatically detects hardware capabilities and requests service assignments

FROM nvidia/cuda:12.2.0-runtime-ubuntu22.04

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    python3.11 \
    python3-pip \
    wget \
    curl \
    git \
    build-essential \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Install cloudflared for automatic tunnel creation
RUN ARCH=$(dpkg --print-architecture) && \
    wget -q https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-${ARCH}.deb \
    && dpkg -i cloudflared-linux-${ARCH}.deb \
    && rm cloudflared-linux-${ARCH}.deb

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip3 install --no-cache-dir -r requirements.txt

# Copy universal worker agent and DHT modules
COPY worker_agent.py .
COPY service_launcher.py .
COPY dht/ ./dht/

# Copy coordinator service (for edge workers)
# This will be copied from ../services/local-coordinator during build
# Build command: docker build -f worker-containers/universal-worker/Dockerfile --build-context coordinator=services/local-coordinator .
RUN mkdir -p /app/coordinator

# Environment variables
ENV COORDINATOR_URL="http://localhost:8080"
ENV WORKER_ID=""
ENV WORKER_TYPE="auto"
ENV USE_TUNNEL="false"

# Auto-detect hardware and register with coordinator
CMD ["python3", "worker_agent.py"]
