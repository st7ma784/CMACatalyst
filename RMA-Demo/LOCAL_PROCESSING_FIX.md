# Local Document Processing Issue & Fix

## The Real Issue

Your system **IS** using local LLaVA processing (not LlamaParse) - the configuration is correct! However, the processing is failing due to performance issues with the `llava:13b` model.

### Evidence from Logs

**Doc-Processor Logs (Confirming Local Processing):**
```
INFO:__main__:Local document parser initialized (LLaVA + Ollama)
INFO:__main__:✅ Using LOCAL vision LLM (LLaVA) - Privacy-first
INFO:__main__:Processing with local vision LLM: /tmp/tmpzydzxn73.pdf
```

**BUT also showing errors:**
```
Error processing page 1 with vision model: unexpected EOF
Error processing page 2 with vision model: Server disconnected without sending a response
Error processing page 3 with vision model: [Errno 111] Connection refused
```

**Ollama Logs (Showing the Problem):**
```
[GIN] 2025/10/20 - 12:05:47 | 200 | 12.079156683s |  172.20.0.3 | POST "/api/chat"
[GIN] 2025/10/20 - 12:06:14 | 200 | 15.725085186s |  172.20.0.3 | POST "/api/chat"
[GIN] 2025/10/20 - 12:06:39 | 200 | 24.547240903s |  172.20.0.3 | POST "/api/chat"
time=2025-10-20T12:05:36.989Z level=WARN source=sched.go:649 msg="gpu VRAM usage didn't recover within timeout"
```

## Root Cause

1. **LLaVA 13b is too heavy**: Takes 15-25 seconds **per page**
2. **VRAM exhaustion**: With multi-page documents (10-13 pages), VRAM doesn't recover between pages
3. **Timeout chain**: 
   - 10 pages × 20 seconds/page = 200-250 seconds
   - 13 pages × 20 seconds/page = 260+ seconds
   - Even with 600-second timeout, Ollama crashes mid-document

4. **Result**: Upload-service gets `ReadTimeout` or connection errors from doc-processor

## The Fix

### Switch to LLaVA 7b Model

The `llava:7b` model is:
- ✅ **Faster**: ~10-15 seconds per page (vs 15-25s for 13b)
- ✅ **Less VRAM**: ~4GB vs ~8GB
- ✅ **More stable**: Better VRAM recovery between pages
- ✅ **Still accurate**: Quality difference minimal for document OCR

### Changes Made

1. **Updated docker-compose.local-parsing.yml:**
   ```yaml
   doc-processor:
     environment:
       - VISION_MODEL=llava:7b  # Changed from llava:13b
   ```

2. **Increased timeout to 600 seconds (10 minutes):**
   ```python
   # In upload-service/app.py
   async with httpx.AsyncClient(timeout=600.0) as client:
   ```

3. **Improved reprocessing logging** with progress tracking

### Deployment Steps

```bash
cd /home/user/Documents/catalyst/CascadeProjects/windsurf-project/RMA-Demo

# 1. Pull the smaller LLaVA model (takes a few minutes)
docker exec rma-ollama ollama pull llava:7b

# 2. Restart doc-processor with new model config
docker compose -f docker-compose.local-parsing.yml restart doc-processor

# 3. Restart upload-service (already rebuilt with 600s timeout)
docker compose -f docker-compose.local-parsing.yml restart upload-service

# 4. Monitor reprocessing
docker logs rma-upload-service -f
```

## Expected Behavior After Fix

With `llava:7b`:
- **1-page doc**: ~10-15 seconds
- **5-page doc**: ~1-2 minutes
- **10-page doc**: ~2-4 minutes
- **13-page doc**: ~3-5 minutes

All should complete within the 600-second (10-minute) timeout.

## Monitoring

### Check if using correct model:
```bash
docker logs rma-doc-processor | grep "vision"
# Should show: Processing with local vision LLM
```

### Check Ollama performance:
```bash
docker logs rma-ollama --tail=50
# Look for processing times and VRAM warnings
```

### Watch reprocessing:
```bash
docker logs rma-upload-service --tail=50 -f
# Should see: "✓ Successfully reprocessed: filename"
```

## Alternative Solutions (if still having issues)

### Option 1: Process documents in batches at night
Instead of at startup, process unindexed documents during off-hours:
```python
# Schedule with cron or systemd timer
# Process max 5 documents per batch to avoid VRAM exhaustion
```

### Option 2: Use even smaller model
Try `llava:latest` (equivalent to llava:7b) or `llava:phi3` (very light):
```yaml
- VISION_MODEL=llava:phi3  # Even faster, less accurate
```

### Option 3: Skip vision model for simple docs
Add text-only fallback for documents that don't need OCR:
```python
# If PDF already has selectable text, extract it directly
# Use vision model only for scanned/image documents
```

## Verification

Once llava:7b is downloaded and services restarted:

1. **Check ChromaDB collections** (should start showing chunks):
   ```bash
   curl http://localhost:8005/api/v1/collections
   ```

2. **Test upload**:
   - Upload a new 1-2 page document
   - Should complete in under 30 seconds
   
3. **Check client document search**:
   - Select client from dropdown
   - Search for terms from uploaded documents
   - Should return results

## Status

- ✅ Configuration correct (using local processing)
- ✅ Timeout increased to 600 seconds
- ✅ Model changed to llava:7b (lighter, faster)
- ⏳ Waiting for llava:7b download (~4GB)
- ⏳ Ready to restart services and test

## Summary

**You were right to question why it seemed like LlamaParse!** The timeouts and errors made it look like cloud API issues, but it was actually:
- Local processing **was** working
- But LLaVA 13b was too slow/heavy
- Causing VRAM exhaustion and crashes
- Resulting in timeouts that mimicked cloud API failures

The switch to llava:7b should resolve all issues while maintaining fully local, privacy-first document processing. 🎉
