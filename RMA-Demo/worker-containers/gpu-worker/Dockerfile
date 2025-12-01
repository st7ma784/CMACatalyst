# GPU Worker Container
# Runs worker agent with GPU support for LLM inference

FROM nvidia/cuda:12.1.0-base-ubuntu22.04

WORKDIR /app

# Install Python and dependencies
RUN apt-get update && apt-get install -y \
    python3.11 \
    python3-pip \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
RUN pip3 install --no-cache-dir \
    requests==2.31.0 \
    psutil==5.9.6 \
    docker==7.0.0 \
    gputil==1.4.0

# Copy worker agent
COPY worker_agent.py .

# Environment variables
ENV COORDINATOR_URL=https://rma-coordinator.fly.dev
ENV PYTHONUNBUFFERED=1
ENV NVIDIA_VISIBLE_DEVICES=all
ENV NVIDIA_DRIVER_CAPABILITIES=compute,utility

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

# Run worker agent
CMD ["python3", "worker_agent.py", "--coordinator", "${COORDINATOR_URL}"]
