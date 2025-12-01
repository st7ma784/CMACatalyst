# RMA Coordinator - Railway Deployment Complete Setup

## 🎯 Quick Deploy: Railway (Recommended)

**Free Tier Benefits:**
- $5/month credit (enough for 24/7 coordinator)
- 512MB RAM (perfect for coordinator)
- No credit card required for trial
- Automatic HTTPS
- GitHub integration

### Deploy in 5 Minutes

1. **Go to Railway Dashboard**: https://railway.app
2. **New Project** → **Deploy from GitHub repo**
3. **Select**: `CMACatalyst` repository
4. **Set Root Directory**: `coordinator-service`
5. **Add Environment Variable**:
   ```
   JWT_SECRET=<generate-random-32-char-string>
   ```
6. **Generate Domain** in Networking settings
7. **Done!** You'll get: `https://rma-coordinator-production.up.railway.app`

### Update Workers

Edit `/worker-containers/.env.coordinator`:
```bash
COORDINATOR_URL=https://rma-coordinator-production.up.railway.app
```

Then restart workers:
```bash
cd RMA-Demo/worker-containers/cpu-worker
docker-compose down && docker-compose up -d --scale cpu-worker=4
```

## 🔄 Architecture with Railway

```
┌─────────────────────────────────────────────────────┐
│  Railway (Free Tier)                                │
│  ┌──────────────────────────────────────┐           │
│  │  RMA Coordinator                     │           │
│  │  - Auth: /api/auth/login             │           │
│  │  - Worker Registry                   │           │
│  │  - Service Proxy: /api/service/*     │           │
│  │  - Admin: /api/admin/workers         │           │
│  └──────────────────────────────────────┘           │
│  Public URL: rma-coordinator-production.up.railway.app │
└─────────────────────────────────────────────────────┘
                    ↓ HTTPS
┌─────────────────────────────────────────────────────┐
│  Your Local Machine / Server                        │
│  ┌────────────────┐  ┌────────────────┐            │
│  │  CPU Workers   │  │  GPU Worker    │            │
│  │  (4 containers)│  │  (1 container) │            │
│  └────────────────┘  └────────────────┘            │
│         ↓                    ↓                      │
│  ┌────────────────────────────────────┐            │
│  │  Service Containers                │            │
│  │  - upload-service:8103             │            │
│  │  - rag-service:8102                │            │
│  │  - notes-service:8100              │            │
│  │  - ner-service:8108                │            │
│  │  - client-rag:8101                 │            │
│  │  - doc-processor:8104              │            │
│  └────────────────────────────────────┘            │
│  Docker Network: rma-network                        │
└─────────────────────────────────────────────────────┘
```

## 📊 Current Status

### ✅ Completed
- [x] Coordinator with auth routes
- [x] Service proxy routing
- [x] Worker registration system
- [x] Admin dashboard endpoints
- [x] Railway deployment config
- [x] Login moved to coordinator (always accessible)
- [x] Cloudflare Tunnel support (for NAT traversal)

### 🔧 Configuration Files
- `railway.json` - Railway deployment config
- `render.yaml` - Alternative: Render.com deployment
- `.env.coordinator` - Centralized coordinator URL config
- `DEPLOY_RAILWAY_WEB_UI.md` - Step-by-step deployment guide

## 🚀 Next Steps

1. **Deploy Coordinator to Railway** (5 minutes)
2. **Update Worker Config** with new Railway URL
3. **Start Workers** with updated coordinator URL
4. **Test End-to-End**:
   ```bash
   # Test auth
   curl -X POST https://rma-coordinator-production.up.railway.app/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"username":"admin","password":"admin123"}'
   
   # Check workers
   curl https://rma-coordinator-production.up.railway.app/api/admin/workers
   
   # Test service proxy (once workers connected)
   curl https://rma-coordinator-production.up.railway.app/api/service/upload/health
   ```

## 💡 Platform Comparison

| Platform | Free Tier | Always On | Setup | Best For |
|----------|-----------|-----------|-------|----------|
| **Railway** | $5/mo credit | Yes | 5min | Recommended - Full control |
| **Render** | 750hrs/mo | No (15min sleep) | 10min | Backup option |
| **Vercel** | Unlimited | Yes | Complex | Would need refactoring |
| **Fly.io** | ~~3 VMs~~ | Trial ended | N/A | Previously used |

## 🔐 Security Notes

**JWT_SECRET Generation:**
```bash
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

**Default Credentials** (change in production):
- Username: `admin` / Password: `admin123`
- Username: `user` / Password: `user123`

## 📈 Monitoring

Railway provides built-in:
- **Logs**: Real-time application logs
- **Metrics**: CPU, Memory, Network usage
- **Alerts**: Set up notifications for downtime
- **Deployments**: Auto-deploy on git push

## 🐛 Troubleshooting

**Workers not connecting:**
```bash
# Check coordinator is up
curl https://your-railway-url.up.railway.app/health

# Check worker logs
docker logs cpu-worker-cpu-worker-1

# Verify coordinator URL in worker config
docker exec cpu-worker-cpu-worker-1 env | grep COORDINATOR
```

**Services not routing:**
```bash
# Check worker registry
curl https://your-railway-url.up.railway.app/api/admin/workers

# Ensure services are running
docker ps | grep service

# Test direct service access
curl http://localhost:8103/health
```

## 💰 Cost Management

**Railway Free Tier:**
- Coordinator: ~50MB RAM, $0.50/mo
- Remaining $4.50 for other services or bandwidth
- Can run 24/7 within free tier

**When Free Tier Expires:**
1. Add payment method to Railway ($0.000463/GB-sec)
2. Deploy to Render.com (750hrs/mo free)
3. Use ngrok/Cloudflare Tunnel for local coordinator

## 🎓 Learning Resources

- Railway Docs: https://docs.railway.app
- FastAPI Deployment: https://fastapi.tiangolo.com/deployment/
- Cloudflare Tunnels: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/

## ✨ Success Indicators

Once fully deployed, you should have:
- ✅ Coordinator running on Railway at public URL
- ✅ 4-8 workers registered and sending heartbeats
- ✅ Login working through coordinator
- ✅ Service requests routing through coordinator → workers → services
- ✅ Admin dashboard showing worker status
- ✅ All services accessible via Docker network

Ready to deploy? Follow `DEPLOY_RAILWAY_WEB_UI.md` for step-by-step instructions!
