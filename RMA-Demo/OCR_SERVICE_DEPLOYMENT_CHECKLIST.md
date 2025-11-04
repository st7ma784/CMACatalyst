# OCR Service Migration Checklist

## Pre-Deployment

- [ ] **Verify file structure**
  ```bash
  ls -la services/ocr-service/
  # Should have: app.py, requirements.txt, Dockerfile
  
  ls -la services/doc-processor/
  # Should have: updated app.py, requirements.txt
  ```

- [ ] **Check docker-compose updates**
  ```bash
  grep -A 20 "ocr-service:" docker-compose.vllm.yml
  # Should show OCR service configuration
  
  grep "OCR_SERVICE_URL" docker-compose.vllm.yml
  # Should show references in doc-processor and upload-service
  ```

- [ ] **Verify port allocations**
  ```bash
  grep -E "ports:|8104|8105|8106|8107" docker-compose.vllm.yml
  # 8104 = OCR Service (NEW)
  # 8105 = Client-RAG (was 8104)
  # 8106 = Upload (was 8103)
  # 8107 = MCP Server (was 8105)
  ```

- [ ] **Check environment variables**
  ```bash
  grep -A 15 "ocr-service:" docker-compose.vllm.yml | grep "environment" -A 10
  # Should have OLLAMA_URL, VISION_MODEL, FALLBACK_MODEL
  ```

## Build & Deploy

### Phase 1: Build Docker Images
- [ ] **Build OCR Service image**
  ```bash
  docker build -t rma-ocr-service services/ocr-service/
  # Should complete without errors
  ```

- [ ] **Build Doc-Processor image**
  ```bash
  docker build -t rma-doc-processor services/doc-processor/
  # Should complete without errors
  ```

- [ ] **Build other services (if changed)**
  ```bash
  docker-compose -f docker-compose.vllm.yml build --no-cache
  # Should build all services successfully
  ```

### Phase 2: Start Services (Background)
- [ ] **Start infrastructure (Ollama, vLLM, ChromaDB)**
  ```bash
  docker-compose -f docker-compose.vllm.yml up -d ollama vllm chromadb
  # Services starting...
  
  docker-compose -f docker-compose.vllm.yml ps
  # Check status
  ```

- [ ] **Wait for services to be healthy**
  ```bash
  # Wait 30-60 seconds for Ollama and vLLM startup
  sleep 60
  
  # Check health
  docker-compose -f docker-compose.vllm.yml ps
  # Should show "healthy" status
  ```

### Phase 3: Start OCR Service
- [ ] **Start OCR Service**
  ```bash
  docker-compose -f docker-compose.vllm.yml up -d ocr-service
  # OCR Service starting...
  ```

- [ ] **Verify OCR Service is healthy**
  ```bash
  docker-compose -f docker-compose.vllm.yml ps
  # Should show ocr-service as healthy
  
  docker logs rma-ocr-service | tail -20
  # Should show "OCR Service initialized"
  ```

- [ ] **Health check endpoint**
  ```bash
  curl -s http://localhost:8104/health | jq .
  # Should show:
  # {
  #   "status": "healthy",
  #   "ollama_available": true,
  #   "vision_models": ["llava:7b", ...],
  #   "ocr_methods_available": ["ollama_vision", "tesseract"]
  # }
  ```

### Phase 4: Start Doc-Processor
- [ ] **Start Doc-Processor**
  ```bash
  docker-compose -f docker-compose.vllm.yml up -d doc-processor
  # Doc-Processor starting...
  ```

- [ ] **Verify Doc-Processor is healthy**
  ```bash
  docker-compose -f docker-compose.vllm.yml ps
  # Should show doc-processor as healthy
  
  docker logs rma-doc-processor | tail -20
  # Should show "Document Processor initialized"
  # Should show "✓ OCR Service available"
  ```

- [ ] **Health check endpoint**
  ```bash
  curl -s http://localhost:8101/health | jq .
  # Should show:
  # {
  #   "status": "healthy",
  #   "llamaparse_available": false,
  #   "ocr_service_available": true,
  #   "processing_methods": ["ocr_service", "tesseract"]
  # }
  ```

