# Worker Deployment Guide

This guide provides complete commands for deploying workers to donate compute time to the RMA distributed system.

## Prerequisites

- Docker installed on your host
- Docker Compose (optional, for easier management)
- Network connectivity to the coordinator at `https://api.rmatool.org.uk`
- For GPU workers: NVIDIA GPU with drivers installed and nvidia-docker runtime

## Quick Start (Recommended)

### Auto-Detection Deployment

**Single Command - Worker Auto-Detects Hardware:**
```bash
docker run -d \
  --name rma-worker \
  --restart unless-stopped \
  --gpus all \
  -e COORDINATOR_URL=https://api.rmatool.org.uk \
  -e WORKER_TYPE=auto \
  -e WORKER_NAME=$(hostname)-auto \
  ghcr.io/st7ma784/cmacatalyst/universal-worker:latest
```

**Detection Priority:** GPU → Edge → Storage → CPU

The worker automatically detects available hardware and registers appropriate services with the coordinator.

## Manual Worker Type Selection

### CPU Worker Deployment

**Single Command Deployment:**
```bash
docker run -d \
  --name rma-cpu-worker \
  --restart unless-stopped \
  -e COORDINATOR_URL=https://api.rmatool.org.uk \
  -e WORKER_TYPE=cpu \
  -e WORKER_NAME=$(hostname)-cpu \
  ghcr.io/st7ma784/cmacatalyst/universal-worker:latest
```

**Services:** NER Extraction, Document Processing, Notes/COA Generation

### GPU Worker Deployment

**Single Command Deployment:**
```bash
docker run -d \
  --name rma-gpu-worker \
  --restart unless-stopped \
  --gpus all \
  -e COORDINATOR_URL=https://api.rmatool.org.uk \
  -e WORKER_TYPE=gpu \
  -e WORKER_NAME=$(hostname)-gpu \
  ghcr.io/st7ma784/cmacatalyst/universal-worker:latest
```

**Services:** LLM Inference (vLLM), Vision/OCR, RAG Embeddings

**Note**: GPU workers require NVIDIA Docker runtime with 8GB+ VRAM.

### Storage Worker Deployment

**With Persistent Volumes:**
```bash
docker run -d \
  --name rma-storage-worker \
  --restart unless-stopped \
  -v ./chroma-data:/chroma/chroma \
  -v ./postgres-data:/var/lib/postgresql/data \
  -e COORDINATOR_URL=https://api.rmatool.org.uk \
  -e WORKER_TYPE=storage \
  -e WORKER_NAME=$(hostname)-storage \
  ghcr.io/st7ma784/cmacatalyst/universal-worker:latest
```

**Services:** ChromaDB, Redis, PostgreSQL, MinIO, Neo4j

### Edge Worker Deployment

**With Exposed Ports:**
```bash
docker run -d \
  --name rma-edge-worker \
  --restart unless-stopped \
  -p 8080:8080 -p 8787:8787 -p 8090:8090 \
  -e COORDINATOR_URL=https://api.rmatool.org.uk \
  -e WORKER_TYPE=edge \
  -e WORKER_NAME=$(hostname)-edge \
  ghcr.io/st7ma784/cmacatalyst/universal-worker:latest
```

**Services:** Coordinator, Edge Proxy, Load Balancer

## Detailed Setup

### Step 1: Pull the Universal Worker Image

```bash
docker pull ghcr.io/st7ma784/cmacatalyst/universal-worker:latest
```

### Step 2: Configure Environment Variables

Create a configuration file for your worker:

**Auto-Detection (`worker-auto.env`):**
```bash
COORDINATOR_URL=https://api.rmatool.org.uk
WORKER_TYPE=auto
WORKER_NAME=my-worker-01
HEARTBEAT_INTERVAL=30
```

**GPU Worker (`worker-gpu.env`):**
```bash
COORDINATOR_URL=https://api.rmatool.org.uk
WORKER_TYPE=gpu
WORKER_NAME=my-gpu-worker-01
HEARTBEAT_INTERVAL=30
GPU_MEMORY_UTILIZATION=0.9
MAX_MODEL_LEN=4096
```

**CPU Worker (`worker-cpu.env`):**
```bash
COORDINATOR_URL=https://api.rmatool.org.uk
WORKER_TYPE=cpu
WORKER_NAME=my-cpu-worker-01
HEARTBEAT_INTERVAL=30
MAX_CONCURRENT_JOBS=4
```

**Storage Worker (`worker-storage.env`):**
```bash
COORDINATOR_URL=https://api.rmatool.org.uk
WORKER_TYPE=storage
WORKER_NAME=my-storage-worker-01
HEARTBEAT_INTERVAL=30
CHROMADB_HOST=0.0.0.0
REDIS_HOST=0.0.0.0
```

