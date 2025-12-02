# RMA Distributed Coordinator Service

Minimal coordinator service for managing distributed RMA worker pool.

## Features

- Worker registration with automatic tier assignment
- Health monitoring with automatic worker cleanup
- Intelligent workload routing and load balancing
- Admin API for system monitoring
- Minimal footprint (runs on free tier hosting)

## Deployment

### Option 1: Fly.io (Recommended - Free Tier)

```bash
# Install flyctl
curl -L https://Cloudflare/install.sh | sh

# Login to Fly.io
fly auth login

# Launch app (first time)
fly launch --name rma-coordinator --region lhr

# Deploy
fly deploy

# Check status
fly status

# View logs
fly logs
```

### Option 2: Railway (Free Tier)

1. Push code to GitHub
2. Go to railway.app
3. Create new project from GitHub repo
4. Select `coordinator-service` folder
5. Railway auto-detects Dockerfile
6. Deploy!

### Option 3: Render (Free Tier)

1. Push code to GitHub
2. Go to render.com
3. Create new Web Service
4. Connect GitHub repo
5. Set build command: `docker build -t coordinator .`
6. Set start command: `docker run -p 8080:8080 coordinator`
7. Deploy!

### Option 4: Local Development

```bash
cd coordinator-service

# Install dependencies
pip install -r requirements.txt

# Run server
python -m uvicorn app.main:app --reload --port 8080
```

## API Endpoints

### Worker Management

- `POST /api/worker/register` - Register new worker
- `POST /api/worker/heartbeat` - Send heartbeat
- `DELETE /api/worker/unregister/{worker_id}` - Unregister worker
- `GET /api/worker/tasks?worker_id=...` - Pull tasks

### Inference Routing

- `POST /api/inference/llm` - LLM inference
- `POST /api/inference/vision` - Vision model inference
- `POST /api/inference/rag/query` - RAG query
- `POST /api/inference/graph/extract` - NER extraction

### Admin Dashboard

- `GET /api/admin/workers` - List all workers
- `GET /api/admin/stats` - System statistics
- `GET /api/admin/health` - System health

## Environment Variables

- `PORT` - Server port (default: 8080)
- `DATABASE_PATH` - Database path for persistence (optional)

## Architecture

```
Coordinator Service
├── app/
│   └── main.py           # FastAPI application
├── models/
│   └── worker.py         # Worker models & registry
├── routers/
│   ├── worker_routes.py  # Worker management
│   ├── inference_routes.py  # Inference routing
│   └── admin_routes.py   # Admin dashboard
├── utils/
│   └── database.py       # Database utilities
└── Dockerfile            # Container build
```

## Monitoring

Access admin dashboard at:
- `https://your-coordinator-url.fly.dev/api/admin/stats`
- `https://your-coordinator-url.fly.dev/api/admin/workers`

## Cost

- **Fly.io**: Free tier (256MB RAM, shared CPU, scales to zero)
- **Railway**: Free tier (512MB RAM, 500 hours/month)
- **Render**: Free tier (512MB RAM, auto-sleep after 15 min idle)

**Total cost**: $0/month on free tier!