### Phase 5: Start Remaining Services
- [ ] **Start remaining services**
  ```bash
  docker-compose -f docker-compose.vllm.yml up -d \
    rag-service notes-service client-rag-service \
    upload-service frontend mcp-server n8n
  ```

- [ ] **Verify all services healthy**
  ```bash
  docker-compose -f docker-compose.vllm.yml ps
  # All should be "Up (healthy)" or "Up (running)"
  ```

## Functional Testing

### Test 1: OCR Service Direct
- [ ] **Test OCR endpoint with sample PDF**
  ```bash
  curl -X POST \
    -F "file=@sample.pdf" \
    http://localhost:8104/process | jq .
  
  # Should return:
  # {
  #   "markdown": "...",
  #   "method": "ollama_vision",
  #   "pages": X,
  #   "success": true,
  #   "processing_time": X.XX
  # }
  ```

- [ ] **Test OCR with image file**
  ```bash
  curl -X POST \
    -F "file=@sample.jpg" \
    http://localhost:8104/process | jq .
  ```

- [ ] **Test model switching**
  ```bash
  curl -X POST 'http://localhost:8104/models/set?model_name=llava:7b'
  # Should return: {"status": "success", "current_model": "llava:7b"}
  ```

### Test 2: Doc-Processor Integration
- [ ] **Test doc-processor with OCR Service fallback**
  ```bash
  curl -X POST \
    -F "file=@sample.pdf" \
    http://localhost:8101/process | jq .
  
  # Should return success with method "ocr_service"
  ```

- [ ] **Test with unsupported format (Tesseract fallback)**
  ```bash
  # Create a test file that Ollama struggles with
  # Doc-processor should fall back to Tesseract
  ```

### Test 3: Upload Service Integration
- [ ] **Test upload service uses doc-processor**
  ```bash
  curl -X POST \
    -H "Authorization: Bearer <token>" \
    -F "file=@sample.pdf" \
    http://localhost:8106/upload
  
  # Should process through doc-processor → OCR Service pipeline
  ```

### Test 4: GPU Resource Verification
- [ ] **Monitor GPU during processing**
  ```bash
  # Terminal 1: Watch GPU
  watch -n 1 nvidia-smi
  
  # Terminal 2: Process document
  curl -X POST \
    -F "file=@large.pdf" \
    http://localhost:8104/process
  
  # Should see:
  # GPU 0: 60-80% (Ollama processing)
  # GPU 1: 70-90% (vLLM available for other tasks)
  # No resource contention
  ```

## Performance Validation

### Benchmark 1: OCR Service Latency
- [ ] **Single document processing time**
  ```bash
  for i in {1..3}; do
    echo "Run $i:"
    curl -X POST \
      -F "file=@sample.pdf" \
      http://localhost:8104/process | jq '.processing_time'
  done
  
  # Expected: 30-60 seconds per PDF
  ```

### Benchmark 2: Doc-Processor Latency
- [ ] **Doc-processor with fallback chain**
  ```bash
  curl -X POST \
    -F "file=@sample.pdf" \
    http://localhost:8101/process | jq '.processing_time'
  
  # Expected: Similar to OCR Service (30-60s)
  # If LlamaParse available: <5s
  ```

### Benchmark 3: Concurrent Processing
- [ ] **Multiple documents in sequence**
  ```bash
  for i in {1..3}; do
    echo "Processing $i..."
    curl -X POST \
      -F "file=@sample.pdf" \
      http://localhost:8104/process &
  done
  wait
  
  # Should queue and process without errors
  # No concurrent image processing (sequential)
  ```

### Benchmark 4: RAG Service Responsiveness
- [ ] **Verify RAG service not blocked during OCR**
  ```bash
  # Terminal 1: Start long OCR processing
  curl -X POST \
    -F "file=@large-document.pdf" \
    http://localhost:8104/process
  
  # Terminal 2: Query RAG service (should respond quickly)
  curl -X POST \
    -H "Content-Type: application/json" \
    -d '{"query": "test question"}' \
    http://localhost:8102/query
  
  # RAG should respond <2s even during OCR
  ```

