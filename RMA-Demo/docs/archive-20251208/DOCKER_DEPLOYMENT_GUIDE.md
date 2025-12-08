# Docker Deployment Guide - Neo4j Graph UI

## Overview

Complete Docker deployment of the CMACatalyst RMA Demo with Neo4j Graph UI, including all backend services, databases, and the React/Next.js frontend.

## Quick Start (One Command)

```bash
cd /data/CMACatalyst/RMA-Demo
./deploy-docker.sh
```

Then open: **http://localhost:3000/graph**

## What Gets Deployed

### Frontend
- **Next.js 14** React application
- **Port 3000** - Main dashboard with Neo4j Graph UI
- Routes: `/graph`, `/graph/extract`, `/graph/ingest`, `/graph/compare`

### Graph Database
- **Neo4j 5.15** - Knowledge graph storage
- **Port 7474** - Web browser UI
- **Port 7687** - Bolt protocol (API)
- Volumes: neo4j_data, neo4j_logs

### AI/LLM Services
- **Ollama** - Vision models (port 11434)
  - GPU 0 (if available)
  - llava models for OCR/vision
  
- **vLLM** - Text generation (port 8000)
  - GPU 1 (if available)
  - Llama 3.2 text model

### Core Services
- **NER Graph Service** (port 8108)
  - Entity/relationship extraction
  - Graph storage and retrieval
  - Graph comparison and matching

- **RAG Service** (port 8102)
  - Document ingestion
  - ChromaDB vector storage
  - Semantic search

- **Document Processor** (port 8101)
  - Hybrid Ollama (vision) + vLLM (text)
  - Markdown generation

- **OCR Service** (port 8104)
  - PDF/image to markdown
  - Ollama vision models

### Supporting Services
- **ChromaDB** (port 8005) - Vector database
- **PostgreSQL** (port 5432) - Relational database
- **Redis** (port 6379) - Cache
- **n8n** (port 5678) - Workflow automation
- **MCP Server** (port 8107) - Protocol interface
- **Upload Service** (port 8106) - File management

## Prerequisites

### System Requirements
- **Docker & Docker Compose** installed
- **8+ GB RAM** (16+ GB recommended)
- **20+ GB disk space**
- **NVIDIA GPU** (strongly recommended for Ollama/vLLM)

### Optional
- **NVIDIA Docker Runtime** for GPU support
- **2 GPUs** for optimal performance (Ollama on GPU 0, vLLM on GPU 1)

### Check Prerequisites
```bash
# Check Docker
docker --version
docker-compose --version

# Check GPU (if available)
nvidia-smi

# Check disk space
df -h /data
```

## Deployment Methods

### Method 1: Automated Script (Recommended)
```bash
cd /data/CMACatalyst/RMA-Demo
./deploy-docker.sh
```

**What it does:**
1. Validates prerequisites
2. Checks port availability
3. Builds frontend
4. Creates .env file
5. Stops existing containers
6. Pulls latest images
7. Starts all services
8. Checks service health
9. Shows URLs and next steps

### Method 2: Manual Docker Compose
```bash
cd /data/CMACatalyst/RMA-Demo

# Start services
docker-compose -f docker-compose.vllm.yml up -d

# Or with logs
docker-compose -f docker-compose.vllm.yml up
```

### Method 3: With Specific Services Only
```bash
# Start only Neo4j + NER service
docker-compose -f docker-compose.vllm.yml up -d neo4j ner-graph-service

# Add more services
docker-compose -f docker-compose.vllm.yml up -d frontend

# Check status
docker-compose -f docker-compose.vllm.yml ps
```

## Environment Configuration

### Default .env
```bash
# Neo4j
NEO4J_AUTH=neo4j/changeme-in-production

# vLLM
VLLM_API_KEY=sk-vllm

# JWT
JWT_SECRET=change-this-in-production-jwt-secret

# MCP
MCP_API_KEY=dev-key-change-in-production

# n8n
N8N_USER=admin
N8N_PASSWORD=changeme123

# App
APP_BASE_URL=http://localhost:3000
```

### Production Configuration
Create `.env.production`:
```bash
NEO4J_AUTH=neo4j/your-secure-password
VLLM_API_KEY=your-secure-api-key
JWT_SECRET=your-long-random-secret-key
MCP_API_KEY=your-secure-mcp-key
APP_BASE_URL=https://yourdomain.com
N8N_USER=secure-admin-username
N8N_PASSWORD=very-secure-password
```

## Service Access

