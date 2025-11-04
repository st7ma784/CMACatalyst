# OCR Service Integration Guide

## Overview

You've successfully separated the OCR/vision model handling from the text-only doc-processor. This resolves the bottleneck where llava-next (llava vision model) was competing for GPU resources with the text generation pipeline.

## Architecture Changes

### Before (Problem)
```
doc-processor (GPU 0/1)
  ├─ LlamaParse API calls → external service
  ├─ Tesseract OCR → CPU
  └─ Vision Analysis (llava) → GPU resource contention with vLLM
```

### After (Solution)
```
Separated Services (Dedicated Resources):
├─ ocr-service (GPU 0)
│  ├─ Ollama with llava-next:34b-v1.5-q4_K_M (primary)
│  ├─ Fallback to llava:7b
│  └─ Hybrid method tries Ollama → Tesseract
│
├─ doc-processor (Hybrid approach)
│  ├─ LlamaParse (external, fastest)
│  ├─ OCR Service (local, accurate)
│  └─ Tesseract (CPU fallback, always available)
│
├─ rag-service (vLLM, GPU 1)
│  └─ Text generation (5-10x faster)
│
└─ notes-service (vLLM, GPU 1)
   └─ Text generation (5-10x faster)
```

## Services

### 1. OCR Service (NEW)
**Port:** 8104  
**Container:** rma-ocr-service  
**Location:** `services/ocr-service/`

**Features:**
- Standalone vision model hosting (Ollama-based)
- Hybrid OCR (Ollama vision + Tesseract fallback)
- Independent scaling and resource management
- Model switching via API

**Endpoints:**
```
GET  /health              → Health status + available models
POST /process             → Process document (PDF/image)
GET  /models              → List available vision models
POST /models/set          → Switch vision model
```

**Environment Variables:**
```
OLLAMA_URL=http://ollama:11434
VISION_MODEL=llava-next:34b-v1.5-q4_K_M
FALLBACK_MODEL=llava:7b
OCR_SERVICE_PORT=8104
```

### 2. Doc-Processor (UPDATED)
**Port:** 8101  
**Container:** rma-doc-processor  
**Location:** `services/doc-processor/`

**Changes:**
- ✅ Removed local vision model initialization
- ✅ Added OCR Service integration
- ✅ Hierarchical fallback: LlamaParse → OCR Service → Tesseract
- ✅ Independent processing method tracking

**Endpoints:**
```
GET  /health              → Processing methods available
POST /process             → Process document
```

**Environment Variables:**
```
OCR_SERVICE_URL=http://ocr-service:8104
LLAMA_PARSE_API_KEY=<optional>
DOC_PROCESSOR_PORT=8101
```

## Docker Compose Updates

### New Port Allocation
```
Port 8100 → Notes Service
Port 8101 → Doc-Processor
Port 8102 → RAG Service
Port 8104 → OCR Service (NEW)
Port 8105 → Client-RAG Service (was 8104)
Port 8106 → Upload Service (was 8103)
Port 8107 → MCP Server (was 8105)
```

### GPU Allocation (Recommended)
```
GPU 0 (4GB+)  → Ollama (vision models)
GPU 1 (8GB+)  → vLLM (text generation)
```

**Single GPU Setup:** Remove `CUDA_VISIBLE_DEVICES` constraints and share GPU

## Processing Pipeline

### Document Processing Flow

```
User uploads file
    ↓
doc-processor receives request
    ↓
1️⃣ Try LlamaParse (if API key configured)
   ├─ Success? Return markdown ✅
   └─ Fail? Continue to step 2
    ↓
2️⃣ Try OCR Service
   ├─ Call /process endpoint
   ├─ OCR Service tries Ollama vision → Tesseract
   ├─ Success? Return markdown ✅
   └─ Fail? Continue to step 3
    ↓
3️⃣ Fallback to Tesseract (local, always available)
   ├─ Success? Return markdown ✅
   └─ Fail? Return error ❌
```