### Step 3: Run the Worker

**Auto-Detection with Config File:**
```bash
docker run -d \
  --name rma-worker \
  --restart unless-stopped \
  --gpus all \
  --env-file worker-auto.env \
  ghcr.io/st7ma784/cmacatalyst/universal-worker:latest
```

**GPU Worker with Config File:**
```bash
docker run -d \
  --name rma-gpu-worker \
  --restart unless-stopped \
  --gpus all \
  --env-file worker-gpu.env \
  ghcr.io/st7ma784/cmacatalyst/universal-worker:latest
```

**CPU Worker with Config File:**
```bash
docker run -d \
  --name rma-cpu-worker \
  --restart unless-stopped \
  --env-file worker-cpu.env \
  ghcr.io/st7ma784/cmacatalyst/universal-worker:latest
```

**Storage Worker with Config File:**
```bash
docker run -d \
  --name rma-storage-worker \
  --restart unless-stopped \
  -v ./chroma-data:/chroma/chroma \
  -v ./postgres-data:/var/lib/postgresql/data \
  --env-file worker-storage.env \
  ghcr.io/st7ma784/cmacatalyst/universal-worker:latest
```

## Docker Compose Deployment

For easier management, use Docker Compose:

### Auto-Detection Worker (`docker-compose.yml`)

```yaml
version: '3.8'

services:
  universal-worker:
    image: ghcr.io/st7ma784/cmacatalyst/universal-worker:latest
    container_name: rma-worker
    restart: unless-stopped
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: all
              capabilities: [gpu]
    environment:
      - COORDINATOR_URL=https://api.rmatool.org.uk
      - WORKER_TYPE=auto
      - WORKER_NAME=${HOSTNAME}-auto
      - HEARTBEAT_INTERVAL=30
    volumes:
      - ./chroma-data:/chroma/chroma
      - ./postgres-data:/var/lib/postgresql/data
    networks:
      - rma-network

networks:
  rma-network:
    driver: bridge
```

**Deploy Auto-Detection Worker:**
```bash
docker-compose up -d
```

### GPU Worker (`docker-compose-gpu.yml`)

```yaml
version: '3.8'

services:
  gpu-worker:
    image: ghcr.io/st7ma784/cmacatalyst/universal-worker:latest
    container_name: rma-gpu-worker
    restart: unless-stopped
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: all
              capabilities: [gpu]
    environment:
      - COORDINATOR_URL=https://api.rmatool.org.uk
      - WORKER_TYPE=gpu
      - WORKER_NAME=${HOSTNAME}-gpu
      - HEARTBEAT_INTERVAL=30
      - GPU_MEMORY_UTILIZATION=0.9
    networks:
      - rma-network

networks:
  rma-network:
    driver: bridge
```

**Deploy GPU Worker:**
```bash
docker-compose -f docker-compose-gpu.yml up -d
```

### CPU Worker (`docker-compose-cpu.yml`)

```yaml
version: '3.8'

services:
  cpu-worker:
    image: ghcr.io/st7ma784/cmacatalyst/universal-worker:latest
    container_name: rma-cpu-worker
    restart: unless-stopped
    environment:
      - COORDINATOR_URL=https://api.rmatool.org.uk
      - WORKER_TYPE=cpu
      - WORKER_NAME=${HOSTNAME}-cpu
      - HEARTBEAT_INTERVAL=30
      - MAX_CONCURRENT_JOBS=4
    networks:
      - rma-network

networks:
  rma-network:
    driver: bridge
```

**Deploy CPU Worker:**
```bash
docker-compose -f docker-compose-cpu.yml up -d
```

### Storage Worker (`docker-compose-storage.yml`)

```yaml
version: '3.8'

services:
  storage-worker:
    image: ghcr.io/st7ma784/cmacatalyst/universal-worker:latest
    container_name: rma-storage-worker
    restart: unless-stopped
    environment:
      - COORDINATOR_URL=https://api.rmatool.org.uk
      - WORKER_TYPE=storage
      - WORKER_NAME=${HOSTNAME}-storage
      - HEARTBEAT_INTERVAL=30
    volumes:
      - ./chroma-data:/chroma/chroma
      - ./postgres-data:/var/lib/postgresql/data
      - ./redis-data:/data
      - ./minio-data:/data/minio
    networks:
      - rma-network

networks:
  rma-network:
    driver: bridge
```

**Deploy Storage Worker:**
```bash
docker-compose -f docker-compose-storage.yml up -d
```

