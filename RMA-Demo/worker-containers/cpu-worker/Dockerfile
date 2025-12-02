# CPU Worker Container
# Runs worker agent in a container to donate CPU compute

FROM python:3.11-slim

WORKDIR /app

# Install system dependencies and SSL certificates
RUN apt-get update && apt-get install -y \
    curl \
    wget \
    ca-certificates \
    && update-ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install cloudflared
RUN wget -q https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb \
    && dpkg -i cloudflared-linux-amd64.deb \
    && rm cloudflared-linux-amd64.deb

# Install Python dependencies
RUN pip install --no-cache-dir \
    requests==2.31.0 \
    psutil==5.9.6

# Copy worker agent
COPY worker_agent.py .

# Environment variables
ENV COORDINATOR_URL=https://api.rmatool.org.uk
ENV PYTHONUNBUFFERED=1

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

# Run worker agent
CMD ["python", "worker_agent.py", "--coordinator", "${COORDINATOR_URL}"]
