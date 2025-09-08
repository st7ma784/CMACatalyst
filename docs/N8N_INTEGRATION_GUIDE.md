# N8N Workflow System Integration Guide

This guide explains how to integrate the N8N workflow system with your main Cascade application.

## 🚀 Quick Start

### 1. Deploy the N8N System
```bash
cd /path/to/windsurf-project
./deploy-n8n.sh
```

### 2. Access N8N Interface
- URL: http://localhost:5678
- Username: `admin`
- Password: `workflow_admin_2024`

## 🔗 API Integration

The MCP server provides REST endpoints to trigger workflows from your main application:

### Base URL
```
http://localhost:3001/api/workflows
```

### Available Endpoints

#### 1. Document Audit Workflow
```javascript
// Trigger document audit
const response = await fetch('http://localhost:3001/api/workflows/document-audit', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer mcp_workflow_key_2024'
  },
  body: JSON.stringify({
    documentId: 'doc_123',
    documentPath: '/uploads/document.pdf',
    clientId: 'client_456',
    priority: 'high'
  })
});

const result = await response.json();
console.log('Workflow ID:', result.workflowId);
```

#### 2. QR SFS Generation
```javascript
// Generate QR code and SFS document
const response = await fetch('http://localhost:3001/api/workflows/qr-sfs', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer mcp_workflow_key_2024'
  },
  body: JSON.stringify({
    clientId: 'client_456',
    advisorId: 'advisor_789',
    documentType: 'fact_find',
    sfsTemplateId: 'template_basic'
  })
});

const result = await response.json();
console.log('QR Code:', result.qrCode);
console.log('SFS Document:', result.sfsDocument);
```

#### 3. Dashboard Analytics
```javascript
// Generate dashboard analytics
const response = await fetch('http://localhost:3001/api/workflows/dashboard-analytics', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer mcp_workflow_key_2024'
  },
  body: JSON.stringify({
    advisorId: 'advisor_789',
    timeframe: '30days',
    includeCharts: true,
    includeAlerts: true
  })
});

const result = await response.json();
console.log('Analytics:', result.analytics);
```

#### 4. Workflow Status Check
```javascript
// Check workflow execution status
const response = await fetch(`http://localhost:3001/api/workflows/status/${workflowId}`, {
  headers: {
    'Authorization': 'Bearer mcp_workflow_key_2024'
  }
});

const status = await response.json();
console.log('Status:', status.status); // 'running', 'completed', 'failed'
```

## 📊 Service Architecture

### Services Overview
- **N8N**: Workflow orchestration engine
- **Ollama**: Local LLaMA AI model serving
- **MCP Server**: RESTful API bridge to N8N
- **ChromaDB**: Vector database for embeddings
- **Redis**: Caching and session management
- **OCR Services**: Document text extraction (Node.js + Python)

### Network Configuration
```yaml
# All services run on cma-n8n-network
N8N:           localhost:5678
MCP Server:    localhost:3001
Ollama:        localhost:11434
ChromaDB:      localhost:8001
Redis:         localhost:6380
OCR (Node):    localhost:8080
OCR (Python):  localhost:8082
```

## 🔧 Environment Configuration

### Required Environment Variables
Copy `.env.n8n` to `.env` and configure:

```bash
# N8N Authentication
N8N_BASIC_AUTH_USER=admin
N8N_BASIC_AUTH_PASSWORD=your_secure_password

# API Keys
MCP_API_KEY=your_mcp_api_key
API_KEY=your_main_app_api_key

# AI Configuration
OLLAMA_MODEL=llama3.1:8b

