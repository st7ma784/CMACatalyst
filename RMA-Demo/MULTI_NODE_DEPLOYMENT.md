# 🚀 Multi-Node Deployment Guide

## Architecture Overview

Your RMA system is now designed for **3-tier deployment**:

```
┌─────────────────────────────────────────────────────────────┐
│                     TIER 1: GPU WORKER                      │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  vLLM (GPU 0) + Ollama Vision (GPU 1)               │   │
│  │  Ports: 8000, 11434, 11435                          │   │
│  │  Resources: 3x Tesla P100 (16GB each)               │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────┐
│                    TIER 2: COMPUTE WORKER                   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Services: RAG, NER, Doc Processor, Notes, Upload    │   │
│  │  Ports: 8100-8108, 3000                             │   │
│  │  Resources: CPU-intensive workloads                  │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────┐
│                   TIER 3: STORAGE WORKER                    │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Redis (RAM disk) + PostgreSQL + Neo4j + ChromaDB   │   │
│  │  Ports: 6379, 5432, 7474, 7687, 8500                │   │
│  │  Resources: SSD/RAM disk optimized                   │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## Prerequisites

### GPU Worker Node
- ✅ 3x NVIDIA Tesla P100 GPUs (16GB each)
- ✅ NVIDIA Driver 550.163.01
- ✅ CUDA 12.4
- ✅ nvidia-docker runtime configured
- 50GB+ free disk space
- Docker 24.0+
- Docker Compose v2

### Storage Worker Node
- **Recommended**: 
  - 32GB+ RAM (for RAM disk caching)
  - 500GB+ SSD storage
  - Fast I/O (NVMe preferred)
- **Minimum**:
  - 16GB RAM
  - 200GB SSD storage
- Docker 24.0+
- Docker Compose v2

---

## Quick Deployment

### Step 1: Prepare Storage Paths (Storage Worker)

```bash
# Create storage directories
sudo mkdir -p /mnt/storage/rma/{postgres,neo4j/{data,logs,import,plugins},chromadb,backups/{redis,postgres,neo4j,chromadb}}

# Set permissions
sudo chown -R $(id -u):$(id -g) /mnt/storage/rma

# Optional: Mount RAM disk for Redis
sudo mount -t tmpfs -o size=10G tmpfs /mnt/storage/rma/redis-ramdisk
```

### Step 2: Create Docker Network (Run on any node)

```bash
docker network create rma-network
```

### Step 3: Deploy Storage Services (Storage Worker)

```bash
cd /data/CMACatalyst/RMA-Demo

# Update passwords in docker-compose.storage.yml FIRST!
# Change these environment variables:
#   - POSTGRES_PASSWORD
#   - NEO4J_AUTH

# Deploy storage tier
docker-compose -f docker-compose.storage.yml up -d

# Verify all services are healthy
docker-compose -f docker-compose.storage.yml ps
docker-compose -f docker-compose.storage.yml logs -f
```

**Expected startup time**: 2-3 minutes

### Step 4: Deploy GPU Services (GPU Worker)

```bash
cd /data/CMACatalyst/RMA-Demo

# Deploy vLLM + Vision services
docker-compose -f docker-compose.vllm.yml up -d vllm vllm-adapter ollama-vision

# Watch logs (first run downloads models ~7GB, takes 15-20 minutes)
docker-compose -f docker-compose.vllm.yml logs -f vllm
```

**Expected startup time**: 
- First run: 15-25 minutes (model download)
- Subsequent runs: 1-2 minutes

### Step 5: Deploy Application Services (Compute Worker or GPU Worker)

```bash
cd /data/CMACatalyst/RMA-Demo

# Update connection strings in docker-compose.vllm.yml to point to storage worker
# Example: POSTGRES_HOST: "storage-worker-hostname:5432"
#          REDIS_URL: "redis://storage-worker-hostname:6379"

# Deploy application services
docker-compose -f docker-compose.vllm.yml up -d