## Performance Benefits

### GPU Utilization
- **Before:** Vision models blocked text generation on same GPU
- **After:** Parallel processing on separate GPUs
- **Improvement:** No resource contention, full GPU efficiency

### Throughput
- **Vision:** Up to 4-8 images/minute with llava-next:34b
- **Text:** Up to 100+ tokens/sec with vLLM
- **Combined:** Both running simultaneously without interference

### Latency
- **Ollama vision:** 30-60s per image (slower, more accurate)
- **Tesseract:** 5-10s per page (fast, CPU-based)
- **Fallback ensures:** Always completes, even if primary slow

## Deployment

### Full Stack (Recommended)
```bash
# Start all services with multi-GPU support
docker-compose -f docker-compose.vllm.yml up -d

# Verify all healthy
docker-compose -f docker-compose.vllm.yml ps

# Health checks
curl http://localhost:8104/health  # OCR Service
curl http://localhost:8101/health  # Doc-Processor
curl http://localhost:8102/health  # RAG Service
curl http://localhost:8000/health  # vLLM
curl http://localhost:11434/api/tags # Ollama
```

### OCR Service Only
```bash
# Start just OCR service
docker-compose -f docker-compose.vllm.yml up ocr-service

# Test endpoint
curl -X POST \
  -F "file=@document.pdf" \
  http://localhost:8104/process
```

## Usage Examples

### Example 1: Process Document (Default)
```bash
curl -X POST \
  -F "file=@invoice.pdf" \
  http://localhost:8101/process
```

**Response:**
```json
{
  "markdown": "# Invoice\n\n...",
  "method": "ocr_service",
  "pages": 3,
  "success": true,
  "processing_time": 45.2
}
```

### Example 2: Check Processing Methods Available
```bash
curl http://localhost:8101/health
```

**Response:**
```json
{
  "status": "healthy",
  "llamaparse_available": false,
  "ocr_service_available": true,
  "processing_methods": ["ocr_service", "tesseract"]
}
```

### Example 3: Get Available Vision Models
```bash
curl http://localhost:8104/models
```

**Response:**
```json
{
  "models": ["llava:7b", "llava-next:34b-v1.5-q4_K_M"],
  "current_vision_model": "llava-next:34b-v1.5-q4_K_M",
  "ollama_available": true
}
```

### Example 4: Switch Vision Model
```bash
curl -X POST \
  'http://localhost:8104/models/set?model_name=llava:7b'
```

**Response:**
```json
{
  "status": "success",
  "current_model": "llava:7b"
}
```

## Troubleshooting

### Issue: OCR Service Not Responding
```bash
# Check if Ollama is running
curl http://localhost:11434/api/tags

# Check OCR Service logs
docker logs rma-ocr-service

# Restart OCR Service
docker restart rma-ocr-service
```

### Issue: Vision Model Not Found
```bash
# List available models in Ollama
curl http://localhost:11434/api/tags

# Pull vision model manually
docker exec rma-ollama ollama pull llava-next:34b-v1.5-q4_K_M

# Restart OCR Service
docker restart rma-ocr-service
```

### Issue: Processing Very Slow
```bash
# Check GPU utilization
nvidia-smi

# Switch to faster fallback model
curl -X POST 'http://localhost:8104/models/set?model_name=llava:7b'

# Or use Tesseract (faster CPU-based OCR)
# OCR Service will automatically fallback if Ollama slow
```

### Issue: Memory Errors
```bash
# Check container memory usage
docker stats rma-ocr-service rma-vllm rma-ollama

# Reduce GPU memory utilization
# In docker-compose.vllm.yml:
# VLLM_GPU_MEMORY_UTILIZATION=0.7  # Reduced from 0.9
```

## Configuration

### Environment Variables (docker-compose.vllm.yml)

