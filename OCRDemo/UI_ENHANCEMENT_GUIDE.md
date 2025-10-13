# OCRDemo UI Enhancement Guide

## Overview

This document describes the major UI enhancements to the OCRDemo system, focusing on three key areas:

1. **Pre-Processing Document View** - See documents from emails before LlamaParse processing
2. **Enhanced Post-Processing View** - Display new filenames, summaries, and raw JSON structure
3. **Error Reporting System** - Allow users to report and correct erroneous detections for model refinement

## Features Implemented

### 1. Pre-Processing Document View

#### New "Pending Documents" Section
Located at the top of the dashboard, displays all documents awaiting LlamaParse processing.

**Features:**
- Shows unprocessed documents from recent emails
- Displays document status (Pending, Error, or Processed but not parsed)
- Shows processing timestamp
- "Process Now" button for immediate LlamaParse processing
- Badge showing count of pending documents
- Auto-refreshes with dashboard updates

**API Endpoint:**
```
GET /api/documents/unprocessed
```

**Response:**
```json
{
  "status": "success",
  "count": 5,
  "documents": [
    {
      "email_id": "email123",
      "original_filename": "statement.pdf",
      "status": "Processed",
      "processing_timestamp": "2023-10-13T15:30:00",
      "error_message": null
    }
  ]
}
```

### 2. Enhanced Post-Processing View

#### Detailed Document Information
Each processed document now shows comprehensive information:

**Document Card Enhancements:**
- **Original Filename**: Shows the email attachment name
- **Processed Filename**: Shows the AI-generated intelligent filename
- **Status Badge**: Visual indicator of processing state
- **Summary Preview**: First 200 characters of extracted summary
- **JSON Preview**: Quick view of key extracted fields
- **LlamaParse Status**: Badge indicating if LlamaParse has been run
- **Debt Information**: Count and total amount of debts
- **Extraction Method**: Shows whether data came from LlamaParse or OCR fallback

**New API Endpoints:**

```
GET /api/documents/detailed_list
```
Returns enriched document data with summaries and JSON previews.

**Response:**
```json
{
  "status": "success",
  "count": 20,
  "documents": [
    {
      "email_id": "email123",
      "original_filename": "statement.pdf",
      "processed_filename": "JohnSmith_AccountStatement_2023-10-01.pdf",
      "client_name": "John Smith",
      "case_number": "CMA789012",
      "processing_timestamp": "2023-10-13T15:30:45",
      "status": "Uploaded",
      "summary": "Account statement showing outstanding balance...",
      "has_llamaparse_data": true,
      "debts_count": 3,
      "total_debt_amount": 5432.10,
      "json_preview": {
        "client_name": "John Smith",
        "document_date": "2023-10-01",
        "document_type": "statement",
        "extraction_method": "llamaparse"
      }
    }
  ]
}
```

#### Enhanced Modal View
The document detail modal now includes:

1. **View JSON Button** - Opens modal with:
   - Formatted JSON display
   - Key fields summary table
   - Copy to clipboard function
   - Download as JSON file
   - Extraction method badge

2. **View Markdown Button** - Shows:
   - Markdown representation from LlamaParse
   - Copy to clipboard function
   - Fallback to OCR text if markdown not available

3. **Process with LlamaParse Button**:
   - Triggers LlamaParse processing on-demand
   - Shows loading state
   - Updates document data on completion

4. **Report Errors Button** ⭐:
   - Opens comprehensive correction interface
   - Allows field-by-field corrections
   - Submits feedback for model training

### 3. Error Reporting & Correction System

#### Correction Tracking Database

**New Component:** `src/correction_tracker.py`

A comprehensive system for tracking user corrections with three SQLite tables:

1. **corrections** - Field-level corrections
2. **extraction_corrections** - Full extraction corrections
3. **correction_analytics** - Statistical analysis

**Database Schema:**

