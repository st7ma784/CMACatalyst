# Client Document Search Feature

## Overview

The Client Document Search feature enables advisors to query client-specific documents using natural language. Every document uploaded for a client is automatically indexed into a searchable knowledge base, allowing instant AI-powered answers with source citations.

## How It Works

### Automatic Indexing Pipeline

```
Client uploads document
         ↓
Upload Service receives file
         ↓
Doc Processor converts to markdown (OCR)
         ↓
Upload Service sends markdown to Client RAG Service
         ↓
Client RAG Service chunks and embeds text
         ↓
Stored in client-specific vector store (ChromaDB)
         ↓
Document is now searchable via AI
```

### Query Pipeline

```
User enters question
         ↓
Client RAG Service searches vector store
         ↓
Retrieves top 4 most relevant chunks
         ↓
Ollama LLM generates answer from context
         ↓
Returns answer with source citations
```

## Features

### Per-Client Isolation
- Each client has their own vector store collection
- Documents from Client A are never visible to Client B
- Secure multi-tenant architecture

### Automatic Processing
- No manual steps required
- Documents are indexed immediately after upload
- Markdown conversion happens automatically

### Smart Chunking
- Documents split into 1000-character chunks
- 200-character overlap between chunks
- Preserves context across boundaries

### Source Attribution
- Every answer includes sources
- Shows which document and section was used
- Displays text preview from source

## Usage

### 1. Upload Documents

First, upload documents for a client via the normal upload flow:

```bash
curl -X POST http://localhost:8103/uploads/CLIENT001 \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@bank-statement.pdf"
```

Response indicates indexing status:
```json
{
  "success": true,
  "filename": "20250115_120000_bank-statement.pdf",
  "client_id": "CLIENT001",
  "markdown_available": true,
  "message": "Document uploaded and processed successfully (searchable via AI)"
}
```

### 2. Check Client Statistics

Before searching, check what documents are available:

```bash
curl http://localhost:8103/client-stats/CLIENT001 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

Response:
```json
{
  "client_id": "CLIENT001",
  "total_chunks": 45,
  "total_documents": 3,
  "documents": [
    "bank-statement.pdf",
    "debt-letter.pdf",
    "income-proof.pdf"
  ],
  "status": "ready"
}
```

### 3. Query Documents

Now you can ask questions:

```bash
curl -X POST http://localhost:8103/query-client-documents \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "client_id": "CLIENT001",
    "question": "What debts does this client have?",
    "model": "llama3.2"
  }'
```

Response:
```json
{
  "answer": "Based on the uploaded documents, the client has three debts:\n1. Credit card debt of £2,450 with Barclaycard\n2. Personal loan of £8,500 with Lloyds Bank\n3. Council tax arrears of £1,200",
  "sources": [
    {
      "filename": "debt-letter.pdf",
      "chunk": 2,
      "text_preview": "Outstanding balance: £2,450.00\nAccount: Barclaycard Visa\nReference: 1234-5678..."
    },
    {
      "filename": "bank-statement.pdf",
      "chunk": 5,
      "text_preview": "Direct Debit - Lloyds Personal Loan £180.00..."
    }
  ],
  "client_id": "CLIENT001"
}
```

## Example Questions

### Debt Information
- "What debts does this client have?"
- "What is the total amount owed?"
- "Who are the creditors?"
- "When are the payment deadlines?"
- "Are any debts in arrears?"

### Income & Benefits
- "What is the client's monthly income?"
- "What benefits is the client receiving?"
- "Does the client have any employment income?"
- "What are the income sources?"

### Personal Information
- "What is the client's address?"
- "Who are the household members?"
- "What is the client's employment status?"

### Financial Analysis
- "What is the client's disposable income?"
- "Can the client afford the monthly payments?"
- "What are the priority debts?"
- "Are there any high-interest debts?"

## Frontend Usage

### In the Dashboard

1. Navigate to the **"Search Client Docs"** tab
2. Enter the Client ID (same ID used for uploads)
3. The system shows:
   - Document statistics (how many docs indexed)
   - List of available documents
   - Status indicator (ready/not initialized)
4. Enter your question in natural language
5. Click "Search Documents"
6. Results appear with:
   - AI-generated answer
   - Source citations with document names
   - Text previews from relevant sections

### Visual Indicators

**Green box** = Documents available and ready to search
```
✓ Documents Available
3 document(s) indexed
45 searchable chunks
```

**Gray box** = No documents yet
```
ℹ No documents have been uploaded for this client yet.
Upload documents first to enable search.
```

## Technical Details

### Vector Store Structure

Each client gets:
- Dedicated ChromaDB collection named `client_{client_id}`
- Persistent storage in `/data/client_vectorstores/{client_id}/`
- Isolated from other clients

### Embedding Model

- **Model**: nomic-embed-text (via Ollama)
- **Dimensions**: 768
- **Quality**: High-quality embeddings for financial documents

### Generation Model

- **Model**: llama3.2 (default, configurable)
- **Temperature**: 0.7 (balanced creativity/accuracy)
- **Top-K**: 4 chunks retrieved per query

### Performance

- **Embedding speed**: ~100ms per document chunk
- **Query speed**: ~2-5 seconds for answer generation
- **Storage**: ~1KB per chunk (text + embeddings)

### Capacity

- **Chunks per document**: Varies (typically 10-50 depending on length)
- **Documents per client**: Unlimited
- **Clients**: Unlimited
- **Total storage**: Limited by disk space

## Privacy & Security

### Data Isolation
- Client documents never cross-contaminate
- Each vector store is completely separate
- No shared embeddings between clients

### Authentication
- All queries require valid JWT token
- Only authenticated advisors can search
- Client data protected by authorization layer

### Data Retention
- Documents stored until manually deleted
- Vector embeddings persist with documents
- No automatic expiration

### Compliance
- All data stays on-premises (no cloud APIs)
- GDPR compliant (data controller maintains full control)
- Audit trail available via service logs

## Troubleshooting

### "No documents found for client"

**Cause**: Client has never uploaded documents OR documents failed to index

**Solutions**:
1. Check client stats endpoint to verify
2. Upload at least one document
3. Verify doc-processor is running
4. Check upload-service logs for indexing errors

### Slow Query Performance

**Cause**: Large number of documents or CPU-only processing

**Solutions**:
1. Ensure Ollama is using GPU acceleration
2. Reduce top_k parameter (default 4)
3. Use smaller/faster model (e.g., llama2)
4. Check system resources (CPU/RAM/GPU)

### Poor Answer Quality

**Cause**: Insufficient context or irrelevant documents retrieved

**Solutions**:
1. Increase top_k to retrieve more context (try 6-8)
2. Rephrase question to be more specific
3. Verify documents were OCR'd correctly
4. Check markdown conversion quality

### Indexing Failures

**Cause**: Client-rag-service unavailable or markdown conversion failed

**Solutions**:
1. Check service health: `curl http://localhost:8104/health`
2. View logs: `docker logs rma-client-rag-service`
3. Verify ChromaDB is accessible
4. Restart client-rag-service if needed