## Monitoring & Logs

### Log Verification
- [ ] **OCR Service logs**
  ```bash
  docker logs rma-ocr-service --tail 50
  # Should show:
  # - Ollama connection successful
  # - Vision model loaded
  # - Processing requests
  ```

- [ ] **Doc-Processor logs**
  ```bash
  docker logs rma-doc-processor --tail 50
  # Should show:
  # - OCR Service detected
  # - Processing method selection
  # - Success confirmations
  ```

- [ ] **Ollama logs**
  ```bash
  docker logs rma-ollama --tail 50
  # Should show GPU allocation to device 0
  # Vision model operations
  ```

- [ ] **vLLM logs**
  ```bash
  docker logs rma-vllm --tail 50
  # Should show GPU allocation to device 1
  # Text generation operations
  # No interference from Ollama
  ```

### GPU Monitoring
- [ ] **GPU allocation verification**
  ```bash
  nvidia-smi
  # GPU 0: Ollama ~2-4GB (vision model)
  # GPU 1: vLLM ~6-8GB (text model)
  # Total: 8-12GB if dual GPU, OK if shared
  ```

- [ ] **Real-time stats**
  ```bash
  watch -n 1 'docker stats rma-ocr-service rma-vllm rma-ollama rma-doc-processor'
  # Monitor CPU, Memory, Network during processing
  ```

## Rollback (if needed)

### Quick Rollback Steps
- [ ] **Stop new services**
  ```bash
  docker-compose -f docker-compose.vllm.yml down ocr-service doc-processor upload-service
  ```

- [ ] **Restart old doc-processor (if backed up)**
  ```bash
  docker-compose -f docker-compose.yml up -d doc-processor
  ```

- [ ] **Verify system operational**
  ```bash
  docker-compose ps
  curl http://localhost:8101/health
  ```

## Post-Deployment

### Optimization
- [ ] **Profile GPU usage**
  ```bash
  # Identify bottlenecks
  nvidia-smi dmon -s p
  ```

- [ ] **Tune vision model if needed**
  ```bash
  # If too slow, switch to llava:7b
  # If too inaccurate, keep llava-next:34b
  curl -X POST 'http://localhost:8104/models/set?model_name=llava:7b'
  ```

- [ ] **Configure Tesseract optimization** (if needed)
  ```bash
  # Tesseract config in OCR Service for language/accuracy
  ```

### Documentation
- [ ] **Update service docs**
  - [ ] README.md with new port allocations
  - [ ] Architecture diagram showing separate GPUs
  - [ ] Runbook for OCR Service troubleshooting

- [ ] **Record baseline metrics**
  ```bash
  # Document:
  # - Ollama GPU 0 usage: ___ MB
  # - vLLM GPU 1 usage: ___ MB
  # - OCR latency: ___ sec
  # - RAG throughput: ___ req/sec
  ```

## Validation Checklist - Final

- [ ] ✅ OCR Service responds to health endpoint
- [ ] ✅ Doc-Processor detects OCR Service available
- [ ] ✅ Document processing successful with OCR Service method
- [ ] ✅ Fallback to Tesseract works (if Ollama slow)
- [ ] ✅ No resource contention on separate GPUs
- [ ] ✅ RAG Service responsive during OCR processing
- [ ] ✅ All services show "Up (healthy)" in docker ps
- [ ] ✅ No error logs in critical services
- [ ] ✅ Performance meets baseline expectations
- [ ] ✅ System ready for production use

## Commands Summary

```bash
# Full deployment
docker-compose -f docker-compose.vllm.yml up -d

# Health check all
docker-compose -f docker-compose.vllm.yml ps

# Test OCR
curl -F "file=@sample.pdf" http://localhost:8104/process | jq .

# Test Doc-Processor
curl -F "file=@sample.pdf" http://localhost:8101/process | jq .

# Monitor
watch -n 1 'docker stats rma-ocr-service rma-ollama rma-vllm'

# Logs
docker logs -f rma-ocr-service
docker logs -f rma-doc-processor

# Cleanup
docker-compose -f docker-compose.vllm.yml down
```

