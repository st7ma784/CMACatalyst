# CMA System - Local GPU Development Setup

This directory contains the complete setup for running the CMA Case Management System locally with GPU acceleration, Ollama, and n8n integration.

## 🚀 Quick Start

```bash
# Start the full system with GPU support
./scripts/local-gpu-deploy.sh

# Stop all services
./scripts/local-stop.sh
```

## 🔧 Local Development Configuration

### Services Included:
- **PostgreSQL** (port 5432) - Main database
- **Redis** (port 6379) - Caching and session management
- **Ollama** (port 11434) - Local LLM inference with GPU support
- **n8n** (port 5678) - Workflow automation and AI orchestration
- **MinIO** (port 9000/9001) - Object storage for documents
- **RabbitMQ** (port 5672/15672) - Message queue for document processing
- **CMA Chatbot** (port 8001) - AI assistant with Ollama integration
- **Document Services** (ports 3001/3002) - File processing and OCR
- **Main App** (port 5000) - Backend API
- **React Frontend** (port 3000) - Development server
- **Nginx** (port 80) - Reverse proxy

### 🤖 AI Models

The system automatically downloads these Ollama models:
- `llama2:7b` - General conversation and advice
- `codellama:7b` - Code analysis and generation
- `mistral:7b` - Alternative high-quality model
- `nomic-embed-text` - Text embeddings

### 🌐 Access URLs

| Service | URL | Credentials |
|---------|-----|-------------|
| Main Application | http://localhost | - |
| AI Chatbot API | http://localhost:8001 | - |
| React Frontend | http://localhost:3000 | - |
| Ollama API | http://localhost:11434 | - |
| n8n Workflows | http://localhost:5678 | admin/password |
| MinIO Console | http://localhost:9001 | minioadmin/minioadmin |
| RabbitMQ Management | http://localhost:15672 | admin/password |

## 🔧 Development Commands

```bash
# View logs for all services
docker-compose -f docker-compose.local.yml logs -f

# View logs for specific service
docker-compose -f docker-compose.local.yml logs -f chatbot

# Restart a specific service
docker-compose -f docker-compose.local.yml restart chatbot

# Shell into a container
docker-compose -f docker-compose.local.yml exec chatbot bash

# Check service status
docker-compose -f docker-compose.local.yml ps
```

## 🧪 Testing the AI Assistant

```bash
# Basic chat test
curl -X POST http://localhost:8001/chat \
  -H 'Content-Type: application/json' \
  -d '{"message": "Hello, I need help with debt advice"}'

# Chat with client context
curl -X POST http://localhost:8001/chat \
  -H 'Content-Type: application/json' \
  -d '{
    "message": "What are my options for dealing with credit card debt?",
    "client_id": "123",
    "context": {"total_debt": 15000, "monthly_income": 2500}
  }'

# Check available models
curl http://localhost:8001/models

# Health check
curl http://localhost:8001/health
```

## 🔄 n8n Workflow Integration

### Pre-configured Workflows:
1. **Document Processing** - OCR → AI Analysis → Storage
2. **AI Assistant** - Context retrieval → LLM generation → Logging

### Creating Custom Workflows:
1. Access n8n at http://localhost:5678
2. Login with admin/password
3. Import workflows from `./n8n/workflows/`
4. Customize for your needs

### Webhook URLs:
- Document processing: `http://localhost:5678/webhook/document-upload`
- AI assistant: `http://localhost:5678/webhook/ai-assistant`

## 🎯 GPU Configuration

### Requirements:
- NVIDIA GPU with CUDA support
- NVIDIA drivers installed
- NVIDIA Container Toolkit installed
- Docker configured with NVIDIA runtime

### Verification:
```bash
# Test GPU access in Docker
docker run --rm --gpus all nvidia/cuda:11.0-base nvidia-smi

# Check Ollama GPU usage
docker-compose -f docker-compose.local.yml exec ollama nvidia-smi
```

### CPU Fallback:
If GPU is not available, the system will automatically fall back to CPU mode. Performance will be slower but functional.

## 📁 Directory Structure

```
/home/user/Documents/catalyst/CascadeProjects/windsurf-project/
├── docker-compose.local.yml     # Local development configuration
├── Dockerfile.chatbot.local     # Chatbot with Ollama integration
├── nginx.conf.local             # Local nginx configuration
├── chatbot/
│   ├── main_local.py           # Enhanced chatbot with Ollama
│   └── requirements.txt        # Updated dependencies
├── n8n/
│   └── workflows/              # Pre-configured n8n workflows
├── scripts/
│   ├── local-gpu-deploy.sh     # Main deployment script
│   ├── local-stop.sh           # Stop all services
│   └── ollama-init.sh          # Ollama model initialization
└── uploads/                    # File upload directory
```

## 🐛 Troubleshooting

### Common Issues:

1. **Port conflicts**: Check if required ports are free
   ```bash
   lsof -i :5432  # Check PostgreSQL port
   ```

2. **GPU not detected**: Verify NVIDIA Container Toolkit
   ```bash
   docker run --rm --gpus all nvidia/cuda:11.0-base nvidia-smi
   ```

3. **Models not downloading**: Check Ollama logs
   ```bash
   docker-compose -f docker-compose.local.yml logs ollama
   ```

4. **Services not starting**: Check individual service logs
   ```bash
   docker-compose -f docker-compose.local.yml logs [service-name]
   ```

### Performance Optimization:
- Ensure sufficient RAM (16GB+ recommended)
- Use SSD storage for Docker volumes
- Close unnecessary applications to free GPU memory
- Monitor GPU usage with `nvidia-smi`

## 🔒 Security Notes

This configuration is for **development only**. For production:
- Change default passwords
- Enable SSL/TLS
- Restrict network access
- Use proper authentication
- Regular security updates

## 📚 Documentation

- [Ollama Documentation](https://ollama.ai/docs)
- [n8n Documentation](https://docs.n8n.io/)
- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)

## 🎯 Next Steps

1. **Customize AI Models**: Add specialized models for debt advice
2. **Extend Workflows**: Create complex n8n automation workflows
3. **Frontend Integration**: Connect React frontend to AI services
4. **Monitoring**: Add Grafana dashboards for local development
5. **Testing**: Implement comprehensive integration tests