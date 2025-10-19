# GPU Sharing Guide for RMA Demo

## Overview

This guide explains how multiple Docker containers share GPU resources for running LLaVA, Llama, and other AI models concurrently.

## Current GPU Configuration

### Services with GPU Access

1. **Ollama Container** (`rma-ollama`)
   - Primary GPU user
   - Runs: llama3.2, llava:13b, nomic-embed-text
   - GPU allocation: All available GPUs
   - Port: 11434

2. **Doc-Processor Container** (`rma-doc-processor`)
   - Uses Ollama via HTTP for LLaVA vision model
   - GPU allocation: All available GPUs (shared)
   - Port: 8101

### How GPU Sharing Works

Docker with NVIDIA Container Runtime allows **multiple containers to share the same GPU(s)** simultaneously. Each container that needs GPU access must have the GPU configuration in `docker-compose.yml`:

```yaml
deploy:
  resources:
    reservations:
      devices:
        - driver: nvidia
          count: all  # or specific number like 1
          capabilities: [gpu]
```

### Key Points

- **NVIDIA Container Runtime** manages GPU access across containers
- **Memory management**: Each container's GPU memory usage is independent but comes from the same physical GPU pool
- **Concurrent execution**: CUDA allows multiple processes to share GPU, but performance depends on available VRAM
- **No isolation**: Containers share the GPU - one container using 100% GPU will impact others

## GPU Memory Usage

### Current Model Sizes (Approximate VRAM)

| Model | Size | VRAM Required | Container |
|-------|------|---------------|-----------|
| llama3.2 | 3.8GB | ~4GB | Ollama |
| llava:13b | 7.4GB | ~8GB | Ollama (via doc-processor) |
| nomic-embed-text | 274MB | ~512MB | Ollama (via rag-service) |

**Total Peak Usage**: ~12.5GB VRAM when all models loaded

### Optimization Tips

1. **Model Offloading**
   - Ollama automatically unloads models after inactivity
   - Configure `OLLAMA_KEEP_ALIVE` environment variable (default: 5 minutes)
   - Set to lower value to free VRAM faster: `OLLAMA_KEEP_ALIVE=2m`

2. **Quantization**
   - Use quantized models for lower VRAM:
     - `llama3.2:4bit` instead of `llama3.2`
     - `llava:13b-q4` instead of `llava:13b`
   - Trade-off: Slightly lower accuracy for ~50% less VRAM

3. **Selective Model Loading**
   - Only load models you actively use
   - Remove unused models: `docker exec rma-ollama ollama rm <model>`

## Monitoring GPU Usage

### Real-time Monitoring

```bash
# Install nvidia-smi or nvtop
sudo apt install nvidia-utils  # for nvidia-smi
sudo apt install nvtop         # for interactive monitoring

# Watch GPU usage
watch -n 1 nvidia-smi

# Or use nvtop for better visualization
nvtop
```

### Check Container GPU Access

```bash
# Verify GPU access from within ollama container
docker exec rma-ollama nvidia-smi

# Check from doc-processor (via ollama)
docker exec rma-doc-processor curl http://ollama:11434/api/tags
```

### Docker Stats

```bash
# Monitor container resource usage
docker stats rma-ollama rma-doc-processor
```

## Configuration Examples

### Low VRAM Systems (<8GB)

Update `docker-compose.yml` to limit GPU memory per container:

```yaml
services:
  ollama:
    # ... existing config ...
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: 1
              capabilities: [gpu]
        limits:
          # Limit to 6GB VRAM
          memory: 6G
```

Use smaller/quantized models:
```bash
docker exec rma-ollama ollama pull llama3.2:4bit
docker exec rma-ollama ollama pull llava:7b  # smaller variant
```

### Multi-GPU Systems

Assign specific GPUs to specific containers:

```yaml
services:
  ollama:
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              device_ids: ['0']  # Use first GPU only
              capabilities: [gpu]
  
  doc-processor:
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              device_ids: ['1']  # Use second GPU
              capabilities: [gpu]
```

## Troubleshooting

### Issue: "CUDA out of memory"

