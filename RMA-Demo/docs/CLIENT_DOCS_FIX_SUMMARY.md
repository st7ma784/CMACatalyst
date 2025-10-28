# Client Document Search Fix Summary

## Issues Identified

### 1. **Local Parsing Logic Mismatch**
- **Problem**: The upload-service code was written for LlamaParse (cloud service) which saves markdown files
- **Reality**: Using local parsing with LLaVA vision model which returns text directly
- **Impact**: Code was checking for `markdown_filename` which never existed, preventing documents from being indexed

### 2. **Client ID Input Issues**
- **Problem**: Free-text input box for Client ID led to typos and partial client IDs
- **Evidence**: Found collections like `client_RMA`, `client_RMAX`, `client_cli`, `client_clien` etc.
- **Impact**: Users couldn't find their documents because they were searching with wrong client IDs

### 3. **Timeout Too Short for Local Processing**
- **Problem**: Initial 60s timeout, then 120s, still too short for LLaVA vision model
- **Reality**: Local vision processing takes 2-5 minutes per document (vs seconds for cloud APIs)
- **Impact**: Documents timing out during processing → `ReadTimeout` errors

## Fixes Applied

### 1. **Removed Markdown File Logic** ✅
**File**: `services/upload-service/app.py`

**Changes**:
- Removed markdown file saving in `upload_document()` function
- Changed reprocessing logic to only check `indexed_to_rag` flag (not `markdown_filename`)
- Updated variable names from `markdown` to `processed_text` for clarity
- Removed markdown file path logic entirely

**Before**:
```python
if not doc.get("markdown_filename") or not doc.get("indexed_to_rag"):
    # Process and save markdown file
    markdown_filename = f"{timestamp}_{original_name}.md"
    with open(markdown_path, 'w') as f:
        f.write(markdown)
```

**After**:
```python
if not doc.get("indexed_to_rag"):
    # Process document (returns text from local parser)
    processed_text = await process_document_to_markdown(file_path)
    # Index directly without saving markdown file
```

### 2. **Added Client ID Dropdown** ✅
**File**: `frontend/src/components/ClientDocumentSearch.tsx`

**Changes**:
- Added `/clients` endpoint call to fetch list of all clients
- Replaced text input with native `<select>` dropdown
- Shows: `Client Name (CLIENT_ID) - X doc(s)`
- Prevents typos and makes it easy to find clients

**UI Improvement**:
```tsx
<select value={clientId} onChange={(e) => setClientId(e.target.value)}>
  <option value="">Select a client...</option>
  {clients.map((client) => (
    <option key={client.client_id} value={client.client_id}>
      {client.client_name} ({client.client_id}) - {client.document_count} doc(s)
    </option>
  ))}
</select>
```

### 3. **Increased Timeout** ✅
**File**: `services/upload-service/app.py`

**Changes**:
- Increased httpx timeout from 60s → 120s → **300s (5 minutes)**
- Added comment explaining this is for local vision model processing
- Accommodates slower processing speed of local LLaVA vs cloud APIs

```python
async with httpx.AsyncClient(timeout=300.0) as client:  # 5 minutes for local vision model
```

### 4. **Added Startup Reprocessing** ✅
**File**: `services/upload-service/app.py`

**Changes**:
- Added `reprocess_unindexed_documents()` function
- Implemented FastAPI lifespan context manager
- On startup, scans all client directories for unindexed documents
- Automatically processes and indexes any documents with `indexed_to_rag: false`

**Benefits**:
- Retroactively processes all existing uploads
- Self-healing system - restarts will catch any failed uploads
- Logs progress with ✓ and ✗ indicators

### 5. **Better Error Logging** ✅
**Added**:
- Detailed traceback logging for processing errors
- Character count logging for successfully processed documents
- Progress indicators (✓ success, ✗ failed)
- HTTP status code and response body logging

## Testing Status

### Current System State (October 20, 2025)

**Containers Running**:
- ✅ rma-upload-service (with fixes)
- ✅ rma-frontend (with dropdown)
- ✅ rma-doc-processor (local LLaVA)
- ✅ rma-client-rag-service
- ✅ rma-chromadb (shared storage)
- ✅ rma-ollama (llama3.2 + llava:13b)

**Documents Pending Processing**:
- Client: `RMAXX01` - 6 documents
- Client: `RMAXX02` - documents being reprocessed now
- Client: `TEST001` - 0 documents

**Reprocessing Status**: 🔄 **IN PROGRESS**
- System is currently processing existing documents on startup
- Each document takes 2-5 minutes with local LLaVA
- Expected completion: 10-30 minutes for all documents

## How to Verify the Fix

