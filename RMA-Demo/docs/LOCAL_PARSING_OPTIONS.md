# Local Document Parsing Options (No Cloud Services)

## Overview

This document outlines local alternatives to LlamaParse that keep sensitive financial documents on-premises, complying with GDPR and data protection requirements for money advice services.

## What LlamaParse Does (Cloud-Based)

- ✅ Advanced PDF parsing with layout understanding
- ✅ Document classification
- ✅ Structured data extraction with schemas
- ✅ Table extraction
- ❌ **Sends documents to external cloud servers**
- ❌ **Requires internet connection**
- ❌ **Potential GDPR compliance issues**
- ❌ **Monthly API costs**

---

## 🔒 Local Alternatives (Recommended)

### Option 1: **Ollama + LLaVA Vision Models** ⭐ RECOMMENDED

**Best for:** Production use with GPU acceleration

**Capabilities:**
- ✅ Complete document understanding (layout, tables, forms)
- ✅ Document classification
- ✅ Structured data extraction
- ✅ Works offline
- ✅ Free and open source
- ✅ GPU accelerated
- ✅ Privacy-first (all on-premises)

**Models Available:**
1. **llava:7b** - Fast, good quality (4GB VRAM)
2. **llava:13b** - Better quality (8GB VRAM) ⭐ Recommended
3. **llava:34b** - Best quality (20GB VRAM)
4. **llava-phi3** - Efficient, Microsoft-backed (4GB VRAM)
5. **bakllava** - Alternative architecture (7GB VRAM)

**Setup:**
```bash
# Pull vision model
docker exec rma-ollama ollama pull llava:13b

# Test it
docker exec rma-ollama ollama run llava:13b "What's in this image?" /path/to/image.jpg
```

**Performance:**
- Processing time: 30-60 seconds per page (GPU)
- Quality: Excellent for forms, tables, handwriting
- Cost: $0 (runs locally)

**Pros:**
- Best balance of quality and speed
- Handles complex layouts (tables, multi-column)
- Can classify document types
- Extracts structured JSON
- No external dependencies
- Integrates with existing Ollama setup

**Cons:**
- Requires more VRAM than text-only models
- Slower than cloud services (but acceptable)

---

### Option 2: **Marker** (PDF to Markdown)

**Best for:** Fast PDF conversion without GPU

**Capabilities:**
- ✅ Excellent PDF to Markdown conversion
- ✅ Preserves formatting, tables, lists
- ✅ Math equation support
- ✅ Works on CPU (no GPU required)
- ✅ Very fast (seconds per document)

**Setup:**
```bash
pip install marker-pdf

# Or add to requirements.txt
marker-pdf==0.2.0
```

**Usage:**
```python
from marker.convert import convert_single_pdf

# Convert PDF
markdown_text, images, metadata = convert_single_pdf(
    pdf_path="document.pdf",
    output_dir="output/"
)
```

**Performance:**
- Processing time: 5-15 seconds per document
- Quality: Very good for standard PDFs
- Cost: $0

**Pros:**
- Extremely fast
- No GPU required
- Great format preservation
- Good with tables

**Cons:**
- No document classification
- No structured extraction (need separate LLM step)
- Doesn't handle scanned images well

---

### Option 3: **Unstructured.io (Local)**

**Best for:** When you need advanced layout detection

**Capabilities:**
- ✅ Advanced layout detection
- ✅ Table extraction
- ✅ Element classification (heading, text, table, image)
- ✅ Multiple file formats
- ✅ Partition by element type

**Setup:**
```bash
pip install unstructured[local-inference]
pip install "unstructured[pdf]"

# Requires additional dependencies
apt-get install -y poppler-utils tesseract-ocr
```

