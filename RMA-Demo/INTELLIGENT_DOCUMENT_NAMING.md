# Intelligent Document Naming Feature

## Overview

Documents uploaded by clients are now automatically analyzed and renamed with meaningful, structured filenames that make them instantly identifiable.

**Naming Format**: `{CLIENT_ID}_{2_word_summary}_{doc_date}.{ext}`

**Example**: `RMAXX01_Council_Tax_20240917.pdf`

## How It Works

### 1. Document Upload Flow

```
Client uploads → Process with LLaVA → Analyze with Ollama → Generate intelligent name → Rename file → Index to RAG
```

### 2. Analysis Process

After a document is processed (text extracted via LLaVA), the system:

1. **Sends first 1500 characters** to Ollama (llama3.2 model)
2. **Extracts 2-word summary**: Common document types like:
   - "Council Tax"
   - "Debt Letter"
   - "Bank Statement"
   - "Benefits Letter"
   - "Court Notice"
   - "Utility Bill"

3. **Extracts document date**: In YYYYMMDD format
   - Looks for dates in document header/footer
   - Returns "UNKNOWN" if no date found

4. **Creates structured filename**: `{CLIENT_ID}_{Summary}_{Date}.{ext}`

### 3. Renaming Logic

**New Uploads**:
- Save initially with timestamp: `20251020_112401_original_name.pdf`
- Process and analyze document
- Rename to: `RMAXX01_Debt_Letter_20240915.pdf`
- Update metadata with new filename

**Existing Documents (Reprocessing)**:
- Checks if already has intelligent name (starts with CLIENT_ID)
- If not, analyzes and renames
- Handles duplicates by appending counter: `RMAXX01_Debt_Letter_20240915_2.pdf`

## Implementation Details

### New Function: `analyze_document_for_naming()`

**Location**: `services/upload-service/app.py`

**Purpose**: Uses Ollama to extract document metadata for naming

**Parameters**:
- `document_text` (str): Processed text from document (first 1500 chars analyzed)

**Returns**:
```python
{
    "summary": "Council_Tax",      # 2 words, underscored
    "date": "20240917"              # YYYYMMDD or "UNKNOWN"
}
```

**Implementation**:
```python
async def analyze_document_for_naming(document_text: str) -> dict:
    """
    Analyze document to extract 2-word summary and document date.
    """
    prompt = f"""Analyze this document and provide ONLY:
    1. A 2-word description (e.g., "Council Tax", "Debt Letter")
    2. The document date in YYYYMMDD format

    Document text (first 1500 chars):
    {document_text[:1500]}

    Respond ONLY in this exact format:
    SUMMARY: [two words]
    DATE: [YYYYMMDD or UNKNOWN]"""
    
    # Call Ollama with low temperature for consistent output
    # Parse response with regex
    # Return structured dict
```

**Key Features**:
- Low temperature (0.3) for consistent output
- Short response limit (50 tokens)
- Regex parsing for reliability
- Fallback to "Document" and "UNKNOWN" if analysis fails
- Special character removal for safe filenames

### Modified: `upload_document()`

**Changes**:
1. Process document as before
2. **NEW**: Call `analyze_document_for_naming()`
3. **NEW**: Rename file from timestamp-based to intelligent name
4. **NEW**: Store `document_summary` and `document_date` in metadata
5. Index to RAG with enriched metadata

**Code Flow**:
```python
# Save with timestamp initially
file_path = client_dir / f"{timestamp}_{original_name}{extension}"

# Process document
processed_text = await process_document_to_markdown(file_path)

# Analyze for intelligent naming
doc_analysis = await analyze_document_for_naming(processed_text)

# Create intelligent name
intelligent_name = f"{client_id}_{doc_analysis['summary']}_{doc_analysis['date']}{extension}"

# Rename file
shutil.move(file_path, client_dir / intelligent_name)

# Store in metadata
metadata["documents"].append({
    "filename": intelligent_name,
    "document_summary": doc_analysis['summary'],
    "document_date": doc_analysis['date'],
    # ... other fields
})
```

### Modified: `reprocess_unindexed_documents()`

