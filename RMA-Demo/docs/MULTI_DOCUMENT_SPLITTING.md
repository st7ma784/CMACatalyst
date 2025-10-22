# Multi-Document PDF Splitting and Intelligent Naming

## Overview

The RMA Document Management system now includes advanced PDF processing capabilities that automatically detect when a single PDF file contains multiple distinct documents, splits them into separate files, and gives each one an intelligent, meaningful name.

## Problem Statement

When clients upload scanned documents, they often combine multiple documents into a single PDF file:
- Multiple letters scanned together
- Bank statements bundled with correspondence
- Mixed document types (forms, letters, receipts) in one file
- Multi-page documents that should be separate entities

This makes it difficult to:
- Identify specific documents quickly
- Search for relevant information
- Organize and manage files
- Understand what documents are available at a glance

## Solution

### Automatic Document Boundary Detection

The system uses AI (LLM) to analyze the content and structure of PDF pages to detect document boundaries. It looks for:

1. **Content Indicators:**
   - New letterhead or header
   - Different sender/recipient
   - Different dates (more than a few days apart)
   - Different document types

2. **Structural Indicators:**
   - Clear visual breaks or separators
   - Change in formatting style
   - Page layout changes

### Intelligent Document Splitting

When multiple documents are detected:
1. **Splits** the original PDF into separate files
2. **Processes** each document independently to extract text
3. **Analyzes** each document to determine its type and date
4. **Names** each file intelligently: `{CLIENT_ID}_{Type}_{Date}.pdf`
5. **Indexes** each document separately in the vector store for AI search
6. **Deletes** the original combined PDF to avoid duplication

### Intelligent File Naming

Each document is automatically named using the format:

```
{CLIENT_ID}_{TwoWordSummary}_{Date}.pdf
```

**Examples:**
- `RMAXX01_Benefits_Letter_20231015.pdf`
- `RMAXX01_Bank_Statement_20231101.pdf`
- `RMAXX01_Council_Tax_20230915.pdf`
- `RMAXX01_Debt_Letter_20231220.pdf`

The system uses AI to extract:
- **2-Word Summary**: Concise description of document type
- **Date**: Document date in YYYYMMDD format (or "UNKNOWN" if not found)

## Technical Implementation

### Architecture

```
┌─────────────────┐
│  Upload PDF     │
└────────┬────────┘
         │
         ▼
┌─────────────────────────┐
│ detect_document_        │
│ boundaries()            │
│ - Extract page text     │
│ - Analyze with LLM      │
│ - Return page ranges    │
└────────┬────────────────┘
         │
         ▼
    ┌───────┐
    │ > 1?  │───No──► Normal single-doc processing
    └───┬───┘
        │Yes
        ▼
┌─────────────────────────┐
│ split_pdf_into_         │
│ documents()             │
│ - Split by page ranges  │
│ - Create separate PDFs  │
└────────┬────────────────┘
         │
         ▼
    ┌────────────────────┐
    │  For Each Split:   │
    │  1. Extract text   │
    │  2. Analyze naming │
    │  3. Rename file    │
    │  4. Index to RAG   │
    └────────┬───────────┘
             │
             ▼
    ┌────────────────────┐
    │ Delete Original    │
    │ Combined PDF       │
    └────────────────────┘
```

### Key Functions

#### 1. `detect_document_boundaries(pdf_path: Path) -> List[dict]`

Analyzes a PDF to detect document boundaries.

**Input:** Path to PDF file

**Output:** List of boundary dictionaries:
```python
[
    {"start_page": 0, "end_page": 2, "page_count": 3},
    {"start_page": 3, "end_page": 5, "page_count": 3},
    {"start_page": 6, "end_page": 8, "page_count": 3}
]
```

**Process:**
1. Extracts text preview from each page (first 500 chars)
2. Creates prompt with page summaries
3. Sends to LLM (llama3.2) for analysis
4. Parses response for document count and boundary pages
5. Returns page ranges for each detected document

**LLM Prompt Structure:**
```
Analyze these N pages from a scanned PDF file.
Determine if this PDF contains MULTIPLE separate documents or just ONE document.

Page previews:
Page 0: [preview text...]
Page 1: [preview text...]
...

Common indicators of document boundaries:
- New letterhead/header
- Different sender/recipient
- Different dates
- Different document types
- Clear visual breaks

Respond in this EXACT format:
DOCUMENT_COUNT: [number]
BOUNDARIES: [comma-separated page numbers]
```

