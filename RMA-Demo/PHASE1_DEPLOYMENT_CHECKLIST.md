# Phase 1 Deployment Checklist

## Pre-Deployment

- [ ] GPU allocation planned (Ollama GPU 0, vLLM GPU 1)
- [ ] Disk space available for Neo4j volumes (~5GB recommended)
- [ ] Docker and Docker Compose installed
- [ ] Git repository updated with latest code
- [ ] Review `PHASE1_NER_IMPLEMENTATION.md`
- [ ] Review `NER_GRAPH_SERVICE_ARCHITECTURE.md`

## Files Verified

- [ ] `services/ner-graph-service/app.py` exists (350+ lines)
- [ ] `services/ner-graph-service/extractors.py` exists (550+ lines)
- [ ] `services/ner-graph-service/neo4j_client.py` exists (400+ lines)
- [ ] `services/ner-graph-service/llm_client.py` exists (250+ lines)
- [ ] `services/ner-graph-service/Dockerfile` exists
- [ ] `services/ner-graph-service/requirements.txt` exists
- [ ] `docker-compose.vllm.yml` updated with Neo4j and NER service
- [ ] `PHASE1_NER_IMPLEMENTATION.md` created
- [ ] `PHASE1_COMPLETION_REPORT.md` created
- [ ] `validate_phase1.py` created
- [ ] `NER_GRAPH_SERVICE_ARCHITECTURE.md` exists

## Deployment Steps

### Step 1: Build Services
```bash
cd RMA-Demo
docker-compose -f docker-compose.vllm.yml build neo4j ner-graph-service
```
- [ ] Build completes without errors
- [ ] Check output: "Successfully built rma-neo4j"
- [ ] Check output: "Successfully built rma-ner-graph-service"

### Step 2: Start Neo4j
```bash
docker-compose -f docker-compose.vllm.yml up -d neo4j
```
- [ ] Container starts: `docker ps | grep rma-neo4j`
- [ ] Health check passes: `docker logs rma-neo4j | grep "started"`
- [ ] Port 7687 available: `netstat -an | grep 7687`
- [ ] Port 7474 available: `netstat -an | grep 7474`

**Wait 30 seconds for Neo4j to fully initialize**

### Step 3: Start NER Service
```bash
docker-compose -f docker-compose.vllm.yml up -d ner-graph-service
```
- [ ] Container starts: `docker ps | grep rma-ner-graph-service`
- [ ] Health check passes: `curl http://localhost:8108/health`
- [ ] Port 8108 available: `netstat -an | grep 8108`

**Wait 30 seconds for service to fully initialize**

### Step 4: Verify Dependencies
```bash
# Check all required services
docker ps | grep -E "rma-(vllm|ollama|neo4j|ner-graph)"
```
- [ ] Ollama running (GPU 0)
- [ ] vLLM running (GPU 1)
- [ ] Neo4j running (7687)
- [ ] NER Graph Service running (8108)

### Step 5: Health Checks
```bash
# NER Service health
curl http://localhost:8108/health
```
- [ ] Status: 200 OK
- [ ] Response: `{"status":"healthy","vllm_available":true,"neo4j_connected":true}`

```bash
# Neo4j Browser available
curl http://localhost:7474 | head -20
```
- [ ] Status: 200 OK

```bash
# vLLM available
curl http://localhost:8000/health
```
- [ ] Status: 200 OK

```bash
# Ollama available
curl http://localhost:11434/api/tags
```
- [ ] Status: 200 OK

### Step 6: Test Basic Extraction
```bash
python validate_phase1.py
```
- [ ] All health checks pass
- [ ] Entity extraction succeeds
- [ ] Graph query works
- [ ] Graph search works
- [ ] Total passed: ≥8/10

## Post-Deployment

### Verify Database
```bash
# Connect to Neo4j Browser
# URL: http://localhost:7474
# User: neo4j
# Password: changeme-in-production
```
- [ ] Browser loads successfully
- [ ] Can execute: `RETURN 1` query
- [ ] Database is empty initially (OK - will populate on first extraction)

### Verify Service Logs
```bash
docker logs rma-ner-graph-service | tail -20
```
- [ ] No error messages
- [ ] Service listening on 0.0.0.0:8108
- [ ] Neo4j connection established

### Create Test Extraction
```bash
curl -X POST http://localhost:8108/extract \
  -H "Content-Type: application/json" \
  -d '{
    "markdown": "When a client defaults for 3 months, they may be eligible for a Payment Holiday. Requirement: age > 60. Benefit: 3-month payment suspension.",
    "source_document": "deployment_test",
    "graph_type": "MANUAL"
  }'
```
- [ ] Status: 200 OK
- [ ] Response includes: graph_id, entity_count > 3, relationship_count > 1
- [ ] avg_confidence > 0.7
- [ ] status: "success"