**Changes**:
1. Check if document already has intelligent name (starts with CLIENT_ID)
2. If not, analyze and rename during reprocessing
3. Handle duplicate filenames with counter
4. Update metadata with analysis results

**Duplicate Handling**:
```python
if intelligent_path.exists():
    counter = 1
    while intelligent_path.exists():
        intelligent_name = f"{client_id}_{summary}_{date}_{counter}{extension}"
        counter += 1
```

## Benefits

### For Advisors
✅ **Instant Document Recognition**: Know what document it is at a glance  
✅ **Chronological Organization**: Date in filename enables easy sorting  
✅ **Better Search**: Can search by document type or date  
✅ **Professional Organization**: Structured naming convention

### For System
✅ **Better Metadata**: Document type and date stored for filtering  
✅ **Improved RAG**: Metadata enriches context for AI queries  
✅ **Audit Trail**: Original filename preserved in metadata  
✅ **Self-Documenting**: Filenames tell the story

### For Clients
✅ **Transparency**: See their documents organized clearly  
✅ **Easier Navigation**: Find specific documents quickly  
✅ **Professional Appearance**: Builds trust

## Examples

### Before (Timestamp-Based)
```
20251019_214814_A00125--17-9-2025StephenManderUNPAID.pdf
20251019_215038_Copier_20251001_153338.pdf
20251019_222319_scan_document.pdf
```

### After (Intelligent Names)
```
RMAXX01_Debt_Letter_20250917.pdf
RMAXX01_Council_Tax_20251001.pdf
RMAXX01_Bank_Statement_20251015.pdf
```

## Document Type Recognition

The system recognizes common financial document types:

**Debt & Collections**:
- Debt Letter
- Collection Notice
- Court Summons
- Bailiff Notice

**Government & Council**:
- Council Tax
- Benefits Letter
- HMRC Notice
- Court Order

**Financial**:
- Bank Statement
- Credit Card
- Loan Agreement
- Payment Plan

**Utilities**:
- Energy Bill
- Water Bill
- Phone Bill
- Rent Notice

**Fallback**: "Unknown Document" if type cannot be determined

## Metadata Structure

### New Fields in `metadata.json`

```json
{
  "filename": "RMAXX01_Debt_Letter_20250917.pdf",
  "original_filename": "A00125--17-9-2025StephenManderUNPAID.pdf",
  "document_summary": "Debt Letter",
  "document_date": "20250917",
  "uploaded_at": "2025-10-19T21:48:14.535989",
  "uploaded_by": "client",
  "size": 99629,
  "indexed_to_rag": true,
  "processed_at": "2025-10-20T11:24:05.123456"
}
```

### ChromaDB Metadata

Documents indexed with enriched metadata:

```python
{
    "original_filename": "scan.pdf",
    "intelligent_filename": "RMAXX01_Debt_Letter_20250917.pdf",
    "document_summary": "Debt Letter",
    "document_date": "20250917",
    "client_id": "RMAXX01",
    "uploaded_at": "2025-10-19T21:48:14.535989",
    "uploaded_by": "client"
}
```

## Performance Considerations

### Processing Time
- **Document Processing (LLaVA)**: 2-5 minutes (existing bottleneck)
- **Document Analysis (Ollama)**: 3-5 seconds (minimal additional time)
- **File Rename**: <1 second

**Total Impact**: ~5 seconds added to overall ~3 minute process = negligible

### Resource Usage
- **CPU**: Minimal (regex parsing only)
- **GPU**: Brief Ollama call (llama3.2 already loaded)
- **Memory**: Small (1500 chars analyzed)
- **Network**: None (all local)

## Testing

### Manual Test - New Upload

1. **Upload a document** via client upload portal
2. **Check logs**:
   ```bash
   docker logs rma-upload-service -f | grep -E "Document analysis|Renamed"
   ```
3. **Verify filename** in uploads directory:
   ```bash
   docker exec rma-upload-service ls -la /data/uploads/RMAXX01/
   ```
4. **Check metadata**:
   ```bash
   docker exec rma-upload-service cat /data/uploads/RMAXX01/metadata.json | grep -A5 document_summary
   ```

