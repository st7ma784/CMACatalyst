# OCR Demo - Now Using Shared Ollama

## What Changed

The OCR Demo docker-compose.yml has been updated to use the shared Ollama service instead of running its own instance.

### Key Changes

1. **OLLAMA_BASE_URL** updated:
   - Before: `http://ollama:11434` (local container)
   - After: `http://shared-ollama-service:11434` (shared service)

2. **Networks** - Now connected to shared network:
   - `ocr-network` (internal)
   - `shared-llm-network` (shared with RAG demo)

3. **Dependencies** - Removed direct dependency on local Ollama:
   - Before: `depends_on: [ollama, redis]`
   - After: `depends_on: [redis]`

4. **Ollama service** - Now references shared instance:
   - Container name: `shared-ollama-service` (shared)
   - Volume: `shared_ollama_models` (external)
   - Network: `shared-llm-network` only

## Starting Services

### Start Everything Together

```bash
cd /home/user/CMACatalyst
./start-all-demos.sh
```

This starts:
1. Shared Ollama service (GPU, port 11434)
2. RAG Demo (port 8000)
3. OCR Demo (port 5001)

### Start Individual Services

```bash
# Start shared Ollama first
docker-compose -f docker-compose.ollama.yml up -d

# Then start OCR demo
cd OCRDemo
docker-compose up -d

# And/or RAG demo
cd ../OllamaRAGDemo
docker-compose up -d
```

## Verification

Check all containers are running and on the shared network:

```bash
# Check running containers
docker ps | grep -E '(ollama|rag|ocr)'

# Should see:
# - shared-ollama-service (port 11434)
# - rag-demo-app (port 8000)
# - ocr-demo-app (port 5001)
# - ocr-redis (port 6379)

# Verify network connectivity
docker network inspect shared-llm-network

# Should show both rag-demo-app and ocr-demo-app
```

## Testing

Test OCR demo can access Ollama:

```bash
# From within OCR container
docker exec ocr-demo-app curl http://shared-ollama-service:11434/api/tags

# From host
curl http://localhost:11434/api/tags

# Access OCR web interface
curl http://localhost:5001
```

## Accessing Services

- **Shared Ollama API**: http://localhost:11434
- **RAG Demo**: http://localhost:8000
- **OCR Demo**: http://localhost:5001

## Resource Usage

### Before (Separate Ollama instances)
```
OCR Demo with Ollama: ~4GB GPU RAM
RAG Demo with Ollama: ~4GB GPU RAM
Total: ~8GB GPU RAM
```

### After (Shared Ollama)
```
Shared Ollama: ~4GB GPU RAM
OCR Demo: ~300MB RAM (no GPU)
RAG Demo: ~500MB RAM (no GPU)
Total: ~4GB GPU RAM + ~800MB RAM
```

**Savings: 50% GPU RAM** 🎉

## Use Cases

### Use Case 1: RAG Queries + Document Processing

Perfect for your scenario:
- RAG Demo for answering questions about stored documents
- OCR Demo for processing new documents
- Both using the same LLM instance

### Use Case 2: Development

- Keep Ollama running all the time
- Start/stop RAG or OCR demos as needed
- Fast iteration without waiting for model loading

### Use Case 3: Production

- One Ollama instance handles all LLM requests
- Easy to scale by adding more application containers
- Centralized model management and updates

## Troubleshooting

### "Cannot connect to shared-ollama-service"

Ensure shared Ollama is running:
```bash
docker ps | grep shared-ollama-service

# If not running:
docker-compose -f /home/user/CMACatalyst/docker-compose.ollama.yml up -d
```

### "Network shared-llm-network not found"

The network is created by the shared Ollama service:
```bash
docker-compose -f /home/user/CMACatalyst/docker-compose.ollama.yml up -d
```

### Port 11434 conflict

If another Ollama is running:
```bash
# Find the container
docker ps -a | grep 11434

# Stop and remove old Ollama containers
docker stop ocr-ollama
docker rm ocr-ollama
```

### OCR Demo can't find Ollama

Check the environment variable in docker-compose.yml:
```yaml
environment:
  - OLLAMA_BASE_URL=http://shared-ollama-service:11434
```

And verify the container is on the shared network:
```yaml
networks:
  - ocr-network
  - shared-llm-network
```

## Stopping Services

```bash
# Stop everything including Ollama
./stop-all-demos.sh --full

# Stop just the demos, keep Ollama running
./stop-all-demos.sh

# Stop individual demo
cd OCRDemo
docker-compose down
```

## Migration Complete! ✅

Your OCR Demo now efficiently shares the Ollama service with the RAG Demo, saving significant GPU resources while maintaining full functionality.
