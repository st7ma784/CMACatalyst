# OCR Demo - Shared Ollama Integration Guide

Quick instructions to update OCR Demo to use the shared Ollama service.

## Changes Required

Edit `/home/user/CMACatalyst/OCRDemo/docker-compose.yml`:

### 1. Update ocr-demo service

Change the `OLLAMA_BASE_URL` and add the shared network:

```yaml
services:
  ocr-demo:
    # ... existing config ...
    environment:
      - FLASK_HOST=0.0.0.0
      - FLASK_PORT=5001
      - OLLAMA_BASE_URL=http://shared-ollama-service:11434  # ← CHANGED
    networks:
      - ocr-network
      - shared-llm-network  # ← ADD THIS
    # ... rest of config ...
```

### 2. Comment out the local Ollama service

```yaml
  # Local Ollama no longer needed - using shared service
  # ollama:
  #   image: ollama/ollama:latest
  #   container_name: ocr-ollama
  #   ...
```

### 3. Add external network definition

At the bottom of the file:

```yaml
networks:
  ocr-network:
    driver: bridge
  shared-llm-network:  # ← ADD THIS
    external: true
    name: shared-llm-network
```

### 4. Update volumes section

```yaml
volumes:
  # ollama-data:  # ← Comment out or remove
  redis-data:
```

## Complete Modified docker-compose.yml

Here's the full updated file:

```yaml
version: '3.8'

services:
  # Main OCR Demo Application
  ocr-demo:
    build: .
    container_name: ocr-demo-app
    ports:
      - "5001:5001"
    environment:
      - FLASK_HOST=0.0.0.0
      - FLASK_PORT=5001
      - OLLAMA_BASE_URL=http://shared-ollama-service:11434
    env_file:
      - .env
    volumes:
      - ./logs:/app/logs
      - ./data:/app/data
      - ./processed_docs:/app/processed_docs
      - ./temp:/app/temp
      - ./credentials:/app/credentials
    depends_on:
      - redis
    networks:
      - ocr-network
      - shared-llm-network
    restart: unless-stopped

  # Redis for caching and session management
  redis:
    image: redis:7-alpine
    container_name: ocr-redis
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data
    networks:
      - ocr-network
    restart: unless-stopped

volumes:
  redis-data:

networks:
  ocr-network:
    driver: bridge
  shared-llm-network:
    external: true
    name: shared-llm-network
```

## Startup Sequence

1. **Start shared Ollama first** (if not already running):
   ```bash
   cd /home/user/CMACatalyst
   docker-compose -f docker-compose.ollama.yml up -d
   ```

2. **Ensure models are pulled**:
   ```bash
   docker exec shared-ollama-service ollama pull llama3.2
   docker exec shared-ollama-service ollama pull nomic-embed-text
   ```

3. **Start OCR Demo**:
   ```bash
   cd /home/user/CMACatalyst/OCRDemo
   docker-compose down  # Stop old setup if running
   docker-compose up -d
   ```

4. **Access at**: http://localhost:5001

## Verification

Check that OCR demo can access Ollama:

```bash
# Check containers are on same network
docker network inspect shared-llm-network

# Check OCR logs
docker logs ocr-demo-app

# Test from within OCR container
docker exec ocr-demo-app curl http://shared-ollama-service:11434/api/tags
```

## Troubleshooting

### "Cannot connect to Ollama"

Ensure shared Ollama is running:
```bash
docker ps | grep shared-ollama-service
```

### "Network not found"

Start the shared Ollama service first - it creates the network:
```bash
docker-compose -f /home/user/CMACatalyst/docker-compose.ollama.yml up -d
```

### Port conflicts

If you see port 11434 conflicts, check what's using it:
```bash
docker ps | grep 11434
```

If there's an old local Ollama, stop it:
```bash
docker stop ocr-ollama
docker rm ocr-ollama
```

## Benefits After Migration

- **50% less GPU RAM usage** - Only one Ollama instance
- **Faster startup** - Models already loaded
- **Consistent responses** - Same model version for both demos
- **Simpler management** - One Ollama to monitor/update

## Running Both Demos Simultaneously

Perfect for your use case! Now you can run:

1. Shared Ollama (port 11434) - GPU
2. RAG Demo (port 8000) - Using Ollama for retrieval + generation
3. OCR Demo (port 5001) - Using Ollama for text extraction + summarization

All three sharing the same LLM instance! 🎉
