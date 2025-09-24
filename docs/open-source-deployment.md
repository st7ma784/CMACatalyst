# Open-Source Deployment Guide

This guide covers deploying the MordecAI system using only open-source components with no external service dependencies.

## Quick Start

### 1. Prerequisites
```bash
# Install Docker and Docker Compose
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

### 2. Environment Setup
```bash
# Clone repository
git clone <repository-url>
cd windsurf-project

# Copy environment template
cp .env.example .env

# Edit configuration for local deployment
nano .env
```

### 3. Start All Services
```bash
# Build and start all containers
docker-compose up -d

# Wait for services to initialize (first run may take longer for model downloads)
sleep 60

# Verify all services are running
docker-compose ps
```

## Service Architecture

### Core Infrastructure
- **PostgreSQL**: Database for all application data
- **Redis**: Session and cache management
- **MinIO**: S3-compatible object storage
- **RabbitMQ**: Message queue for document processing
- **Nginx**: Reverse proxy and static file serving

### Application Services
- **Frontend**: React application served by Nginx
- **Backend API**: Node.js Express server
- **Chatbot**: Python FastAPI with local LLM
- **Document Inbox**: File upload and email processing
- **OCR Processor**: Document text extraction and classification

### AI/ML Components (All Local)
- **LLM**: Microsoft DialoGPT or compatible Hugging Face model
- **OCR**: Google Tesseract with enhanced preprocessing
- **NLP**: Natural language processing for document classification

## Local Model Configuration

### 1. LLM Options

**Small (Development)**:
```env
LLM_MODEL_NAME=microsoft/DialoGPT-small
# ~117MB, suitable for testing
```

**Medium (Recommended)**:
```env
LLM_MODEL_NAME=microsoft/DialoGPT-medium  
# ~345MB, good balance of performance and size
```

**Large (Production)**:
```env
LLM_MODEL_NAME=microsoft/DialoGPT-large
# ~774MB, best performance
```

**Advanced (Llama 2)**:
```env
LLM_MODEL_NAME=meta-llama/Llama-2-7b-chat-hf
# Requires Hugging Face token and Meta approval
```

### 2. Model Storage
Models are cached locally in Docker volumes:
```bash
# Check model cache usage
docker volume ls | grep models
docker system df -v
```

## Production Deployment

### 1. Hardware Requirements

**Minimum**:
- 4 CPU cores
- 8GB RAM  
- 50GB storage
- 100Mbps network

**Recommended**:
- 8 CPU cores
- 16GB RAM
- 500GB SSD storage
- 1Gbps network

**High Volume**:
- 16 CPU cores
- 32GB RAM
- 1TB NVMe storage
- GPU for LLM acceleration

### 2. Security Hardening

```bash
# Create dedicated user
sudo useradd -r -s /bin/false mordecai
sudo usermod -aG docker mordecai

# Set file permissions
sudo chown -R mordecai:mordecai /opt/mordecai
sudo chmod 750 /opt/mordecai

# Configure firewall
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw deny from any to any port 5432  # Block external DB access
sudo ufw deny from any to any port 6379  # Block external Redis access
```

### 3. SSL Configuration

```bash
# Generate self-signed certificates or use Let's Encrypt
sudo certbot --nginx -d your-domain.com

# Update nginx.conf with SSL settings
```

## AWS/Cloud Deployment (Air-Gapped)

### 1. VPC Setup
```bash
# Create isolated VPC with no internet gateway
aws ec2 create-vpc --cidr-block 10.0.0.0/16
aws ec2 create-subnet --vpc-id vpc-xxx --cidr-block 10.0.1.0/24
```

### 2. EC2 Instance
```bash
# Launch instance in private subnet
aws ec2 run-instances \
  --image-id ami-xxx \
  --instance-type t3.large \
  --subnet-id subnet-xxx \
  --security-group-ids sg-xxx \
  --user-data file://install-docker.sh
```

### 3. Container Registry
Use AWS ECR or private registry:
```bash
# Build and push images to private registry
docker build -t your-registry/cma-app .
docker push your-registry/cma-app
```

## Monitoring Setup

### 1. Prometheus Configuration
```yaml
# prometheus.yml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'cma-services'
    static_configs:
      - targets: 
        - 'app:5000'
        - 'chatbot:8001'
        - 'document-inbox:3001'
        - 'ocr-processor:3002'
```

### 2. Grafana Dashboards
- Service health monitoring
- Document processing metrics  
- AI model performance
- Storage usage tracking

## Backup and Recovery

### 1. Automated Backups
```bash
#!/bin/bash
# backup-script.sh

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/opt/backups/$DATE"

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Backup database
docker exec cma-postgres pg_dump -U postgres cma_db > "$BACKUP_DIR/database.sql"

