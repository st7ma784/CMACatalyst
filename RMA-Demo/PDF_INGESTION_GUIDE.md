# PDF Ingestion Guide for RAG Service

## Overview
The RAG service now includes robust PDF processing capabilities with automatic OCR fallback for scanned documents.

## New Features

### 1. PDF Text Extraction
- **Direct Text Extraction**: Uses PyPDF2 to extract text from digital PDFs
- **OCR Fallback**: Automatically falls back to Tesseract OCR for scanned PDFs
- **High DPI Processing**: OCR uses 300 DPI for better accuracy
- **Progress Logging**: Detailed logs show extraction progress

### 2. New Endpoints

#### `/ingest-pdf` - Upload Single PDF
```bash
curl -X POST http://localhost:8102/ingest-pdf \
  -F "file=@/path/to/manual.pdf"
```

Response includes:
- Success status
- Number of chunks created
- Extracted text length
- Preview of extracted text

#### `/ingest-all-manuals` - Bulk Process
```bash
curl -X POST http://localhost:8102/ingest-all-manuals
```

Processes all PDFs in `/manuals` directory and returns:
- Total files processed
- Success/failure counts
- Detailed status for each file
- Text lengths and chunk counts

#### `/debug/documents` - View Raw Chunks
```bash
curl "http://localhost:8102/debug/documents?limit=10&source=manual.pdf"
```

Shows actual text chunks stored in vectorstore with metadata.

#### `/debug/sources` - List All Sources
```bash
curl http://localhost:8102/debug/sources
```

Returns list of all source documents in the vectorstore.

## Extraction Process

### Step 1: Direct Text Extraction (PyPDF2)
```python
# Attempts to extract text from each page
# Fast and works well for digital PDFs
# If extraction yields < 100 characters, falls back to OCR
```

### Step 2: OCR Fallback (Tesseract)
```python
# Converts PDF to images (300 DPI)
# Processes each page with Tesseract OCR
# Logs progress every 5 pages
# Works for scanned documents, images, etc.
```

### Step 3: Chunking
```python
# Splits text into chunks
chunk_size=1000
chunk_overlap=200
# Creates Document objects with metadata
```

### Step 4: Vectorization
```python
# Embeds chunks using nomic-embed-text
# Stores in ChromaDB with source metadata
# Queryable via /query endpoint
```

## Testing PDF Ingestion

### Test Single File
```bash
# Copy a test PDF to the manuals directory
docker cp test-manual.pdf rma-rag-service:/manuals/

# Ingest it
curl -X POST http://localhost:8102/ingest-pdf \
  -F "file=@test-manual.pdf"
```

### Test Bulk Ingestion
```bash
# Copy multiple PDFs
docker cp manuals/ rma-rag-service:/manuals/

# Ingest all
curl -X POST http://localhost:8102/ingest-all-manuals
```

### Verify Ingestion
```bash
# Check stats
curl http://localhost:8102/stats

# List sources
curl http://localhost:8102/debug/sources

# View chunks from specific source
curl "http://localhost:8102/debug/documents?source=manual.pdf&limit=5"
```

### Test Query
```bash
curl -X POST http://localhost:8102/query \
  -H "Content-Type: application/json" \
  -d '{
    "question": "What is the debt advice process?",
    "top_k": 3
  }'
```

## Docker Configuration

### Updated Dockerfile
```dockerfile
# Installs system dependencies:
- tesseract-ocr (for OCR)
- poppler-utils (for PDF to image conversion)
```

### Updated requirements.txt
```txt
PyPDF2==3.0.1          # PDF text extraction
pdf2image==1.16.3      # PDF to image conversion
Pillow==10.2.0         # Image processing
pytesseract==0.3.10    # OCR wrapper
```

## Troubleshooting

### PDF Not Extracting Text
**Symptom**: Extracted text length < 50 characters
**Causes**:
- PDF is encrypted
- PDF is scanned but OCR failed
- PDF contains only images

**Solution**: Check logs for OCR errors. May need to pre-process PDF.

### OCR Taking Too Long
**Symptom**: Processing hangs on large PDFs
**Causes**:
- High page count
- Large page size
- Low system resources

**Solution**: 
- Process smaller batches
- Reduce DPI (edit `dpi=300` to `dpi=150` in code)
- Increase container memory

### Chunks Not Appearing in Queries
**Symptom**: Query returns "I don't know"
**Causes**:
- Poor text extraction
- Vectorstore not initialized
- Embedding model not loaded

**Solution**:
```bash
# Check extraction quality
curl "http://localhost:8102/debug/documents?limit=1"

# Check vectorstore status
curl http://localhost:8102/stats

# Check service logs
docker logs rma-rag-service --tail 100
```

## Best Practices

### 1. Pre-process PDFs
- Remove encryption
- Ensure text layer exists
- Compress large files
- Use OCR preprocessing for scanned docs

### 2. Monitor Ingestion
```bash
# Watch logs during ingestion
docker logs -f rma-rag-service
```

### 3. Verify Quality
After ingestion:
1. Check chunk count matches expectation
2. View sample chunks to verify text quality
3. Test queries with known questions
4. Check retrieved chunks show relevant content

### 4. Debugging Workflow
1. Ingest document
2. Check `/debug/documents` for raw chunks
3. Test query with `/query?top_k=5` 
4. Check `retrieved_chunks` in response
5. Verify chunks contain expected content

## Performance Tips

### For Large Documents (>100 pages)
- Increase chunk size to reduce total chunks
- Batch process instead of bulk
- Monitor memory usage

### For Many Small Documents
- Use bulk ingestion endpoint
- Process during off-hours
- Consider pre-extracting text

### For Scanned Documents
- Pre-process with external OCR tool
- Use higher DPI (but slower)
- Clean up noise in scans first

## Frontend Integration

The Debug tab in the frontend provides:
- View all ingested sources
- Browse chunks by source
- Search/filter functionality
- Preview extracted text
- Verify vectorstore contents

Access at: http://localhost:3000 → Debug tab

## Next Steps

1. **Rebuild RAG service** with new dependencies:
```bash
docker compose -f docker-compose.local-parsing.yml build rag-service
docker compose -f docker-compose.local-parsing.yml up -d rag-service
```

2. **Copy manuals** to container:
```bash
docker cp ./manuals/ rma-rag-service:/manuals/
```

3. **Ingest all PDFs**:
```bash
curl -X POST http://localhost:8102/ingest-all-manuals
```

4. **Test queries** and verify results using Debug tab