### Verify Graph Storage
```bash
# In Neo4j Browser (http://localhost:7474):
MATCH (e:Entity) RETURN count(e) as entity_count
```
- [ ] entity_count > 0 (from test extraction)
- [ ] Can execute: `MATCH (e:Entity) RETURN e LIMIT 10`

### Performance Test
```bash
# Time extraction on small document
time curl -X POST http://localhost:8108/extract \
  -H "Content-Type: application/json" \
  -d '{
    "markdown": "5-10 sentences of financial text...",
    "source_document": "perf_test",
    "graph_type": "MANUAL"
  }' > /dev/null
```
- [ ] Response time < 30 seconds
- [ ] No timeout errors

## Documentation Review

- [ ] `PHASE1_NER_IMPLEMENTATION.md` - Reviewed quick start section
- [ ] `PHASE1_COMPLETION_REPORT.md` - Reviewed deliverables
- [ ] `PHASE1_QUICK_REFERENCE.md` - Bookmarked for operations
- [ ] `NER_GRAPH_SERVICE_ARCHITECTURE.md` - Reviewed data model
- [ ] `validate_phase1.py` - Script location noted

## Data Backup Strategy

- [ ] Neo4j volume backed up: `neo4j_data`
- [ ] Neo4j logs volume backed up: `neo4j_logs`
- [ ] Service config backed up: `docker-compose.vllm.yml`
- [ ] Backup location: `[your-backup-path]`
- [ ] Backup frequency: daily (recommend)

## Security Checklist

- [ ] Neo4j password changed from default ⚠️ (MUST DO in production)
  ```bash
  # Update in docker-compose.vllm.yml
  NEO4J_AUTH=neo4j/YOUR_SECURE_PASSWORD
  ```

- [ ] Service not exposed to internet without HTTPS ✓
- [ ] Firewall rules configured for ports 7687, 7474, 8108
- [ ] API key required for services (if applicable) ✓
- [ ] Volume permissions set correctly (docker handles)

## Monitoring Setup

- [ ] Enable Docker stats monitoring
  ```bash
  docker stats rma-neo4j rma-ner-graph-service --no-stream
  ```

- [ ] Setup log aggregation (optional)
  ```bash
  docker logs rma-ner-graph-service --follow
  ```

- [ ] GPU monitoring
  ```bash
  nvidia-smi dmon -s p
  ```

- [ ] Alert on service restarts (check docker events)
  ```bash
  docker events --filter 'type=container'
  ```

## Integration Readiness

- [ ] Doc Processor ready to call NER service (Phase 2)
  - [ ] NER service URL: http://ner-graph-service:8108
  - [ ] Endpoint: POST /extract
  
- [ ] RAG Service ready for graph queries (Phase 2)
  - [ ] Graph ID storage in doc metadata
  - [ ] Graph query endpoint: GET /graph/{id}
  - [ ] Graph search endpoint: GET /graph/{id}/search

- [ ] Frontend ready for graph visualization (Phase 3)
  - [ ] NER service URL exposed to frontend
  - [ ] Graph data format documented
  - [ ] Visualization library selected

## Final Verification

```bash
# All services operational
docker ps | grep -c rma
# Should output: ≥ 5 (including existing services)

# All health checks passing
curl http://localhost:8108/health && \
curl http://localhost:8000/health && \
curl http://localhost:11434/api/tags && \
echo "✅ All services healthy"

# Database working
curl -X POST http://localhost:8108/extract \
  -H "Content-Type: application/json" \
  -d '{"markdown":"Test","source_document":"test","graph_type":"MANUAL"}' && \
echo "✅ Extraction working"
```

- [ ] All services healthy
- [ ] Extraction working
- [ ] Database storing data
- [ ] Logs clean (no errors)

## Deployment Complete ✅

- [ ] All checklist items completed
- [ ] Phase 1 fully operational
- [ ] Ready for Phase 2 integration
- [ ] Documentation accessible
- [ ] Team notified of deployment

## Rollback Plan (If Needed)

```bash
# Stop Phase 1 services only
docker-compose -f docker-compose.vllm.yml stop neo4j ner-graph-service

# Or complete rollback
docker-compose -f docker-compose.vllm.yml down
docker volume rm rma_neo4j_data rma_neo4j_logs

# Restart previous stack
docker-compose -f docker-compose.vllm.yml up -d
```

- [ ] Rollback procedures tested
- [ ] Data backup verified before rollback
- [ ] Team knows rollback procedures

---

## Deployment Sign-Off

- **Deployed By:** ___________________
- **Date:** ___________________
- **Environment:** [ ] Development [ ] Staging [ ] Production
- **Verified By:** ___________________
- **Notes:** ___________________________________________________

---

**Phase 1 Deployment Checklist Complete** ✅

**Next:** Proceed with Phase 2 - RAG Service Integration
