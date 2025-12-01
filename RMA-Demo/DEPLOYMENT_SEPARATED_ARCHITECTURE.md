# 🚀 Deployment Guide: Separated LLM & Vision Architecture

**Phase**: Phase 1 - Model Separation  
**Date**: November 5, 2025  
**Status**: Ready for deployment

## Quick Start

### Option 1: Fresh Deployment (Recommended)

```bash
cd /data/CMACatalyst/RMA-Demo

# Clean up old containers
docker-compose -f docker-compose-simple.yml down -v
docker system prune -f

# Deploy new separated architecture
docker-compose -f docker-compose-separated.yml up -d

# Monitor startup
docker-compose -f docker-compose-separated.yml logs -f ollama ollama-vision
```

### Option 2: Gradual Migration

Keep running with `docker-compose-simple.yml` and test with a single service first:

```bash
# Test doc-processor with vision Ollama
docker-compose -f docker-compose-separated.yml up -d ollama-vision doc-processor

# Once working, expand to all vision services
docker-compose -f docker-compose-separated.yml up -d
```

## Architecture

```
LANGUAGE MODELS (11434)          VISION MODELS (11435)
  ├─ llama3.2:latest             ├─ llava:7b
  ├─ llama2:7b                   └─ nomic-embed-text
  │
  Services:                       Services:
  ├─ RAG (8102)                  ├─ Doc Processor (8101)
  ├─ Notes (8100)                ├─ OCR (8104)
  └─ NER Graph (8108)            └─ Client RAG (8105)
```

## Service Configuration Details

### LLM Ollama (Port 11434)
- **Models**: llama3.2:latest, llama2:7b
- **Services**: RAG, Notes Converter, NER Graph
- **Health Check**: `http://ollama:11434/api/tags`
- **Startup**: ~2-5 minutes (model pulling on first run)

### Vision Ollama (Port 11435)
- **Models**: llava:7b, nomic-embed-text
- **Services**: Doc Processor, OCR, Client RAG
- **Health Check**: `http://ollama-vision:11434/api/tags` (internal port)
- **External Port**: 11435 (for testing)
- **Startup**: ~5-10 minutes (model pulling on first run)

## Environment Variables

Services now use these variables:

```bash
# LLM Services
OLLAMA_URL=http://ollama:11434
OLLAMA_MODEL=llama3.2:latest

# Vision Services
VISION_OLLAMA_URL=http://ollama-vision:11434  # Internal network
VISION_MODEL=llava:7b
```

## First Run Initialization

### Ollama (LLM)
```
✓ Starting Ollama LLM Service
✓ Pulling llama3.2:latest (~2-5 min)
✓ Pulling llama2:7b (~2-5 min)
✓ LLM Ollama ready
```

### Ollama Vision
```
✓ Starting Ollama Vision Service
✓ Pulling llava:7b (~5-10 min)
✓ Pulling nomic-embed-text (~2 min)
✓ Vision Ollama ready
```

**Total First-Run Time**: ~15-25 minutes (parallel pulling)

## Testing the Deployment

### 1. Check Ollama Health

```bash
# LLM Ollama
curl http://localhost:11434/api/tags

# Vision Ollama
curl http://localhost:11435/api/tags
```

### 2. Test Language Models

```bash
# Ask RAG service
curl -X POST http://localhost:8102/query \
  -H "Content-Type: application/json" \
  -d '{"question": "What is an IVA?"}'

# Convert notes
curl -X POST http://localhost:8100/convert \
  -H "Content-Type: application/json" \
  -d '{"notes": "Client has £25000 debt", "client_name": "John"}'
```

### 3. Test Vision Models

```bash
# Upload document for processing
curl -X POST http://localhost:8101/process \
  -F "file=@document.pdf"

# Extract entities with OCR
curl -X POST http://localhost:8104/extract \
  -F "image=@document.jpg"
```

## Monitoring