```sql
-- Field-level corrections
CREATE TABLE corrections (
    id INTEGER PRIMARY KEY,
    document_id TEXT NOT NULL,
    email_id TEXT NOT NULL,
    original_filename TEXT NOT NULL,
    correction_timestamp TEXT NOT NULL,
    user_id TEXT,
    correction_type TEXT NOT NULL,
    field_name TEXT NOT NULL,
    original_value TEXT,
    corrected_value TEXT,
    confidence_score REAL,
    extraction_method TEXT,
    notes TEXT,
    status TEXT DEFAULT 'pending'
);

-- Full extraction corrections
CREATE TABLE extraction_corrections (
    id INTEGER PRIMARY KEY,
    document_id TEXT NOT NULL,
    email_id TEXT NOT NULL,
    original_filename TEXT NOT NULL,
    correction_timestamp TEXT NOT NULL,
    user_id TEXT,
    original_json TEXT,
    corrected_json TEXT,
    extraction_method TEXT,
    notes TEXT,
    status TEXT DEFAULT 'pending',
    review_status TEXT DEFAULT 'unreviewed'
);

-- Analytics
CREATE TABLE correction_analytics (
    id INTEGER PRIMARY KEY,
    field_name TEXT NOT NULL,
    total_corrections INTEGER DEFAULT 0,
    avg_confidence REAL,
    last_correction_date TEXT,
    extraction_method TEXT
);
```

#### Correction Interface

**"Report Errors" Button** on each document opens a comprehensive form:

**Editable Fields:**
- Client Name
- Document Date
- Document Type (dropdown)
- Creditor Name
- Phone Numbers (comma-separated)
- Email Addresses (comma-separated)
- Total Financial Amount
- Currency
- Reference Numbers (JSON format)
- Summary
- Additional Notes
- User ID (optional)

**Features:**
- Shows original values below each field
- Displays extraction method badge
- Pre-populated with current extracted data
- JSON validation for reference numbers
- User-friendly error messages

**API Endpoints:**

```
POST /api/corrections/submit
```

**Request Body:**
```json
{
  "document_id": "email123",
  "email_id": "email123",
  "correction_type": "extraction",
  "original_json": { /* original extracted data */ },
  "corrected_json": { /* user's corrections */ },
  "extraction_method": "llamaparse",
  "user_id": "john.advisor",
  "notes": "Client name was misspelled"
}
```

**Response:**
```json
{
  "status": "success",
  "correction_id": 42,
  "message": "Extraction correction submitted successfully"
}
```

```
GET /api/corrections/<document_id>
```
Retrieves all corrections for a specific document.

```
GET /api/corrections/statistics
```
Returns correction analytics and statistics.

**Response:**
```json
{
  "status": "success",
  "statistics": {
    "total_field_corrections": 150,
    "total_extraction_corrections": 45,
    "status_counts": {
      "pending": 30,
      "applied": 15
    },
    "most_corrected_fields": [
      {"field": "client_name", "count": 25},
      {"field": "document_date", "count": 18}
    ]
  },
  "field_analytics": [ /* detailed analytics */ ]
}
```

## User Workflow

### Workflow 1: Processing New Documents

1. User receives email with document attachment
2. Document appears in **"Pending Documents"** section
3. User clicks **"Process Now"** button
4. LlamaParse processes document → markdown + JSON
5. Document moves to **"Processed Documents"** section
6. User can view:
   - Original document
   - Processed filename
   - Summary
   - Raw JSON structure

### Workflow 2: Reviewing and Correcting Extractions

1. User views processed document
2. Notices extraction errors (e.g., wrong client name)
3. Clicks **"Report Errors"** button
4. Correction modal opens with all extracted fields
5. User corrects erroneous fields:
   - Sees original value below each field
   - Edits incorrect values
   - Adds notes explaining corrections
6. Clicks **"Submit Corrections"**
7. Corrections saved to database for model training
8. Success message confirms submission

### Workflow 3: Viewing Document Details

1. User clicks **"View & Analyze"** on any document
2. Document modal opens with tabs:
   - **PDF Viewer**: Shows document (processed or original)
   - **Extracted Data**: Shows debts, metadata, AI analysis
   - **OCR Text**: Shows raw extracted text
3. User can:
   - Toggle between processed and original document
   - Click **"View JSON"** to see structured data
   - Click **"View Markdown"** to see markdown format
   - Click **"Process with LlamaParse"** if not yet processed
   - Click **"Report Errors"** to submit corrections
   - Download document with RMA filename

## Benefits

### For Users

1. **Transparency**: See documents before and after processing
2. **Control**: Process documents on-demand
3. **Quality Assurance**: Review and correct extraction errors
4. **Efficiency**: Quick access to structured data
5. **Accountability**: Track what's been processed and what's pending

### For System

1. **Model Improvement**: Corrections fed back for training
2. **Quality Metrics**: Track which fields need improvement
3. **User Feedback**: Understand common extraction errors
4. **Training Data**: Build dataset of corrected examples
5. **Analytics**: Identify patterns in extraction accuracy

