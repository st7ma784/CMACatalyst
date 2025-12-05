# 🚀 RMA-Demo Quick Start Guide

**🎉 NEW: Zero-Cost Serverless Deployment!**  
**Status**: ✅ Deploy in 5 minutes for $0/month  
**Last Updated**: December 2025  

See [ZERO_COST_DEPLOYMENT.md](ZERO_COST_DEPLOYMENT.md) for the new serverless architecture.

---

## Legacy Local Deployment (Old Method)

The following is the original single-machine deployment. For distributed zero-cost deployment, use the guide above.

**Status**: ✅ Ready for Production Deployment  
**Last Updated**: 2024  
**Target Audience**: DevOps Engineers, System Administrators

---

## 30-Second Quick Start

```bash
cd /data/CMACatalyst/RMA-Demo

# Make script executable and deploy
chmod +x deploy-vllm-local.sh
./deploy-vllm-local.sh start

# Access services
open http://localhost:3000           # Frontend
open http://localhost:7474          # Neo4j (neo4j/changeme-in-production)
open http://localhost:5678          # N8n (admin/changeme123)
```

---

## What Gets Deployed

### 11 Microservices

```
✅ Ollama          - Vision & text models (GPU 0)
✅ vLLM            - High-perf text generation (GPU 1)
✅ Neo4j           - Knowledge graph database
✅ OCR Service     - Document → Markdown conversion
✅ NER Graph       - Entity extraction & graph building
✅ Doc Processor   - Document orchestration
✅ RAG Service     - Knowledge retrieval
✅ Client RAG      - Document-aware Q&A
✅ Upload Service  - File management
✅ Frontend        - React UI
✅ N8n             - Workflow automation
```

### Architecture

```
Document Upload (8103)
         ↓
OCR Service (8104) → [Ollama llava on GPU 0]
         ↓
NER Graph Service (8108) → [vLLM on GPU 1]
         ↓
Neo4j (7687) → Knowledge Graph
```

---

## Prerequisites Checklist

- [ ] 2× NVIDIA GPUs (24GB+ VRAM each, e.g., RTX 4090)
- [ ] 32GB+ system RAM
- [ ] 100GB+ free disk space
- [ ] Ubuntu 22.04 LTS or similar
- [ ] NVIDIA drivers installed (`nvidia-smi` works)
- [ ] Docker & Docker Compose installed
- [ ] Network connectivity (for model downloads)

**Verify GPU Setup**:
```bash
nvidia-smi
# Should show 2 GPUs with CUDA capability
```

---

## Installation Steps

### Step 1: Clone/Navigate to Repository

```bash
cd /data/CMACatalyst
git pull  # Get latest
```

### Step 2: Make Deployment Script Executable

```bash
chmod +x RMA-Demo/deploy-vllm-local.sh
```

### Step 3: Start Deployment

```bash
cd RMA-Demo
./deploy-vllm-local.sh start
```

**What happens**:
1. ✅ Checks prerequisites (GPU, memory, disk)
2. ✅ Creates data directories
3. ✅ Starts 11 Docker services
4. ✅ Waits 2 minutes for services to be healthy
5. ✅ Runs health verification
6. ✅ Shows access points

### Step 4: Access Services

Once deployment completes:

**Frontend** → http://localhost:3000
- Risk Management Advice dashboard
- Document upload interface
- Query generation

**Neo4j Browser** → http://localhost:7474
- Username: `neo4j`
- Password: `changeme-in-production`
- Query knowledge graphs
- Visualize entity relationships

**N8n Workflows** → http://localhost:5678
- Username: `admin`
- Password: `changeme123`
- Automation workflows
- Integration setup

---

## Test Deployment (5 minutes)

### 1. Test OCR Service

```bash
# Create test document
echo "This is a test document." > /tmp/test.txt

# Test OCR endpoint
curl -X POST http://localhost:8104/health
# Expected: {"status":"healthy"}
```

### 2. Test NER Graph Service

```bash
# Extract entities from test markdown
curl -X POST http://localhost:8108/extract \
  -H "Content-Type: application/json" \
  -d '{
    "markdown": "John Smith is married with £500k savings. Income: £45k annually.",
    "source_document": "test-client",
    "graph_type": "CLIENT"
  }'

# Expected response includes extraction_id, graph_id, entity_count, relationship_count
```

### 3. Test Neo4j Graph

```bash
# Open browser
open http://localhost:7474

# Login: neo4j / changeme-in-production

# Test query
MATCH (e:Entity) RETURN e LIMIT 10
```

### 4. Test Frontend

```bash
open http://localhost:3000

# Upload a PDF document
# Observe OCR processing
# Check extracted entities
```

---

## Common Commands

### View Service Status

```bash
cd RMA-Demo
./deploy-vllm-local.sh status
```

### View Service Logs

```bash
# All services
./deploy-vllm-local.sh logs

# Specific service
./deploy-vllm-local.sh logs ner-graph-service
./deploy-vllm-local.sh logs ocr-service
./deploy-vllm-local.sh logs neo4j

# Real-time logs
docker-compose -f docker-compose.vllm.yml logs -f neo4j
```

### Stop Services

```bash
./deploy-vllm-local.sh stop
```

### Restart Services

```bash
./deploy-vllm-local.sh restart
```

### Check GPU Utilization