#### 2. `split_pdf_into_documents(pdf_path, boundaries, client_dir) -> List[Path]`

Splits a PDF into separate files based on boundaries.

**Input:**
- `pdf_path`: Original PDF file
- `boundaries`: List of page ranges
- `client_dir`: Directory to save split files

**Output:** List of paths to split PDF files

**Process:**
1. Uses PyPDF2 to read original PDF
2. For each boundary range:
   - Creates new PdfWriter
   - Adds pages from range
   - Saves as `{timestamp}_{original}_part{N}.pdf`
3. Returns list of all created files

#### 3. `process_multipage_pdf(file_path, client_id, original_filename, client_dir) -> List[dict]`

Complete workflow for processing multi-document PDFs.

**Input:**
- `file_path`: Path to uploaded PDF
- `client_id`: Client identifier
- `original_filename`: Original upload filename
- `client_dir`: Client's document directory

**Output:** List of processed document metadata dictionaries

**Process:**
1. Calls `detect_document_boundaries()` to analyze PDF
2. If single document detected, returns empty list (use normal flow)
3. If multiple documents detected:
   - Calls `split_pdf_into_documents()` to split
   - For each split file:
     - Processes to extract text
     - Analyzes for intelligent naming
     - Renames file intelligently
     - Indexes to vector store
     - Collects metadata
4. Deletes original combined PDF
5. Returns list of all processed document metadata

#### 4. `analyze_document_for_naming(document_text: str) -> dict`

Extracts intelligent name components from document text.

**Input:** Document text content

**Output:**
```python
{
    "summary": "Benefits_Letter",  # 2 words, underscore-separated
    "date": "20231015"             # YYYYMMDD or "UNKNOWN"
}
```

**LLM Prompt:**
```
Analyze this document and provide ONLY:
1. A 2-word description (e.g., "Council Tax", "Debt Letter", "Bank Statement")
2. The document date in YYYYMMDD format (if found, otherwise use "UNKNOWN")

Document text (first 1500 chars):
[text...]

Respond ONLY in this exact format:
SUMMARY: [two words]
DATE: [YYYYMMDD or UNKNOWN]
```

### Updated Upload Flow

```python
@app.post("/uploads/{client_id}")
async def upload_document(client_id: str, file: UploadFile):
    # 1. Save uploaded file with timestamp
    file_path = save_upload(file)
    
    # 2. Check if PDF contains multiple documents
    if file.filename.endswith('.pdf'):
        multi_docs = await process_multipage_pdf(...)
        
        if multi_docs:
            # Multiple documents processed
            for doc in multi_docs:
                save_metadata(doc)
            return success_response(multi_docs)
    
    # 3. Fallback: Single document processing
    text = await process_document_to_markdown(file_path)
    naming = await analyze_document_for_naming(text)
    intelligent_filename = create_name(naming)
    rename_file(file_path, intelligent_filename)
    index_to_rag(text, intelligent_filename)
    save_metadata(...)
    
    return success_response(...)
```

## Dependencies

### Python Libraries

```txt
PyPDF2==3.0.1        # PDF reading and writing
pdf2image==1.16.3    # PDF to image conversion (future enhancement)
```

### System Dependencies

```dockerfile
RUN apt-get update && apt-get install -y \
    poppler-utils \
    && rm -rf /var/lib/apt/lists/*
```

**poppler-utils** provides:
- `pdfinfo`: PDF metadata extraction
- `pdftotext`: Text extraction
- `pdftoppm`: PDF to image conversion

## Configuration

### Environment Variables

```bash
OLLAMA_URL=http://ollama:11434  # LLM service for analysis
CLIENT_RAG_URL=http://client-rag-service:8104  # Vector store service
```

### LLM Model

Uses **llama3.2** for both:
- Document boundary detection
- Intelligent naming analysis

**Model Parameters:**
- Temperature: 0.2-0.3 (consistent, factual output)
- Num_predict: 50-100 tokens (short, focused responses)

## Metadata Structure

Documents are stored with comprehensive metadata:

