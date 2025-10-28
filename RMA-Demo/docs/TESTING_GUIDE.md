# RMA-Demo Testing Guide

## Quick Start Testing

### 1. Verify All Services Running
```bash
cd /home/user/Documents/catalyst/CascadeProjects/windsurf-project/RMA-Demo
docker ps --filter "name=rma-"
```

Expected output: 8 containers running

### 2. Check LLaVA Models Available
```bash
docker exec rma-ollama ollama list
```

Should show:
- llava:13b (7.4 GB)
- llama2 (3.8 GB)

### 3. Test Frontend Access
```bash
curl -I http://localhost:3000
```

Or open in browser: http://localhost:3000

### 4. Test Ollama Service
```bash
curl http://localhost:11434/api/tags
```

Should return list of available models.

### 5. Test Document Processor with Vision Model
```bash
# Check if service is ready
curl http://localhost:8101/health

# Upload a test document (if you have one)
curl -X POST http://localhost:8101/process \
  -F "file=@/path/to/test.pdf" \
  -F "use_vision=true"
```

### 6. Test ChromaDB Vector Store
```bash
curl http://localhost:8005/api/v1/heartbeat
```

### 7. Test RAG Service
```bash
# Add a test document (if you have uploaded manuals)
curl -X POST http://localhost:8102/query \
  -H "Content-Type: application/json" \
  -d '{
    "query": "What are the main features?",
    "top_k": 3
  }'
```

## Testing Local Parsing with LLaVA

### Test 1: Simple Image OCR
1. Create a test image with text (or use existing document)
2. Upload via frontend at http://localhost:3000
3. Check doc-processor logs:
```bash
docker logs rma-doc-processor -f
```

Look for:
- "Using local parser (USE_LOCAL_PARSING=true)"
- "Processing image with LLaVA vision model"
- Extracted text output

### Test 2: PDF with Vision Model
1. Upload a PDF document
2. Verify LLaVA processes each page:
```bash
docker logs rma-doc-processor --tail 100 | grep -i "llava"
```

### Test 3: RAG Document Ingestion
1. Add manuals to the system via upload service
2. Query the RAG service:
```bash
curl -X POST http://localhost:8102/ingest \
  -H "Content-Type: application/json" \
  -d '{
    "file_path": "/manuals/test.pdf",
    "use_vision": true
  }'
```

3. Query for information:
```bash
curl -X POST http://localhost:8102/query \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Summarize the document",
    "top_k": 5
  }'
```

## OllamaRAGDemo Enhanced Ingestion Test

### Prerequisites
```bash
cd /home/user/Documents/catalyst/CascadeProjects/windsurf-project/client/OllamaRAGDemo
```

### Step 1: Check Current Setup
```bash
# Verify enhanced ingestion script exists
ls -la app/ingest_documents_enhanced.py
ls -la app/local_parser.py
```

### Step 2: Add Test Documents
```bash
# Create documents directory if needed
mkdir -p documents

# Copy sample documents (PDFs, images, HTML, TXT)
cp /path/to/sample.pdf documents/
cp /path/to/sample.jpg documents/
```

### Step 3: Run Enhanced Ingestion
```bash
# If using Docker:
docker exec rag-demo-app python3 /app/ingest_documents_enhanced.py

# Watch logs for LLaVA processing:
docker exec rag-demo-app tail -f /var/log/ingestion.log
```

Look for:
- "Using LLaVA vision model for PDF processing"
- "Using LLaVA vision model for image processing"
- "Document type: [classified_type]"
- "Structured metadata extracted"

### Step 4: Verify Vector Store Population
```bash
# Check ChromaDB collection
docker exec rma-chromadb ls -la /chroma/chroma/
```

### Step 5: Query Ingested Documents
Access the OllamaRAGDemo UI or use API to query the documents.

## Performance Benchmarks

### Expected Processing Times (LLaVA 13B)

| Document Type | Pages/Images | Expected Time | Notes |
|--------------|--------------|---------------|-------|
| Single Image | 1 | 2-5 seconds | 400 DPI, ~2MB |
| PDF (text) | 10 pages | 20-30 seconds | Vision model per page |
| PDF (scanned) | 10 pages | 30-50 seconds | Full OCR processing |
| HTML | - | <1 second | Text extraction only |
| TXT | - | <1 second | Direct processing |