# Verify
docker-compose -f docker-compose.vllm.yml ps
```

---

## Configuration for Multi-Node Setup

### GPU Worker → Storage Worker Connection

Edit `docker-compose.vllm.yml` to point services to storage worker:

```yaml
services:
  rag-service:
    environment:
      POSTGRES_HOST: "storage-worker-ip-or-hostname"
      POSTGRES_PORT: "5432"
      REDIS_URL: "redis://storage-worker-ip-or-hostname:6379"
      NEO4J_URI: "bolt://storage-worker-ip-or-hostname:7687"
      CHROMADB_HOST: "storage-worker-ip-or-hostname"
      CHROMADB_PORT: "8500"
```

### Network Options

#### Option 1: Docker Swarm (Recommended for Production)
```bash
# Initialize swarm on manager node
docker swarm init

# Join workers
docker swarm join --token <token> manager-ip:2377

# Deploy as stack
docker stack deploy -c docker-compose.vllm.yml rma-gpu
docker stack deploy -c docker-compose.storage.yml rma-storage
```

#### Option 2: External Network Bridge
```bash
# Create network on each node
docker network create --driver bridge --subnet 10.10.0.0/16 rma-network

# Services connect via host IPs
```

#### Option 3: Host Network Mode
```yaml
services:
  service-name:
    network_mode: host
```

---

## Verification Commands

### GPU Worker Health Checks

```bash
# Check GPU utilization
nvidia-smi

# Check vLLM
curl http://localhost:8000/health
curl http://localhost:8000/v1/models

# Check adapter
curl http://localhost:11434/api/tags

# Check vision
curl http://localhost:11435/api/tags
```

### Storage Worker Health Checks

```bash
# Redis
docker exec rma-redis-storage redis-cli ping
docker exec rma-redis-storage redis-cli INFO memory

# PostgreSQL
docker exec rma-postgres-storage pg_isready -U rma_user

# Neo4j
curl http://localhost:7474

# ChromaDB
curl http://localhost:8500/api/v1/heartbeat
```

### Application Services Health

```bash
# RAG Service
curl http://localhost:8102/health

# Notes Service
curl http://localhost:8100/health

# NER Service
curl http://localhost:8108/health

# Frontend
curl http://localhost:3000
```

---

## Performance Tuning

### Redis (RAM Disk Configuration)

**Current**: Redis uses 10GB tmpfs (RAM disk) with SSD backup

**Benefits**:
- ⚡ ~50-100x faster than disk I/O
- Sub-millisecond latency
- Perfect for cache/session data

**Trade-offs**:
- Data lost on reboot (use backup service)
- Requires sufficient RAM

**Alternative (SSD-only)**:
```yaml
volumes:
  - redis-data:/data  # Persistent SSD storage
```

### PostgreSQL Tuning

**Current settings** (optimized for SSD):
- `shared_buffers: 4GB`
- `effective_cache_size: 12GB`
- `random_page_cost: 1.1` (SSD)
- `effective_io_concurrency: 200` (SSD)

**For NVMe**, change to:
```yaml
environment:
  POSTGRES_RANDOM_PAGE_COST: "1.0"
  POSTGRES_EFFECTIVE_IO_CONCURRENCY: "300"
```

### GPU Memory Distribution

**Current allocation**:
- GPU 0 (vLLM): 90% utilization (14.4GB)
- GPU 1 (Ollama Vision): Auto-managed
- GPU 2: Available for scaling

**To use GPU 2 for additional vLLM instance**:
```yaml
vllm-2:
  image: vllm/vllm-openai:v0.3.0
  environment:
    CUDA_VISIBLE_DEVICES: "2"
```

---

## Monitoring

### Resource Usage

```bash
# GPU Worker
watch -n 1 nvidia-smi

# Storage Worker - Disk I/O
iostat -x 1

# Storage Worker - Memory
free -h
watch -n 1 'docker stats --no-stream'
```

### Service Logs

```bash
# GPU Worker
docker-compose -f docker-compose.vllm.yml logs -f vllm vllm-adapter ollama-vision

# Storage Worker
docker-compose -f docker-compose.storage.yml logs -f redis postgres neo4j chromadb

