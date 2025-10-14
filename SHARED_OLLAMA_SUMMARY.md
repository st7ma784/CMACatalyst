# Shared Ollama Architecture - Summary

## What Changed

Previously, each demo had its own Ollama instance:
```
RAG Demo Container = Ollama + RAG App (Port 11434 + 8000)
OCR Demo Container = Ollama + OCR App (Port 11434 + 5001) ← CONFLICT!
```

Now, one shared Ollama serves both:
```
Shared Ollama Container (Port 11434, GPU)
    ↓
RAG Demo Container (Port 8000) ← Connects via shared-llm-network
    ↓
OCR Demo Container (Port 5001) ← Connects via shared-llm-network
```

## Quick Start for Tomorrow's Demo

### Option 1: Use the startup script (Easiest)

```bash
cd /home/user/CMACatalyst
./start-rag-demo.sh
```

That's it! Script handles everything automatically.

### Option 2: Manual steps

```bash
# 1. Start shared Ollama
cd /home/user/CMACatalyst
docker-compose -f docker-compose.ollama.yml up -d

# 2. Pull models (first time only)
docker exec shared-ollama-service ollama pull llama3.2
docker exec shared-ollama-service ollama pull nomic-embed-text

# 3. Start RAG demo
cd OllamaRAGDemo
docker-compose up -d

# 4. Ingest documents (if needed)
docker-compose exec rag-app python3 /app/ingest_documents.py

# 5. Open browser
xdg-open http://localhost:8000
```

## Files Created/Modified

### New Files Created:
- `/home/user/CMACatalyst/docker-compose.ollama.yml` - Shared Ollama service
- `/home/user/CMACatalyst/start-rag-demo.sh` - Easy startup script
- `/home/user/CMACatalyst/stop-rag-demo.sh` - Easy shutdown script
- `/home/user/CMACatalyst/SHARED_OLLAMA_SETUP.md` - Detailed documentation
- `/home/user/CMACatalyst/OllamaRAGDemo/Dockerfile.app` - App-only Dockerfile
- `/home/user/CMACatalyst/OllamaRAGDemo/entrypoint-app.sh` - New entrypoint
- `/home/user/CMACatalyst/OCRDemo/SHARED_OLLAMA_MIGRATION.md` - OCR migration guide

### Modified Files:
- `/home/user/CMACatalyst/OllamaRAGDemo/docker-compose.yml` - Now uses external Ollama
- `/home/user/CMACatalyst/OllamaRAGDemo/app/rag_app.py` - Reads OLLAMA_BASE_URL env var
- `/home/user/CMACatalyst/OllamaRAGDemo/app/ingest_documents.py` - Reads OLLAMA_BASE_URL env var

## Resource Savings

| Configuration | GPU RAM | System RAM | Model Storage |
|---------------|---------|------------|---------------|
| **Before** (2 Ollama) | ~8GB | ~4GB | ~8GB (duplicated) |
| **After** (Shared) | ~4GB | ~2.8GB | ~4GB (shared) |
| **Savings** | 50% | 30% | 50% |

## Architecture Benefits

1. **Resource Efficiency**: Only one model in GPU memory
2. **Cost Savings**: Smaller GPU requirements for multi-service setup
3. **Faster Development**: Models pre-loaded, instant responses
4. **Scalability**: Easy to add more services using same LLM
5. **Flexibility**: Services can start/stop independently

## Testing Your Setup

```bash
# Check all containers
docker ps | grep -E '(ollama|rag|ocr)'

# Should see:
# - shared-ollama-service (port 11434)
# - rag-demo-app (port 8000)

# Test Ollama directly
curl http://localhost:11434/api/tags

# Test RAG demo web interface
curl http://localhost:8000

# Check network
docker network inspect shared-llm-network
```

## Demo Tomorrow - Step by Step

1. **Before the demo** (15 minutes before):
   ```bash
   cd /home/user/CMACatalyst
   ./start-rag-demo.sh
   ```
   Wait for completion message.

2. **Open browser**: http://localhost:8000

3. **Test questions**:
   - "What are Julian's hobbies?"
   - "Where did Julian go on holiday?"
   - "What is the UK State Pension age?"
   - "How much can I save in an ISA?"

4. **Show the haystack concept**:
   - Explain: 18 documents, many very long
   - Show sources displayed for each answer
   - Demonstrate finding specific info in large corpus

5. **After demo**:
   ```bash
   ./stop-rag-demo.sh
   # Or keep Ollama running: it stops just the RAG app
   ```

## Next Steps (Optional)

To also migrate OCR Demo:
1. Follow instructions in `/home/user/CMACatalyst/OCRDemo/SHARED_OLLAMA_MIGRATION.md`
2. Both demos can then run simultaneously using shared Ollama
3. Perfect for your use case: RAG for queries, OCR for processing

## Troubleshooting

**Port 11434 already in use?**
```bash
docker ps -a | grep 11434
docker stop <old-container>
docker rm <old-container>
```

**Models not found?**
```bash
docker exec shared-ollama-service ollama list
docker exec shared-ollama-service ollama pull llama3.2
```

**Container won't start?**
```bash
docker logs shared-ollama-service
docker logs rag-demo-app
```

**Need to reset everything?**
```bash
./stop-rag-demo.sh --full
docker volume rm shared_ollama_models
./start-rag-demo.sh
```

## Questions?

Check the detailed docs:
- Architecture: `/home/user/CMACatalyst/SHARED_OLLAMA_SETUP.md`
- Demo instructions: `/home/user/CMACatalyst/OllamaRAGDemo/DEMO_INSTRUCTIONS.md`
- OCR migration: `/home/user/CMACatalyst/OCRDemo/SHARED_OLLAMA_MIGRATION.md`

Good luck with your demo! 🎉
