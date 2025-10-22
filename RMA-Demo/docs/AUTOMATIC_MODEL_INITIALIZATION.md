# Automatic Ollama Model Initialization

## Overview
This document describes the automatic model initialization system that ensures all required Ollama models are available before services start, preventing "model not found" errors.

## Required Models

| Model Name | Size | Purpose |
|------------|------|---------|
| `llava:7b` | 4.7 GB | Vision model for document OCR and image analysis |
| `llama3.2` | 2.0 GB | Text generation for queries, analysis, and chat |
| `nomic-embed-text` | 274 MB | Text embeddings for vector storage and semantic search |

## Implementation

### 1. Custom Ollama Entrypoint (`scripts/ollama-entrypoint.sh`)

The Ollama container uses a custom entrypoint that:
1. Starts the Ollama service in the background
2. Waits for Ollama to be ready (health check)
3. Checks for each required model
4. Automatically pulls any missing models
5. Keeps the container running

**Location:** `/scripts/ollama-entrypoint.sh`

```bash
#!/bin/bash
set -e

echo "🚀 Starting Ollama with automatic model initialization..."

# Start Ollama in the background
/bin/ollama serve &
OLLAMA_PID=$!

# Wait for Ollama to be ready
echo "⏳ Waiting for Ollama to be ready..."
max_attempts=30
attempt=0
while [ $attempt -lt $max_attempts ]; do
    if curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
        echo "✅ Ollama is ready!"
        break
    fi
    attempt=$((attempt + 1))
    echo "   Attempt $attempt/$max_attempts..."
    sleep 2
done

# Pull required models if they don't exist
REQUIRED_MODELS=("llava:7b" "llama3.2" "nomic-embed-text")
for model in "${REQUIRED_MODELS[@]}"; do
    echo "📦 Checking model: $model"
    if ! ollama list | grep -q "^${model}"; then
        echo "   ⬇️  Pulling $model..."
        ollama pull "$model"
        echo "   ✅ $model ready"
    else
        echo "   ✅ $model already exists"
    fi
done

echo "🎉 All models initialized! Ollama ready for use."

# Keep container alive
wait $OLLAMA_PID
```

### 2. Docker Compose Configuration

**File:** `docker-compose.local-parsing.yml`

#### Ollama Service Configuration

```yaml
ollama:
  image: ollama/ollama:latest
  container_name: rma-ollama
  ports:
    - "11434:11434"
  volumes:
    - ollama_data:/root/.ollama  # Persistent storage for models
    - ./scripts/ollama-entrypoint.sh:/usr/local/bin/ollama-entrypoint.sh:ro
  entrypoint: ["/bin/bash", "/usr/local/bin/ollama-entrypoint.sh"]
  deploy:
    resources:
      reservations:
        devices:
          - driver: nvidia
            count: all
            capabilities: [gpu]
  healthcheck:
    test: ["CMD", "curl", "-f", "http://localhost:11434/api/tags"]
    interval: 30s
    timeout: 10s
    retries: 5
    start_period: 60s  # Give time for models to download on first start
  restart: unless-stopped
```

#### Service Dependencies

All services that use Ollama now wait for the health check to pass:

```yaml
doc-processor:
  depends_on:
    ollama:
      condition: service_healthy
  # ... rest of config

rag-service:
  depends_on:
    ollama:
      condition: service_healthy
    chromadb:
      condition: service_started
  # ... rest of config

client-rag-service:
  depends_on:
    ollama:
      condition: service_healthy
    chromadb:
      condition: service_started
  # ... rest of config
```

### 3. Persistent Storage

Models are stored in a Docker volume that persists across container restarts:

```yaml
volumes:
  ollama_data:  # Models stored here (~7 GB total)
```

This ensures models are only downloaded once and are available on subsequent deployments.

## Deployment Process

### Initial Deployment (First Time)

1. **Start the stack:**
   ```bash
   cd /path/to/RMA-Demo
   docker compose -f docker-compose.local-parsing.yml up -d
   ```

2. **Monitor Ollama initialization:**
   ```bash
   docker logs rma-ollama -f
   ```

   You should see:
   ```
   🚀 Starting Ollama with automatic model initialization...
   ⏳ Waiting for Ollama to be ready...
   ✅ Ollama is ready!
   📦 Checking model: llava:7b
      ⬇️  Pulling llava:7b...
      ✅ llava:7b ready
   📦 Checking model: llama3.2
      ⬇️  Pulling llama3.2...
      ✅ llama3.2 ready
   📦 Checking model: nomic-embed-text
      ⬇️  Pulling nomic-embed-text...
      ✅ nomic-embed-text ready
   🎉 All models initialized! Ollama ready for use.
   ```

3. **Wait for health check:** Other services will automatically start once Ollama passes health checks (about 60-90 seconds on first start)

### Subsequent Deployments

On subsequent deployments, models are already present in the persistent volume:

