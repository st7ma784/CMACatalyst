# 🚀 Quick Start - Neo4j Graph UI (DEPLOYED)

## ✅ System is Now Running!

### Access the Dashboard
**URL**: http://localhost:3000/graph

### Available Tools

1. **Extract** (`/graph/extract`)
   - Paste markdown text or upload files
   - See entities highlighted in real-time
   - View D3.js force-directed graph
   - Get confidence scores

2. **Ingest** (`/graph/ingest`)
   - Batch upload multiple documents
   - Automatic graph extraction
   - View statistics and results

3. **Compare** (`/graph/compare`)
   - Compare two graphs side-by-side
   - Find matching entities
   - See applicable rules
   - Get reasoning explanation

---

## 🔍 What to Try First

### Step 1: View Dashboard
```bash
curl http://localhost:3000/graph
# Open in browser: http://localhost:3000/graph
```

### Step 2: Extract a Document
Go to http://localhost:3000/graph/extract and paste this markdown:

```markdown
# Debt Relief Options

## Individual Voluntary Arrangement (IVA)
- For debtors with £15,000+ unsecured debt
- Negotiated with creditors
- 5-year typical repayment plan
- Professional fees required

## Debt Relief Order (DRO)
- For debtors with £15,000 or less total debt
- £90 application fee
- 6-year protection period
- No credit available
```

**Expected**: Entities extracted (DEBT_TYPE, AMOUNT, DURATION, etc.)

### Step 3: View Neo4j
```bash
# Browser: http://localhost:7474
# Username: neo4j
# Password: changeme-in-production

# Run in browser console:
MATCH (n) RETURN n LIMIT 25
```

---

## 🔧 Service Ports

| Service | Port | URL |
|---------|------|-----|
| Frontend | 3000 | http://localhost:3000 |
| Neo4j Browser | 7474 | http://localhost:7474 |
| Neo4j Bolt | 7687 | bolt://localhost:7687 |
| NER Service | 8108 | http://localhost:8108 |
| RAG Service | 8102 | http://localhost:8102 |
| Ollama | 11434 | http://localhost:11434 |
| ChromaDB | 8005 | http://localhost:8005 |
| PostgreSQL | 5432 | localhost:5432 |

---

## 📋 Troubleshooting

### Frontend not loading?
```bash
docker logs rma-frontend
```

### NER service not responding?
```bash
curl http://localhost:8108/health
```

### RAG service issues?
```bash
docker logs rma-rag-service
```

### Neo4j not accessible?
```bash
docker logs rma-neo4j
```

---

## 🛠️ Common Commands

### Check all services
```bash
docker ps | grep rma-
```

### Restart a service
```bash
docker-compose -f docker-compose-simple.yml restart rma-frontend
```

### View real-time logs
```bash
docker logs -f rma-ner-graph-service
```

### Stop everything
```bash
docker-compose -f docker-compose-simple.yml down
```

### Start everything again
```bash
docker-compose -f docker-compose-simple.yml up -d
```

---

## 📊 What's Working

✅ Frontend dashboard  
✅ Graph visualization (D3.js)  
✅ Entity extraction (NER service)  
✅ Neo4j graph storage  
✅ Document ingestion (RAG)  
✅ All 16 entity types  
✅ Relationship extraction  
✅ Confidence scoring  

---

## 🎯 Next: Test the Tools

1. **Visit**: http://localhost:3000/graph
2. **Click**: "Extract Entities"
3. **Paste**: Sample markdown (see Step 2 above)
4. **See**: Entities + Graph visualization
5. **Enjoy**: The Neo4j Graph UI! 🎉

---

*System deployed and running November 5, 2025*
