# Phase 6: Deployment Guide
## RMA-Demo LangGraph Migration - Production Deployment

**Version:** 1.0
**Date:** October 24, 2025
**Status:** Ready for Deployment

---

## Table of Contents

1. [Pre-Deployment Checklist](#pre-deployment-checklist)
2. [Staging Environment Setup](#staging-environment-setup)
3. [Acceptance Testing](#acceptance-testing)
4. [Production Deployment](#production-deployment)
5. [Rollback Procedures](#rollback-procedures)
6. [Monitoring & Observability](#monitoring--observability)
7. [Post-Deployment Tasks](#post-deployment-tasks)

---

## Pre-Deployment Checklist

### Code Readiness

- [ ] All Phase 1, 2, 3 files are committed to version control
- [ ] Integration tests pass (`./run_integration_tests.sh`)
- [ ] Performance benchmarks completed (`python tests/benchmark_performance.py`)
- [ ] Code review completed by team
- [ ] Documentation is up-to-date

### Infrastructure Readiness

- [ ] Docker images build successfully
- [ ] Environment variables documented in `.env.example`
- [ ] Secrets management solution in place
- [ ] SSL/TLS certificates obtained (for production)
- [ ] Domain names configured
- [ ] Resource limits set in docker-compose.yml

### Data Readiness

- [ ] Manual PDFs loaded in `/manuals` directory
- [ ] ChromaDB vector store initialized
- [ ] Ollama models downloaded (llama3.2, nomic-embed-text)
- [ ] Database backups configured
- [ ] Test data prepared for acceptance testing

### Team Readiness

- [ ] Deployment team briefed
- [ ] Rollback plan reviewed
- [ ] Monitoring alerts configured
- [ ] On-call schedule established
- [ ] Communication channels set up (Slack, email, etc.)

---

## Staging Environment Setup

### 1. Clone Repository

```bash
# Clone to staging server
git clone https://github.com/your-org/rma-demo.git /opt/rma-demo
cd /opt/rma-demo

# Checkout specific version/tag
git checkout tags/v1.0.0-langgraph
```

### 2. Configure Staging Environment

Create `.env` file for staging:

```bash
cp .env.example .env.staging
```

Edit `.env.staging`:

```ini
# LangGraph Configuration
USE_LANGGRAPH=true  # Enable new implementation

# Ollama Configuration
OLLAMA_URL=http://ollama:11434
OLLAMA_MODEL=llama3.2

# ChromaDB Configuration
CHROMA_URL=http://chromadb:8000

# MCP Server Configuration
MCP_API_KEY=staging-secure-key-here  # Generate: openssl rand -hex 32

# n8n Configuration
N8N_USER=admin
N8N_PASSWORD=staging-password-here  # Generate strong password

# JWT Secret
JWT_SECRET=staging-jwt-secret-here  # Generate: openssl rand -hex 32

# Application URLs (staging domain)
APP_BASE_URL=https://staging.rma-demo.your-org.uk
WEBHOOK_URL=https://staging.rma-demo.your-org.uk/

# LlamaParse (if used)
LLAMA_PARSE_API_KEY=your-llamaparse-key-here

# Resource Limits (adjust for staging server)
COMPOSE_PROJECT_NAME=rma-staging
```

### 3. Start Staging Services

```bash
# Use staging environment file
docker-compose --env-file .env.staging up -d

# Wait for services to initialize
sleep 30

# Check service health
docker-compose ps
docker-compose logs --tail=50
```

### 4. Verify Staging Deployment

```bash
# Run validation script
./validate_migration.sh

# Check each service
curl http://localhost:8102/health  # RAG service
curl http://localhost:8105/health  # MCP server
curl http://localhost:11434/api/tags  # Ollama
curl http://localhost:8005/api/v1/heartbeat  # ChromaDB
curl http://localhost:5678/  # n8n (should return HTML)

# Check if models are loaded
docker-compose exec ollama ollama list
```

### 5. Load Test Data

```bash
# Copy manuals to staging
docker-compose cp ./manuals ollama:/manuals/

# Initialize vector store (if needed)
docker-compose exec rag-service python -c "
from app import RAGService
service = RAGService()
service.initialize_vectorstore()
print('Vector store initialized')
"
```

---

## Acceptance Testing

### Test Suite 1: Functional Tests

Run integration tests:

```bash
# Full integration test suite
./run_integration_tests.sh

# Expected: All tests pass
# Look for: "All tests passed!" message
```

### Test Suite 2: Performance Tests

Run performance benchmarks:

```bash
# Run benchmarks
python tests/benchmark_performance.py

# Review results
cat test_results/benchmark_report.json | jq .

# Verify:
# - Average response time < 3 seconds
# - Confidence scores >= 0.7
# - LangGraph performance within ±20% of legacy
```

### Test Suite 3: Manual Acceptance Tests

Test critical user journeys:

#### 1. Simple Query Test

```bash
curl -X POST http://localhost:8102/agentic-query \
  -H "Content-Type: application/json" \
  -d '{
    "question": "What is a DRO?",
    "topic": "general",
    "use_langgraph": true
  }'

# Verify:
# - Response contains DRO definition
# - Confidence >= 0.7
# - Response time < 3s
```

#### 2. Eligibility Check Test

```bash
curl -X POST http://localhost:8102/agentic-query \
  -H "Content-Type: application/json" \
  -d '{
    "question": "Is a client with £15,000 debt, £50/month income, and £1,000 assets eligible for a DRO?",
    "topic": "dro_eligibility",
    "debt": 15000,
    "income": 50,
    "assets": 1000,
    "use_langgraph": true
  }'

# Verify:
# - Response indicates "eligible"
# - Symbolic variables used
# - Confidence >= 0.8
```

#### 3. n8n Workflow Test

1. Access n8n: http://localhost:5678
2. Login with credentials from `.env.staging`
3. Import workflow: `services/n8n/workflows/client-onboarding.json`
4. Execute workflow with test data
5. Verify: Email sent, calendar event created

### Test Suite 4: Load Testing

Simulate concurrent users:

```bash
# Install hey if not present
go install github.com/rakyll/hey@latest

# Run load test (50 concurrent requests, 200 total)
hey -n 200 -c 50 -m POST \
  -H "Content-Type: application/json" \
  -d '{"question":"What is a DRO?","topic":"general","use_langgraph":true}' \
  http://localhost:8102/agentic-query

# Verify:
# - No errors
# - Average response time acceptable
# - No memory leaks (check docker stats)
```

### Acceptance Criteria

Deployment is approved if:

- ✅ All integration tests pass
- ✅ Performance benchmarks within acceptable range
- ✅ Manual acceptance tests pass
- ✅ Load test shows no errors
- ✅ No critical bugs found
- ✅ Rollback procedure tested

---

## Production Deployment

### Step 1: Prepare Production Environment

```bash
# SSH to production server
ssh user@production.rma-demo.your-org.uk

# Create deployment directory
sudo mkdir -p /opt/rma-demo
sudo chown $USER:$USER /opt/rma-demo
cd /opt/rma-demo

# Clone repository
git clone https://github.com/your-org/rma-demo.git .
git checkout tags/v1.0.0-langgraph
```

### Step 2: Configure Production Environment

Create `.env` for production:

```bash
cp .env.example .env
```

Edit `.env` with production values:

```ini
# LangGraph Configuration
USE_LANGGRAPH=true  # Enable new implementation

# Ollama Configuration
OLLAMA_URL=http://ollama:11434
OLLAMA_MODEL=llama3.2

# ChromaDB Configuration
CHROMA_URL=http://chromadb:8000

# MCP Server Configuration
MCP_API_KEY=<secure-production-key>  # From secrets manager

# n8n Configuration
N8N_USER=admin
N8N_PASSWORD=<secure-production-password>  # From secrets manager

# JWT Secret
JWT_SECRET=<secure-production-jwt-secret>  # From secrets manager

# Application URLs (production domain)
APP_BASE_URL=https://rma-demo.riverside.org.uk
WEBHOOK_URL=https://rma-demo.riverside.org.uk/

# SSL/TLS (for reverse proxy)
N8N_PROTOCOL=https
N8N_HOST=rma-demo.riverside.org.uk

# Resource Limits (production)
COMPOSE_PROJECT_NAME=rma-production
```

### Step 3: Configure Reverse Proxy (Nginx)

Create `/etc/nginx/sites-available/rma-demo`:

```nginx
upstream frontend {
    server localhost:3000;
}

upstream rag_service {
    server localhost:8102;
}

upstream n8n {
    server localhost:5678;
}

upstream mcp_server {
    server localhost:8105;
}

server {
    listen 80;
    server_name rma-demo.riverside.org.uk;

    # Redirect to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name rma-demo.riverside.org.uk;

    # SSL configuration
    ssl_certificate /etc/letsencrypt/live/rma-demo.riverside.org.uk/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/rma-demo.riverside.org.uk/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # Frontend
    location / {
        proxy_pass http://frontend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # RAG Service API
    location /api/rag {
        proxy_pass http://rag_service;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 60s;
    }

    # n8n (restrict to internal network)
    location /n8n {
        proxy_pass http://n8n;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;

        # Restrict access
        allow 10.0.0.0/8;  # Internal network
        deny all;
    }

    # MCP Server (restrict to internal network)
    location /mcp {
        proxy_pass http://mcp_server;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-API-Key $http_x_api_key;

        # Restrict access
        allow 10.0.0.0/8;  # Internal network
        deny all;
    }
}
```

Enable site:

```bash
sudo ln -s /etc/nginx/sites-available/rma-demo /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### Step 4: Deploy to Production

```bash
# Pull latest images (or build)
docker-compose build

# Start services with production config
docker-compose up -d

# Wait for initialization
sleep 60

# Verify health
docker-compose ps
docker-compose logs --tail=100

# Check all endpoints
curl https://rma-demo.riverside.org.uk/health
```

### Step 5: Gradual Rollout (A/B Testing)

If you want to gradually roll out LangGraph:

**Option A: Percentage-based rollout**

Edit `services/rag-service/app.py`:

```python
import random

USE_LANGGRAPH_PERCENTAGE = int(os.getenv("USE_LANGGRAPH_PERCENTAGE", "50"))

@app.post("/agentic-query")
def agentic_query_endpoint(request: AgenticQueryRequest):
    # 50% traffic to LangGraph, 50% to legacy
    use_langgraph = random.randint(1, 100) <= USE_LANGGRAPH_PERCENTAGE

    if use_langgraph and rag_service.agent_app is not None:
        return agentic_query_langgraph(request)
    else:
        return agentic_query_legacy(request)
```

Set in `.env`:

```ini
USE_LANGGRAPH_PERCENTAGE=10  # Start with 10%
```

Gradually increase: 10% → 25% → 50% → 75% → 100%

**Option B: User-based rollout**

```python
# Beta users get LangGraph
BETA_USER_IDS = set(os.getenv("BETA_USER_IDS", "").split(","))

@app.post("/agentic-query")
def agentic_query_endpoint(request: AgenticQueryRequest, user_id: str = Header(None)):
    use_langgraph = user_id in BETA_USER_IDS
    # ... route to implementation
```

### Step 6: Monitor Initial Deployment

First 24 hours after deployment:

```bash
# Monitor logs continuously
docker-compose logs -f rag-service | grep -E "(ERROR|WARNING|Exception)"

# Monitor resource usage
watch -n 5 'docker stats --no-stream'

# Check error rates
docker-compose exec rag-service sh -c '
grep -c "ERROR" /var/log/app.log
'

# Monitor response times
# (Use your monitoring solution - Prometheus, Datadog, etc.)
```

---

## Rollback Procedures

### Scenario 1: Critical Bug Found

**Fast Rollback (< 5 minutes):**

```bash
# Set feature flag to disable LangGraph
echo "USE_LANGGRAPH=false" >> .env

# Restart service
docker-compose restart rag-service

# Verify legacy mode
curl https://rma-demo.riverside.org.uk/health | jq .langgraph_enabled
# Should return: false
```

### Scenario 2: Performance Issues

**Gradual Rollback:**

```bash
# Reduce percentage
sed -i 's/USE_LANGGRAPH_PERCENTAGE=.*/USE_LANGGRAPH_PERCENTAGE=25/' .env
docker-compose restart rag-service

# If still issues, reduce further
sed -i 's/USE_LANGGRAPH_PERCENTAGE=.*/USE_LANGGRAPH_PERCENTAGE=0/' .env
docker-compose restart rag-service
```

### Scenario 3: Complete Rollback to Previous Version

```bash
# Stop services
docker-compose down

# Checkout previous version
git checkout tags/v0.9.0-pre-langgraph

# Rebuild and restart
docker-compose build
docker-compose up -d

# Verify
./validate_migration.sh
```

### Rollback Decision Matrix

| Severity | Threshold | Action |
|----------|-----------|--------|
| Critical | Any production outage | Immediate rollback |
| High | Error rate > 5% | Rollback within 1 hour |
| Medium | Performance degradation > 50% | Reduce LangGraph percentage |
| Low | Confidence scores < 0.5 | Monitor and investigate |

---

## Monitoring & Observability

### Key Metrics to Track

**1. Service Health**

```bash
# Health check endpoint
curl https://rma-demo.riverside.org.uk/health

{
  "status": "healthy",
  "langgraph_enabled": true,
  "ollama_connected": true,
  "chromadb_connected": true,
  "mcp_server_connected": true
}
```

**2. Performance Metrics**

Track in your monitoring system:

- Response time (P50, P95, P99)
- Request rate (requests/second)
- Error rate (errors/total requests)
- Confidence scores (average, distribution)
- Tool execution time
- LangGraph graph execution time

**3. Resource Metrics**

```bash
# CPU, Memory, Disk usage
docker stats --no-stream

# ChromaDB storage
du -sh /var/lib/docker/volumes/rma-production_chroma_data

# Ollama model memory
docker-compose exec ollama nvidia-smi
```

**4. Application Metrics**

```bash
# Query complexity distribution
docker-compose exec rag-service sh -c '
grep "complexity" /var/log/app.log | jq -r .complexity | sort | uniq -c
'

# Tool usage statistics
docker-compose exec rag-service sh -c '
grep "tool_call" /var/log/app.log | jq -r .tool_name | sort | uniq -c
'
```

### Alerting Rules

Configure alerts for:

| Metric | Threshold | Severity |
|--------|-----------|----------|
| Error rate | > 5% | Critical |
| P95 response time | > 5s | High |
| Memory usage | > 90% | High |
| ChromaDB connection failures | > 3/min | Critical |
| Ollama model load failures | Any | Critical |
| Confidence score avg | < 0.6 | Medium |

### Logging Best Practices

Structured logging format:

```json
{
  "timestamp": "2025-10-24T12:00:00Z",
  "level": "INFO",
  "service": "rag-service",
  "implementation": "langgraph",
  "query_id": "uuid-here",
  "complexity": "multi_step_research",
  "response_time_ms": 1234,
  "confidence": 0.87,
  "tools_used": ["calculate", "extract_threshold"]
}
```

---

## Post-Deployment Tasks

### Day 1

- [ ] Monitor error logs every 2 hours
- [ ] Check performance dashboard
- [ ] Verify backup systems running
- [ ] Send deployment success notification
- [ ] Document any issues found

### Week 1

- [ ] Review performance metrics daily
- [ ] Analyze user feedback
- [ ] Check confidence score trends
- [ ] Review tool usage patterns
- [ ] Weekly team retrospective

### Month 1

- [ ] Full performance review
- [ ] User satisfaction survey
- [ ] Cost analysis (compute resources)
- [ ] Plan optimizations
- [ ] Update documentation

### Ongoing

- [ ] Weekly monitoring review
- [ ] Monthly performance benchmarks
- [ ] Quarterly security audits
- [ ] Regular dependency updates
- [ ] Continuous improvement planning

---

## Deployment Sign-Off

**Deployment Approval:**

- [ ] Staging tests passed
- [ ] Performance benchmarks acceptable
- [ ] Security review completed
- [ ] Documentation updated
- [ ] Team trained
- [ ] Rollback plan tested
- [ ] Monitoring configured
- [ ] Approved by: ___________________
- [ ] Date: ___________________

**Post-Deployment Verification:**

- [ ] All services running
- [ ] No critical errors in logs
- [ ] Performance metrics within SLA
- [ ] User acceptance verified
- [ ] Verified by: ___________________
- [ ] Date: ___________________

---

## Support Contacts

**Development Team:**
- Lead Developer: [name@email.com]
- DevOps: [devops@email.com]

**On-Call:**
- Primary: [on-call-primary@email.com]
- Secondary: [on-call-secondary@email.com]

**Escalation:**
- Manager: [manager@email.com]
- CTO: [cto@email.com]

---

## Additional Resources

- **Quick Start Guide**: `QUICK_START_GUIDE.md`
- **Implementation Summary**: `IMPLEMENTATION_COMPLETE.md`
- **Migration Plan**: `MIGRATION_PLAN_LANGGRAPH_N8N.md`
- **n8n Workflows Guide**: `PHASE2_PHASE3_COMPLETE.md`

---

**Document Version:** 1.0
**Last Updated:** October 24, 2025
**Next Review:** November 24, 2025