```bash
# Monitor in real-time
watch -n 1 nvidia-smi

# Or one-time check
nvidia-smi
```

### Restart Individual Service

```bash
docker-compose -f docker-compose.vllm.yml restart ner-graph-service
docker-compose -f docker-compose.vllm.yml restart neo4j
```

---

## Troubleshooting

### "Permission denied" on deploy script

```bash
chmod +x deploy-vllm-local.sh
```

### "No such container" errors

```bash
# Make sure you're in the right directory
cd /data/CMACatalyst/RMA-Demo

# Check if services are running
docker-compose -f docker-compose.vllm.yml ps
```

### "Out of memory" error

**For GPU memory**:
```yaml
# In docker-compose.vllm.yml, reduce vLLM GPU usage:
environment:
  - VLLM_GPU_MEMORY_UTILIZATION=0.7  # Reduce from 0.9
```

**For system memory**:
```yaml
# Reduce Neo4j heap memory:
environment:
  - NEO4J_server_memory_heap_initial__size=1G  # Reduce from 2G
  - NEO4J_server_memory_heap_max__size=1G
```

Then restart:
```bash
./deploy-vllm-local.sh restart
```

### Services unhealthy after startup

```bash
# Check logs
./deploy-vllm-local.sh logs

# Wait longer (large models take time to download)
sleep 120
./deploy-vllm-local.sh status

# If still unhealthy, restart
./deploy-vllm-local.sh restart
```

### Neo4j connection refused

```bash
# Check if Neo4j is running
docker ps | grep neo4j

# Check Neo4j logs
./deploy-vllm-local.sh logs neo4j | tail -50

# Verify connectivity
docker exec rma-neo4j cypher-shell -u neo4j -p "changeme-in-production" "RETURN 1"

# If still failing, restart
docker-compose -f docker-compose.vllm.yml restart neo4j
```

---

## Production Deployment Checklist

Before running in production, change all defaults:

- [ ] **Neo4j Password**: Update `NEO4J_PASSWORD` in `.env` or docker-compose
- [ ] **N8n Credentials**: Update `N8N_USER` and `N8N_PASSWORD`
- [ ] **JWT Secret**: Update `JWT_SECRET`
- [ ] **MCP API Key**: Update `MCP_API_KEY`
- [ ] **Enable TLS**: Configure nginx reverse proxy
- [ ] **Network Isolation**: Use custom Docker network
- [ ] **Backup Strategy**: Configure volume backups
- [ ] **Monitoring**: Set up Prometheus/Grafana
- [ ] **Resource Limits**: Configure CPU/memory limits per service

---

## API Examples

### Extract Document Entities

```bash
curl -X POST http://localhost:8108/extract \
  -H "Content-Type: application/json" \
  -d '{
    "markdown": "Client John Smith married with £500,000 savings",
    "source_document": "client-123",
    "graph_type": "CLIENT"
  }'
```

**Response**:
```json
{
  "extraction_id": "uuid",
  "graph_id": "graph-123",
  "entity_count": 5,
  "relationship_count": 3,
  "avg_confidence": 0.92,
  "graph_type": "CLIENT",
  "status": "success"
}
```

### Query Knowledge Graph

```bash
# Get graph structure
curl http://localhost:8108/graph/graph-123

# Search entities
curl "http://localhost:8108/graph/graph-123/search?query=married&entity_type=RELATIONSHIP_STATUS"

# Compare graphs
curl -X POST http://localhost:8108/graph/compare \
  -H "Content-Type: application/json" \
  -d '{
    "manual_graph_id": "manual-123",
    "client_graph_id": "client-123",
    "question_entities": ["married", "income"]
  }'
```

---

## Performance Expectations

### Processing Times (Production Hardware - 2× RTX 4090)

| Operation | Time |
|-----------|------|
| Single page OCR | 5-15 seconds |
| Entity extraction (1000 words) | 10-30 seconds |
| Full pipeline (1000 words) | 40-90 seconds |
| Graph storage in Neo4j | 2-5 seconds |

### Throughput

- **Sequential**: ~1 document/3 minutes
- **Parallel (5 concurrent)**: ~1 document/40 seconds
- **Batch (10 documents)**: ~400-600 words/min aggregate

---

## Data Locations

All service data is stored in Docker volumes:

```
/data/CMACatalyst/RMA-Demo/
├── data/
│   ├── uploads/        # User-uploaded documents
│   ├── ollama/         # Model cache
│   ├── chroma/         # Vector embeddings
│   └── n8n/            # Workflow definitions
```

---

## Getting Help

### Check Service Health

```bash
./deploy-vllm-local.sh status
```

### View Real-time Logs

```bash
docker-compose -f docker-compose.vllm.yml logs -f ner-graph-service
```

### Access Neo4j Browser for Debugging

```bash
open http://localhost:7474
# Query: MATCH (n) RETURN n LIMIT 25
```

---

## Next Steps

1. ✅ Deploy with `./deploy-vllm-local.sh start`
2. ✅ Verify services at `./deploy-vllm-local.sh status`
3. ✅ Test with provided curl examples
4. ✅ Upload documents via frontend (http://localhost:3000)
5. ✅ Inspect Neo4j browser (http://localhost:7474)
6. ✅ Configure N8n workflows (http://localhost:5678)

---

**Questions?** Check the full documentation at `/data/CMACatalyst/DEPLOYMENT_READY_STATUS.md`
