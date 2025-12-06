# Model Management Guide

## Overview

This guide explains the model management strategy for RMA-Demo, focusing on:
- Downloading models at worker spin-up (not build time)
- Volume mounting for model sharing across containers
- GPU scaling and resource allocation
- OCR model optimization

## Table of Contents

1. [Model Architecture](#model-architecture)
2. [Volume Mounting Strategy](#volume-mounting-strategy)
3. [GPU Scaling](#gpu-scaling)
4. [Model Download on Worker Spin-up](#model-download-on-worker-spin-up)
5. [Configuration Examples](#configuration-examples)
6. [Troubleshooting](#troubleshooting)

---

## Model Architecture

### Models Used in RMA-Demo

| Model | Type | Size | GPU Memory | Purpose | Worker Type |
|-------|------|------|------------|---------|-------------|
| **mistralai/Mistral-7B-Instruct-v0.2** | LLM | ~14GB | 8GB+ | Text generation, analysis | vLLM, GPU |
| **llava:7b** | Vision | 4.7GB | 4GB+ | Document OCR, vision | OCR, GPU |
| **llava-next:34b-v1.5-q4_K_M** | Vision | ~20GB | 24GB+ | Advanced OCR (optional) | GPU (high-mem) |
| **nomic-embed-text** | Embedding | 274MB | 512MB+ | Text embeddings for RAG | Embedding, CPU/GPU |
| **llama3.2** | LLM | 2.0GB | 2GB+ | Lightweight text gen | CPU, GPU |

### Model Storage Layout

```
/models/                          # Main model cache
├── huggingface/                  # HuggingFace models (vLLM, embeddings)
│   └── hub/
│       ├── models--mistralai--Mistral-7B-Instruct-v0.2/
│       └── models--sentence-transformers--all-MiniLM-L6-v2/
├── ollama/                       # Ollama models (vision, text)
│   ├── models/
│   │   ├── llava/
│   │   ├── llama3.2/
│   │   └── nomic-embed-text/
│   └── manifests/
└── vllm/                         # vLLM-specific cache
    └── mistralai/
```

---

## Volume Mounting Strategy

### Why Volume Mounting?

1. **Avoid Re-downloading**: Models are large (2-20GB). Volume mounting allows sharing across containers.
2. **Faster Startup**: Pre-downloaded models mean instant worker spin-up.
3. **Bandwidth Savings**: Download once, use everywhere.
4. **Persistence**: Models survive container restarts.

### Option 1: Docker Named Volumes (Default)

**Pros**: Simple, managed by Docker
**Cons**: Less control over location

```yaml
# In docker-compose.yml
services:
  vllm:
    volumes:
      - model_cache:/models

volumes:
  model_cache:
    driver: local
```

**Usage**:
```bash
# Start services
docker-compose up -d

# Check volume
docker volume ls | grep model_cache
docker volume inspect rma-demo_model_cache

# View contents
docker run --rm -v rma-demo_model_cache:/models alpine ls -lh /models
```

### Option 2: Host Directory Mounting (Recommended for Production)

**Pros**: Full control, easy backup, shared across projects
**Cons**: Requires manual directory management

```yaml
# In docker-compose.yml
services:
  vllm:
    volumes:
      - /data/ai-models:/models  # Host path : Container path
```

**Setup**:
```bash
# Create host directory
sudo mkdir -p /data/ai-models/{huggingface,ollama,vllm}
sudo chown -R 1000:1000 /data/ai-models

# Pre-download models (optional)
docker run --rm -v /data/ai-models:/models \
  rma-gpu-worker:latest \
  /usr/local/bin/download-models.sh gpu-worker

# Start services with host mount
docker-compose up -d
```

### Option 3: NFS/Network Storage (Multi-Host)

For multiple GPU hosts sharing the same models:

```yaml
volumes:
  model_cache:
    driver: local
    driver_opts:
      type: nfs
      o: addr=nfs-server.local,rw
      device: ":/exports/ai-models"
```

---

## GPU Scaling

### Minimum Requirements

| Worker Type | Min GPU Memory | Recommended | Models Loaded |
|-------------|----------------|-------------|---------------|
| OCR Worker | 4GB | 8GB | llava:7b |
| GPU Worker | 8GB | 12GB | Mistral-7B + llava:7b |
| High-Memory GPU | 24GB | 32GB | llava-next:34b + Mistral-7B |

### GPU Configuration

#### Single GPU (8GB+)

```yaml
# docker-compose.yml
services:
  vllm:
    deploy:
      resources:
        limits:
          memory: 12G
        reservations:
          memory: 8G
          devices:
            - driver: nvidia
              count: 1  # Use 1 GPU
              capabilities: [gpu]
    environment:
      - NVIDIA_VISIBLE_DEVICES=0  # Specify GPU 0
```

#### Multi-GPU Setup

```yaml
services:
  vllm:
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: all  # Use all GPUs
              capabilities: [gpu]
    command: >
      --model mistralai/Mistral-7B-Instruct-v0.2
      --gpu-memory-utilization 0.9
      --tensor-parallel-size 2  # Split across 2 GPUs

  # Separate OCR worker on different GPU
  ocr-gpu-worker:
    environment:
      - NVIDIA_VISIBLE_DEVICES=1  # Use GPU 1
```

#### GPU Memory Optimization

```yaml
services:
  vllm:
    environment:
      # Model cache
      - HF_HOME=/models/huggingface

    command: >
      --model mistralai/Mistral-7B-Instruct-v0.2
      --gpu-memory-utilization 0.9  # Use 90% of available GPU memory
      --max-model-len 4096          # Limit context length to save memory
      --download-dir /models/vllm   # Download to shared volume
```

---

## Model Download on Worker Spin-up

### How It Works

1. **Container Starts**: GPU worker container starts up
2. **Check Volume**: Script checks `/models` for existing models
3. **Download if Missing**: Downloads only missing models
4. **Log Progress**: Detailed logs for container hosts
5. **Start Worker**: Worker registers with coordinator

### Download Script Usage

The universal model download script supports different worker types:

```bash
# GPU worker (LLM + Vision + Embeddings)
/usr/local/bin/download-models.sh gpu-worker

# OCR-only worker (Vision models)
/usr/local/bin/download-models.sh ocr

# Embedding-only worker
/usr/local/bin/download-models.sh embedding

# vLLM-only worker
/usr/local/bin/download-models.sh vllm

# CPU worker (lightweight models)
/usr/local/bin/download-models.sh cpu-worker

# Download all models
/usr/local/bin/download-models.sh all
```

### Environment Variables

```bash
# Model cache location
MODEL_CACHE_DIR=/models              # Main cache directory
HF_HOME=/models/huggingface          # HuggingFace cache
OLLAMA_MODELS=/models/ollama         # Ollama cache
VLLM_CACHE=/models/vllm              # vLLM cache

# GPU configuration
MIN_GPU_MEMORY_GB=8                  # Minimum GPU memory required
ENABLE_GPU=auto                       # auto, true, false

# Ollama connection
OLLAMA_URL=http://localhost:11434    # Ollama API endpoint

# Logging
LOG_LEVEL=INFO                        # DEBUG, INFO, WARN, ERROR
LOG_FILE=/var/log/model-download.log # Log file location

# Worker type
WORKER_TYPE=gpu-worker                # Worker type for model selection
```

### Logs and Monitoring

View model download logs:

```bash
# GPU Worker logs
docker logs rma-gpu-worker | grep "Downloading"

# Check download progress
docker exec rma-gpu-worker tail -f /var/log/model-download.log

# View model cache sizes
docker exec rma-gpu-worker du -sh /models/*
```

---

## Configuration Examples

### Example 1: Development Setup (Docker Named Volumes)

```yaml
# docker-compose.yml
version: '3.8'

services:
  vllm:
    image: vllm/vllm-openai:latest
    volumes:
      - model_cache:/models
    environment:
      - HF_HOME=/models/huggingface
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: 1
              capabilities: [gpu]
    command: --model mistralai/Mistral-7B-Instruct-v0.2 --download-dir /models/vllm

volumes:
  model_cache:
```

**First Run**:
```bash
docker-compose up -d
# Models download automatically (may take 10-30 minutes)

docker logs -f rma-vllm
# Watch download progress
```

**Subsequent Runs**:
```bash
docker-compose down
docker-compose up -d
# Instant startup, models already cached
```

### Example 2: Production Setup (Host Directory Mounting)

```yaml
# docker-compose.override.yml
version: '3.8'

services:
  vllm:
    volumes:
      - /data/ai-models:/models
    environment:
      - HF_HOME=/models/huggingface
      - TRANSFORMERS_CACHE=/models/huggingface

  embedding-service:
    volumes:
      - /data/ai-models:/models
    environment:
      - HF_HOME=/models/huggingface

  gpu-worker:
    volumes:
      - /data/ai-models:/models
    environment:
      - MODEL_CACHE_DIR=/models
```

**Pre-download Models**:
```bash
# Create directory
sudo mkdir -p /data/ai-models
sudo chown -R $(id -u):$(id -g) /data/ai-models

# Pre-download all models
docker run --rm \
  -v /data/ai-models:/models \
  -e OLLAMA_URL=http://host.docker.internal:11434 \
  rma-gpu-worker:latest \
  /usr/local/bin/download-models.sh all

# Verify
du -sh /data/ai-models/*
```

### Example 3: Multi-GPU OCR Setup

```yaml
# docker-compose.gpu.yml
version: '3.8'

services:
  # Main LLM on GPU 0
  vllm:
    volumes:
      - /data/ai-models:/models
    environment:
      - NVIDIA_VISIBLE_DEVICES=0
      - HF_HOME=/models/huggingface
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              device_ids: ['0']
              capabilities: [gpu]

  # OCR worker on GPU 1
  ocr-gpu-worker:
    build: ./worker-containers/gpu-worker
    volumes:
      - /data/ai-models:/models
    environment:
      - NVIDIA_VISIBLE_DEVICES=1
      - WORKER_TYPE=ocr
      - MODEL_CACHE_DIR=/models
      - OLLAMA_MODELS=/models/ollama
    deploy:
      resources:
        limits:
          memory: 12G
        reservations:
          memory: 6G
          devices:
            - driver: nvidia
              device_ids: ['1']
              capabilities: [gpu]
```

### Example 4: GPU + CPU Hybrid

```yaml
services:
  # GPU worker for heavy models
  vllm:
    volumes:
      - /data/ai-models:/models
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: 1
              capabilities: [gpu]

  # CPU worker for lightweight tasks
  cpu-worker:
    build: ./worker-containers/cpu-worker
    volumes:
      - /data/ai-models:/models
    environment:
      - WORKER_TYPE=cpu-worker
      - MODEL_CACHE_DIR=/models
    # No GPU allocation
```

---

## Troubleshooting

### Issue: Models Re-downloading on Every Restart

**Cause**: Volume not persisting

**Solution**:
```bash
# Check volumes
docker volume ls

# Inspect volume
docker volume inspect rma-demo_model_cache

# Verify mount
docker exec rma-vllm ls -lh /models
```

### Issue: Out of Disk Space

**Cause**: Models are large (20-50GB total)

**Solution**:
```bash
# Check disk usage
df -h

# Clean old models
docker exec rma-vllm rm -rf /models/huggingface/hub/.cache

# Use host directory with more space
# In docker-compose.yml:
volumes:
  - /data/large-disk/ai-models:/models
```

### Issue: GPU Out of Memory

**Cause**: Too many models loaded, insufficient GPU memory

**Solution**:
```bash
# Check GPU usage
nvidia-smi

# Reduce GPU memory utilization in vLLM
command: >
  --model mistralai/Mistral-7B-Instruct-v0.2
  --gpu-memory-utilization 0.7  # Reduce from 0.9 to 0.7
  --max-model-len 2048           # Reduce context length

# Or use quantized models
command: --model TheBloke/Mistral-7B-Instruct-v0.2-GPTQ
```

### Issue: Model Download Hangs

**Cause**: Network issues, Ollama not ready

**Solution**:
```bash
# Check Ollama health
curl http://localhost:11434/api/tags

# Check logs
docker logs rma-gpu-worker

# Manually download model
docker exec -it rma-gpu-worker bash
OLLAMA_MODELS=/models/ollama ollama pull llava:7b
```

### Issue: Permission Denied on Host Mount

**Cause**: Container user doesn't have write access

**Solution**:
```bash
# Fix permissions
sudo chown -R 1000:1000 /data/ai-models

# Or in docker-compose.yml:
services:
  vllm:
    user: "1000:1000"
```

### Issue: Cannot Share Models Across Hosts

**Cause**: Models stored in Docker volumes

**Solution**: Use NFS or shared storage
```yaml
volumes:
  model_cache:
    driver: local
    driver_opts:
      type: nfs
      o: addr=192.168.1.100,rw,nolock,soft
      device: ":/exports/ai-models"
```

---

## Performance Tips

### 1. Pre-download Models Before Production

```bash
# Download all models to host directory
./scripts/download-models.sh all

# Or use Docker
docker run --rm -v /data/ai-models:/models \
  rma-gpu-worker:latest \
  /usr/local/bin/download-models.sh all
```

### 2. Use Quantized Models for Lower Memory

```yaml
# 4-bit quantized Mistral (4GB instead of 14GB)
command: --model TheBloke/Mistral-7B-Instruct-v0.2-GPTQ
```

### 3. Monitor Model Cache Size

```bash
# Create monitoring script
cat > check-model-cache.sh << 'EOF'
#!/bin/bash
echo "Model Cache Sizes:"
docker exec rma-vllm du -sh /models/* 2>/dev/null || echo "vLLM not running"
EOF

chmod +x check-model-cache.sh
./check-model-cache.sh
```

### 4. Clean Unused Models

```bash
# Remove old/unused models
docker exec rma-vllm rm -rf /models/huggingface/hub/models--old-model
```

---

## Quick Reference

### Environment Variables Summary

```bash
# Model Cache
MODEL_CACHE_DIR=/models
HF_HOME=/models/huggingface
OLLAMA_MODELS=/models/ollama
VLLM_CACHE=/models/vllm
TRANSFORMERS_CACHE=/models/huggingface

# GPU Config
NVIDIA_VISIBLE_DEVICES=all
MIN_GPU_MEMORY_GB=8

# Worker Type
WORKER_TYPE=gpu-worker  # gpu-worker, ocr, embedding, vllm, cpu-worker
```

### Common Commands

```bash
# Check GPU
nvidia-smi

# View model cache
docker exec rma-vllm ls -lh /models

# Download models manually
docker run --rm -v model_cache:/models rma-gpu-worker /usr/local/bin/download-models.sh gpu-worker

# Clean cache
docker volume rm rma-demo_model_cache

# Check disk usage
docker system df -v
```

---

## Related Documentation

- [GPU Sharing Guide](GPU_SHARING_GUIDE.md)
- [Worker Deployment](../deployment/worker-deployment.md)
- [OCR Service Guide](OCR_SERVICE_INTEGRATION_GUIDE.md)

---

**Last Updated**: December 2025
**Status**: Production Ready