```bash
docker compose -f docker-compose.local-parsing.yml up -d
```

You'll see:
```
🚀 Starting Ollama with automatic model initialization...
⏳ Waiting for Ollama to be ready...
✅ Ollama is ready!
📦 Checking model: llava:7b
   ✅ llava:7b already exists
📦 Checking model: llama3.2
   ✅ llama3.2 already exists
📦 Checking model: nomic-embed-text
   ✅ nomic-embed-text already exists
🎉 All models initialized! Ollama ready for use.
```

Services start much faster since no downloads are needed.

## Verification

### Check Ollama Health

```bash
docker ps | grep ollama
```

Look for `healthy` status in the STATUS column.

### Check Available Models

```bash
docker exec rma-ollama ollama list
```

Expected output:
```
NAME                       ID              SIZE      MODIFIED           
llava:7b                   8dd30f6b0cb1    4.7 GB    X minutes ago    
llama3.2:latest            a80c4f17acd5    2.0 GB    X minutes ago         
nomic-embed-text:latest    0a109f422b47    274 MB    X minutes ago
```

### Test Each Model

```bash
# Test vision model
docker exec rma-ollama ollama run llava:7b "hello"

# Test text generation model
docker exec rma-ollama ollama run llama3.2 "hello"

# Test embedding model (via API)
curl -X POST http://localhost:11434/api/embeddings \
  -H "Content-Type: application/json" \
  -d '{"model": "nomic-embed-text", "prompt": "test"}'
```

## Troubleshooting

### Models Not Downloading

**Symptom:** Ollama health check failing, services not starting

**Solution:**
1. Check Ollama logs: `docker logs rma-ollama`
2. Ensure internet connectivity
3. Check disk space (need ~7 GB free)
4. Manually pull models:
   ```bash
   docker exec rma-ollama ollama pull llava:7b
   docker exec rma-ollama ollama pull llama3.2
   docker exec rma-ollama ollama pull nomic-embed-text
   ```

### Services Starting Too Early

**Symptom:** Services fail with "connection refused" to Ollama

**Solution:**
1. Verify health check configuration in docker-compose.yml
2. Ensure `depends_on` uses `condition: service_healthy`
3. Increase `start_period` if downloads are slow:
   ```yaml
   healthcheck:
     start_period: 120s  # Increase for slow networks
   ```

### Models Disappearing After Restart

**Symptom:** Models need to be re-downloaded each time

**Solution:**
1. Check volume is properly configured:
   ```bash
   docker volume inspect rma-demo_ollama_data
   ```
2. Verify volume mount in docker-compose:
   ```yaml
   volumes:
     - ollama_data:/root/.ollama
   ```
3. Do not use `docker compose down -v` (removes volumes)

### GPU Not Available

**Symptom:** "CUDA not found" or slow model performance

**Solution:**
1. Install NVIDIA Docker runtime:
   ```bash
   distribution=$(. /etc/os-release;echo $ID$VERSION_ID)
   curl -s -L https://nvidia.github.io/nvidia-docker/gpgkey | sudo apt-key add -
   curl -s -L https://nvidia.github.io/nvidia-docker/$distribution/nvidia-docker.list | \
     sudo tee /etc/apt/sources.list.d/nvidia-docker.list
   sudo apt-get update && sudo apt-get install -y nvidia-docker2
   sudo systemctl restart docker
   ```
2. Verify GPU access:
   ```bash
   docker exec rma-ollama nvidia-smi
   ```

## Benefits

1. **Zero Configuration:** Users don't need to manually pull models
2. **Automatic Recovery:** Missing models are automatically downloaded
3. **Service Reliability:** Services won't start until Ollama is fully ready
4. **Persistent Storage:** Models only downloaded once, saved across deployments
5. **Clear Logging:** Visual indicators show exactly what's happening
6. **Production Ready:** Suitable for deployment without manual intervention

## Model Update Process

To update to a newer version of a model:

1. **Pull new version:**
   ```bash
   docker exec rma-ollama ollama pull llava:latest
   ```

2. **Update configuration** in `scripts/ollama-entrypoint.sh` if model name changes

3. **Restart Ollama:**
   ```bash
   docker compose -f docker-compose.local-parsing.yml restart ollama
   ```

## Resource Requirements

- **Disk Space:** Minimum 8 GB free for all models
- **Memory:** Minimum 8 GB RAM (16 GB recommended)
- **GPU:** NVIDIA GPU with 8+ GB VRAM recommended for optimal performance
- **Network:** Good internet connection for initial download (7 GB total)

## Related Documents

- [Document Scanning Architecture](DOCUMENT_SCANNING_ARCHITECTURE.md)
- [AWS Deployment Guide](AWS_DEPLOYMENT_GUIDE.md)
- [Client Documents Root Cause Analysis](CLIENT_DOCS_ROOT_CAUSE.md)