```json
{
  "filename": "RMAXX01_Benefits_Letter_20231015.pdf",
  "original_filename": "scanned_docs.pdf",
  "uploaded_at": "2025-10-20T14:30:00",
  "uploaded_by": "client",
  "size": 245678,
  "processed_text_length": 1523,
  "indexed_to_rag": true,
  "document_summary": "Benefits Letter",
  "document_date": "20231015",
  "part_of_multipage": true,
  "original_multipage_file": "scanned_docs.pdf"
}
```

**Key Fields:**
- `part_of_multipage`: Indicates document was split from larger PDF
- `original_multipage_file`: Original combined PDF filename
- `document_summary`: Human-readable type
- `document_date`: Structured date for sorting/filtering

## Vector Store Integration

Each split document is indexed separately in ChromaDB:

**Collection Structure:**
- Collection name: `client_{CLIENT_ID}`
- Each document gets its own set of chunks
- Metadata attached to each chunk:
  - `source`: filename
  - `chunk`: chunk number
  - `document_summary`: type
  - `document_date`: date
  - `original_multipage_file`: if applicable

**Search Benefits:**
- Queries can find specific documents by type
- Date-based filtering possible
- Chunk-level precision for context
- Source attribution to exact file

## Example Scenarios

### Scenario 1: Client Scans 3 Letters Together

**Upload:**
- Filename: `client_docs_scan.pdf`
- Pages: 8 total

**Detection:**
```
DOCUMENT_COUNT: 3
BOUNDARIES: 0,3,6
```

**Results:**
- `RMAXX01_Benefits_Letter_20231015.pdf` (pages 0-2)
- `RMAXX01_Council_Tax_20231022.pdf` (pages 3-5)
- `RMAXX01_Bank_Statement_20231101.pdf` (pages 6-7)

### Scenario 2: Single Multi-Page Document

**Upload:**
- Filename: `tax_form.pdf`
- Pages: 5 pages of same form

**Detection:**
```
DOCUMENT_COUNT: 1
BOUNDARIES: 0
```

**Result:**
- `RMAXX01_Tax_Form_20231120.pdf` (all 5 pages)
- Normal processing flow used

### Scenario 3: Mixed Document Types

**Upload:**
- Filename: `various_docs.pdf`
- Pages: 12 pages

**Detection:**
```
DOCUMENT_COUNT: 4
BOUNDARIES: 0,4,7,10
```

**Results:**
- `RMAXX01_Debt_Letter_20231005.pdf` (pages 0-3)
- `RMAXX01_Income_Statement_20231010.pdf` (pages 4-6)
- `RMAXX01_Benefits_Letter_20231015.pdf` (pages 7-9)
- `RMAXX01_Grant_Offer_20231020.pdf` (pages 10-11)

## Error Handling

### Fallback Behavior

If any step fails, the system falls back gracefully:

1. **Boundary Detection Fails** → Treat as single document
2. **Splitting Fails** → Use original file, normal processing
3. **Individual Processing Fails** → Skip that document, continue with others
4. **Naming Analysis Fails** → Use default `Document_UNKNOWN` naming
5. **RAG Indexing Fails** → Document still saved, marked as unindexed

### Logging

Comprehensive emoji-based logging for easy debugging:

```
🔍 [DOC-SPLIT] Analyzing PDF for document boundaries
   ├─ Total pages: 8
   ├─ Analyzing page structure with LLM...
   ├─ Detected 3 documents
   ├─ Boundary pages: [0, 3, 6]
   └─ Document ranges: [...]

✂️  [DOC-SPLIT] Splitting PDF into 3 documents
   ├─ Created: 20251020_143000_scan_part1.pdf (pages 0-2)
   ├─ Created: 20251020_143000_scan_part2.pdf (pages 3-5)
   ├─ Created: 20251020_143000_scan_part3.pdf (pages 6-7)
   └─ Successfully split into 3 files

📄 [MULTI-DOC] Processing multipage PDF: scan.pdf
   ├─ Processing split document: ...part1.pdf
   │  ✓ Renamed to: RMAXX01_Benefits_Letter_20231015.pdf
   │  ✓ Indexed: True
   ├─ Processing split document: ...part2.pdf
   │  ✓ Renamed to: RMAXX01_Council_Tax_20231022.pdf
   │  ✓ Indexed: True
   └─ Successfully processed 3 documents from multipage PDF
```

## Performance Considerations

### Processing Time

For a 10-page PDF with 3 documents:

1. **Boundary Detection**: ~5-10 seconds
   - LLM analysis of page structure
2. **PDF Splitting**: ~1-2 seconds
   - Mechanical page extraction