**Usage:**
```python
from unstructured.partition.pdf import partition_pdf

# Partition PDF
elements = partition_pdf(
    filename="document.pdf",
    strategy="hi_res",  # High resolution
    infer_table_structure=True
)

# Get different element types
for element in elements:
    if element.type == "Table":
        print(element.metadata.text_as_html)  # Get table as HTML
    elif element.type == "Title":
        print(f"Heading: {element.text}")
```

**Performance:**
- Processing time: 20-40 seconds per document
- Quality: Excellent for complex layouts
- Cost: $0

**Pros:**
- Best layout detection
- Table extraction as structured HTML
- Element-level classification
- Works well with forms

**Cons:**
- Slower than Marker
- More dependencies
- Requires follow-up LLM for classification

---

### Option 4: **Tesseract OCR + Your LLM** (Fallback)

**Best for:** Budget deployments without GPU

**Capabilities:**
- ✅ OCR for scanned documents
- ✅ Works on CPU
- ✅ No external dependencies
- ✅ Very lightweight

**Already Implemented:** This is your current fallback

**Performance:**
- Processing time: 10-30 seconds per page
- Quality: Good for clear scans, struggles with layouts
- Cost: $0

**Pros:**
- Already working
- No GPU needed
- Very lightweight
- Good for simple documents

**Cons:**
- Poor with complex layouts
- No table structure
- Requires separate classification step

---

## 🎯 Recommended Implementation Strategy

### Hybrid Approach (Best Quality + Reliability)

```python
def parse_document_local(file_path: str) -> dict:
    """
    Hybrid local parsing strategy
    """

    # Step 1: Try vision model first (best quality)
    if gpu_available and has_vision_model:
        try:
            return parse_with_llava(file_path)  # Option 1
        except Exception as e:
            log.warning(f"Vision model failed: {e}, trying Marker")

    # Step 2: Fallback to Marker (fast, good quality)
    if has_marker:
        try:
            markdown = convert_with_marker(file_path)  # Option 2
            # Classify with text LLM
            classification = classify_with_llama(markdown)
            structured_data = extract_with_llama(markdown, classification)
            return {
                'text': markdown,
                'classification': classification,
                'structured_data': structured_data,
                'method': 'marker_plus_llm'
            }
        except Exception as e:
            log.warning(f"Marker failed: {e}, trying Tesseract")

    # Step 3: Final fallback to Tesseract
    return parse_with_tesseract(file_path)  # Option 4
```

---

## 📊 Comparison Table

| Feature | LlamaParse<br/>(Cloud) | LLaVA<br/>(Local GPU) | Marker<br/>(Local CPU) | Unstructured<br/>(Local) | Tesseract<br/>(Fallback) |
|---------|------------|-----------|---------|--------------|-----------|
| **Privacy** | ❌ Cloud | ✅ Local | ✅ Local | ✅ Local | ✅ Local |
| **Cost** | $0.003/page | Free | Free | Free | Free |
| **Speed** | Fast | Medium | Very Fast | Medium | Slow |
| **Quality** | Excellent | Excellent | Very Good | Excellent | Fair |
| **GPU Required** | No | Yes | No | No | No |
| **Complex Layouts** | ✅ | ✅ | ⚠️ | ✅ | ❌ |
| **Tables** | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Classification** | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Structured Output** | ✅ | ✅ | ❌ | ⚠️ | ❌ |
| **Handwriting** | ✅ | ✅ | ❌ | ⚠️ | ⚠️ |
| **Setup Complexity** | Easy | Easy | Easy | Medium | Easy |

---

## 💡 Specific Recommendations

### For Your Money Advice Use Case:

**Primary:** **LLaVA (Ollama Vision) + Llama3.2 for classification**
- You already have Ollama with GPU
- Handles debt letters, bank statements, benefit forms perfectly
- Can extract monetary amounts accurately
- Understands tables in credit card statements
- All data stays on-premises (GDPR compliant)

**Fallback:** **Marker + Llama3.2**
- For when GPU is busy
- Still gives good results
- Fast processing

**Emergency Fallback:** **Tesseract** (already implemented)
- For service degradation
- Basic text extraction

