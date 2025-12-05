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

# Install common Python dependencies
RUN pip3 install --no-cache-dir \
    fastapi \
    uvicorn \
    requests \
    python-dotenv \
    pydantic \
    aiohttp

# Install GPU libraries (optional, only used if GPU detected)
RUN pip3 install --no-cache-dir \
    torch \
    transformers \
    accelerate \
    bitsandbytes

# Install storage libraries
RUN pip3 install --no-cache-dir \
    chromadb \
    redis \
    psycopg2-binary \
    minio \
    neo4j

# Install CPU service libraries
RUN pip3 install --no-cache-dir \
    spacy \
    pytesseract \
    pillow \
    pypdf2

# Copy universal worker agent
COPY worker_agent.py .
COPY service_launcher.py .
COPY services/ ./services/

# Environment variables
ENV COORDINATOR_URL="https://api.rmatool.org.uk"
ENV WORKER_ID=""
ENV WORKER_TYPE="auto"
ENV USE_TUNNEL="true"

# Auto-detect hardware and register with coordinator
CMD ["python3", "worker_agent.py"]