3. **Per Document** (×3):
   - Text extraction: ~2-3 seconds
   - Name analysis: ~3-5 seconds
   - RAG indexing: ~2-3 seconds
   
**Total**: ~35-50 seconds for 3 documents

### Optimization Opportunities

1. **Parallel Processing**: Process split documents concurrently
2. **Caching**: Cache LLM responses for similar documents
3. **Smart Detection**: Skip boundary detection for single-page PDFs
4. **Batch Indexing**: Index multiple documents to RAG in one call

## Future Enhancements

### 1. Visual Analysis

Add image-based boundary detection:
- Analyze page images for visual breaks
- Detect header/footer patterns
- Identify logo/letterhead changes

### 2. User Confirmation

Before splitting, show preview:
- Detected boundaries
- Proposed filenames
- Allow manual adjustment

### 3. Merge Detection

Identify pages that belong together:
- Multi-page letters
- Forms with attachments
- Related correspondence

### 4. Advanced Naming

More sophisticated naming:
- Extract sender/recipient
- Identify priority level
- Detect action items

### 5. Metadata Extraction

Pull structured data:
- Dates
- Amounts
- Reference numbers
- Names and addresses

## Testing

### Test Cases

1. **Single Document PDF**
   - Should use normal processing
   - Should get intelligent name
   
2. **Multiple Documents PDF**
   - Should detect all boundaries
   - Should split correctly
   - Should name each intelligently
   
3. **Mixed Types PDF**
   - Should handle different document types
   - Should extract correct dates
   - Should use appropriate naming

4. **Edge Cases**
   - 1-page PDF: No splitting
   - 50-page PDF: Stress test
   - Corrupted PDF: Error handling
   - No text PDF: Fallback behavior

### Manual Testing

```bash
# Upload test PDF
curl -X POST http://192.168.5.70:8103/uploads/TESTCLIENT \
  -F "file=@test_multipage.pdf"

# Check results
curl http://192.168.5.70:8103/uploads/TESTCLIENT \
  -H "Authorization: Bearer $TOKEN"

# Search documents
curl -X POST http://192.168.5.70:8104/query \
  -H "Content-Type: application/json" \
  -d '{
    "client_id": "TESTCLIENT",
    "question": "What documents do I have?",
    "model": "llama3.2"
  }'
```

## Troubleshooting

### Problem: All PDFs Treated as Single Document

**Causes:**
- LLM not detecting boundaries
- All pages look similar
- Timeout in boundary detection

**Solutions:**
- Check LLM logs for analysis
- Adjust detection prompt
- Increase timeout
- Manual splitting

### Problem: Incorrect Split Points

**Causes:**
- Ambiguous page content
- Inconsistent formatting
- LLM hallucination

**Solutions:**
- Review page previews
- Adjust prompt with better examples
- Lower temperature for consistency
- Add manual override option

### Problem: Naming Not Working

**Causes:**
- Text extraction failed
- LLM unable to categorize
- No date in document

**Solutions:**
- Check OCR quality
- Review naming prompt
- Add more category examples
- Accept "UNKNOWN" as valid

### Problem: RAG Indexing Fails

**Causes:**
- ChromaDB connection issue
- Embedding model unavailable
- Text too short/long

**Solutions:**
- Verify ChromaDB health
- Check Ollama models
- Adjust text length limits
- Retry indexing separately

## Monitoring

### Key Metrics

1. **Split Rate**: % of PDFs that get split
2. **Average Documents Per PDF**: For multi-doc files
3. **Naming Success Rate**: % with intelligent names (not "Document_UNKNOWN")
4. **Processing Time**: Total and per-document
5. **RAG Index Success**: % successfully indexed

### Logging Queries

```bash
# Count multi-document uploads
docker logs rma-upload-service | grep "Detected.*separate documents" | wc -l

# Check naming success
docker logs rma-upload-service | grep "Renamed to:" | grep -v "UNKNOWN"

# Find processing errors
docker logs rma-upload-service | grep "ERROR.*multipage"
```

## Related Documentation

- [Document Scanning Architecture](DOCUMENT_SCANNING_ARCHITECTURE.md)
- [Automatic Model Initialization](AUTOMATIC_MODEL_INITIALIZATION.md)
- [Client RAG Service](../services/client-rag-service/README.md)
- [Upload Service API](../services/upload-service/README.md)
