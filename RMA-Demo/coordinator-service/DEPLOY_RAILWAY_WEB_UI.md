# Deploy RMA Coordinator to Railway (Web UI Method)

## Step-by-Step Deployment via Railway Dashboard

### 1. **Sign Up / Login to Railway**
- Go to https://railway.app
- Sign up with GitHub account (easiest)
- Railway free tier: $5/month credit, 512MB RAM, 1GB storage

### 2. **Create New Project**
- Click "New Project"
- Select "Deploy from GitHub repo"
- Authorize Railway to access your GitHub repos
- Select your `CMACatalyst` repository

### 3. **Configure Service**
- Railway will detect the project automatically
- Set the **Root Directory**: `coordinator-service`
- Railway will auto-detect Python and use Nixpacks

### 4. **Set Environment Variables**
In the Railway dashboard, go to **Variables** tab and add:

```
JWT_SECRET=your-random-secret-key-here-change-in-production
PORT=8080
```

To generate a secure JWT_SECRET:
```bash
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

### 5. **Configure Start Command**
In **Settings** → **Deploy**:
- **Start Command**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`

### 6. **Deploy**
- Click **Deploy**
- Railway will:
  - Install dependencies from `requirements.txt`
  - Start the coordinator
  - Provide a public URL

### 7. **Get Your Public URL**
- Go to **Settings** → **Networking**
- Click **Generate Domain**
- You'll get a URL like: `rma-coordinator-production.up.railway.app`

### 8. **Update Workers to Use New URL**

Update worker environment variables to point to Railway:

```bash
# For containerized workers
cd RMA-Demo/worker-containers/cpu-worker
docker-compose down
export COORDINATOR_URL=https://rma-coordinator-production.up.railway.app
docker-compose up -d
```

Or update docker-compose.yml:
```yaml
environment:
  - COORDINATOR_URL=https://rma-coordinator-production.up.railway.app
```

### 9. **Update Frontend**

Update frontend environment variables:

```bash
# In RMA-Demo/frontend/.env.production
NEXT_PUBLIC_COORDINATOR_URL=https://rma-coordinator-production.up.railway.app
```

### 10. **Test Deployment**

```bash
# Health check
curl https://rma-coordinator-production.up.railway.app/health

# Test auth
curl -X POST https://rma-coordinator-production.up.railway.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "admin123"}'
```

## Monitoring

Railway provides:
- Real-time logs
- Metrics (CPU, Memory, Network)
- Deployment history
- Automatic HTTPS

## Cost Estimation

With $5/month free credit:
- Coordinator uses ~50-100MB RAM
- ~24/7 uptime possible within free tier
- When credit runs out, add payment method or redeploy to Render.com

## Alternative: Render.com

If Railway credit runs out, use Render:

1. Go to https://render.com
2. Connect GitHub repo
3. Create new **Web Service**
4. Root directory: `coordinator-service`
5. Build: `pip install -r requirements.txt`
6. Start: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
7. Free tier: 750 hours/month, auto-sleep after 15min inactivity

## Cloudflare Tunnel Integration

Workers use Cloudflare Tunnels to expose services:
- Workers behind NAT can still receive requests
- Coordinator routes to worker tunnel URLs
- No port forwarding needed on worker machines

Architecture:
```
Railway Coordinator ← HTTPS ← Internet
    ↓
    HTTP to Cloudflare Tunnel URL
    ↓
Cloudflare Edge → Worker's Tunnel → Service Container
```

## Troubleshooting

**Service won't start:**
- Check logs in Railway dashboard
- Verify `requirements.txt` has all dependencies
- Ensure start command is correct

**Workers can't connect:**
- Verify COORDINATOR_URL is correct
- Check Railway service is running (not sleeping)
- Test health endpoint

**502 errors:**
- Service may be restarting
- Check memory usage (upgrade if >512MB)
- Review error logs

## Success Metrics

Once deployed, you should see:
- ✅ Health endpoint returns `{"status": "healthy"}`
- ✅ Workers registering at `/api/admin/workers`
- ✅ Login works at `/api/auth/login`
- ✅ Service proxying works at `/api/service/*`
