# Worker Deployment Guide

This guide provides complete commands for deploying GPU or CPU workers to donate compute time to the RMA distributed system.

## Prerequisites

- Docker installed on your host
- Docker Compose (optional, for easier management)
- Network connectivity to the coordinator at `https://api.rmatool.org.uk`
- For GPU workers: NVIDIA GPU with drivers installed and nvidia-docker runtime

## Quick Start

### CPU Worker Deployment

**Single Command Deployment:**
```bash
docker run -d \
  --name rma-cpu-worker \
  --restart unless-stopped \
  -e COORDINATOR_URL=https://api.rmatool.org.uk \
  -e WORKER_TYPE=cpu \
  -e WORKER_NAME=$(hostname)-cpu \
  ghcr.io/st7ma784/cmacatalyst/cpu-worker:latest
```

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
  ghcr.io/st7ma784/cmacatalyst/gpu-worker:latest
```

## Detailed Setup

### Step 1: Pull the Worker Image

**For CPU Workers:**
```bash
docker pull ghcr.io/st7ma784/cmacatalyst/cpu-worker:latest
```

**For GPU Workers:**
```bash
docker pull ghcr.io/st7ma784/cmacatalyst/gpu-worker:latest
```

### Step 2: Configure Environment Variables

Create a configuration file for your worker:

**CPU Worker (`cpu-worker.env`):**
```bash
COORDINATOR_URL=https://api.rmatool.org.uk
WORKER_TYPE=cpu
WORKER_NAME=my-cpu-worker-01
HEARTBEAT_INTERVAL=30
MAX_CONCURRENT_JOBS=4
```

**GPU Worker (`gpu-worker.env`):**
```bash
COORDINATOR_URL=https://api.rmatool.org.uk
WORKER_TYPE=gpu
WORKER_NAME=my-gpu-worker-01
HEARTBEAT_INTERVAL=30
MAX_CONCURRENT_JOBS=2
GPU_MEMORY_LIMIT=8GB
```

### Step 3: Run the Worker

**CPU Worker with Config File:**
```bash
docker run -d \
  --name rma-cpu-worker \
  --restart unless-stopped \
  --env-file cpu-worker.env \
  -v /var/run/docker.sock:/var/run/docker.sock \
  ghcr.io/st7ma784/cmacatalyst/cpu-worker:latest
```

**GPU Worker with Config File:**
```bash
docker run -d \
  --name rma-gpu-worker \
  --restart unless-stopped \
  --gpus all \
  --env-file gpu-worker.env \
  -v /var/run/docker.sock:/var/run/docker.sock \
  ghcr.io/st7ma784/cmacatalyst/gpu-worker:latest
```

## Docker Compose Deployment

For easier management, use Docker Compose:

### CPU Worker (`docker-compose-cpu.yml`)

```yaml
version: '3.8'

services:
  cpu-worker:
    image: ghcr.io/st7ma784/cmacatalyst/cpu-worker:latest
    container_name: rma-cpu-worker
    restart: unless-stopped
    environment:
      - COORDINATOR_URL=https://api.rmatool.org.uk
      - WORKER_TYPE=cpu
      - WORKER_NAME=${HOSTNAME}-cpu
      - HEARTBEAT_INTERVAL=30
      - MAX_CONCURRENT_JOBS=4
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
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

### GPU Worker (`docker-compose-gpu.yml`)

```yaml
version: '3.8'

services:
  gpu-worker:
    image: ghcr.io/st7ma784/cmacatalyst/gpu-worker:latest
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
      - MAX_CONCURRENT_JOBS=2
      - GPU_MEMORY_LIMIT=8GB
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
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

## Worker Management Commands

### Check Worker Status
```bash
# View logs
docker logs rma-cpu-worker
docker logs rma-gpu-worker

# Follow logs in real-time
docker logs -f rma-cpu-worker

# Check worker registration
curl https://api.rmatool.org.uk/api/admin/workers
```

### Stop Worker
```bash
docker stop rma-cpu-worker
# or
docker stop rma-gpu-worker
```

### Restart Worker
```bash
docker restart rma-cpu-worker
# or
docker restart rma-gpu-worker
```

### Remove Worker
```bash
docker stop rma-cpu-worker && docker rm rma-cpu-worker
# or
docker stop rma-gpu-worker && docker rm rma-gpu-worker
```

### Update Worker
```bash
# Pull latest image
docker pull ghcr.io/st7ma784/cmacatalyst/cpu-worker:latest

# Stop and remove old container
docker stop rma-cpu-worker && docker rm rma-cpu-worker

# Start new container with same configuration
docker run -d \
  --name rma-cpu-worker \
  --restart unless-stopped \
  --env-file cpu-worker.env \
  -v /var/run/docker.sock:/var/run/docker.sock \
  ghcr.io/st7ma784/cmacatalyst/cpu-worker:latest