### Web Interfaces
| Service | URL | Username | Password |
|---------|-----|----------|----------|
| Dashboard | http://localhost:3000 | - | - |
| Neo4j | http://localhost:7474 | neo4j | changeme-in-production |
| n8n | http://localhost:5678 | admin | changeme123 |

### API Endpoints
| Service | Port | URL |
|---------|------|-----|
| Frontend | 3000 | http://localhost:3000 |
| Notes | 8100 | http://localhost:8100 |
| Doc Processor | 8101 | http://localhost:8101 |
| RAG | 8102 | http://localhost:8102 |
| Upload | 8106 | http://localhost:8103 |
| OCR | 8104 | http://localhost:8104 |
| NER Graph | 8108 | http://localhost:8108 |
| vLLM | 8000 | http://localhost:8000 |
| Ollama | 11434 | http://localhost:11434 |

## Health Checks

### Check All Services
```bash
docker-compose -f docker-compose.vllm.yml ps

# Shows: Up (running) or Exit (stopped/error)
```

### Check Specific Service
```bash
# Frontend health
curl http://localhost:3000/

# NER Service health
curl http://localhost:8108/health

# RAG Service health
curl http://localhost:8102/health

# vLLM health
curl http://localhost:8000/health

# Neo4j health
curl http://localhost:7474
```

### View Logs
```bash
# All services
docker-compose -f docker-compose.vllm.yml logs -f

# Specific service
docker logs -f rma-frontend
docker logs -f rma-ner-graph-service
docker logs -f rma-neo4j

# Recent logs only
docker logs -f --tail 50 rma-frontend
```

## Management Commands

### Stop Services
```bash
# Graceful shutdown
docker-compose -f docker-compose.vllm.yml down

# With volume cleanup (WARNING: deletes data)
docker-compose -f docker-compose.vllm.yml down -v
```

### Restart Services
```bash
# Restart all
docker-compose -f docker-compose.vllm.yml restart

# Restart specific service
docker-compose -f docker-compose.vllm.yml restart rma-frontend
```

### View Running Containers
```bash
docker ps
docker ps -a  # Including stopped containers
```

### Resource Usage
```bash
# Memory and CPU usage
docker stats

# Disk usage by volumes
docker system df

# Detailed volume info
docker volume ls
```

### Build Issues

#### Rebuild without cache
```bash
docker-compose -f docker-compose.vllm.yml build --no-cache
docker-compose -f docker-compose.vllm.yml up -d
```

#### Remove all containers and volumes
```bash
# WARNING: This deletes all data!
docker-compose -f docker-compose.vllm.yml down -v
docker system prune -a
```

## Troubleshooting

### Problem: "Cannot connect to Docker daemon"
```bash
# Start Docker
sudo systemctl start docker

# Or check if running
sudo systemctl status docker

# Add user to docker group (if not admin)
sudo usermod -aG docker $USER
```

### Problem: "Port already in use"
```bash
# Find what's using a port
netstat -tulpn | grep 8108

# Kill process
kill -9 <PID>

# Or use different ports in docker-compose.yml
```

### Problem: "Out of disk space"
```bash
# Check disk usage
du -sh /data

# Clean up Docker
docker system prune -a

# Remove old volumes
docker volume prune
```

### Problem: "GPU not found"
```bash
# Check NVIDIA installation
nvidia-smi

# Install NVIDIA Docker runtime
distribution=$(. /etc/os-release;echo $ID$VERSION_ID)
curl -s -L https://nvidia.github.io/nvidia-docker/gpgkey | sudo apt-key add -
curl -s -L https://nvidia.github.io/nvidia-docker/$distribution/nvidia-docker.list | \
  sudo tee /etc/apt/sources.list.d/nvidia-docker.list
sudo apt-get update && sudo apt-get install -y nvidia-docker2
sudo systemctl restart docker
```

### Problem: "Service fails to start"
```bash
# View detailed logs
docker logs -f rma-<service-name>

# Check service health
docker-compose -f docker-compose.vllm.yml ps

# Try rebuilding
docker-compose -f docker-compose.vllm.yml build rma-<service-name>
docker-compose -f docker-compose.vllm.yml up -d rma-<service-name>
```

### Problem: "Frontend shows blank page"
```bash
# Check build completed
docker logs rma-frontend | grep -E "(compiled|error)"

# Rebuild frontend
docker-compose -f docker-compose.vllm.yml build --no-cache rma-frontend

# Restart frontend
docker-compose -f docker-compose.vllm.yml restart rma-frontend
```

## Performance Tuning

### GPU Configuration
In `docker-compose.vllm.yml`:
```yaml
environment:
  - VLLM_GPU_MEMORY_UTILIZATION=0.9    # 0.7-0.95 recommended
  - VLLM_ENABLE_PREFIX_CACHING=true    # Enable KV cache optimization
```

