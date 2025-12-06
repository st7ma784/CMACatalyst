# Model Management Quick Start

Quick reference for setting up model management with volume mounting and GPU scaling.

## TL;DR

```bash
# 1. Enable model volume mounting (edit docker-compose.yml)
# Already configured! Uses shared volume: model_cache

# 2. Start services (models download automatically on first run)
cd RMA-Demo
docker-compose up -d

# 3. Watch model download progress
docker logs -f rma-vllm

# 4. Check downloaded models
docker exec rma-vllm du -sh /models/*

# Done! Models are cached and shared across containers.
```

---

## Model Sizes

| Model | Size | GPU Memory | Download Time (100Mbps) |
|-------|------|------------|-------------------------|
| Mistral-7B | ~14GB | 8GB+ | 15-20 min |
| llava:7b | 4.7GB | 4GB+ | 5-8 min |
| nomic-embed-text | 274MB | 512MB+ | 30 sec |
| llama3.2 | 2.0GB | 2GB+ | 2-3 min |

**Total for full stack**: ~20GB disk, ~12GB GPU memory

---

## Setup Options

### Option 1: Quick Start (Named Volumes - Default)

Already configured in `docker-compose.yml`:

```yaml
volumes:
  - model_cache:/models
```

**Usage**:
```bash
docker-compose up -d
# First run: downloads models (15-30 min)
# Subsequent runs: instant startup
```

**Check cache**:
```bash
docker volume inspect rma-demo_model_cache
```

### Option 2: Host Directory (Recommended)

Create `docker-compose.override.yml`:

```yaml
version: '3.8'
services:
  vllm:
    volumes:
      - /data/ai-models:/models
  embedding-service:
    volumes:
      - /data/ai-models:/models
  gpu-worker:
    volumes:
      - /data/ai-models:/models
```

**Setup**:
```bash
# Create directory
sudo mkdir -p /data/ai-models
sudo chown -R $(id -u):$(id -g) /data/ai-models

# Start services
docker-compose up -d
```

**Benefits**:
- Full control over location
- Easy backup/restore
- Share across projects

---

## GPU Configuration

### Single GPU (8GB+)

Default configuration works out of the box:

```yaml
services:
  vllm:
    deploy:
      resources:
        reservations:
          memory: 8G
          devices:
            - driver: nvidia
              count: 1
              capabilities: [gpu]
```

### Multiple GPUs

Edit `docker-compose.yml`:

```yaml
services:
  vllm:
    environment:
      - NVIDIA_VISIBLE_DEVICES=0  # Use GPU 0

  ocr-gpu-worker:
    environment:
      - NVIDIA_VISIBLE_DEVICES=1  # Use GPU 1
```

### GPU Memory < 8GB

Use quantized models:

```yaml
services:
  vllm:
    command: >
      --model TheBloke/Mistral-7B-Instruct-v0.2-GPTQ
      --gpu-memory-utilization 0.7
      --max-model-len 2048
```

---

## Pre-download Models (Optional)

Skip waiting on first startup by pre-downloading models:

```bash
# Using download script
cd RMA-Demo
./scripts/download-models.sh gpu-worker

# Or via Docker
docker run --rm \
  -v /data/ai-models:/models \
  -e OLLAMA_URL=http://host.docker.internal:11434 \
  rma-gpu-worker:latest \
  /usr/local/bin/download-models.sh all
```

---

## Common Commands

### Check Model Cache

```bash
# View cache size
docker exec rma-vllm du -sh /models

# List models
docker exec rma-vllm ls -lh /models/huggingface/hub
docker exec rma-vllm ls -lh /models/ollama/models

# Check logs
docker exec rma-vllm cat /var/log/model-download.log
```

### Monitor GPU Usage

```bash
# Real-time GPU monitoring
watch -n 1 nvidia-smi

# Check memory usage
nvidia-smi --query-gpu=memory.used,memory.total --format=csv
```

### Clean Cache