## Technical Details

### Frontend Components

**New JavaScript Functions:**
- `loadUnprocessedDocuments()` - Loads pending documents
- `displayUnprocessedDocuments()` - Renders pending section
- `reportErrors(emailId)` - Opens correction modal
- `showCorrectionModal()` - Creates correction form
- `submitCorrections()` - Submits user corrections
- `viewDocumentJSON()` - Shows JSON modal
- `viewDocumentMarkdown()` - Shows markdown modal

### Backend Components

**New Python Modules:**
- `correction_tracker.py` - Manages correction database
  - `save_field_correction()` - Save single field correction
  - `save_extraction_correction()` - Save full extraction correction
  - `get_corrections_for_document()` - Retrieve corrections
  - `get_field_analytics()` - Get correction statistics
  - `get_corrections_for_training()` - Export for model training

**Integration Points:**
- `main.py` - New API endpoints and correction tracker initialization
- `dashboard.html` - New UI sections and buttons
- `dashboard.js` - New client-side functions

### Data Flow

```
Email Received
    ↓
Appears in "Pending Documents"
    ↓
User Clicks "Process Now"
    ↓
LlamaParse Processing (PDF → Markdown → JSON)
    ↓
Stored with Document Object
    ↓
Appears in "Processed Documents" with Summary & JSON Preview
    ↓
User Reviews
    ↓
[If Errors Found]
    ↓
User Clicks "Report Errors"
    ↓
Correction Form Opens
    ↓
User Edits Fields
    ↓
Submit Corrections
    ↓
Saved to correction_tracker Database
    ↓
Available for Model Training
```

## Configuration

### Environment Variables

Add to `.env`:
```bash
# Correction tracking
CORRECTION_DB_PATH=/app/data/corrections.db

# LlamaParse settings
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2
```

### Database Location

Corrections database created at:
```
/app/data/corrections.db
```

Ensure the `/app/data/` directory exists and is writable.

## Future Enhancements

### Planned Features

1. **Batch Processing**
   - Process multiple pending documents at once
   - Progress indicator for bulk operations

2. **Correction Review Dashboard**
   - Admin interface to review submitted corrections
   - Approve/reject corrections before applying to training

3. **Model Retraining Integration**
   - Automated export of corrections to training format
   - Integration with fine-tuning pipeline
   - A/B testing of model versions

4. **Enhanced Analytics**
   - Per-user correction accuracy tracking
   - Field-level confidence scoring
   - Extraction quality trends over time

5. **Smart Suggestions**
   - Auto-suggest corrections based on patterns
   - Highlight low-confidence extractions
   - Pre-fill corrections using historical data

6. **Export Functions**
   - Export corrections as CSV for analysis
   - Generate training datasets
   - Download correction reports

## Testing Checklist

- [ ] Pending documents section loads correctly
- [ ] Process Now button triggers LlamaParse
- [ ] Document cards show summaries and JSON previews
- [ ] View JSON modal displays formatted data
- [ ] View Markdown modal shows markdown content
- [ ] Report Errors button opens correction form
- [ ] Correction form pre-populates with extracted data
- [ ] Submit Corrections saves to database
- [ ] Correction statistics API returns data
- [ ] Original values shown below correction fields
- [ ] User ID and notes are optional
- [ ] JSON reference numbers validate correctly

## API Reference Summary

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/documents/unprocessed` | GET | Get pending documents |
| `/api/documents/detailed_list` | GET | Get all documents with summaries |
| `/api/document/<email_id>/json` | GET | Get extracted JSON data |
| `/api/document/<email_id>/markdown` | GET | Get markdown representation |
| `/api/document/<email_id>/llamaparse` | POST | Process with LlamaParse |
| `/api/corrections/submit` | POST | Submit user corrections |
| `/api/corrections/<document_id>` | GET | Get corrections for document |
| `/api/corrections/statistics` | GET | Get correction statistics |

## Support

For issues or questions:
1. Check logs at `/app/logs/ocr_demo.log`
2. Verify database exists at `/app/data/corrections.db`
3. Check browser console for JavaScript errors
4. Review API responses in Network tab

## Conclusion

These enhancements provide users with complete visibility into the document processing pipeline, from receipt through extraction to correction. The error reporting system creates a feedback loop that continuously improves model accuracy while giving users confidence in the extracted data.
