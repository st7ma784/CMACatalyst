# 🚀 Render.com - Quick Deploy Reference

## One-Time Setup (5 Minutes)

```
1. Go to: https://dashboard.render.com/
2. Click: "New +" → "Web Service"
3. Connect: GitHub repo (st7ma784/CMACatalyst)
4. Configure:
   ├─ Name: rma-coordinator
   ├─ Root Directory: RMA-Demo/coordinator-service
   ├─ Environment: Python 3
   ├─ Build: pip install -r requirements.txt
   ├─ Start: uvicorn app.main:app --host 0.0.0.0 --port $PORT
   └─ Env Vars:
      └─ JWT_SECRET=<random-32-chars>
5. Click: "Create Web Service" (Free plan)
```

## Your New Coordinator URL
```
https://rma-coordinator.onrender.com
```

## Update Workers (One Command)
```bash
cd /home/user/CMACatalyst/RMA-Demo/worker-containers
echo 'COORDINATOR_URL=https://rma-coordinator.onrender.com' > .env.coordinator
cd cpu-worker && docker-compose down && docker-compose up -d --scale cpu-worker=4
```

## Test Deployment
```bash
# Health check
curl https://rma-coordinator.onrender.com/health

# Login test
curl -X POST https://rma-coordinator.onrender.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' | jq .

# Check workers
curl https://rma-coordinator.onrender.com/api/admin/workers | jq .
```

## Keep Alive (Prevent Sleep)

**Option 1: UptimeRobot (Recommended)**
- Go to: https://uptimerobot.com/
- Add monitor: `https://rma-coordinator.onrender.com/health`
- Interval: 5 minutes
- Free tier: 50 monitors

**Option 2: Cron Job**
```bash
crontab -e
# Add this line:
*/10 * * * * curl -s https://rma-coordinator.onrender.com/health > /dev/null 2>&1
```

## Free Tier Limits
- ✅ 750 hours/month (25 days always-on)
- ✅ 512MB RAM
- ✅ Automatic HTTPS
- ✅ Auto-deploy on git push
- ⚠️ Sleeps after 15min inactivity (wakes in 30sec)

## Quick Links
- Dashboard: https://dashboard.render.com/
- Logs: https://dashboard.render.com/web/[your-service-id]/logs
- Docs: https://render.com/docs

## Status Indicators

**Healthy:**
```json
{"status": "healthy", "workers": {"total": 4}}
```

**Login Works:**
```json
{"access_token": "eyJ...", "token_type": "bearer"}
```

**Workers Connected:**
```json
{"workers": [...], "total": 4}
```

## Troubleshooting One-Liners

```bash
# Check if service is awake
curl -w "%{http_code}" https://rma-coordinator.onrender.com/health

# Wake service (if sleeping)
curl https://rma-coordinator.onrender.com/health && sleep 30 && curl https://rma-coordinator.onrender.com/health

# Check worker connectivity
docker logs cpu-worker-cpu-worker-1 | grep -i "registered\|error"

# Restart all workers
cd /home/user/CMACatalyst/RMA-Demo/worker-containers/cpu-worker && docker-compose restart
```

## Generate JWT_SECRET
```bash
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

## Done! ✨
Your coordinator is now live on Render.com with authentication always accessible!
