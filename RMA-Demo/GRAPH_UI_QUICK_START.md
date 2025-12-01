# Quick Start Guide - Neo4j Graph UI

## Access the Dashboard

Navigate to: **http://localhost:3000/graph**

## Three Main Tools

### 1. **Extract Entities** (`/graph/extract`)
Extract entities and relationships from a single document.

**How to use:**
1. Paste markdown content or upload a file (.md or .txt)
2. Enter document name (e.g., "client-facts")
3. Select graph type:
   - **MANUAL**: For financial advice/rules documents
   - **CLIENT**: For client situation/facts documents
4. Click "Extract Graph"
5. View visualization on the right
6. Click entities to see details

**Sample documents ready to test:**
- `/manuals/debt-relief-guide.md` - DRO, IVA, bankruptcy rules
- `/manuals/tax-planning-manual.md` - Tax planning rules

### 2. **Ingest Documents** (`/graph/ingest`)
Upload multiple documents at once and extract graphs for all of them.

**How to use:**
1. Drag-drop or select multiple markdown files
2. Enter collection name (e.g., "tax-rules", "manuals")
3. Click "Ingest Documents"
4. System ingests to RAG vector store
5. System automatically extracts graphs from each document
6. View results with entity/relationship statistics

**Result:**
- Documents stored in ChromaDB (RAG service)
- Graphs extracted and stored in Neo4j
- Each document gets an extraction ID

### 3. **Compare Graphs** (`/graph/compare`)
Compare manual knowledge graphs against client situation graphs to find applicable rules.

**How to use:**
1. Paste Manual Graph ID (knowledge base)
2. Paste Client Graph ID (client situation)
3. Click "Load Graphs" to visualize both
4. Click "Compare & Find Rules" to find matches
5. Select rules from the list to see:
   - Full rule text
   - Confidence score
   - Matched entities highlighted
   - Reasoning explanation

## Services That Must Be Running

Make sure the Docker services are active:

```bash
docker-compose -f docker-compose.vllm.yml up -d
```

**Services needed:**
- **NER Service** (port 8108) - Entity extraction
- **RAG Service** (port 8102) - Document ingestion
- **Neo4j** (port 7687) - Graph storage
- **Ollama** (port 11434) - LLM models

## Example Workflow

### 1. Extract Rules from Manual
```
1. Go to /graph/extract
2. Upload tax-planning-manual.md
3. Name: "tax-rules"
4. Type: MANUAL
5. Click Extract
6. Copy Graph ID: abc123def456...
```

### 2. Extract Client Facts
```
1. Go to /graph/extract
2. Paste client facts markdown
3. Name: "client-john-smith"
4. Type: CLIENT
5. Click Extract
6. Copy Graph ID: xyz789uvw012...
```

### 3. Compare and Find Applicable Rules
```
1. Go to /graph/compare
2. Paste manual Graph ID: abc123def456...
3. Paste client Graph ID: xyz789uvw012...
4. Click "Load Graphs" to see both
5. Click "Compare & Find Rules"
6. Review applicable rules and reasoning
```

## Understanding the Graph Visualization

### Node Colors (Entity Types)
- 🔴 **Red** - Debt types (DRO, IVA, bankruptcy)
- 🔵 **Teal** - Obligations (must, should)
- 🔷 **Blue** - Rules and advice
- 🟠 **Orange** - Logic gates (AND, OR)
- 🟢 **Green** - Money thresholds
- 🟡 **Yellow** - Creditors
- 🟣 **Purple** - Repayment terms
- And 9 more types...

### Interactions
- **Hover** - See entity details
- **Click** - Select entity to view properties
- **Drag** - Move nodes around
- **Scroll** - Zoom in/out
- **Arrows** - Direction of relationships

## Confidence Scores

Higher confidence = stronger match
- **0.90-1.00** - Excellent match (95%+ sure)
- **0.70-0.89** - Good match (70%+ sure)
- **0.50-0.69** - Possible match (50%+ sure)
- **Below 0.50** - Uncertain match

## Entity Types Reference

| Type | Description | Example |
|------|-------------|---------|
| DEBT_TYPE | Type of debt | "Debt Relief Order" |
| OBLIGATION | Financial must-do | "Must disclose assets" |
| RULE | Advice rule | "DRO applies under £15,000" |
| GATE | Conditional logic | "AND", "OR", "IF" |
| MONEY_THRESHOLD | Financial limit | "£15,000 debt limit" |
| CREDITOR | Who is owed | "HMRC", "Bank" |
| REPAYMENT_TERM | Payment schedule | "5 years" |
| LEGAL_STATUS | Legal state | "Bankrupt", "Insolvent" |
| CLIENT_ATTRIBUTE | Client property | "Employed", "Single" |
| PERSON | Individual | "John Smith" |
| ORGANIZATION | Company/agency | "Citizens Advice" |
| DATE | Time/date | "January 2024" |
| MONEY | Amount | "£12,500" |
| PERCENT | Percentage | "50%" |
| LOCATION | Place | "Scotland", "England" |
| DURATION | Time period | "6 months" |

## Troubleshooting

### Graph doesn't load
- Check that NER service is running: `curl http://localhost:8108/health`
- Check that Neo4j is running: `docker logs rma-neo4j`

### No entities extracted
- Ensure markdown document uses clear entity mentions
- Check document format (UTF-8 encoding)
- Verify Ollama models are downloaded

### Comparison returns no rules
- Ensure both graph IDs are correct
- Check that graphs were successfully extracted
- Look for matching entity types between graphs

### Slow performance
- Graphs with 1000+ nodes may be slow
- Try searching or filtering by entity type
- Consider breaking documents into smaller sections

## Tips & Best Practices

✅ **DO:**
- Use clear, structured markdown
- Group related entities together in document
- Use consistent terminology
- Add context around entities

❌ **DON'T:**
- Mix MANUAL and CLIENT graphs without caution
- Upload very large documents (>50MB)
- Use special characters in names
- Manually edit Graph IDs

## Next Steps

1. **Extract** - Try extracting from tax-planning-manual.md
2. **Ingest** - Upload both sample manuals
3. **Compare** - Create client facts and compare

Then build your own knowledge base!

## Support

For issues or questions:
1. Check Docker services are running
2. View NER service logs: `docker logs rma-ner-graph-service`
3. View browser console for frontend errors
4. Check Neo4j browser: `http://localhost:7474`