```

## Environment Variables Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `COORDINATOR_URL` | Yes | - | URL of the coordinator service |
| `WORKER_TYPE` | Yes | - | Type of worker: `cpu` or `gpu` |
| `WORKER_NAME` | No | `hostname` | Unique identifier for this worker |
| `HEARTBEAT_INTERVAL` | No | `30` | Seconds between heartbeats |
| `MAX_CONCURRENT_JOBS` | No | `4` (CPU), `2` (GPU) | Maximum parallel jobs |
| `GPU_MEMORY_LIMIT` | No | `8GB` | GPU memory limit (GPU workers only) |
| `LOG_LEVEL` | No | `INFO` | Logging level: `DEBUG`, `INFO`, `WARNING`, `ERROR` |

## Monitoring Your Worker

### View Worker in Dashboard
Visit the admin dashboard to see your worker's status:
```
https://dashboard.rmatool.org.uk
```

### Check Worker Health
```bash
# Get worker info from coordinator
curl https://api.rmatool.org.uk/api/admin/workers | jq

# Check if worker is registered
curl https://api.rmatool.org.uk/api/admin/workers | jq '.workers[] | select(.name=="my-cpu-worker-01")'
```

### Monitor Resource Usage
```bash
# Check CPU and memory usage
docker stats rma-cpu-worker

# For GPU workers, check GPU usage
nvidia-smi

# Watch GPU usage in real-time
watch -n 1 nvidia-smi
```

## Troubleshooting

### Worker Not Registering

**Check network connectivity:**
```bash
docker exec rma-cpu-worker curl -v https://api.rmatool.org.uk/health
```

**Check worker logs:**
```bash
docker logs rma-cpu-worker | grep -i error
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

### High CPU/Memory Usage

**Reduce concurrent jobs:**
```bash
docker stop rma-cpu-worker
docker rm rma-cpu-worker

# Restart with lower MAX_CONCURRENT_JOBS
docker run -d \
  --name rma-cpu-worker \
  --restart unless-stopped \
  -e COORDINATOR_URL=https://api.rmatool.org.uk \
  -e WORKER_TYPE=cpu \
  -e WORKER_NAME=$(hostname)-cpu \
  -e MAX_CONCURRENT_JOBS=2 \
  ghcr.io/st7ma784/cmacatalyst/cpu-worker:latest
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

**Multiple CPU Workers:**
```bash
# Worker 1
docker run -d \
  --name rma-cpu-worker-1 \
  --restart unless-stopped \
  -e COORDINATOR_URL=https://api.rmatool.org.uk \
  -e WORKER_TYPE=cpu \
  -e WORKER_NAME=$(hostname)-cpu-1 \
  -e MAX_CONCURRENT_JOBS=2 \
  ghcr.io/st7ma784/cmacatalyst/cpu-worker:latest

# Worker 2
docker run -d \
  --name rma-cpu-worker-2 \
  --restart unless-stopped \
  -e COORDINATOR_URL=https://api.rmatool.org.uk \
  -e WORKER_TYPE=cpu \
  -e WORKER_NAME=$(hostname)-cpu-2 \
  -e MAX_CONCURRENT_JOBS=2 \
  ghcr.io/st7ma784/cmacatalyst/cpu-worker:latest
```

### Custom Service Configuration

Workers can be configured to run specific services:

```bash
docker run -d \
  --name rma-specialized-worker \
  --restart unless-stopped \
  -e COORDINATOR_URL=https://api.rmatool.org.uk \
  -e WORKER_TYPE=cpu \
  -e WORKER_NAME=$(hostname)-ocr-specialist \
  -e SERVICES=ocr,ner \
  ghcr.io/st7ma784/cmacatalyst/cpu-worker:latest
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

- **CPU Workers**: Handle document processing, OCR, NER, and general tasks
- **GPU Workers**: Handle AI inference, vision models, and GPU-accelerated tasks

Your contribution helps researchers and organizations process documents efficiently!

## Getting Help

- **Check logs**: `docker logs rma-cpu-worker`
- **View dashboard**: https://dashboard.rmatool.org.uk
- **API status**: https://api.rmatool.org.uk/health
- **GitHub Issues**: https://github.com/st7ma784/CMACatalyst/issues

## Cost & Resource Usage

**Typical Resource Usage:**

| Worker Type | CPU | RAM | GPU | Storage |
|-------------|-----|-----|-----|---------|
| CPU Worker | 2-4 cores | 4-8GB | - | 2GB |
| GPU Worker | 4-8 cores | 8-16GB | 1 GPU | 10GB |

**Network Usage:**
- Heartbeats: ~1KB every 30 seconds (~100KB/day)
- Job data: Varies by task (typically 1-100MB per job)
- Estimated monthly bandwidth: 1-10GB for active workers

## License

Workers run open-source software under the MIT License. By contributing compute time, you agree to process documents and data submitted to the RMA system.
