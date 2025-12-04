# Storage Worker Container
# Provides persistent storage services for distributed RMA system
# Supports: ChromaDB (vector DB), Redis (cache), PostgreSQL (relational),
#           MinIO (object storage), Neo4j (graph DB)
# Configure via environment variables which services to enable

FROM chromadb/chroma:0.4.24

WORKDIR /app

# Install Python dependencies for coordinator integration
RUN pip install --no-cache-dir requests python-dotenv

# Install cloudflared for automatic tunnel creation
RUN apt-get update && apt-get install -y wget && \
    ARCH=$(dpkg --print-architecture) && \
    wget -q https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-${ARCH}.deb \
    && dpkg -i cloudflared-linux-${ARCH}.deb \
    && rm cloudflared-linux-${ARCH}.deb \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Copy worker agent for registration and health reporting
COPY worker_agent.py .

# Environment variables
ENV COORDINATOR_URL="https://api.rmatool.org.uk"
ENV WORKER_ID=""
ENV CHROMADB_PORT=8000
ENV USE_TUNNEL="true"
ENV ENABLE_CHROMADB="true"

# Optional: Enable additional storage services
# ENV REDIS_PORT=6379
# ENV POSTGRES_PORT=5432
# ENV MINIO_PORT=9000
# ENV NEO4J_PORT=7474

# Data persistence volume
VOLUME /chroma/chroma

# Expose ChromaDB port (add more if enabling other services)
EXPOSE 8000

# Start worker agent (registers with coordinator) and ChromaDB
CMD python worker_agent.py & exec chroma run --host 0.0.0.0 --port ${CHROMADB_PORT}