## Worker Management Commands

### Check Worker Status
```bash
# View logs (replace container name with yours)
docker logs rma-worker
docker logs rma-gpu-worker
docker logs rma-cpu-worker
docker logs rma-storage-worker

# Follow logs in real-time
docker logs -f rma-worker

# Check which services were detected (auto mode)
docker logs rma-worker | grep "Detected"

# Check worker registration with coordinator
curl https://api.rmatool.org.uk/api/admin/workers
```

### Stop Worker
```bash
docker stop rma-worker
# Or for specific types:
docker stop rma-gpu-worker
docker stop rma-cpu-worker
docker stop rma-storage-worker
```

### Restart Worker
```bash
docker restart rma-worker
# Or for specific types:
docker restart rma-gpu-worker
docker restart rma-cpu-worker
```

### Remove Worker
```bash
docker stop rma-worker && docker rm rma-worker
# Or for specific types:
docker stop rma-gpu-worker && docker rm rma-gpu-worker
```

### Update Worker
```bash
# Pull latest universal worker image
docker pull ghcr.io/st7ma784/cmacatalyst/universal-worker:latest

# Stop and remove old container
docker stop rma-worker && docker rm rma-worker

# Start new container with same configuration
docker run -d \
  --name rma-worker \
  --restart unless-stopped \
  --gpus all \
  -e COORDINATOR_URL=https://api.rmatool.org.uk \
  -e WORKER_TYPE=auto \
  ghcr.io/st7ma784/cmacatalyst/universal-worker:latest
```

## Environment Variables Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `COORDINATOR_URL` | Yes | - | URL of the coordinator service |
| `WORKER_TYPE` | No | `auto` | Worker tier: `auto`, `gpu`, `cpu`, `storage`, `edge` |
| `WORKER_NAME` | No | `hostname` | Unique identifier for this worker |
| `HEARTBEAT_INTERVAL` | No | `30` | Seconds between heartbeats |
| `GPU_MEMORY_UTILIZATION` | No | `0.9` | GPU memory utilization (0.0-1.0) |
| `MAX_MODEL_LEN` | No | `4096` | Maximum model context length |
| `CHROMADB_HOST` | No | `0.0.0.0` | ChromaDB bind address |
| `REDIS_HOST` | No | `0.0.0.0` | Redis bind address |
| `LOG_LEVEL` | No | `INFO` | Logging level: `DEBUG`, `INFO`, `WARNING`, `ERROR` |

## Monitoring Your Worker

### View Worker in Dashboard
Visit the admin dashboard to see your worker's status:
```
https://dashboard.rmatool.org.uk
```

### Check Worker Health
```bash
# Get all workers from coordinator
curl https://api.rmatool.org.uk/api/admin/workers | jq

# Check if specific worker is registered
curl https://api.rmatool.org.uk/api/admin/workers | jq '.workers[] | select(.name=="my-worker-01")'

# Check which services worker is running
curl https://api.rmatool.org.uk/api/admin/workers | jq '.workers[] | select(.name=="my-worker-01") | .services'
```

### Monitor Resource Usage
```bash
# Check CPU and memory usage
docker stats rma-worker

# For GPU workers, check GPU usage
nvidia-smi

# Watch GPU usage in real-time
watch -n 1 nvidia-smi
```

## Troubleshooting

### Worker Not Registering

**Check network connectivity:**
```bash
docker exec rma-worker curl -v https://api.rmatool.org.uk/health
```

**Check worker logs:**
```bash
docker logs rma-worker | grep -i error

# Check what services were detected
docker logs rma-worker | grep "Detected"
```

### GPU Not Detected

**Verify NVIDIA runtime:**
```bash
docker run --rm --gpus all nvidia/cuda:11.8.0-base-ubuntu22.04 nvidia-smi
```

**Check Docker daemon configuration:**
```bash
cat /etc/docker/daemon.json
# Should contain:
# {
#   "runtimes": {
#     "nvidia": {
#       "path": "nvidia-container-runtime",
#       "runtimeArgs": []
#     }
#   }
# }
```

### No Services Assigned

**Check worker type:**
```bash
docker logs rma-worker | grep "WORKER_TYPE"
```

**Verify coordinator has gaps:**
```bash
curl https://api.rmatool.org.uk/api/admin/workers | jq '.gaps'
```

### Worker Offline After Restart

**Check if worker auto-starts:**
```bash
docker ps -a | grep rma-worker
```

**If not running, start it:**
```bash
docker start rma-cpu-worker
```

## Advanced Configuration

### Running Multiple Workers on Same Host