**OCR Service Section:**
```yaml
environment:
  - OLLAMA_URL=http://ollama:11434
  - VISION_MODEL=llava-next:34b-v1.5-q4_K_M
  - FALLBACK_MODEL=llava:7b
  - OCR_SERVICE_PORT=8104
```

**Doc-Processor Section:**
```yaml
environment:
  - OCR_SERVICE_URL=http://ocr-service:8104
  - LLAMA_PARSE_API_KEY=<api-key-if-available>
  - DOC_PROCESSOR_PORT=8101
```

## Monitoring

### Real-time Monitoring
```bash
# Watch container stats
watch -n 1 'docker stats rma-ocr-service rma-ollama rma-vllm'

# Watch GPU usage
watch -n 1 'nvidia-smi'

# Watch logs
docker logs -f rma-ocr-service
```

### Health Checks
```bash
# Full system health
curl -s http://localhost:8104/health | jq .
curl -s http://localhost:8101/health | jq .
curl -s http://localhost:8102/health | jq .

# Check GPU allocation
nvidia-smi --query-gpu=index,name,memory.used,memory.total --format=csv
```

## Model Selection

### Recommended Models

| Model | Speed | Accuracy | VRAM | Use Case |
|-------|-------|----------|------|----------|
| llava:7b | ⚡ Fast | ⭐⭐⭐ | 4GB | General docs, quick processing |
| llava-next:13b | ⚡ Medium | ⭐⭐⭐⭐ | 6GB | Balanced (recommended) |
| llava-next:34b-v1.5-q4_K_M | 🐢 Slow | ⭐⭐⭐⭐⭐ | 8-12GB | Complex documents, forms |

### Switching Models

```bash
# Option 1: API call
curl -X POST 'http://localhost:8104/models/set?model_name=llava:7b'

# Option 2: Environment variable
export VISION_MODEL=llava:7b
docker-compose -f docker-compose.vllm.yml restart ocr-service

# Option 3: docker-compose.vllm.yml
# Modify VISION_MODEL in ocr-service section
```

## Performance Tuning

### For Speed (Use llava:7b)
```yaml
VISION_MODEL: llava:7b
FALLBACK_MODEL: llava:7b
```

### For Accuracy (Use llava-next:34b)
```yaml
VISION_MODEL: llava-next:34b-v1.5-q4_K_M
FALLBACK_MODEL: llava-next:13b
```

### For Reliability (Mixed)
```yaml
VISION_MODEL: llava-next:13b
FALLBACK_MODEL: llava:7b
```

## Next Steps

1. ✅ Deploy OCR Service
   ```bash
   docker-compose -f docker-compose.vllm.yml up ocr-service
   ```

2. ✅ Test OCR Endpoint
   ```bash
   curl -F "file=@sample.pdf" http://localhost:8104/process
   ```

3. ✅ Deploy Full Stack
   ```bash
   docker-compose -f docker-compose.vllm.yml up -d
   ```

4. ✅ Verify Integration
   ```bash
   curl http://localhost:8101/health
   curl -F "file=@sample.pdf" http://localhost:8101/process
   ```

5. ✅ Monitor Performance
   ```bash
   watch -n 1 'nvidia-smi'
   docker logs -f rma-doc-processor
   ```

## FAQ

**Q: Can I use OCR Service without doc-processor?**  
A: Yes! OCR Service is standalone. Call `/process` directly at `http://localhost:8104/process`

**Q: What if Ollama is not available?**  
A: OCR Service automatically falls back to Tesseract (CPU-based OCR)

**Q: Can I use only Tesseract without Ollama?**  
A: Yes, doc-processor will skip OCR Service and go directly to Tesseract fallback

**Q: What's the latency difference?**  
A: Ollama vision (30-60s) vs Tesseract (5-10s) vs LlamaParse (<30s with API)

**Q: Can models be switched without restart?**  
A: Yes, use the `/models/set` API endpoint on OCR Service

**Q: What about throughput?**  
A: OCR Service handles 1 image at a time. For batch processing, queue requests

