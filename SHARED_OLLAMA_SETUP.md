# Shared Ollama Service Setup

This setup allows multiple applications (RAG Demo, OCR Demo, etc.) to share a single Ollama LLM service, reducing memory usage and compute resources.

## Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                Shared Ollama Service                 │
│              (Port 11434, GPU-enabled)              │
│              Models: llama3.2, nomic-embed-text     │
└─────────────┬────────────────────┬──────────────────┘
              │                    │
    ┌─────────▼─────────┐  ┌──────▼──────────┐
    │   RAG Demo App    │  │  OCR Demo App   │
    │   (Port 8000)     │  │  (Port 5001)    │
    │   With vector DB  │  │  Direct LLM     │
    └───────────────────┘  └─────────────────┘
```

## Benefits

- **Single GPU allocation** - Only one Ollama instance uses GPU
- **Shared model cache** - Models loaded once in memory
- **Reduced memory footprint** - No duplicate model storage
- **Easy scaling** - Add more apps without more Ollama instances
- **Independent operation** - Apps can start/stop independently

## Quick Start

### 1. Start the Shared Ollama Service

From the project root directory:

```bash
cd /home/user/CMACatalyst
docker-compose -f docker-compose.ollama.yml up -d
```

This starts:
- `shared-ollama-service` container on port 11434
- Creates `shared-llm-network` for inter-service communication
- Creates `shared_ollama_models` volume for persistent model storage

### 2. Pre-pull Required Models (Recommended)

```bash
# Pull LLM model
docker exec shared-ollama-service ollama pull llama3.2

# Pull embedding model (for RAG)
docker exec shared-ollama-service ollama pull nomic-embed-text
```

This takes a few minutes but only needs to be done once.

### 3. Start RAG Demo

```bash
cd /home/user/CMACatalyst/OllamaRAGDemo
docker-compose up -d
```

Access at: http://localhost:8000

### 4. Start OCR Demo (with shared Ollama)

Update OCR Demo's docker-compose.yml to use the shared service:

```bash
cd /home/user/CMACatalyst/OCRDemo
# Edit docker-compose.yml (see instructions below)
docker-compose up -d
```

Access at: http://localhost:5001

## Updating OCR Demo to Use Shared Ollama

### Option A: Use External Network (Recommended)

Edit `/home/user/CMACatalyst/OCRDemo/docker-compose.yml`:

```yaml
version: '3.8'

services:
  ocr-demo:
    # ... existing config ...
    environment:
      - FLASK_HOST=0.0.0.0
      - FLASK_PORT=5001
      - OLLAMA_BASE_URL=http://shared-ollama-service:11434  # Changed!
    networks:
      - ocr-network
      - shared-llm-network  # Add this!
    # ... rest of config ...

  # Comment out or remove the local ollama service
  # ollama:
  #   image: ollama/ollama:latest
  #   ...

  redis:
    # ... keep as is ...

networks:
  ocr-network:
    driver: bridge
  shared-llm-network:  # Add this!
    external: true
    name: shared-llm-network

# Remove ollama-data volume or comment out
volumes:
  redis-data:
  # ollama-data:  # No longer needed
```

### Option B: Use Host Network (Simpler but less isolated)

```yaml
services:
  ocr-demo:
    environment:
      - OLLAMA_BASE_URL=http://host.docker.internal:11434
```

## Management Commands

### Check Ollama Status

```bash
docker ps | grep ollama
docker logs shared-ollama-service
curl http://localhost:11434/api/tags  # List loaded models
```

### Check which apps are connected

```bash
docker network inspect shared-llm-network
```

### Stop Services

```bash
# Stop individual apps
cd /home/user/CMACatalyst/OllamaRAGDemo
docker-compose down

cd /home/user/CMACatalyst/OCRDemo
docker-compose down

# Stop shared Ollama (do this last!)
cd /home/user/CMACatalyst
docker-compose -f docker-compose.ollama.yml down
```

### Complete Cleanup

```bash
# Remove everything including models
docker-compose -f docker-compose.ollama.yml down -v

# This will delete downloaded models!
# You'll need to re-pull them next time
```

## Resource Usage

### Before (Separate Ollama per app):
- RAG Demo: ~4GB GPU RAM + ~2GB System RAM
- OCR Demo: ~4GB GPU RAM + ~2GB System RAM
- **Total: ~8GB GPU RAM, ~4GB System RAM**

### After (Shared Ollama):
- Shared Ollama: ~4GB GPU RAM + ~2GB System RAM
- RAG App: ~500MB System RAM (for vector DB)
- OCR App: ~300MB System RAM
- **Total: ~4GB GPU RAM, ~2.8GB System RAM**

**Savings: ~50% GPU RAM, ~30% System RAM**

## Troubleshooting

### "Cannot find Ollama service"

Make sure the shared service is running:
```bash
docker ps | grep shared-ollama-service
```

If not running, start it:
```bash
docker-compose -f docker-compose.ollama.yml up -d
```

### "Network not found"

The network is created by the shared Ollama service. Start it first:
```bash
docker-compose -f docker-compose.ollama.yml up -d
```

### Apps can't connect to Ollama

Check they're on the same network:
```bash
docker network inspect shared-llm-network
```

Both containers should appear in the list.

### Models not found

Pull them manually:
```bash
docker exec shared-ollama-service ollama pull llama3.2
docker exec shared-ollama-service ollama pull nomic-embed-text
```

### Performance issues

Check GPU usage:
```bash
nvidia-smi
```

Only one Ollama process should be using the GPU.

## Demo Workflow for Tomorrow

1. **Start shared Ollama** (do this first!)
   ```bash
   docker-compose -f docker-compose.ollama.yml up -d
   ```

2. **Wait for models to load** (~30 seconds)

3. **Start RAG demo**
   ```bash
   cd OllamaRAGDemo
   docker-compose up -d
   docker-compose exec rag-app python3 /app/ingest_documents.py
   ```

4. **Open browser to http://localhost:8000**

5. **Run your demo queries!**

## Adding More Applications

To add another app that needs Ollama:

1. Add to its `docker-compose.yml`:
   ```yaml
   networks:
     - shared-llm-network
   
   networks:
     shared-llm-network:
       external: true
       name: shared-llm-network
   ```

2. Set environment variable:
   ```yaml
   environment:
     - OLLAMA_BASE_URL=http://shared-ollama-service:11434
   ```

3. Start your app!

## Technical Notes

- The shared Ollama service uses a named Docker network for inter-container communication
- Models are stored in a persistent Docker volume
- Each app maintains its own data (RAG has vector DB, OCR has processed docs)
- GPU is allocated only to the Ollama container
- Apps can be started/stopped independently without affecting Ollama
- Ollama automatically handles concurrent requests from multiple apps

## Files Modified

- Created: `/home/user/CMACatalyst/docker-compose.ollama.yml`
- Created: `/home/user/CMACatalyst/OllamaRAGDemo/Dockerfile.app`
- Created: `/home/user/CMACatalyst/OllamaRAGDemo/entrypoint-app.sh`
- Modified: `/home/user/CMACatalyst/OllamaRAGDemo/docker-compose.yml`
- Modified: `/home/user/CMACatalyst/OllamaRAGDemo/app/rag_app.py`
- Modified: `/home/user/CMACatalyst/OllamaRAGDemo/app/ingest_documents.py`
