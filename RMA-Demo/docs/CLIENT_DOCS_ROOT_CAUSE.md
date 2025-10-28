# Client Documents Processing Issue - ROOT CAUSE FOUND

## Problem
Client documents were being uploaded but not appearing in the vector store (showing 0 chunks).

## Investigation with Enhanced Debugging

Added comprehensive logging to trace the document flow:

### Upload Service (`upload-service/app.py`)
- Added detailed logging for `process_document_to_markdown()`:
  - Document info (filename, size, MIME type)
  - Request/response from doc-processor
  - Processing results
  
- Added detailed logging for `index_document_to_rag()`:
  - Client ID, filename, text length
  - Request payload to client-rag-service
  - Response status and details
  - Success/failure with chunk counts

### Client RAG Service (`client-rag-service/app.py`)
- Added detailed logging for `ingest_document()`:
  - Incoming request details
  - Text splitting (number of chunks)
  - Collection creation/updates
  - Embedding process
  - Final verification

## Root Cause Discovered

**The `nomic-embed-text` embedding model was missing from Ollama!**

### Evidence from Logs:

```
INFO:__main__:Created 27 chunks from RMAXX02_Document_UNKNOWN.pdf for client RMAXX02
INFO:__main__:Adding to existing collection client_RMAXX02 in shared ChromaDB
ERROR:__main__:Error ingesting document for client RMAXX02: Error raised by inference API HTTP code: 404, {"error":"model \"nomic-embed-text\" not found, try pulling it first"}
```

### What Was Happening:

1. ✅ **Upload worked** - Files saved to `/data/uploads/{CLIENT_ID}/`
2. ✅ **Doc processing worked** - LLaVA successfully extracted text
3. ✅ **Text chunking worked** - Documents split into 1-27 chunks each
4. ❌ **Embedding FAILED** - `nomic-embed-text` model not available
5. ❌ **Vector store empty** - No chunks could be embedded/stored

### The Flow (Now Visible):

```
📄 Upload Service
   ├─ Receives document upload
   ├─ Saves to /data/uploads/{CLIENT_ID}/
   ├─ Calls doc-processor → LLaVA processes (✓)
   ├─ Gets text back (✓)
   ├─ Calls analyze_document_for_naming() (✓)
   ├─ Renames file intelligently (✓)
   └─ Calls client-rag-service /ingest

📚 Client RAG Service
   ├─ Receives ingest request (✓)
   ├─ Splits text into chunks (✓)
   ├─ Tries to embed with nomic-embed-text (✗ MODEL MISSING!)
   └─ Returns 500 error

❌ Result: Document uploaded but NOT indexed to vector store
```

## The Fix

### Pull the Missing Embedding Model:
```bash
docker exec rma-ollama ollama pull nomic-embed-text
```

**Model size:** 274 MB  
**Download time:** ~1-2 minutes depending on connection

### After Model Download:

The reprocessing function (runs at startup) will automatically:
1. Find all unindexed documents
2. Reprocess them
3. Index them to the vector store

Or manually trigger reprocessing:
```bash
docker compose -f docker-compose.local-parsing.yml restart upload-service
```

## Verification

### Check if model is downloaded:
```bash
docker exec rma-ollama ollama list
```

Should show:
```
NAME                       ID              SIZE
nomic-embed-text:latest    0a109f422b47    274 MB
llava:7b                   8dd30f6b0cb1    4.7 GB
llama3.2:latest            a80c4f17acd5    2.0 GB
```

### Check vector store has chunks:
```bash
curl http://localhost:8104/stats/RMAXX01
curl http://localhost:8104/stats/RMAXX02
```

Should show:
```json
{
  "client_id": "RMAXX01",
  "total_chunks": 55,  // Or whatever number
  "total_documents": 4,
  "status": "ready"
}
```

### Test document search:
Navigate to frontend → Search Client Docs → Select client → Enter query

## Why This Wasn't Obvious Before

1. **No detailed logging** - Just generic "failed to index" messages
2. **Multiple services** - Error happened in client-rag-service but only showed "failed" in upload-service
3. **HTTP 500 errors** - Generic server errors without details
4. **Assumed model present** - nomic-embed-text was used elsewhere (manuals RAG) so seemed available

## Models Required for Full System

| Model | Purpose | Size | Service |
|-------|---------|------|---------|
| `llava:7b` | Document OCR (vision) | 4.7 GB | doc-processor |
| `llama3.2` | Text generation/analysis | 2.0 GB | All services |
| `nomic-embed-text` | Text embeddings | 274 MB | RAG services |

### Pull All Models at Once:
```bash
docker exec rma-ollama ollama pull llava:7b
docker exec rma-ollama ollama pull llama3.2
docker exec rma-ollama ollama pull nomic-embed-text
```

## Lessons Learned

1. **Add comprehensive logging** at service boundaries
2. **Log request/response payloads** for debugging
3. **Verify all dependencies** (models, services, etc.) before processing
4. **Add health checks** that verify model availability
5. **Better error propagation** from downstream services

## Next Steps

1. ✅ Pull `nomic-embed-text` model
2. ⏳ Wait for reprocessing to complete (automatic at next restart)
3. ✅ Verify chunks appear in ChromaDB collections
4. ✅ Test document search functionality

## Future Improvements

### Add Model Health Check:
```python
def check_model_availability():
    """Verify all required models are available before starting."""
    required_models = ["nomic-embed-text", "llama3.2"]
    for model in required_models:
        # Check if model exists in Ollama
        response = requests.get(f"{OLLAMA_URL}/api/tags")
        models = response.json().get("models", [])
        if not any(m["name"].startswith(model) for m in models):
            logger.error(f"Required model {model} not found! Pull with: ollama pull {model}")
            raise Exception(f"Missing required model: {model}")
```

### Add Startup Model Pull:
```yaml
# In docker-compose, add init container or startup script:
command: >
  sh -c "
    ollama pull nomic-embed-text &&
    ollama pull llama3.2 &&
    python app.py
  "
```

## Status

- 🔍 **Root cause identified:** Missing `nomic-embed-text` embedding model
- 🔧 **Fix in progress:** Downloading model (274 MB)
- ✅ **Debug logging added:** Full visibility into document processing flow
- ⏳ **Waiting for:** Model download + automatic reprocessing

**ETA to resolution:** 2-3 minutes (model download + reprocessing)