**Multiple Workers with Different Types:**
```bash
# GPU Worker
docker run -d \
  --name rma-gpu-worker \
  --restart unless-stopped \
  --gpus all \
  -e COORDINATOR_URL=https://api.rmatool.org.uk \
  -e WORKER_TYPE=gpu \
  -e WORKER_NAME=$(hostname)-gpu \
  ghcr.io/st7ma784/cmacatalyst/universal-worker:latest

# CPU Worker
docker run -d \
  --name rma-cpu-worker \
  --restart unless-stopped \
  -e COORDINATOR_URL=https://api.rmatool.org.uk \
  -e WORKER_TYPE=cpu \
  -e WORKER_NAME=$(hostname)-cpu \
  ghcr.io/st7ma784/cmacatalyst/universal-worker:latest

# Storage Worker
docker run -d \
  --name rma-storage-worker \
  --restart unless-stopped \
  -v ./chroma-data:/chroma/chroma \
  -e COORDINATOR_URL=https://api.rmatool.org.uk \
  -e WORKER_TYPE=storage \
  -e WORKER_NAME=$(hostname)-storage \
  ghcr.io/st7ma784/cmacatalyst/universal-worker:latest
```

### Resource Constraints

**Limit CPU and Memory:**
```bash
docker run -d \
  --name rma-cpu-worker \
  --restart unless-stopped \
  --memory=8g \
  --cpus=4 \
  -e COORDINATOR_URL=https://api.rmatool.org.uk \
  -e WORKER_TYPE=cpu \
  ghcr.io/st7ma784/cmacatalyst/universal-worker:latest
```

**Limit GPU Memory:**
```bash
docker run -d \
  --name rma-gpu-worker \
  --restart unless-stopped \
  --gpus all \
  -e COORDINATOR_URL=https://api.rmatool.org.uk \
  -e WORKER_TYPE=gpu \
  -e GPU_MEMORY_UTILIZATION=0.7 \
  ghcr.io/st7ma784/cmacatalyst/universal-worker:latest
```

## Firewall Configuration

Ensure outbound connections are allowed:

```bash
# Allow HTTPS to coordinator
sudo ufw allow out 443/tcp

# For internal Docker networking
sudo ufw allow in on docker0
```

## Security Best Practices

1. **Use latest images**: Always pull the latest worker images for security updates
2. **Limit resource access**: Use Docker resource constraints
3. **Monitor logs**: Regularly check logs for suspicious activity
4. **Network isolation**: Consider using Docker networks for isolation
5. **Read-only volumes**: Mount sensitive volumes as read-only when possible

## Contributing Compute Time

By running a worker, you're contributing to the RMA distributed system:

**Worker Types:**
- **GPU Workers (Tier 1)**: LLM inference, vision/OCR, RAG embeddings
- **CPU Workers (Tier 2)**: NER extraction, document processing, notes/COA generation
- **Storage Workers (Tier 3)**: ChromaDB, Redis, PostgreSQL, MinIO, Neo4j
- **Edge Workers (Tier 4)**: Coordinator, edge proxy, load balancer

**Auto-Detection (Recommended):**
Use `WORKER_TYPE=auto` to let the worker automatically detect capabilities and register appropriate services.

Your contribution helps researchers and organizations process documents efficiently!

## Getting Help

- **Check logs**: `docker logs rma-worker`
- **View worker services**: `docker logs rma-worker | grep "Detected"`
- **View dashboard**: https://dashboard.rmatool.org.uk
- **API status**: https://api.rmatool.org.uk/health
- **Check registered workers**: `curl https://api.rmatool.org.uk/api/admin/workers | jq`
- **GitHub Issues**: https://github.com/st7ma784/CMACatalyst/issues

## Cost & Resource Usage

**Typical Resource Usage:**

| Worker Type | CPU | RAM | GPU | Storage |
|-------------|-----|-----|-----|------|
| Auto-Detection | 2-8 cores | 8-16GB | Optional | 2-10GB |
| GPU Worker | 4-8 cores | 8-16GB | 8GB+ VRAM | 10GB |
| CPU Worker | 2-4 cores | 4-8GB | - | 2GB |
| Storage Worker | 2-4 cores | 8-16GB | - | 50-500GB |
| Edge Worker | 2-4 cores | 4-8GB | - | 2GB |

**Network Usage:**
- Heartbeats: ~1KB every 30 seconds (~100KB/day)
- Job data: Varies by task (typically 1-100MB per job)
- Estimated monthly bandwidth: 1-10GB for active workers

## License

Workers run open-source software under the MIT License. By contributing compute time, you agree to process documents and data submitted to the RMA system.