### View Logs

```bash
# LLM Ollama startup
docker logs -f rma-ollama

# Vision Ollama startup
docker logs -f rma-ollama-vision

# Document processor (uses vision)
docker logs -f rma-doc-processor

# OCR service (uses vision)
docker logs -f rma-ocr-service
```

### Resource Usage

```bash
# Monitor container resources
docker stats

# Check model sizes
docker exec rma-ollama ollama list
docker exec rma-ollama-vision ollama list
```

## Troubleshooting

### Models Not Pulling

**Problem**: Ollama stuck waiting for API
**Solution**: Check Ollama logs for errors
```bash
docker logs rma-ollama | tail -50
docker logs rma-ollama-vision | tail -50
```

### Document Processor Fails

**Problem**: VISION_OLLAMA_URL connection error
**Solution**: Verify vision Ollama is running
```bash
curl http://ollama-vision:11434/api/tags  # from doc-processor container
```

### OCR Service Fails

**Problem**: Vision model not responding
**Solution**: Check vision Ollama health
```bash
docker-compose -f docker-compose-separated.yml logs ollama-vision
```

## Next Steps (Phase 2)

### vLLM Integration
1. Create Dockerfile.vllm
2. Create docker-compose-vllm.yml
3. Replace LLM Ollama with vLLM
4. Keep vision Ollama as-is

### Vision Improvements
1. Add ollama-ocr model for better OCR
2. Explore specialized VLM servers
3. Add multi-modal capabilities

## Performance Implications

### Separation Benefits
✅ **Parallel Inference**: LLM and vision queries don't compete  
✅ **Independent Scaling**: Can add more GPUs to either service  
✅ **Cleaner Resource Allocation**: Each service optimized for its task  
✅ **Foundation for vLLM**: LLM service easy to swap

### Current Limitations (Addressed in Phase 2)
⏳ **Ollama Batching**: Not as efficient as vLLM  
⏳ **Latency**: Ollama slower than vLLM for LLM tasks  
⏳ **Token Streaming**: Limited streaming support  

## Rollback to Simple Compose

If issues occur, roll back to single Ollama:

```bash
docker-compose -f docker-compose-separated.yml down -v
docker-compose -f docker-compose-simple.yml up -d
```

## Files Changed

### New Files
- `docker-compose-separated.yml` - New deployment config with dual Ollama
- `Dockerfile.ollama-vision` - Vision-specific Ollama image
- `ollama-entrypoint-vision.sh` - Vision model auto-pull script
- `SEPARATED_LLM_VISION_ARCHITECTURE.md` - Architecture documentation

### Modified Files
- `ollama-entrypoint.sh` - Now LLM-only, removes llava/vision models
- `docker-compose-simple.yml` - Remains as-is for backward compatibility

## Success Criteria

- [ ] Both Ollama services start successfully
- [ ] LLM models pull and initialize
- [ ] Vision models pull and initialize
- [ ] Doc processor can reach vision Ollama
- [ ] OCR service can reach vision Ollama
- [ ] RAG service can reach LLM Ollama
- [ ] Notes service can reach LLM Ollama
- [ ] All health checks passing
- [ ] Document processing works with llava
- [ ] No errors in service logs after 5 minutes

## Performance Benchmarks (Baseline)

After deployment, measure:
- LLM response time (vs single Ollama)
- Document processing speed
- OCR extraction quality
- Parallel query handling
- Memory usage per service

## Support

For issues, check:
1. `docker logs rma-ollama` (LLM service)
2. `docker logs rma-ollama-vision` (Vision service)
3. `docker-compose -f docker-compose-separated.yml ps` (service status)
4. `docker network inspect rma-network` (network connectivity)

---

**Deployment Status**: 🟢 Ready  
**Estimated Time**: 15-25 minutes (first run)  
**Network**: rma-network  
**Version**: 1.0  
**Next Phase**: vLLM optimization for language models