## Best Practices

### Document Preparation
- Upload clear, high-quality scans
- Ensure text is readable (not handwritten)
- Name files descriptively (e.g., "bank-statement-jan-2025.pdf")

### Query Formulation
- Be specific in questions
- Use financial terminology when appropriate
- Ask one question at a time
- Reference specific document types if known

### Maintenance
- Regularly check client statistics
- Monitor disk space usage
- Archive old clients' data when no longer needed
- Back up vector stores periodically

## Integration Examples

### Python Client

```python
import requests

class ClientDocumentSearch:
    def __init__(self, base_url, token):
        self.base_url = base_url
        self.headers = {"Authorization": f"Bearer {token}"}

    def query(self, client_id, question):
        response = requests.post(
            f"{self.base_url}/query-client-documents",
            headers=self.headers,
            json={"client_id": client_id, "question": question}
        )
        return response.json()

    def get_stats(self, client_id):
        response = requests.get(
            f"{self.base_url}/client-stats/{client_id}",
            headers=self.headers
        )
        return response.json()

# Usage
search = ClientDocumentSearch("http://localhost:8103", "YOUR_TOKEN")
result = search.query("CLIENT001", "What debts does this client have?")
print(result["answer"])
```

### JavaScript/Node.js Client

```javascript
class ClientDocumentSearch {
  constructor(baseUrl, token) {
    this.baseUrl = baseUrl;
    this.token = token;
  }

  async query(clientId, question) {
    const response = await fetch(`${this.baseUrl}/query-client-documents`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ client_id: clientId, question })
    });
    return response.json();
  }

  async getStats(clientId) {
    const response = await fetch(`${this.baseUrl}/client-stats/${clientId}`, {
      headers: { 'Authorization': `Bearer ${this.token}` }
    });
    return response.json();
  }
}

// Usage
const search = new ClientDocumentSearch('http://localhost:8103', 'YOUR_TOKEN');
const result = await search.query('CLIENT001', 'What debts does this client have?');
console.log(result.answer);
```

## API Reference

See main README.md for complete API documentation of:
- `/query-client-documents` - Query documents
- `/client-stats/{client_id}` - Get statistics
- `/ingest` (client-rag-service) - Manual ingestion
- `/query` (client-rag-service) - Direct query

## Future Enhancements

Potential improvements for future versions:

- [ ] Multi-language support
- [ ] Document similarity search
- [ ] Timeline extraction from documents
- [ ] Automated debt prioritization
- [ ] Budget calculation from income/expenses
- [ ] Document comparison ("compare Jan and Feb statements")
- [ ] Alert on missing required documents
- [ ] Automated form filling from extracted data
- [ ] Export query results to PDF report
- [ ] Conversation history per client

## Support

For issues or questions about client document search:
1. Check service logs: `docker logs rma-client-rag-service`
2. Verify ChromaDB connectivity
3. Test with simple query first
4. Contact system administrator

## See Also

- [README.md](README.md) - Main project documentation
- [MIGRATION_GUIDE.md](MIGRATION_GUIDE.md) - Local parsing setup
- [LOCAL_PARSING_OPTIONS.md](LOCAL_PARSING_OPTIONS.md) - Document processing options