### Expected Log Output

```
INFO:__main__:Successfully processed A00125.pdf, got 2341 chars
INFO:__main__:Document analysis: summary='Debt_Letter', date='20250917'
INFO:__main__:Renamed file to: RMAXX01_Debt_Letter_20250917.pdf
INFO:__main__:Indexed document RMAXX01_Debt_Letter_20250917.pdf for client RMAXX01: 12 chunks
```

### Reprocessing Test

1. **Restart service** (triggers reprocessing):
   ```bash
   docker compose -f docker-compose.local-parsing.yml restart upload-service
   ```
2. **Watch logs** for renaming:
   ```bash
   docker logs rma-upload-service -f | grep -E "Renamed to|✓"
   ```
3. **Verify filenames** changed in directory

## Error Handling

### Analysis Failures

**Scenario**: Ollama call fails or returns invalid format

**Handling**:
- Falls back to: `{CLIENT_ID}_Document_UNKNOWN.{ext}`
- Logs warning but continues processing
- Document still gets indexed and searchable

### Rename Failures

**Scenario**: File system error during rename

**Handling**:
- Keeps timestamp-based filename
- Logs warning: "Failed to rename, keeping original"
- Document still gets processed and indexed
- Metadata marks original filename

### Duplicate Names

**Scenario**: Two documents with same type and date

**Handling**:
- Appends counter: `RMAXX01_Debt_Letter_20250917_2.pdf`
- Prevents overwrite conflicts
- All documents preserved

## Future Enhancements

### Short Term
- [ ] Show document type as badge/icon in UI
- [ ] Filter documents by type in client list
- [ ] Sort by document date
- [ ] Custom naming rules per client

### Long Term
- [ ] Machine learning for better type classification
- [ ] Multi-language document support
- [ ] Extract more metadata (amounts, creditors, etc.)
- [ ] Generate document summaries for advisor dashboard
- [ ] Bulk rename existing documents via admin UI

## Configuration

### Environment Variables

**Ollama Model**: Uses `llama3.2` (already configured)
```yaml
environment:
  - OLLAMA_URL=http://ollama:11434
```

**Analysis Parameters** (in code):
- Temperature: 0.3 (consistent output)
- Max tokens: 50 (short response)
- Context: First 1500 chars

### Customization

To change document type patterns, edit the prompt in `analyze_document_for_naming()`:

```python
prompt = f"""Analyze this document and provide ONLY:
1. A 2-word description (e.g., "Council Tax", "Debt Letter", "YOUR_TYPE")
...
"""
```

## Troubleshooting

### Issue: Documents not being renamed

**Check**:
1. Ollama service running: `docker ps | grep ollama`
2. llama3.2 model loaded: `docker exec rma-ollama ollama list`
3. Logs for errors: `docker logs rma-upload-service | grep "Error analyzing"`

**Solution**: Restart Ollama if needed

### Issue: Wrong document types

**Check**: First 1500 chars of document contains type info

**Solution**: Increase context window in `analyze_document_for_naming()`:
```python
{document_text[:3000]}  # Increase from 1500 to 3000
```

### Issue: Invalid dates

**Check**: Date format in document (UK vs US format)

**Solution**: Enhance date parsing regex to handle more formats

## Deployment Checklist

Before deploying to production:

- [x] Code implemented in `app.py`
- [x] Service rebuilt and restarted
- [ ] Test with real client document
- [ ] Verify filename appears in UI correctly
- [ ] Check search still works with new names
- [ ] Monitor performance impact
- [ ] Update user documentation
- [ ] Train advisors on new naming convention

## Rollback Plan

If issues occur:

1. **Revert code**:
   ```bash
   git checkout HEAD~1 services/upload-service/app.py
   ```

2. **Rebuild**:
   ```bash
   docker compose -f docker-compose.local-parsing.yml build upload-service
   docker compose -f docker-compose.local-parsing.yml up -d upload-service
   ```

3. **Old filenames preserved** in metadata as `original_filename`

---

**Status**: ✅ Implemented | 🔄 Testing in Progress  
**Date**: October 20, 2025  
**Feature**: Intelligent Document Naming v1.0