```bash
# Remove all cached models
docker volume rm rma-demo_model_cache

# Remove specific model
docker exec rma-vllm rm -rf /models/huggingface/hub/models--old-model
```

---

## Troubleshooting

### Models re-downloading every restart?

**Check volume persistence**:
```bash
docker volume ls | grep model_cache
docker exec rma-vllm ls /models
```

**Fix**: Ensure volume is defined in `docker-compose.yml`:
```yaml
volumes:
  model_cache:
```

### Out of disk space?

**Check usage**:
```bash
df -h
docker system df -v
```

**Solutions**:
- Use host directory on larger disk
- Remove unused models
- Use quantized models

### GPU out of memory?

**Check GPU**:
```bash
nvidia-smi
```

**Reduce memory usage**:
```yaml
command: >
  --gpu-memory-utilization 0.7  # Reduce from 0.9
  --max-model-len 2048           # Reduce context
```

### Model download hanging?

**Check network**:
```bash
# Test HuggingFace
curl -I https://huggingface.co

# Check logs
docker logs rma-vllm
```

**Restart**:
```bash
docker-compose restart vllm
```

---

## Volume Mounting Examples

### Development (Auto-managed)

```yaml
volumes:
  model_cache:  # Docker manages location
```

### Production (Host directory)

```yaml
services:
  vllm:
    volumes:
      - /data/ai-models:/models
```

### Multi-host (NFS)

```yaml
volumes:
  model_cache:
    driver: local
    driver_opts:
      type: nfs
      o: addr=nfs-server,rw
      device: ":/exports/ai-models"
```

---

## Environment Variables

### Essential

```bash
# Model cache locations
MODEL_CACHE_DIR=/models
HF_HOME=/models/huggingface
OLLAMA_MODELS=/models/ollama

# GPU config
NVIDIA_VISIBLE_DEVICES=all
MIN_GPU_MEMORY_GB=8

# Worker type
WORKER_TYPE=gpu-worker
```

### Optional

```bash
# Logging
LOG_LEVEL=INFO
LOG_FILE=/var/log/model-download.log

# Download settings
ENABLE_GPU=auto
OLLAMA_URL=http://localhost:11434
```

---

## Performance Tips

1. **Pre-download models** before production deployment
2. **Use host volumes** for faster I/O and easier management
3. **Monitor disk space** - models are 20-50GB total
4. **Use quantized models** if GPU memory < 12GB
5. **Share volumes** across containers to avoid duplication

---

## Architecture

```
┌─────────────────────────────────────────────────┐
│  Host Machine                                   │
│                                                 │
│  /data/ai-models/  (or Docker volume)          │
│  ├── huggingface/                               │
│  │   └── hub/                                   │
│  │       └── models--mistralai--Mistral-7B/    │
│  ├── ollama/                                    │
│  │   └── models/                                │
│  │       ├── llava/                             │
│  │       └── nomic-embed-text/                  │
│  └── vllm/                                      │
│                                                 │
│  ┌─────────────┐  ┌──────────────┐            │
│  │ vLLM        │  │ GPU Worker   │            │
│  │ Container   │  │ Container    │            │
│  │             │  │              │            │
│  │ /models ───┼──┼── /models     │            │
│  │             │  │              │            │
│  │ Reads:      │  │ Writes:      │            │
│  │ Mistral-7B  │  │ Downloads    │            │
│  │ nomic-embed │  │ models on    │            │
│  │             │  │ spin-up      │            │
│  └─────────────┘  └──────────────┘            │
│         ▲                 ▲                     │
│         └─────────────────┘                     │
│         Shared volume mount                     │
└─────────────────────────────────────────────────┘
```

---

## Next Steps

1. Read [Full Model Management Guide](docs/MODEL_MANAGEMENT_GUIDE.md)
2. Configure GPU settings for your hardware
3. Set up monitoring and alerts
4. Plan backup strategy for model cache

---

**Need Help?**
- Check logs: `docker logs rma-vllm`
- GPU status: `nvidia-smi`
- Disk usage: `docker system df -v`