# Application Services
docker-compose -f docker-compose.vllm.yml logs -f rag-service notes-service ner-service
```

---

## Backup & Recovery

### Automated Backups

Backup service runs **hourly** and keeps **7 days** of history.

```bash
# Check backup status
docker logs rma-backup-service

# Manual backup trigger
docker exec rma-backup-service sh /backup.sh

# List backups
ls -lh /mnt/storage/rma/backups/
```

### Recovery

```bash
# PostgreSQL restore
docker exec -i rma-postgres-storage pg_restore -U rma_user -d rma_db -c /backup/rma_db_TIMESTAMP.dump

# Neo4j restore
docker exec rma-neo4j-storage neo4j-admin database load neo4j --from-path=/backup/neo4j_TIMESTAMP.dump

# Redis restore (if using persistence)
docker cp /mnt/storage/rma/backups/redis/dump_TIMESTAMP.rdb rma-redis-storage:/data/dump.rdb
docker restart rma-redis-storage
```

---

## Troubleshooting

### GPU Not Detected

```bash
# Check nvidia-docker runtime
docker run --rm --gpus all nvidia/cuda:12.4.0-base-ubuntu22.04 nvidia-smi

# If fails, restart Docker
sudo systemctl restart docker
```

### Storage Worker - Disk Full

```bash
# Check disk usage
df -h /mnt/storage

# Clean old backups
find /mnt/storage/rma/backups -type f -mtime +7 -delete

# Clean Docker
docker system prune -a
```

### Service Not Connecting to Storage

```bash
# Check network connectivity
docker exec rma-rag-service ping storage-worker-hostname

# Check firewall
sudo ufw allow 5432,6379,7474,7687,8500/tcp

# Verify storage services are listening
netstat -tlnp | grep -E '5432|6379|7474|7687|8500'
```

---

## Scaling Options

### Horizontal Scaling

**Add more GPU workers**:
```bash
# Clone compose on new GPU worker
# Update service names (vllm-2, vllm-adapter-2)
# Use different port mappings (8001, 11436)
```

**Load balancer** (nginx/traefik) distributes requests across workers.

### Vertical Scaling

**Add GPUs to vLLM**:
```yaml
environment:
  TENSOR_PARALLEL_SIZE: "2"  # Use 2 GPUs
  CUDA_VISIBLE_DEVICES: "0,1"
```

---

## Production Checklist

### Security
- [ ] Change all default passwords in compose files
- [ ] Enable SSL/TLS for PostgreSQL, Neo4j
- [ ] Configure firewall rules (UFW/iptables)
- [ ] Use Docker secrets for sensitive data
- [ ] Enable authentication on Redis

### Performance
- [ ] Mount storage volumes on SSDs
- [ ] Configure RAM disk for Redis
- [ ] Tune PostgreSQL for your workload
- [ ] Monitor GPU utilization
- [ ] Set up proper backups

### Reliability
- [ ] Configure restart policies
- [ ] Set up monitoring (Prometheus/Grafana)
- [ ] Test backup/recovery procedures
- [ ] Document runbooks
- [ ] Set up alerting

---

## Quick Reference Commands

```bash
# Start everything
docker-compose -f docker-compose.storage.yml up -d    # Storage worker
docker-compose -f docker-compose.vllm.yml up -d       # GPU worker

# Stop everything
docker-compose -f docker-compose.vllm.yml down
docker-compose -f docker-compose.storage.yml down

# View logs
docker-compose -f docker-compose.vllm.yml logs -f
docker-compose -f docker-compose.storage.yml logs -f

# Restart service
docker-compose -f docker-compose.vllm.yml restart vllm

# Check health
docker-compose -f docker-compose.vllm.yml ps
docker-compose -f docker-compose.storage.yml ps
```

---

## Next Steps

1. ✅ Deploy storage tier first
2. ✅ Deploy GPU services second
3. ✅ Deploy application services last
4. ✅ Verify all health checks pass
5. ✅ Run performance tests
6. ✅ Set up monitoring
7. ✅ Configure automated backups

**Estimated total deployment time**: 30-40 minutes (first run)
