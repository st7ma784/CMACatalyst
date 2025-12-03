# Document Extraction Service - Deployment Options

The document extraction service at **Port 8007** is now a lightweight bridge/proxy that delegates to well-maintained containerized tools.

## Current Architecture

```
┌─────────────────────────────────┐
│   Document Extraction (8007)    │
│  (FastAPI Bridge/Proxy)         │
└────────────┬────────────────────┘
             │
             ├─→ Option 1: Marker (best for performance)
             ├─→ Option 2: LlamaParse (API + self-hosted)
             ├─→ Option 3: Paddle-OCR (lightweight)
             ├─→ Option 4: PaddleOCR v3 (Mardown output)
             └─→ Option 5: DocTR (enterprise-grade)
```

## Recommended Options (Zero Maintenance)

### 1. **Marker** (Recommended - Best Performance)
- GitHub: https://github.com/VikParuchuri/marker
- Features: PDF→Markdown, tables detected, equations, 70%+ faster than Nougat
- Docker: `docker run -p 5000:5000 vikp/marker:latest`
- Integration: `BACKEND_SERVICE=marker BACKEND_URL=http://marker:5000`

### 2. **LlamaParse** (Easiest - Cloud Option)
- API: https://www.llamaindex.ai/blog/llama-parse-launch
- Self-hosted option available
- Cost: $1-2 per 1000 pages
- Very high quality PDF parsing

### 3. **PaddleOCR v3** (Lightweight - Self-Hosted)
- GitHub: https://github.com/PaddlePaddle/PaddleOCR
- Docker: `docker run -p 8000:8000 paddlepaddle/paddle:2.5-gpu-cuda11.2-cudnn8.1-runtime`
- Lightweight, supports 80+ languages
- No external dependencies

### 4. **DocTR** (Enterprise - Self-Hosted)
- GitHub: https://github.com/mindee/doctr
- Docker: `docker run -p 8000:8000 mindee/doctr:latest-tf`
- Production-grade, multi-language
- Enterprise features

## Quick Setup - Using Marker

1. **Add to docker-compose.yml:**
```yaml
marker:
  image: vikp/marker:latest
  container_name: rma-marker
  ports:
    - "5000:5000"
  environment:
    - CUDA_VISIBLE_DEVICES=0
  deploy:
    resources:
      reservations:
        devices:
          - driver: nvidia
            count: 1
            capabilities: [gpu]
```

2. **Configure document-extraction service:**
```bash
# In RMA-Demo/.env or docker-compose environment
BACKEND_SERVICE=marker
BACKEND_URL=http://marker:5000
```

3. **Start:**
```bash
docker-compose up -d marker document-extraction-service
curl http://localhost:8007/health
```

## API Usage

### Extract from uploaded file:
```bash
curl -X POST "http://localhost:8007/extract/upload" \
  -F "file=@document.pdf" \
  -F "extraction_type=full"
```

### Response:
```json
{
  "success": true,
  "text": "# Document Title\n\n## Section\n\nContent...",
  "extraction_type": "full",
  "page_count": 5,
  "confidence": 0.85
}
```

## Benchmarks (PDF→Markdown)

| Tool | Speed | Quality | Self-Hosted | GPU | 
|------|-------|---------|------------|-----|
| Marker | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | Yes | Yes |
| DocTR | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | Yes | Yes |
| PaddleOCR | ⭐⭐⭐ | ⭐⭐⭐⭐ | Yes | Optional |
| LlamaParse | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | API only | - |

## Migration Path

1. **Development:** Use free API (LlamaParse) 
2. **Testing:** Use self-hosted lightweight (PaddleOCR)
3. **Production:** Use Marker (best balance) or DocTR (enterprise)

## Zero-Maintenance Promise

This approach means:
- ✅ No custom OCR/vision model maintenance
- ✅ Upstream handles updates
- ✅ Can swap backends without code changes (config only)
- ✅ Leverage community-maintained tools
- ✅ Focus on integration, not implementation

## Next Steps

1. Choose backend tool (Marker recommended)
2. Add to docker-compose.yml
3. Set environment variables
4. Restart services

The document-extraction-service will auto-detect and use the backend!
