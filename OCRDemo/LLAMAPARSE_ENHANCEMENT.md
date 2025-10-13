# LlamaParse Enhancement for OCRDemo

## Overview

This enhancement adds a new document processing method using LlamaParse with a local Llama model. Instead of relying solely on OCR systems with LLM summary, this method converts PDFs directly into markdown format and then extracts structured JSON data.

## Key Features

### 1. LlamaParse Processor (`src/llamaparse_processor.py`)

A new processor that:
- Uses local Llama vision models to extract text from documents
- Converts document content to well-formatted markdown
- Extracts structured JSON data with comprehensive fields
- Supports both PDF and image files

### 2. Structured JSON Output

The extracted JSON includes:
- **document_uri**: Path to the original document
- **document_date**: Date of the document (YYYY-MM-DD format)
- **client_name**: Full name of the client/recipient
- **reference_numbers**: Nested dictionary containing:
  - account_number
  - case_number
  - invoice_number
  - other_references (array)
- **contact_info**:
  - phone_numbers (array)
  - email_addresses (array)
- **financial_values**:
  - total_amount
  - currency (e.g., GBP)
  - breakdown (array of items with description and amount)
- **creditor_name**: Name of creditor/sender
- **document_type**: Type of document (statement, demand, notice, etc.)
- **summary**: Brief summary of document's purpose and key points
- **extraction_timestamp**: When the data was extracted
- **extraction_method**: Method used (llamaparse or ocr_fallback)

### 3. New API Endpoints

Added to `src/main.py`:

#### `/api/llamaparse/test` (GET)
Tests if the LlamaParse service and Llama model are available.

#### `/api/document/<email_id>/llamaparse` (POST)
Processes a document using LlamaParse to extract markdown and JSON.

#### `/api/document/<email_id>/json` (GET)
Retrieves the extracted JSON data for a document. Falls back to OCR data if LlamaParse hasn't been run.

#### `/api/document/<email_id>/markdown` (GET)
Retrieves the markdown representation of a document.

### 4. Enhanced Dashboard Interface

Added to `static/js/dashboard.js` and `templates/dashboard.html`:

#### New Functions:
- `processWithLlamaParse(emailId)`: Triggers LlamaParse processing for a document
- `viewOriginalDocument(emailId, filename)`: Opens original document in new tab
- `viewDocumentJSON(emailId)`: Displays extracted JSON data in a modal with:
  - Formatted JSON view
  - Copy to clipboard functionality
  - Download as JSON file
  - Key fields summary table
- `viewDocumentMarkdown(emailId)`: Displays markdown representation in a modal
- `copyJSONToClipboard()`: Copies JSON to clipboard
- `downloadJSON()`: Downloads JSON as a file
- `copyMarkdownToClipboard()`: Copies markdown to clipboard

#### New UI Buttons:
In the document modal footer:
- **View JSON**: Opens JSON viewer modal
- **View Markdown**: Opens markdown viewer modal
- **Process with LlamaParse**: Triggers LlamaParse processing
- **Download Original (RMA)**: Downloads original document
- **Download Processed (RMA)**: Downloads processed document

## Usage

### 1. Processing a Document with LlamaParse

1. Open a document in the dashboard
2. Click "Process with LlamaParse" button in the modal footer
3. Wait for processing to complete
4. The markdown and JSON data will be stored with the document

### 2. Viewing Extracted JSON

1. Click "View JSON" button in the document modal
2. The JSON modal will display:
   - Full formatted JSON
   - Key fields summary table
   - Copy and download options

### 3. Viewing Document Markdown

1. Click "View Markdown" button
2. The markdown modal shows the formatted markdown representation

### 4. Viewing Original Document

1. The original document can be viewed by clicking "Download Original (RMA)"
2. Or use the radio buttons in the PDF viewer tab to switch between processed and original

## Technical Details

### Dependencies

All required dependencies are already in `requirements.txt`:
- `ollama==0.3.1` - For Llama model integration
- `pdf2image==1.16.3` - For PDF to image conversion
- `python-magic==0.4.27` - For file type detection

### Environment Variables

Configure in `.env`:
- `OLLAMA_URL`: URL of Ollama service (default: http://localhost:11434)
- `OLLAMA_MODEL`: Llama model to use (default: llama3.2)

### How It Works

1. **PDF Processing**:
   - Converts PDF pages to images (first 5 pages)
   - Uses Llama vision model to extract text from each image
   - Converts extracted text to markdown format
   - Combines all pages into a single markdown document

2. **Structured Data Extraction**:
   - Sends markdown to Llama model with specific extraction prompt
   - Model analyzes content and returns JSON with structured fields
   - Parses JSON response (handles various formats including code blocks)
   - Falls back to basic structure if JSON parsing fails

3. **Fallback Mechanism**:
   - If LlamaParse processing hasn't been performed, API endpoints fall back to OCR data
   - Constructs JSON from existing OCR-extracted information
   - Ensures functionality even without LlamaParse processing

## Benefits Over OCR-Only Approach

1. **Better Structure Preservation**: Markdown maintains document structure better than raw OCR text
2. **Comprehensive Extraction**: Single pass extracts all required fields in structured format
3. **Easier Summarization**: Markdown format is more suitable for LLM summarization
4. **Flexible Output**: Both markdown (for human reading) and JSON (for machine processing)
5. **Contact Information**: Automatically extracts phone numbers and email addresses
6. **Reference Numbers**: Captures multiple reference types in organized structure
7. **Financial Analysis**: Detailed breakdown of financial values with currency

## Example JSON Output

```json
{
  "document_uri": "/app/processed_docs/original_20231013_123456_statement.pdf",
  "document_date": "2023-10-01",
  "client_name": "John Smith",
  "reference_numbers": {
    "account_number": "ACC123456",
    "case_number": "CMA789012",
    "invoice_number": null,
    "other_references": ["REF-2023-001"]
  },
  "contact_info": {
    "phone_numbers": ["+44 20 1234 5678"],
    "email_addresses": ["john.smith@example.com"]
  },
  "financial_values": {
    "total_amount": "5432.10",
    "currency": "GBP",
    "breakdown": [
      {"description": "Outstanding balance", "amount": "5000.00"},
      {"description": "Late fee", "amount": "432.10"}
    ]
  },
  "creditor_name": "Example Bank Ltd",
  "document_type": "statement",
  "summary": "Account statement showing outstanding balance with late fees",
  "extraction_timestamp": "2023-10-13T15:30:45",
  "extraction_method": "llamaparse"
}
```

## Future Enhancements

Potential improvements:
1. Batch processing of multiple documents
2. Comparison view between OCR and LlamaParse results
3. Editing interface for JSON data
4. Export to other formats (CSV, Excel)
5. Integration with case management system
6. Automated quality scoring of extractions
7. Machine learning model training from corrected data