# Backup MinIO data
docker run --rm -v cma_minio_data:/data -v "$BACKUP_DIR":/backup alpine tar czf /backup/minio-data.tar.gz -C /data .

# Backup configuration
cp -r ./config "$BACKUP_DIR/"
cp docker-compose.yml "$BACKUP_DIR/"

# Compress backup
tar czf "/opt/backups/cma-backup-$DATE.tar.gz" -C "/opt/backups" "$DATE"
rm -rf "$BACKUP_DIR"

echo "Backup completed: cma-backup-$DATE.tar.gz"
```

### 2. Recovery Procedures
```bash
#!/bin/bash
# restore-script.sh

BACKUP_FILE=$1
TEMP_DIR="/tmp/cma-restore"

# Extract backup
mkdir -p "$TEMP_DIR"
tar xzf "$BACKUP_FILE" -C "$TEMP_DIR"

# Stop services
docker-compose down

# Restore database
cat "$TEMP_DIR/database.sql" | docker exec -i cma-postgres psql -U postgres -d cma_db

# Restore MinIO data
docker run --rm -v cma_minio_data:/data -v "$TEMP_DIR":/backup alpine tar xzf /backup/minio-data.tar.gz -C /data

# Restart services
docker-compose up -d

echo "Restore completed from $BACKUP_FILE"
```

## Network Security

### 1. Internal Communication
All services communicate via internal Docker networks:

```yaml
networks:
  cma-internal:
    driver: bridge
    internal: true  # No internet access

  cma-external:
    driver: bridge  # Internet access only for reverse proxy
```

### 2. External Access Points
Only these services need external access:
- **Nginx**: Port 80/443 for web interface
- **SMTP**: Port 25/587 for email processing (optional)

### 3. Firewall Configuration
```bash
# Allow only necessary ports
iptables -A INPUT -p tcp --dport 80 -j ACCEPT
iptables -A INPUT -p tcp --dport 443 -j ACCEPT
iptables -A INPUT -p tcp --dport 25 -j ACCEPT   # If using SMTP
iptables -A INPUT -p tcp --dport 587 -j ACCEPT  # If using SMTP
iptables -A INPUT -j DROP
```

## Compliance Verification

### 1. Data Location Audit
```bash
# Script to verify all data stays local
#!/bin/bash

echo "=== Data Location Audit ==="

echo "Database files:"
docker volume inspect cma_postgres_data | jq '.[0].Mountpoint'

echo "MinIO files:" 
docker volume inspect cma_minio_data | jq '.[0].Mountpoint'

echo "Model cache:"
docker volume inspect cma_chatbot_models | jq '.[0].Mountpoint'

echo "Network connections:"
docker exec cma-app netstat -tuln

echo "=== No external connections should be listed above ==="
```

### 2. External Dependency Check
```bash
# List all external package dependencies
find . -name "package.json" -exec jq '.dependencies | keys[]' {} \;
find . -name "requirements.txt" -exec cat {} \;

# Verify no cloud service SDKs
grep -r "aws-sdk\|anthropic\|openai" . --exclude-dir=node_modules || echo "No cloud SDKs found"
```

### 3. Runtime Verification
```bash
# Monitor for any external network calls during operation
sudo ss -tuln | grep -v '127.0.0.1\|::1\|172.\|192.168.\|10.'
```

## Air-Gapped Deployment

For environments requiring complete network isolation:

### 1. Offline Image Preparation
```bash
# Save all Docker images
docker save $(docker images --format "{{.Repository}}:{{.Tag}}") > cma-images.tar

# Transfer to air-gapped system
scp cma-images.tar user@airgapped-server:

# Load images on air-gapped system  
docker load < cma-images.tar
```

### 2. Model Pre-downloading
```bash
# Download models on internet-connected system
python -c "
from transformers import AutoTokenizer, AutoModelForCausalLM
model = AutoModelForCausalLM.from_pretrained('microsoft/DialoGPT-medium')
tokenizer = AutoTokenizer.from_pretrained('microsoft/DialoGPT-medium')
model.save_pretrained('./models/DialoGPT-medium')
tokenizer.save_pretrained('./models/DialoGPT-medium')
"

# Transfer models to air-gapped system
tar czf models.tar.gz models/
scp models.tar.gz user@airgapped-server:
```

## Verification Checklist

- [ ] All services start successfully with `docker-compose up -d`
- [ ] No external network connections in `netstat -tuln`
- [ ] All health checks pass
- [ ] Document upload and OCR processing works
- [ ] Chatbot responds using local models
- [ ] Case data access through MCP endpoints
- [ ] Email processing saves files locally
- [ ] No AWS/cloud service dependencies in code
- [ ] Backup and restore procedures tested
- [ ] Network monitoring shows no external traffic

This architecture ensures complete data sovereignty while maintaining full functionality through open-source alternatives.