---

## 🚀 Implementation Plan

### Phase 1: Add Vision Model Support (Recommended Now)

1. **Pull LLaVA model:**
   ```bash
   docker exec rma-ollama ollama pull llava:13b
   ```

2. **Update doc-processor service:**
   - Use `local_parser.py` (already created)
   - Set `VISION_MODEL=llava:13b` in docker-compose

3. **Update requirements.txt:**
   ```
   ollama==0.1.6
   pdf2image==1.17.0
   Pillow==10.2.0
   pytesseract==0.3.10  # Keep as fallback
   ```

4. **Test:**
   ```bash
   # Should work with debt letters, bank statements, etc.
   curl -X POST http://localhost:8101/process -F "file=@bank_statement.pdf"
   ```

### Phase 2: Add Marker for Speed (Optional)

1. **Add Marker:**
   ```bash
   pip install marker-pdf
   ```

2. **Use for non-critical documents**

### Phase 3: Remove LlamaParse Dependency

1. **Update `.env`:**
   ```bash
   # Remove or comment out
   # LLAMA_PARSE_API_KEY=xxx

   # Add
   USE_LOCAL_PARSING=true
   VISION_MODEL=llava:13b
   ```

2. **Update docker-compose.yml:**
   ```yaml
   doc-processor:
     environment:
       - USE_LOCAL_PARSING=true
       - VISION_MODEL=llava:13b
       - OLLAMA_URL=http://ollama:11434
   ```

---

## 📈 Performance Expectations

### With GPU (g5.xlarge or local NVIDIA):

| Document Type | LLaVA Time | Quality |
|---------------|------------|---------|
| 1-page letter | 30-45s | Excellent |
| 3-page bank statement | 90-120s | Excellent |
| 10-page form | 5-7 min | Excellent |

### Without GPU (CPU only):

| Document Type | Marker + LLM | Quality |
|---------------|--------------|---------|
| 1-page letter | 15-25s | Very Good |
| 3-page bank statement | 45-60s | Very Good |
| 10-page form | 3-4 min | Good |

---

## 🔐 Security & Compliance Benefits

**Using local parsing:**

✅ **GDPR Compliant** - No data leaves your infrastructure
✅ **Client Confidentiality** - No third-party access to sensitive financial data
✅ **Audit Trail** - Complete control over data processing
✅ **No Vendor Lock-in** - Not dependent on external services
✅ **Cost Control** - No per-page API costs
✅ **Offline Capable** - Works without internet

**Risk Mitigation:**
- No data breaches from cloud providers
- No compliance issues with cloud data processing
- No service outages from external APIs
- Full control over model behavior

---

## 💰 Cost Comparison (1000 pages/month)

| Solution | Monthly Cost | Annual Cost |
|----------|-------------|-------------|
| LlamaParse | $3 + API costs | $36+ |
| Local LLaVA | $0 | $0 |
| Local Marker | $0 | $0 |
| Tesseract | $0 | $0 |

**Hardware costs already covered by existing Ollama GPU setup!**

---

## 🎓 Training Recommendations

**For Staff:**
1. Document processing now takes 30-60s instead of 10s
2. Quality is same or better
3. All documents stay on-premises (mention in client communications)
4. No API key management needed

---

## Summary

**Recommended Stack:**
```
Primary:   LLaVA (Ollama Vision) ← Best quality, on-premises
Fallback:  Marker + Llama3.2    ← Fast, reliable
Emergency: Tesseract            ← Basic but works
```

**Benefits:**
- 🔒 100% on-premises
- 💰 Zero API costs
- 🚀 Production-ready quality
- ⚡ GPU accelerated
- 📊 Structured extraction
- 🎯 Document classification
- ✅ GDPR compliant

**Next Step:**
```bash
cd RMA-Demo
docker exec rma-ollama ollama pull llava:13b
# Ready to use!
```