### Memory Limits
```yaml
deploy:
  resources:
    limits:
      memory: 4G                        # Max memory per container
    reservations:
      memory: 2G                        # Min guaranteed memory
```

### Network Optimization
```bash
# Monitor network
docker stats --no-stream

# Check network connectivity between containers
docker exec rma-frontend curl http://rma-neo4j:7687
```

## Scaling

### Single GPU Setup
Remove CUDA_VISIBLE_DEVICES from compose file:
```bash
# Let both Ollama and vLLM share GPU
# Performance will be lower but still workable
```

### Multi-GPU Setup
Assign GPUs:
```yaml
# Ollama on GPU 0
environment:
  - CUDA_VISIBLE_DEVICES=0

# vLLM on GPU 1
environment:
  - CUDA_VISIBLE_DEVICES=1
```

### Load Balancing
Add multiple instances:
```yaml
services:
  ner-graph-service-1:
    ...
  ner-graph-service-2:
    ...
```

## Backup & Restore

### Backup Neo4j
```bash
# Create backup
docker exec rma-neo4j neo4j-admin dump --database=neo4j /backups/neo4j.dump

# Restore backup
docker exec rma-neo4j neo4j-admin load --from-path=/backups/neo4j.dump --database=neo4j --overwrite-existing=true
```

### Backup Volumes
```bash
# List volumes
docker volume ls

# Backup volume
docker run --rm -v neo4j_data:/data -v /backup:/backup \
  busybox tar czf /backup/neo4j_data.tar.gz -C / data

# Restore volume
docker volume create neo4j_data_restored
docker run --rm -v neo4j_data_restored:/data -v /backup:/backup \
  busybox tar xzf /backup/neo4j_data.tar.gz -C /
```

## Security Best Practices

### 1. Change Default Passwords
```bash
# Edit .env file
NEO4J_AUTH=neo4j/your-very-secure-password
N8N_PASSWORD=your-secure-n8n-password
```

### 2. Use Environment Variables
```bash
# Never commit secrets to git
echo ".env" >> .gitignore
echo ".env.local" >> .gitignore
```

### 3. Firewall Setup
```bash
# Allow only necessary ports
sudo ufw allow 3000    # Frontend
sudo ufw allow 7474    # Neo4j
sudo ufw deny 8108     # NER (internal only)
```

### 4. Network Isolation
```bash
# Create isolated network
docker network create rma-network
# Use in compose: networks: [rma-network]
```

### 5. Regular Updates
```bash
# Pull latest images
docker-compose -f docker-compose.vllm.yml pull

# Rebuild with updates
docker-compose -f docker-compose.vllm.yml build --pull
```

## Monitoring & Logging

### Prometheus Metrics (Optional)
```bash
# Add to docker-compose.yml
prometheus:
  image: prom/prometheus
  ports: ["9090:9090"]
```

### ELK Stack (Optional)
```bash
# Add Elasticsearch, Logstash, Kibana
# For centralized logging
```

### Container Logs
```bash
# JSON format logs
docker logs --follow rma-frontend

# With timestamps
docker logs --timestamps rma-frontend

# Last 100 lines
docker logs --tail 100 rma-frontend
```

## Production Deployment

### 1. Use Docker Swarm or Kubernetes
```bash
# Initialize swarm
docker swarm init

# Deploy stack
docker stack deploy -c docker-compose.vllm.yml rma-demo
```

### 2. Use Reverse Proxy (Nginx)
```bash
# Add Nginx service to compose file
nginx:
  image: nginx:latest
  ports: ["80:80", "443:443"]
```

### 3. Enable HTTPS
```bash
# Use Let's Encrypt with Certbot
# Configure in Nginx
```

### 4. Implement CI/CD
```bash
# GitHub Actions, GitLab CI, or Jenkins
# Auto-build and deploy on push
```

## Next Steps

1. **Verify Deployment**: Check all services are running
   ```bash
   docker ps
   ```

2. **Access Dashboard**: http://localhost:3000/graph

3. **Try Extract Tool**: Upload debt-relief-guide.md

4. **Try Ingest Tool**: Batch upload sample documents

5. **Try Compare Tool**: Compare extracted graphs

6. **Read Documentation**: See README_GRAPH_UI.md

## Support

For issues:
1. Check logs: `docker logs -f rma-<service>`
2. Check health: `docker-compose ps`
3. Review docs: `GRAPH_UI_QUICK_START.md`

---

**Status**: Production-ready Docker deployment  
**Last Updated**: November 5, 2024
