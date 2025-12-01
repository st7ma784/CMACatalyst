# Deploy RMA Coordinator to Render.com

## 🚀 Quick Deploy (5 Minutes)

### Step 1: Push Code to GitHub

If your code isn't already on GitHub:

```bash
cd /home/user/CMACatalyst
git add .
git commit -m "Add coordinator with Railway/Render support"
git push origin master
```

### Step 2: Deploy to Render

1. **Go to Render Dashboard**: https://dashboard.render.com/
2. **Sign up/Login** with your GitHub account
3. **Click "New +"** → **"Web Service"**
4. **Connect your GitHub repository**: `st7ma784/CMACatalyst`
5. **Configure the service**:

#### Basic Settings:
- **Name**: `rma-coordinator`
- **Root Directory**: `RMA-Demo/coordinator-service`
- **Environment**: `Python 3`
- **Region**: Choose closest to you
- **Branch**: `master`

#### Build & Deploy:
- **Build Command**: `pip install -r requirements.txt`
- **Start Command**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`

#### Environment Variables:
Click **"Add Environment Variable"** and add:
```
JWT_SECRET=<your-random-secret-32-chars>
```

Generate JWT_SECRET:
```bash
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

6. **Select "Free" Plan**
7. **Click "Create Web Service"**

### Step 3: Wait for Deployment (2-3 minutes)

Render will:
- Install Python dependencies
- Start the coordinator
- Provide a public URL like: `https://rma-coordinator.onrender.com`

### Step 4: Test Deployment

```bash
# Test health endpoint
curl https://rma-coordinator.onrender.com/health

# Test authentication
curl -X POST https://rma-coordinator.onrender.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "admin123"}'
```

### Step 5: Update Workers

```bash
# Edit the coordinator URL
nano /home/user/CMACatalyst/RMA-Demo/worker-containers/.env.coordinator
```

Change to:
```bash
COORDINATOR_URL=https://rma-coordinator.onrender.com
```

Restart workers:
```bash
cd /home/user/CMACatalyst/RMA-Demo/worker-containers/cpu-worker
docker-compose down && docker-compose up -d --scale cpu-worker=4
```

### Step 6: Verify Workers Connected

```bash
# Check registered workers
curl https://rma-coordinator.onrender.com/api/admin/workers | jq .
```

## ✅ What You Get with Render Free Tier

- **750 hours/month** of runtime (25 days if always on)
- **512MB RAM**
- **Automatic HTTPS**
- **Auto-deploy** on git push
- **Free custom domain support**
- **Sleep after 15 min inactivity** (wakes on first request)

## ⚠️ Important: Sleep Behavior

**Render free tier sleeps after 15 minutes of inactivity**

To keep it alive:
1. Workers will auto-wake it when sending heartbeats
2. Set up a cron job to ping it every 10 minutes:

```bash
# Add to crontab -e
*/10 * * * * curl https://rma-coordinator.onrender.com/health > /dev/null 2>&1
```

Or use a free uptime monitor:
- UptimeRobot: https://uptimerobot.com/ (free, pings every 5 min)
- Cronitor: https://cronitor.io/ (free tier available)

## 🔄 Architecture

```
Render.com (Free Tier)
  ↓
RMA Coordinator (Public URL)
  ↓ 
Local Workers → Services
  ↓
Docker Network
```

## 📊 Monitoring in Render

Render Dashboard provides:
- **Logs**: Real-time application logs
- **Metrics**: Memory, CPU usage
- **Deploy History**: Rollback capability
- **Events**: All deployments and config changes

## 🐛 Troubleshooting

### Service won't start
- Check **Logs** tab in Render dashboard
- Verify `requirements.txt` is correct
- Ensure start command includes `--host 0.0.0.0 --port $PORT`

### Workers can't connect
- Service might be sleeping - first request wakes it (30sec delay)
- Check coordinator URL is correct
- Verify JWT_SECRET is set

### 502 Bad Gateway
- Service is waking up from sleep
- Wait 30 seconds and retry
- Check service logs for errors

## 🔧 Advanced: Keep Alive Script

Create a simple keep-alive on your local machine:

```bash
#!/bin/bash
# keep-coordinator-alive.sh

while true; do
    curl -s https://rma-coordinator.onrender.com/health > /dev/null
    echo "Pinged coordinator at $(date)"
    sleep 600  # Every 10 minutes
done
```

Run in background:
```bash
chmod +x keep-coordinator-alive.sh
nohup ./keep-coordinator-alive.sh &
```

## 💡 Alternative: Upgrade to Paid

If you need 24/7 uptime without sleep:
- **$7/month** for always-on instance
- No sleep behavior
- Better for production use

## 🎯 Success Checklist

- [ ] Render service deployed and running
- [ ] Health endpoint returns `{"status": "healthy"}`
- [ ] Login works: `/api/auth/login`
- [ ] Workers updated with new URL
- [ ] Workers registering successfully
- [ ] Admin endpoint shows workers: `/api/admin/workers`

## 🚀 Next Steps

1. **Deploy Now**: Follow steps above
2. **Update Frontend**: Change `NEXT_PUBLIC_COORDINATOR_URL` in frontend
3. **Test End-to-End**: Login → Upload → Query documents
4. **Set Up Monitoring**: Use UptimeRobot to prevent sleep

Your coordinator will be live at: `https://rma-coordinator.onrender.com`

Ready to deploy? Start at Step 1 above! 🎉
