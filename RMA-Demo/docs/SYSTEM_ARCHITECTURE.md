# RMA System Architecture

## System Overview

The RMA (Return Merchandise Authorization) Document Management System is a microservices-based architecture designed to handle document processing, AI-powered analysis, and client-specific document management with intelligent search capabilities.

## High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT LAYER                                    │
│                                                                              │
│  ┌──────────────┐         ┌──────────────┐         ┌──────────────┐       │
│  │   Web App    │         │ Client QR    │         │  Admin UI    │       │
│  │  (React)     │         │ Upload Page  │         │  (React)     │       │
│  │  Port 3000   │         │  (React)     │         │  Port 3000   │       │
│  └──────┬───────┘         └──────┬───────┘         └──────┬───────┘       │
│         │                        │                         │                │
└─────────┼────────────────────────┼─────────────────────────┼───────────────┘
          │                        │                         │
          │                        │                         │
          ▼                        ▼                         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           API GATEWAY / NGINX                                │
│                              Port 80/443                                     │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  Routes:                                                             │   │
│  │  /api/*           → Backend Server (8000)                           │   │
│  │  /uploads/*       → Upload Service (8103)                           │   │
│  │  /*               → Frontend Static Files                            │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
          │                        │                         │
          ▼                        ▼                         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          APPLICATION SERVICES                                │
│                                                                              │
│  ┌──────────────────────┐       ┌──────────────────────┐                   │
│  │  Backend Server      │       │  Upload Service      │                   │
│  │  (Node.js/Express)   │       │  (Python/FastAPI)    │                   │
│  │  Port 8000          │       │  Port 8103           │                   │
│  │                      │       │                      │                   │
│  │  • Authentication    │       │  • QR Code Gen       │                   │
│  │  • Client CRUD       │◄──────┤  • File Upload       │                   │
│  │  • Case Management   │       │  • Multi-Doc Split   │                   │
│  │  • User Management   │       │  • Smart Naming      │                   │
│  │  • API Orchestration │       │  • Metadata Mgmt     │                   │
│  └──────┬───────────────┘       └──────┬───────────────┘                   │
│         │                              │                                    │
│         │                              │                                    │
└─────────┼──────────────────────────────┼────────────────────────────────────┘
          │                              │
          │                              ▼
          │                   ┌──────────────────────┐
          │                   │  Doc Processor       │
          │                   │  (Python/FastAPI)    │
          │                   │  Port 8101           │
          │                   │                      │
          │                   │  • PDF Text Extract  │
          │                   │  • OCR Processing    │
          │                   │  • Vision Analysis   │
          │                   │  • Markdown Convert  │
          │                   └──────┬───────────────┘
          │                          │
          │                          │ Text
          ▼                          ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          AI/RAG SERVICES                                     │
│                                                                              │
│  ┌──────────────────────┐       ┌──────────────────────┐                   │
│  │  Client RAG Service  │       │  Notes RAG Service   │                   │
│  │  (Python/FastAPI)    │       │  (Python/FastAPI)    │                   │
│  │  Port 8104           │       │  Port 8100           │                   │
│  │                      │       │                      │                   │
│  │  • Client Doc Search │       │  • Case Notes Search │                   │
│  │  • Doc Ingestion     │       │  • Note Embeddings   │                   │
│  │  • Vector Store Mgmt │       │  • Note Retrieval    │                   │
│  │  • Query Processing  │       │  • Context Building  │                   │
│  └──────┬───────────────┘       └──────┬───────────────┘                   │
│         │                              │                                    │
│         │                              │                                    │
└─────────┼──────────────────────────────┼────────────────────────────────────┘
          │                              │
          │                              │
          ▼                              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           INFRASTRUCTURE SERVICES                            │
│                                                                              │
│  ┌──────────────────────┐   ┌──────────────────────┐   ┌────────────────┐ │
│  │  ChromaDB            │   │  Ollama              │   │  PostgreSQL    │ │
│  │  (Vector Store)      │   │  (LLM Service)       │   │  (Database)    │ │
│  │  Port 8005           │   │  Port 11434          │   │  Port 5432     │ │
│  │                      │   │                      │   │                │ │
│  │  • Vector Embeddings │   │  • llama3.2 (3B)     │   │  • Clients     │ │
│  │  • Similarity Search │   │  • llava:7b (Vision) │   │  • Cases       │ │
│  │  • Client Collections│   │  • nomic-embed-text  │   │  • Users       │ │
│  │  • Persistent Store  │   │  • GPU Acceleration  │   │  • Metadata    │ │
│  └──────────────────────┘   └──────────────────────┘   └────────────────┘ │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
          │                              │                         │
          ▼                              ▼                         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            PERSISTENT STORAGE                                │
│                                                                              │
│  ┌──────────────────┐   ┌──────────────────┐   ┌──────────────────┐       │
│  │  uploads/        │   │  chroma_data/    │   │  postgres_data/  │       │
│  │  Client Docs     │   │  Vector Store    │   │  Relational DB   │       │
│  └──────────────────┘   └──────────────────┘   └──────────────────┘       │
│                                                                              │
│  ┌──────────────────┐                                                       │
│  │  ollama_data/    │                                                       │
│  │  LLM Models      │                                                       │
│  └──────────────────┘                                                       │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Service Interconnection Details

### 1. Upload Service → Doc Processor → Client RAG Service

**Document Upload Flow:**

```
┌─────────┐  1. Upload PDF   ┌──────────────┐
│ Client  │─────────────────►│Upload Service│
│         │                  │ (Port 8103)  │
└─────────┘                  └──────┬───────┘
                                    │
                             2. Detect Multi-Doc
                                    │
                           ┌────────▼────────┐
                           │ Is Multi-Doc?   │
                           └────────┬────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    │ Yes                           │ No
                    ▼                               ▼
        ┌───────────────────┐           ┌──────────────────┐
        │ Split PDF into    │           │ Process as       │
        │ Separate Files    │           │ Single Document  │
        └─────────┬─────────┘           └────────┬─────────┘
                  │                              │
                  │ For Each Split              │
                  ▼                              ▼
        ┌──────────────────────────────────────────┐
        │ 3. Send to Doc Processor (8101)          │
        │    POST /process-document                │
        │    - Extract text with OCR/Vision        │
        │    - Convert to markdown                 │
        └──────────────────┬───────────────────────┘
                           │
                           │ 4. Processed Text
                           ▼
        ┌──────────────────────────────────────────┐
        │ 5. Analyze for Naming (Ollama)           │
        │    - Extract 2-word summary              │
        │    - Extract document date               │
        └──────────────────┬───────────────────────┘
                           │
                           │ 6. Intelligent Name
                           ▼
        ┌──────────────────────────────────────────┐
        │ 7. Rename File                           │
        │    {ClientID}_{Summary}_{Date}.pdf       │
        └──────────────────┬───────────────────────┘
                           │
                           │ 8. Index Document
                           ▼
        ┌──────────────────────────────────────────┐
        │ 9. Send to Client RAG Service (8104)     │
        │    POST /ingest                          │
        │    - Create embeddings                   │
        │    - Store in vector DB                  │
        └──────────────────────────────────────────┘
```

### 2. Client RAG Service → ChromaDB → Ollama

**Document Search Flow:**

```
┌─────────┐  1. Search Query   ┌──────────────────┐
│ User    │───────────────────►│ Client RAG       │
│         │  "Find tax docs"   │ Service (8104)   │
└─────────┘                    └────────┬─────────┘
                                        │
                          2. Generate Query Embedding
                                        │
                                        ▼
                               ┌────────────────┐
                               │ Ollama (11434) │
                               │ nomic-embed-   │
                               │ text model     │
                               └────────┬───────┘
                                        │
                                3. Embedding Vector
                                        │
                                        ▼
                        ┌───────────────────────────┐
                        │ ChromaDB (8005)           │
                        │ - Similarity search       │
                        │ - client_{ID} collection  │
                        │ - Return top K chunks     │
                        └────────────┬──────────────┘
                                     │
                              4. Relevant Chunks
                                     │
                                     ▼
                        ┌────────────────────────────┐
                        │ Build Context Prompt       │
                        │ - Chunk text               │
                        │ - Metadata                 │
                        │ - User question            │
                        └────────────┬───────────────┘
                                     │
                              5. Full Prompt
                                     │
                                     ▼
                        ┌────────────────────────────┐
                        │ Ollama (11434)             │
                        │ llama3.2 model             │
                        │ - Generate answer          │
                        │ - Cite sources             │
                        └────────────┬───────────────┘
                                     │
                              6. Answer + Sources
                                     │
                                     ▼
                        ┌────────────────────────────┐
                        │ Return to User             │
                        │ {                          │
                        │   answer: "...",           │
                        │   sources: [...]           │
                        │ }                          │
                        └────────────────────────────┘
```

### 3. Backend Server → PostgreSQL

**Data Management Flow:**

```
┌──────────┐  API Request    ┌────────────────┐
│ Frontend │────────────────►│ Backend Server │
│          │  GET /clients   │ (Port 8000)    │
└──────────┘                 └────────┬───────┘
                                      │
                               1. Query Data
                                      │
                                      ▼
                        ┌──────────────────────┐
                        │ PostgreSQL (5432)    │
                        │                      │
                        │ Tables:              │
                        │ • clients            │
                        │ • cases              │
                        │ • users              │
                        │ • case_notes         │
                        │ • income             │
                        │ • expenditure        │
                        │ • debts              │
                        └──────────┬───────────┘
                                   │
                            2. Query Results
                                   │
                                   ▼
                        ┌──────────────────────┐
                        │ Backend Server       │
                        │ - Transform data     │
                        │ - Apply business     │
                        │   logic              │
                        └──────────┬───────────┘
                                   │
                            3. JSON Response
                                   │
                                   ▼
                        ┌──────────────────────┐
                        │ Frontend             │
                        │ - Render UI          │
                        │ - Display data       │
                        └──────────────────────┘
```

## Service Responsibilities

### Frontend Services

#### 1. React Web Application (Port 3000)
**Purpose:** Main user interface for case workers and administrators

**Responsibilities:**
- Client management UI
- Case management and tracking
- Financial data entry and display
- Document viewing and search
- User authentication interface
- Dashboard and reporting

**Technologies:**
- React 18
- Material-UI components
- React Router for navigation
- Axios for API calls

**Key Features:**
- Responsive design
- Real-time updates
- Form validation
- File upload interface

---

### Application Services

#### 2. Backend Server (Port 8000)
**Purpose:** Main API server and business logic orchestrator

**Responsibilities:**
- User authentication (JWT tokens)
- Client CRUD operations
- Case management
- Financial data management
- Notes and timeline management
- Authorization and access control
- API endpoint orchestration

**Technologies:**
- Node.js + Express
- JWT authentication
- PostgreSQL client (pg)
- RESTful API design

**Key Endpoints:**
```
POST   /api/login
GET    /api/clients
POST   /api/clients
GET    /api/clients/:id
PUT    /api/clients/:id
GET    /api/clients/:id/cases
POST   /api/cases
GET    /api/cases/:id
POST   /api/cases/:id/notes
GET    /api/users
POST   /api/users
```

**Database Schema Management:**
- Manages all PostgreSQL tables
- Handles relationships and foreign keys
- Ensures data integrity

---

#### 3. Upload Service (Port 8103)
**Purpose:** Document upload, processing orchestration, and intelligent file management

**Responsibilities:**
- QR code generation for client uploads
- File upload handling (multi-part form data)
- **Multi-document PDF detection and splitting**
- Document processing coordination
- **Intelligent file naming using AI**
- Client-specific file organization
- Document metadata management
- RAG indexing coordination

**Technologies:**
- Python 3.11 + FastAPI
- PyPDF2 for PDF manipulation
- QRCode library
- JWT authentication
- httpx for async HTTP calls

**Key Features:**

**1. Multi-Document PDF Splitting:**
```python
# Detects multiple documents in single PDF
detect_document_boundaries(pdf_path)
  → Analyzes page content with LLM
  → Returns page ranges for each document

# Splits PDF into separate files
split_pdf_into_documents(pdf_path, boundaries)
  → Creates individual PDFs
  → One file per detected document
```

**2. Intelligent Naming:**
```python
# Analyzes document content
analyze_document_for_naming(text)
  → Uses LLM to extract summary (2 words)
  → Extracts document date
  → Returns: {summary, date}

# Creates smart filename
{CLIENT_ID}_{Summary}_{Date}.pdf
# Example: RMAXX01_Benefits_Letter_20231015.pdf
```

**3. Processing Workflow:**
```
Upload → Detect Multi-Doc → Split (if needed) →
Process Each → Analyze → Rename → Index to RAG
```

**API Endpoints:**
```
POST   /uploads/{client_id}      # Upload document
GET    /uploads/{client_id}      # List documents
POST   /generate-qr              # Generate QR code
POST   /query-client-documents   # Search documents
```

---

#### 4. Document Processor (Port 8101)
**Purpose:** Extract text from documents using OCR and vision models

**Responsibilities:**
- PDF text extraction
- Image OCR processing (Tesseract)
- Vision-based document analysis (llava:7b)
- Markdown conversion
- Table and structure detection
- Fallback processing strategies

**Technologies:**
- Python 3.11 + FastAPI
- Tesseract OCR
- Poppler utilities
- pdf2image conversion
- Ollama client (llava:7b vision model)

**Processing Strategies:**
1. **Direct text extraction** (fast, for text PDFs)
2. **OCR processing** (Tesseract for scanned docs)
3. **Vision model analysis** (llava:7b for complex layouts)

**Key Features:**
- Multi-strategy processing with fallbacks
- Vision-based understanding of document structure
- Handles various document types (letters, forms, statements)
- Returns structured markdown

**API Endpoints:**
```
POST   /process-document     # Process document to markdown
POST   /extract-text         # Extract raw text
GET    /health              # Health check
```

---

### AI/RAG Services

#### 5. Client RAG Service (Port 8104)
**Purpose:** Client-specific document search and retrieval using vector embeddings

**Responsibilities:**
- Document ingestion and chunking
- Vector embedding generation
- Client-specific collection management
- Semantic search across client documents
- Answer generation with source citations
- Document statistics and management

**Technologies:**
- Python 3.11 + FastAPI
- LangChain for RAG pipeline
- ChromaDB client
- Ollama client (llama3.2, nomic-embed-text)

**Vector Store Architecture:**
```
ChromaDB Collections:
  client_{CLIENT_ID}  → Separate collection per client
    ├─ Document chunks with embeddings
    ├─ Metadata (filename, date, type, chunk#)
    └─ Source attribution
```

**RAG Pipeline:**
```
1. Ingestion:
   Document Text → Split into chunks (1000 chars) →
   Generate embeddings (nomic-embed-text) →
   Store in ChromaDB

2. Query:
   User Question → Generate query embedding →
   Similarity search (top K chunks) →
   Build context prompt →
   Generate answer (llama3.2) →
   Return answer + sources
```

**Key Features:**
- Client data isolation (separate collections)
- Chunk-level source attribution
- Metadata-enhanced search
- Statistics tracking (document count, chunks)

**API Endpoints:**
```
POST   /ingest                # Add document to vector store
POST   /query                # Search documents
GET    /clients              # List all clients
GET    /stats/{client_id}    # Get client statistics
GET    /health               # Health check
```

---

#### 6. Notes RAG Service (Port 8100)
**Purpose:** Case notes search and retrieval

**Responsibilities:**
- Case note indexing
- Note-based semantic search
- Context-aware note retrieval
- Historical note management

**Technologies:**
- Python 3.11 + FastAPI
- ChromaDB for vector storage
- Ollama for embeddings and generation

**Use Cases:**
- "Find all notes about housing issues"
- "What did we discuss about benefits?"
- Historical case review

---

### Infrastructure Services

#### 7. ChromaDB (Port 8005)
**Purpose:** Vector database for semantic search

**Responsibilities:**
- Store document embeddings (vectors)
- Perform similarity search
- Manage collections (per-client, notes)
- Persist vector data

**Technologies:**
- ChromaDB 0.4.24
- Pinned version for compatibility
- HTTP API interface

**Storage Structure:**
```
chroma_data/
├─ client_RMAXX01/      # Client-specific collection
│  ├─ embeddings.bin    # Vector embeddings
│  └─ metadata.json     # Document metadata
├─ client_RMAXX02/
└─ notes/               # Case notes collection
```

**Key Features:**
- Fast similarity search (cosine similarity)
- Metadata filtering
- Persistent storage
- RESTful API

---

#### 8. Ollama (Port 11434)
**Purpose:** Local LLM service with GPU acceleration

**Responsibilities:**
- Text generation (llama3.2)
- Vision analysis (llava:7b)
- Text embeddings (nomic-embed-text)
- Model management

**Models Deployed:**

| Model | Size | Purpose | Use Cases |
|-------|------|---------|-----------|
| **llama3.2** | 2.0 GB | Text generation | • Answer generation<br>• Document naming<br>• Content analysis<br>• Boundary detection |
| **llava:7b** | 4.7 GB | Vision + Language | • OCR alternative<br>• Layout understanding<br>• Image analysis |
| **nomic-embed-text** | 274 MB | Text embeddings | • Vector generation<br>• Semantic search<br>• Similarity matching |

**GPU Configuration:**
- NVIDIA GPU acceleration
- CUDA support
- Models loaded in VRAM for speed
- Automatic model caching

**Health Check:**
```bash
ollama list  # Verify models loaded
```

**Persistent Storage:**
```
ollama_data/
└─ models/
   ├─ llama3.2/
   ├─ llava:7b/
   └─ nomic-embed-text/
```

---

#### 9. PostgreSQL (Port 5432)
**Purpose:** Primary relational database

**Responsibilities:**
- Store structured data
- Maintain data relationships
- Ensure data integrity
- Transaction management

**Database Schema:**

**Core Tables:**
```sql
clients               -- Client information
├─ id (PK)
├─ name, dob, email
├─ address details
└─ timestamps

cases                 -- Case tracking
├─ id (PK)
├─ client_id (FK)
├─ status, priority
├─ assigned caseworker
└─ timestamps

case_notes           -- Case activity log
├─ id (PK)
├─ case_id (FK)
├─ user_id (FK)
├─ note_content
└─ timestamp

users                -- Staff accounts
├─ id (PK)
├─ username
├─ password_hash
└─ role

income               -- Income tracking
├─ id (PK)
├─ client_id (FK)
├─ source, amount
└─ frequency

expenditure          -- Expenses
├─ id (PK)
├─ client_id (FK)
├─ category, amount
└─ frequency

debts                -- Debt tracking
├─ id (PK)
├─ client_id (FK)
├─ creditor, amount
└─ status
```

**Relationships:**
- Clients → Cases (1:many)
- Cases → Notes (1:many)
- Clients → Financial Data (1:many)
- Users → Cases (many:many via assignments)

---

## Data Flow Patterns

### Pattern 1: Document Upload and Search

```
┌──────────┐
│  Client  │
│  Uploads │
│   PDF    │
└─────┬────┘
      │
      ▼
┌─────────────┐  1. Save File
│   Upload    │─────────────────┐
│  Service    │                 │
│  (8103)     │                 ▼
└──────┬──────┘         ┌───────────────┐
       │                │  File System  │
       │                │  /uploads/    │
       │                └───────────────┘
       │ 2. Multi-Doc Check
       ▼
┌─────────────┐
│   Ollama    │
│  (11434)    │
│  llama3.2   │
└──────┬──────┘
       │ Boundary Info
       ▼
┌─────────────┐  3. Split PDF
│   Upload    │     (if multiple)
│  Service    │
└──────┬──────┘
       │ 4. Send to Process
       ▼
┌─────────────┐
│    Doc      │  5. Extract Text
│  Processor  │     (OCR/Vision)
│  (8101)     │
└──────┬──────┘
       │ Text
       ▼
┌─────────────┐
│   Upload    │  6. Analyze for
│  Service    │     Smart Name
└──────┬──────┘
       │ 7. Index
       ▼
┌─────────────┐
│ Client RAG  │  8. Embed & Store
│  (8104)     │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  ChromaDB   │  Vector Storage
│  (8005)     │
└─────────────┘

Later...

┌──────────┐
│   User   │  9. Search Query
│  Searches│
└─────┬────┘
      │
      ▼
┌─────────────┐
│ Client RAG  │  10. Generate
│  (8104)     │      Query Embedding
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  ChromaDB   │  11. Similarity Search
│  (8005)     │      Return Chunks
└──────┬──────┘
       │ Relevant Chunks
       ▼
┌─────────────┐
│   Ollama    │  12. Generate Answer
│  llama3.2   │      with Context
└──────┬──────┘
       │ Answer + Sources
       ▼
┌──────────┐
│   User   │  13. Display Results
└──────────┘
```

### Pattern 2: Case Management

```
┌──────────┐
│   User   │  1. Create Case
└─────┬────┘
      │
      ▼
┌─────────────┐
│  Frontend   │  2. POST /api/cases
│  (3000)     │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Backend    │  3. Validate + Auth
│  Server     │
│  (8000)     │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ PostgreSQL  │  4. INSERT case
│  (5432)     │     Return case_id
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Backend    │  5. Return JSON
│  Server     │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Frontend   │  6. Update UI
│             │     Show new case
└─────────────┘
```

### Pattern 3: Document Triage

```
┌──────────┐
│  Client  │  1. Upload Document
│          │     via QR Code
└─────┬────┘
      │
      ▼
┌─────────────┐
│   Upload    │  2. Process & Index
│  Service    │
│  (8103)     │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│    Doc      │  3. Extract Content
│  Processor  │
│  (8101)     │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   Ollama    │  4. Analyze:
│  (11434)    │     - Document type
│  llama3.2   │     - Concern level
└──────┬──────┘     - Reassurance msg
       │
       ▼
┌─────────────┐
│   Upload    │  5. Return Triage
│  Service    │     Info to Client
└──────┬──────┘
       │
       ▼
┌──────────┐
│  Client  │  6. Show:
│          │     - Type: "Benefits Letter"
│          │     - Concern: "Low"
│          │     - Msg: "This is good news..."
└──────────┘
```

## Security Architecture

### Authentication Flow

```
┌──────────┐
│   User   │  1. Login Request
│          │     {username, password}
└─────┬────┘
      │
      ▼
┌─────────────┐
│  Backend    │  2. Verify Credentials
│  Server     │     Hash password
│  (8000)     │     Check database
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ PostgreSQL  │  3. Lookup User
│  (5432)     │     Compare hash
└──────┬──────┘
       │ Valid
       ▼
┌─────────────┐
│  Backend    │  4. Generate JWT
│  Server     │     {user_id, role, exp}
└──────┬──────┘
       │
       ▼
┌──────────┐
│   User   │  5. Store Token
│          │     Use in headers
└──────────┘
```

### Authorization Layers

1. **Frontend:** Role-based UI rendering
2. **Backend:** Token verification on all protected routes
3. **Services:** Internal service-to-service trust (no auth between microservices)
4. **Upload Service:** Public upload endpoint (QR code access), protected admin endpoints

## Deployment Configuration

### Docker Compose Services

```yaml
services:
  # Frontend
  frontend:           Port 3000

  # Application Services
  backend:            Port 8000
  upload-service:     Port 8103
  doc-processor:      Port 8101

  # AI/RAG Services
  client-rag-service: Port 8104
  notes-service:      Port 8100

  # Infrastructure
  postgres:           Port 5432
  chromadb:           Port 8005
  ollama:             Port 11434 (GPU)

  # Proxy
  nginx:              Port 80, 443
```

### Volume Mounts

```yaml
volumes:
  postgres_data:      # Database persistence
  chroma_data:        # Vector store persistence
  ollama_data:        # LLM models persistence
  uploads:            # Client documents storage
```

### Network Configuration

```
Docker Network: rma-network
  - All services communicate internally
  - No external access except nginx
  - Service discovery by service name
```

## Health Monitoring

### Health Check Endpoints

```bash
# Application Health
curl http://localhost:8000/health      # Backend
curl http://localhost:8103/health      # Upload Service
curl http://localhost:8101/health      # Doc Processor
curl http://localhost:8104/health      # Client RAG

# Infrastructure Health
curl http://localhost:8005/api/v1/heartbeat  # ChromaDB
docker exec rma-ollama ollama list           # Ollama models
docker exec rma-postgres pg_isready          # PostgreSQL
```

### Service Dependencies

```
Frontend → Backend → PostgreSQL
              ↓
         Upload Service → Doc Processor → Ollama (llava:7b)
              ↓
         Client RAG → ChromaDB → Ollama (nomic-embed-text, llama3.2)
```

## Performance Characteristics

### Expected Response Times

| Operation | Service | Time | Notes |
|-----------|---------|------|-------|
| Login | Backend | <100ms | Database lookup + JWT |
| List Clients | Backend | <200ms | Simple query |
| Upload File | Upload Service | <2s | File I/O only |
| Process PDF (single) | Doc Processor | 5-15s | OCR/Vision dependent |
| Multi-doc Split | Upload Service | 10-30s | LLM analysis |
| RAG Ingestion | Client RAG | 3-10s | Embedding generation |
| Document Search | Client RAG | 2-5s | Vector search + LLM |
| Smart Naming | Upload Service | 3-5s | LLM analysis |

### Resource Requirements

**CPU:**
- Backend: Low (Node.js)
- Upload Service: Medium (PDF processing)
- RAG Services: Medium (embedding generation)

**GPU:**
- Ollama: High (LLM inference)
- Required: NVIDIA GPU with 8+ GB VRAM

**Memory:**
- PostgreSQL: 512 MB - 2 GB
- ChromaDB: 1-4 GB (depends on document count)
- Ollama: 8-16 GB (model loading)
- Each service: 256-512 MB

**Storage:**
- Ollama models: ~7 GB
- Client documents: Variable (10-100 GB+)
- Vector embeddings: ~500 MB per 10,000 docs
- PostgreSQL: ~100 MB - 1 GB

## Scalability Considerations

### Horizontal Scaling Options

1. **Backend Server:** Stateless, can run multiple instances
2. **Upload Service:** Stateless after file save, scalable
3. **Doc Processor:** CPU-intensive, benefit from multiple instances
4. **RAG Services:** Can scale per-client or by load

### Vertical Scaling Needs

1. **PostgreSQL:** More RAM for larger datasets
2. **Ollama:** Better GPU for faster inference
3. **ChromaDB:** More RAM for larger vector stores

### Bottlenecks

1. **Ollama:** Single GPU, sequential processing
   - Solution: Model queue, multiple Ollama instances
2. **Doc Processor:** OCR is CPU-intensive
   - Solution: Worker pool, background jobs
3. **File Storage:** Single volume
   - Solution: Distributed storage, S3-compatible

## Related Documentation

- [Multi-Document PDF Splitting](MULTI_DOCUMENT_SPLITTING.md)
- [Automatic Model Initialization](AUTOMATIC_MODEL_INITIALIZATION.md)
- [Document Scanning Architecture](DOCUMENT_SCANNING_ARCHITECTURE.md)
- [AWS Deployment Guide](AWS_DEPLOYMENT_GUIDE.md)