# Redis Password
REDIS_PASSWORD=your_redis_password
```

## 📥 Workflow Templates

### 1. Document Audit Workflow
**Triggers**: Document upload, manual audit request
**Process**:
1. Extract document metadata
2. OCR text extraction
3. AI-powered document classification
4. FCA compliance checking
5. Generate audit report
6. Store results in database

**Outputs**: Audit report, compliance score, recommendations

### 2. QR SFS Generator Workflow
**Triggers**: Client onboarding, document request
**Process**:
1. Fetch client information
2. Generate unique QR code
3. Create SFS document from template
4. AI-powered content validation
5. Generate PDF with QR code
6. Send notifications

**Outputs**: QR code, SFS PDF, tracking URLs

### 3. Dashboard Analytics Workflow
**Triggers**: Scheduled (daily/weekly), manual request
**Process**:
1. Fetch data from multiple sources
2. AI-powered trend analysis
3. Generate charts and KPIs
4. Create alert notifications
5. Cache results for performance

**Outputs**: Analytics data, charts, alerts

## 🔍 Monitoring & Debugging

### View All Service Logs
```bash
docker-compose -f docker-compose.n8n.yml logs -f
```

### View Specific Service Logs
```bash
# N8N workflow logs
docker-compose -f docker-compose.n8n.yml logs -f n8n

# MCP server logs
docker-compose -f docker-compose.n8n.yml logs -f mcp-server

# Ollama AI logs
docker-compose -f docker-compose.n8n.yml logs -f ollama
```

### Health Check Endpoints
```bash
# Check all services
curl http://localhost:3001/health

# Check N8N
curl -u admin:workflow_admin_2024 http://localhost:5678/healthz

# Check Ollama
curl http://localhost:11434/api/version

# Check OCR services
curl http://localhost:8080/health
curl http://localhost:8082/health
```

## 🔐 Security Configuration

### API Authentication
All MCP endpoints require Bearer token authentication:
```javascript
headers: {
  'Authorization': 'Bearer mcp_workflow_key_2024'
}
```

### N8N Access Control
- Basic auth enabled by default
- Webhook endpoints secured with secrets
- Environment-based credential management

### Network Security
- Services isolated in Docker network
- No external API dependencies (local AI only)
- Redis password protection

## 📈 Performance Optimization

### Caching Strategy
- Redis caching for workflow results
- OCR results cached by file hash
- AI responses cached for repeat queries

### Resource Limits
```yaml
# Recommended Docker limits
services:
  ollama:
    deploy:
      resources:
        limits:
          memory: 8G
        reservations:
          memory: 4G
```

### Scaling Considerations
- OCR services can be horizontally scaled
- Redis clustering for high availability
- N8N supports queue-based execution

## 🛠️ Troubleshooting

### Common Issues

#### 1. Ollama Model Download Fails
```bash
# Manually pull the model
docker exec cascade-ollama ollama pull llama3.1:8b
```

#### 2. N8N Workflows Not Importing
```bash
# Check N8N logs and manually import via UI
docker-compose -f docker-compose.n8n.yml logs n8n
```

#### 3. MCP Server Connection Issues
```bash
# Verify Redis connection
docker exec cascade-redis redis-cli ping

# Check MCP server health
curl http://localhost:3001/health
```

#### 4. OCR Processing Failures
```bash
# Test OCR services
curl -F "file=@test.pdf" http://localhost:8080/ocr/extract
curl -F "file=@test.pdf" http://localhost:8082/ocr/extract
```

## 🚀 Production Deployment

### Environment Preparation
1. Update `.env` with production credentials
2. Configure external Redis for clustering
3. Set up persistent volume mounts
4. Configure backup strategies

### Security Hardening
1. Change default passwords
2. Enable HTTPS with certificates
3. Configure firewall rules
4. Set up log aggregation

### Monitoring Setup
1. Configure Prometheus metrics
2. Set up Grafana dashboards
3. Configure alerting rules
4. Monitor resource usage

## 📚 Additional Resources

- [N8N Documentation](https://docs.n8n.io)
- [Ollama Model Library](https://ollama.ai/library)
- [ChromaDB Documentation](https://docs.trychroma.com)
- [Redis Configuration](https://redis.io/documentation)

## 🆘 Support

For issues with the workflow system:
1. Check service logs first
2. Verify environment configuration
3. Test individual service health
4. Review N8N workflow execution logs

Remember: This system runs entirely locally with no external API dependencies for maximum security and control.
