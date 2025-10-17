# RMA-Demo Quick Start Guide

Get the RMA Dashboard running in 5 minutes!

## Prerequisites

- Docker & Docker Compose installed
- 16GB RAM minimum
- (Optional) NVIDIA GPU for faster inference

## Installation

### 1. Initialize the Project

```bash
cd RMA-Demo
./init.sh
```

This will:
- Create configuration files
- Start all Docker services
- Pull required Ollama models (llama3.2, nomic-embed-text)

### 2. Configure API Keys

Edit the `.env` file and add your LlamaParse API key:

```bash
# Get your API key from https://cloud.llamaindex.ai/
LLAMA_PARSE_API_KEY=your-key-here
```

### 3. Add Training Manuals (Optional)

```bash
# Copy your PDF manuals
cp /path/to/manuals/*.pdf ./manuals/

# Ingest them into the RAG system
./scripts/ingest-manuals.sh
```

### 4. Access the Dashboard

Open your browser to: **http://localhost:3000**

Default credentials:
- Username: `admin`
- Password: `admin123`

## Using the Dashboard

### Tab 1: Notes to CoA

Convert advisor notes into client-friendly letters:

1. Enter client name
2. Paste your technical notes
3. Click "Convert to Client Letter"
4. Copy the formatted output

Example notes:
```
Client has £15k unsecured debt across 3 creditors.
Income £1800/mo, expenses £1600/mo, surplus £200/mo.
Recommended DMP over 6 years. Client agreed.
Need bank statements and creditor letters.
```

### Tab 2: Client QR Codes

Generate QR codes for client document uploads:

1. Enter client ID (e.g., CLIENT001)
2. Enter client name
3. Click "Generate QR Code"
4. Download and share with client

Client scans QR code → Gets unique upload page → Uploads documents → Auto-processed

### Tab 3: Ask the Manuals

Query your training manuals using AI:

1. Type your question in the chat
2. Press Send or Enter
3. Get answers with source citations

Example questions:
- "What's the process for debt advice?"
- "How do I calculate disposable income?"
- "What documents are needed for bankruptcy?"

### Tab 4: Documentation

Complete guides accessible in the dashboard:

1. **Using for Money Advice** - How to use features effectively for client work
2. **Local Deployment** - Step-by-step Docker deployment guide
3. **AWS Deployment** - Enterprise deployment with GPU support
4. **Domain Registration** - Set up custom domains with SSL
5. **Troubleshooting** - Quick solutions for common issues

All documentation includes copy-paste commands, real examples, and diagrams!

## Service URLs

- **Frontend**: http://localhost:3000
- **Notes Service**: http://localhost:8100
- **Doc Processor**: http://localhost:8101
- **RAG Service**: http://localhost:8102
- **Upload Service**: http://localhost:8103
- **Ollama API**: http://localhost:11434

## Common Commands

```bash
# View logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f frontend
docker-compose logs -f ollama

# Restart a service
docker-compose restart notes-service

# Stop all services
docker-compose down

# Stop and remove volumes (clean slate)
docker-compose down -v

# Check service status
docker-compose ps

# Pull latest models
docker exec rma-ollama ollama pull llama3.2
```

## Troubleshooting

### Services won't start
```bash
# Check Docker is running
docker ps

# Check logs
docker-compose logs

# Restart everything
docker-compose down && docker-compose up -d
```

### Ollama not responding
```bash
# Check Ollama logs
docker logs rma-ollama

# List models
docker exec rma-ollama ollama list

# Pull models manually
docker exec rma-ollama ollama pull llama3.2
```

### Frontend can't connect
```bash
# Verify all services are running
docker-compose ps

# Check service URLs in .env
cat .env | grep NEXT_PUBLIC
```

### Out of memory
- Close other applications
- Increase Docker memory limit (Docker Desktop → Settings → Resources)
- Disable GPU if not available

## Next Steps

1. **Customize Branding**: Edit `frontend/src/app/page.tsx`
2. **Add More Manuals**: Copy PDFs to `./manuals/` and run `./scripts/ingest-manuals.sh`
3. **Change Passwords**: Edit `services/upload-service/app.py` USERS dictionary
4. **Deploy to Production**: See `README.md` AWS deployment section

## AWS Production Deployment

For production deployment on AWS EKS:

```bash
cd aws-scripts
./deploy-eks.sh
```

This creates:
- EKS cluster with GPU nodes
- All services on Kubernetes
- Load Balancer with public IP
- Auto-scaling and high availability

See `README.md` for full deployment guide.

## Support

For issues:
1. Check logs: `docker-compose logs -f`
2. Review README.md troubleshooting section
3. Verify prerequisites are met
4. Check GitHub issues

## Architecture Overview

```
┌─────────────────────────────────────────┐
│         Frontend (Next.js)              │
│     http://localhost:3000               │
└─────────────┬───────────────────────────┘
              │
    ┌─────────┴──────────┬────────────┐
    │                    │            │
    ▼                    ▼            ▼
┌─────────┐      ┌──────────────┐  ┌────────┐
│ Notes   │      │ Doc          │  │  RAG   │
│ Service │      │ Processor    │  │Service │
│ :8100   │      │ :8101        │  │ :8102  │
└─────────┘      └──────────────┘  └────────┘
    │                    │            │
    └─────────┬──────────┴────────────┘
              │
         ┌────▼────┐
         │ Ollama  │
         │ :11434  │
         └─────────┘
```

## Features Summary

- ✅ LLM-powered note conversion
- ✅ QR code generation for clients
- ✅ Document OCR (LlamaParse + Tesseract)
- ✅ RAG-based manual search
- ✅ Authenticated file uploads
- ✅ Auto-processing to markdown
- ✅ GPU acceleration support
- ✅ Docker Compose for local dev
- ✅ Kubernetes for production
- ✅ AWS EKS deployment scripts

## License

Proprietary - RMA Centre Prototype

---

Ready to start? Run `./init.sh` and open http://localhost:3000!