**Solutions:**
1. Reduce concurrent model usage
2. Use quantized models
3. Increase `OLLAMA_KEEP_ALIVE` timeout to unload models faster
4. Restart Ollama to clear VRAM: `docker restart rma-ollama`

### Issue: "No GPU detected"

**Check:**
```bash
# Verify NVIDIA driver installed
nvidia-smi

# Check Docker has GPU access
docker run --rm --gpus all nvidia/cuda:12.0-base nvidia-smi

# Verify nvidia-container-runtime installed
docker info | grep -i runtime
```

**Fix:**
```bash
# Install NVIDIA Container Toolkit
distribution=$(. /etc/os-release;echo $ID$VERSION_ID)
curl -s -L https://nvidia.github.io/nvidia-docker/gpgkey | sudo apt-key add -
curl -s -L https://nvidia.github.io/nvidia-docker/$distribution/nvidia-docker.list | sudo tee /etc/apt/sources.list.d/nvidia-docker.list

sudo apt-get update
sudo apt-get install -y nvidia-container-toolkit
sudo systemctl restart docker
```

### Issue: Poor performance with multiple containers

**Optimize:**
1. **Sequential processing**: Process documents one at a time rather than batch
2. **Model caching**: Let Ollama keep frequently-used models loaded
3. **Async operations**: Use async/await in services to avoid blocking

## Performance Benchmarks

### Single Model Inference (llama3.2)
- **Tokens/sec**: ~40-60 (depends on GPU)
- **Latency**: ~1-2s for short responses

### Vision Model (LLaVA 13B)
- **Processing time**: ~30-60s per document page
- **VRAM spike**: Up to 8GB during inference

### Concurrent Usage
- **2 models active**: ~70% of single-model speed
- **3+ models active**: May queue requests (depends on VRAM)

## Best Practices

1. **Pre-load models on startup**
   ```bash
   # In container startup script
   ollama pull llama3.2
   ollama pull llava:13b
   ollama pull nomic-embed-text
   ```

2. **Configure timeouts appropriately**
   - Doc processing: 120s timeout
   - RAG queries: 30s timeout
   - Embeddings: 10s timeout

3. **Monitor and alert**
   - Set up alerts for GPU memory >90%
   - Monitor container restarts (OOM kills)

4. **Testing**
   ```bash
   # Test GPU sharing with concurrent requests
   # Terminal 1
   time docker exec rma-ollama ollama run llama3.2 "Hello"
   
   # Terminal 2 (run simultaneously)
   time curl -X POST http://localhost:8101/process -F "file=@test.pdf"
   ```

## Environment Variables

Add these to `.env` for GPU optimization:

```env
# Ollama GPU settings
OLLAMA_GPU_LAYERS=35          # Number of layers to offload to GPU (default: all)
OLLAMA_NUM_PARALLEL=2         # Concurrent requests (default: 4)
OLLAMA_KEEP_ALIVE=2m          # Keep model loaded (default: 5m)
OLLAMA_MAX_LOADED_MODELS=2    # Max models in VRAM (default: 3)

# For doc-processor
DOC_PROCESSOR_TIMEOUT=120     # Timeout for vision processing
```

Update `docker-compose.yml`:
```yaml
services:
  ollama:
    environment:
      - OLLAMA_GPU_LAYERS=${OLLAMA_GPU_LAYERS:-35}
      - OLLAMA_NUM_PARALLEL=${OLLAMA_NUM_PARALLEL:-2}
      - OLLAMA_KEEP_ALIVE=${OLLAMA_KEEP_ALIVE:-2m}
      - OLLAMA_MAX_LOADED_MODELS=${OLLAMA_MAX_LOADED_MODELS:-2}
```

## Summary

- ✅ **GPU sharing enabled** for Ollama and doc-processor containers
- ✅ All containers can use GPU **simultaneously** via NVIDIA Container Runtime
- ✅ Ollama acts as **GPU service hub** - other containers call it via HTTP
- ✅ Memory managed by CUDA - containers share VRAM pool
- ⚠️ Watch for OOM errors with large models on GPUs <16GB VRAM
- 💡 Use quantized models (`q4`, `q5`) for better memory efficiency

---

**Need help?** Check logs: `docker logs rma-ollama` or `docker logs rma-doc-processor`