### Resource Usage

Monitor with:
```bash
docker stats rma-ollama rma-doc-processor rma-rag-service
```

Expected:
- **Ollama** (with GPU): 4-8 GB VRAM, 30-60% GPU
- **Ollama** (CPU only): 8-12 GB RAM, 80-100% CPU
- **Doc Processor**: 500 MB - 2 GB RAM
- **RAG Service**: 300 MB - 1 GB RAM

## Troubleshooting Tests

### Test 1: Vision Model Availability
```bash
# Should return model details
docker exec rma-ollama ollama show llava:13b
```

### Test 2: ChromaDB Connection
```bash
# From RAG service container
docker exec rma-rag-service python3 -c "
import chromadb
client = chromadb.HttpClient(host='chromadb', port=8000)
print('ChromaDB collections:', client.list_collections())
"
```

### Test 3: Local Parsing Configuration
```bash
# Check environment
docker exec rma-doc-processor env | grep -E "USE_LOCAL_PARSING|VISION_MODEL|OLLAMA"
```

Should show:
- USE_LOCAL_PARSING=true
- VISION_MODEL=llava:13b
- OLLAMA_BASE_URL=http://ollama:11434

### Test 4: Service Logs Review
```bash
# All services at once
docker compose -f docker-compose.local-parsing.yml logs --tail=50

# Specific service
docker logs rma-doc-processor --tail 100
docker logs rma-rag-service --tail 100
docker logs rma-ollama --tail 100
```

## Integration Tests

### End-to-End Document Processing Flow

1. **Upload Document**
   - POST to upload-service (port 8103)
   - Document stored in shared volume

2. **Process with Vision Model**
   - Doc-processor (port 8101) receives file
   - LLaVA extracts text and metadata
   - Classified by document type

3. **Ingest to RAG**
   - RAG-service (port 8102) chunks document
   - Embeddings generated (nomic-embed-text)
   - Stored in ChromaDB

4. **Query RAG**
   - User query submitted to RAG-service
   - Vector similarity search in ChromaDB
   - LLM (llama2) generates response with context

5. **Display Results**
   - Frontend displays response
   - Source citations included

### Full Integration Test Script
```bash
#!/bin/bash
# test-full-pipeline.sh

# 1. Upload document
UPLOAD_RESPONSE=$(curl -s -X POST http://localhost:8103/upload \
  -F "file=@test-document.pdf")
echo "Upload response: $UPLOAD_RESPONSE"

# 2. Extract file ID
FILE_ID=$(echo $UPLOAD_RESPONSE | jq -r '.file_id')

# 3. Wait for processing
sleep 10

# 4. Query RAG
QUERY_RESPONSE=$(curl -s -X POST http://localhost:8102/query \
  -H "Content-Type: application/json" \
  -d "{\"query\": \"What is this document about?\", \"top_k\": 3}")
echo "Query response: $QUERY_RESPONSE"

# 5. Verify response contains content
if echo "$QUERY_RESPONSE" | jq -e '.answer' > /dev/null; then
  echo "✅ Pipeline test PASSED"
else
  echo "❌ Pipeline test FAILED"
fi
```

## Success Criteria

✅ All 8 containers running  
✅ LLaVA 13B model available in Ollama  
✅ ChromaDB accepting connections  
✅ Document upload succeeds  
✅ Vision model processes images/PDFs  
✅ RAG ingestion completes  
✅ Query returns relevant results  
✅ No external API calls (privacy-first)  

## Next Steps After Testing

1. **Add production documents** to the system
2. **Configure backup strategy** for ChromaDB
3. **Set up monitoring** (Prometheus/Grafana)
4. **Implement user authentication** (JWT already configured)
5. **Scale services** as needed with Docker Compose scale
6. **Add document retention policies**
7. **Configure logging aggregation**

## Support

For issues:
1. Check deployment summary: `RMA-Demo/DEPLOYMENT_SUMMARY.md`
2. Review logs: `docker compose logs [service-name]`
3. Verify configuration: `cat RMA-Demo/.env`
4. Check service health: `docker ps` and `docker stats`