### 1. Check Reprocessing Logs
```bash
docker logs rma-upload-service --tail=100 | grep -E "✓|✗|reprocessing complete"
```

### 2. Verify ChromaDB Indexing
```bash
docker exec rma-client-rag-service python -c "
import chromadb
client = chromadb.HttpClient(host='chromadb', port=8000)
for c in client.list_collections():
    if c.name.startswith('client_'):
        print(f'{c.name}: {c.count()} chunks')
"
```

### 3. Check Metadata Update
```bash
docker exec rma-upload-service cat /data/uploads/RMAXX01/metadata.json | grep indexed_to_rag
```

### 4. Test Client Dropdown
1. Navigate to "Search Client Docs" tab
2. Click Client ID dropdown - should see list of clients
3. Select `RMAXX01` (John Smith)
4. Should show document statistics

### 5. Test Document Search
1. Select client from dropdown
2. Enter question: "What debts does this client have?"
3. Should get AI-generated answer with sources

## Expected Behavior After Fix

### Upload Flow (New Documents)
1. ✅ Client uploads PDF via QR code
2. ✅ Upload-service saves file
3. ✅ Doc-processor extracts text with LLaVA (2-5 min)
4. ✅ Text indexed into ChromaDB collection `client_{CLIENT_ID}`
5. ✅ Metadata updated with `indexed_to_rag: true`
6. ✅ Document immediately searchable via AI

### Startup Flow (Existing Documents)
1. ✅ Upload-service starts up
2. ✅ Scans all client directories
3. ✅ Finds documents with `indexed_to_rag: false`
4. ✅ Reprocesses each document automatically
5. ✅ Updates metadata and indexes to RAG
6. ✅ Logs completion statistics

### Search Flow
1. ✅ Advisor opens "Search Client Docs"
2. ✅ Selects client from dropdown (no typing errors)
3. ✅ Sees document statistics (X docs, Y chunks)
4. ✅ Asks natural language question
5. ✅ Gets AI answer with source citations

## Configuration Notes

### Docker Compose
Using: `docker-compose.local-parsing.yml` (LOCAL PRIVACY MODE)

**Key Environment Variables**:
```yaml
doc-processor:
  environment:
    - USE_LOCAL_PARSING=true  # NO cloud services
    - OLLAMA_URL=http://ollama:11434
    - VISION_MODEL=llava:13b  # Local vision model
    - TEXT_MODEL=llama3.2     # Local LLM
```

### Local Processing Characteristics
- **Privacy**: No data leaves your infrastructure
- **Speed**: 2-5 minutes per document (slower than cloud)
- **Cost**: Free (no API charges)
- **GDPR**: Fully compliant
- **GPU**: Uses shared GPU via Ollama service

## Known Limitations

### Current System
1. **Processing Time**: Local LLaVA is slower than cloud APIs (acceptable trade-off for privacy)
2. **Timeout**: 5-minute max per document (very large PDFs might still timeout)
3. **GPU Memory**: LLaVA 13B uses ~8GB VRAM (ensure sufficient GPU memory)

### Not Yet Implemented
1. Progress bar for document processing in UI
2. Notification when reprocessing completes
3. Manual "Re-index all documents" button for advisors

## Deployment Checklist

When deploying these fixes:

- [ ] Rebuild upload-service: `docker compose -f docker-compose.local-parsing.yml build upload-service`
- [ ] Rebuild frontend: `docker compose -f docker-compose.local-parsing.yml build frontend`
- [ ] Restart services: `docker compose -f docker-compose.local-parsing.yml up -d upload-service frontend`
- [ ] Wait 5 minutes for startup (allows reprocessing to begin)
- [ ] Check logs for reprocessing progress
- [ ] Verify ChromaDB has chunks for client collections
- [ ] Test client dropdown in Search Client Docs
- [ ] Test querying a client's documents

## Rollback Plan

If issues occur:
1. Revert to previous `app.py`: `git checkout HEAD~1 services/upload-service/app.py`
2. Revert frontend: `git checkout HEAD~1 frontend/src/components/ClientDocumentSearch.tsx`
3. Rebuild and restart: `docker compose -f docker-compose.local-parsing.yml build && docker compose -f docker-compose.local-parsing.yml up -d`

## Future Enhancements

### Short Term
- Add progress indicator for document processing
- Show reprocessing status in admin UI
- Add "Refresh" button to reload client list

### Long Term
- Implement chunking progress bar
- Add document preview in search results
- Support batch upload with progress tracking
- Implement document versioning

---

**Status**: ✅ Fixes Applied | 🔄 Testing in Progress  
**Date**: October 20, 2025  
**System**: RMA Demo - Local Parsing Mode
