# RMA Distributed System - Minimal Cost Public Hosting

## Goal: $0-2/month for Public, Open Access

Make the RMA distributed system publicly accessible so anyone can:
- View the system dashboard
- Register as a worker
- Contribute compute power
- Use the services

---

## Architecture: Free Tier Stack

```
┌──────────────────────────────────────────────────────┐
│  Frontend + Admin Dashboard                         │
│  Vercel (Free Tier) - Static Site                   │
│  Cost: $0/month                                      │
│  https://rma-demo.vercel.app                        │
└──────────────┬───────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────────┐
│  Coordinator Service API                             │
│  Fly.io (Free Tier) or Railway (Free Tier)          │
│  Cost: $0/month                                      │
│  https://api.rmatool.org.uk                    │
└──────────────┬───────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────────┐
│  Database                                            │
│  Supabase PostgreSQL (Free Tier)                    │
│  Cost: $0/month                                      │
│  500MB storage, 2 CPU                                │
└──────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────┐
│  Workers (Distributed)                               │
│  Community-donated compute                           │
│  Cost: $0/month (provided by contributors)          │
└──────────────────────────────────────────────────────┘
```

**Total Cost: $0/month**

---

## Component Breakdown

### 1. Frontend + Admin Dashboard → Vercel (FREE)

**Why Vercel:**
- Free tier: Unlimited bandwidth (fair use)
- 100 deployments/day
- Automatic HTTPS
- Global CDN
- Perfect for Next.js

**Limits:**
- 100GB bandwidth/month (plenty for demo)
- No usage-based billing

**Setup:**
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
cd RMA-Demo/frontend
vercel deploy --prod

# Also deploy admin dashboard as static site
cd ../admin-dashboard
npm run build
vercel deploy --prod
```

**Result:**
- Frontend: `https://rma-demo.vercel.app`
- Admin: `https://rma-admin.vercel.app`
- Cost: **$0/month**

---

### 2. Coordinator API → Fly.io (FREE) or Railway (FREE)

#### Option A: Fly.io (Recommended)

**Free Tier Includes:**
- 3 shared-cpu-1x VMs (256MB RAM each)
- 160GB outbound transfer
- Automatic HTTPS

**Limits:**
- Apps scale to zero when idle (restarts on request)
- Cold start: ~2-3 seconds

**Setup:**
```bash
cd RMA-Demo/coordinator-service

# Deploy
fly launch --name rma-coordinator
fly deploy

# Set environment (if using Supabase)
fly secrets set DATABASE_URL="postgresql://..."
```

**Cost: $0/month** (stays within free tier)

#### Option B: Railway (Alternative)

**Free Tier:**
- $5 credit/month (enough for small app)
- 512MB RAM
- Shared CPU

**Setup:**
1. Push to GitHub
2. Connect Railway to repo
3. Deploy `coordinator-service` folder
4. Railway auto-detects Dockerfile

**Cost: $0/month** (within free credit)

---

### 3. Database → Supabase (FREE)

**Why Supabase:**
- Free PostgreSQL database
- 500MB storage
- Unlimited API requests
- Built-in auth (optional)
- Real-time subscriptions

**Free Tier:**
- 500MB database
- 1GB file storage
- 2GB bandwidth/month
- 50,000 monthly active users

**Setup:**
1. Go to https://supabase.com
2. Create new project (free)
3. Get connection string
4. Use for coordinator's worker registry

**Alternative: Use SQLite (Even Cheaper!)**

For minimal setup, just use SQLite in coordinator (no external DB needed).

**Cost: $0/month**

---

### 4. Domain (OPTIONAL) → Namecheap (~$1/month)

**Options:**
1. **Use free subdomains** (Vercel/Fly.io provide)
   - `rma-demo.vercel.app`
   - `rma-coordinator.fly.dev`
   - Cost: $0/month

2. **Buy cheap domain**
   - `.xyz` domains: $1-2/year (~$0.08-0.17/month)
   - `.tech` domains: $5/year (~$0.42/month)
   - Point DNS to Vercel/Fly.io

**Recommendation: Use free subdomains**
**Cost: $0/month**

---

## Cheapest Possible Setup (Step-by-Step)

### Phase 1: Deploy Coordinator (5 minutes)

```bash
cd RMA-Demo/coordinator-service

# Option 1: Fly.io (Recommended)
fly launch --name rma-coordinator --region lhr
fly deploy

# Option 2: Railway
# Just connect GitHub repo, Railway auto-deploys
```

**Get URL:** `https://api.rmatool.org.uk`

### Phase 2: Deploy Frontend (5 minutes)

```bash
cd RMA-Demo/frontend

# Update .env.local
echo "NEXT_PUBLIC_COORDINATOR_URL=https://api.rmatool.org.uk" > .env.local

# Build and deploy
npm run build
vercel deploy --prod
```

**Get URL:** `https://rma-demo.vercel.app`

### Phase 3: Deploy Admin Dashboard (5 minutes)

```bash
cd RMA-Demo/admin-dashboard

# Update coordinator URL in vite.config.js
# Then build and deploy
npm run build
vercel deploy --prod
```

**Get URL:** `https://rma-admin.vercel.app`

### Phase 4: Public Landing Page (10 minutes)

Create a simple landing page explaining the project and how to join.

---

## Public Access & Authentication

### Option 1: Completely Open (Simplest)

**No authentication required:**
- Anyone can view dashboards
- Anyone can register workers
- Anyone can use services

**Risks:**
- Potential abuse
- No usage tracking per user

**Good for:** Public demo, community project

### Option 2: Simple API Key Auth

**Add minimal auth:**
- Workers need API key to register
- Free API keys via landing page form
- Track usage per key

**Implementation:**
```python
# In coordinator main.py
API_KEYS = set()  # Load from env or DB

@app.post("/api/worker/register")
async def register_worker(request: WorkerRegistrationRequest, api_key: str = Header(None)):
    if api_key not in API_KEYS:
        raise HTTPException(401, "Invalid API key")
    # ... rest of registration
```

**Landing page:**
```html
<form action="/request-api-key">
  <input type="email" placeholder="Your email" />
  <button>Get Free API Key</button>
</form>
```

**Cost: Still $0/month**

### Option 3: GitHub OAuth (Free)

**Use GitHub for auth:**
- Users sign in with GitHub
- Get personal API key
- Track contributions

**Implementation:**
- Use Supabase Auth (free)
- GitHub OAuth integration
- Issue JWT tokens

**Cost: Still $0/month**

---

## Public Landing Page

Create a landing page to explain the project and onboard contributors.

### Landing Page Structure

```
┌─────────────────────────────────────────────────┐
│  RMA Distributed Compute Pool                   │
│  Democratized AI Infrastructure                 │
├─────────────────────────────────────────────────┤
│                                                 │
│  [View System Dashboard]  [Download Worker]    │
│                                                 │
│  📊 Active Workers: 12                          │
│  💻 Total Compute: 180 GPU hours donated        │
│  🚀 Inference Requests: 1,247 today             │
│                                                 │
│  ─────────────────────────────────────────────  │
│                                                 │
│  How It Works:                                  │
│  1. Download worker agent                       │
│  2. Run on your computer                        │
│  3. Donate idle GPU/CPU time                    │
│  4. Earn credits for priority access            │
│                                                 │
│  ─────────────────────────────────────────────  │
│                                                 │
│  Quick Start:                                   │
│  $ pip install rma-worker                       │
│  $ rma-worker start                             │
│                                                 │
│  [Join Discord] [View Docs] [GitHub]            │
└─────────────────────────────────────────────────┘
```

### Deploy Landing Page

**Option 1: GitHub Pages (FREE)**
```bash
# Create landing-page/index.html
cd RMA-Demo
mkdir landing-page
# Create HTML/CSS/JS
git add landing-page
git commit -m "Add landing page"
git push

# Enable GitHub Pages in repo settings
# Available at: https://yourusername.github.io/rma-demo
```

**Option 2: Vercel (FREE)**
```bash
cd landing-page
vercel deploy --prod
# Available at: https://rma.vercel.app
```

**Cost: $0/month**

---

## Cost Comparison

### Absolute Minimum (No Domain)
| Service | Provider | Cost |
|---------|----------|------|
| Frontend | Vercel | $0 |
| Admin Dashboard | Vercel | $0 |
| Coordinator API | Fly.io | $0 |
| Database | SQLite (local) | $0 |
| Landing Page | GitHub Pages | $0 |
| **Total** | | **$0/month** |

### With Domain
| Service | Provider | Cost |
|---------|----------|------|
| Frontend | Vercel | $0 |
| Admin Dashboard | Vercel | $0 |
| Coordinator API | Fly.io | $0 |
| Database | Supabase | $0 |
| Domain (.xyz) | Namecheap | ~$0.08 |
| **Total** | | **~$1/month** |

### With External DB
| Service | Provider | Cost |
|---------|----------|------|
| Frontend | Vercel | $0 |
| Admin Dashboard | Vercel | $0 |
| Coordinator API | Fly.io | $0 |
| Database | Supabase | $0 |
| Domain (.xyz) | Namecheap | ~$0.08 |
| **Total** | | **~$1/month** |

---

## Alternative: All-in-One Free Solutions

### Option A: Render (Single Platform)

**Free Tier:**
- Web services (spins down after 15min idle)
- PostgreSQL database (90-day expiry, then recreates)
- Static sites

**Deploy Everything on Render:**
- Coordinator: Web Service (free)
- Frontend: Static Site (free)
- Admin: Static Site (free)
- Database: PostgreSQL (free)

**Pros:** Single platform
**Cons:** Services spin down (slower cold starts)

**Cost: $0/month**

### Option B: Netlify (Static-First)

**Free Tier:**
- 100GB bandwidth
- 300 build minutes
- Serverless functions (125k/month)

**Use Netlify Functions for Coordinator:**
- Convert coordinator to serverless functions
- Deploy frontend as static site
- Use Supabase for database

**Pros:** Fast, global CDN
**Cons:** Serverless functions have cold starts

**Cost: $0/month**

---

## Optimization for Free Tier Limits

### 1. Minimize Database Calls

Use in-memory caching:
```python
# In coordinator
from functools import lru_cache
import time

_cache = {}
_cache_time = {}

def get_workers():
    if time.time() - _cache_time.get('workers', 0) < 30:
        return _cache['workers']

    workers = db.get_workers()
    _cache['workers'] = workers
    _cache_time['workers'] = time.time()
    return workers
```

### 2. Reduce Frontend Build Size

```javascript
// next.config.js
module.exports = {
  output: 'export', // Static export (smaller)
  images: {
    unoptimized: true // Reduce build time
  }
}
```

### 3. Optimize Coordinator

```python
# Use SQLite instead of PostgreSQL
DATABASE_URL = "sqlite:///coordinator.db"

# Disable verbose logging
import logging
logging.basicConfig(level=logging.WARNING)
```

---

## Public Onboarding Flow

### User Journey 1: View System

1. User visits `https://rma-demo.vercel.app`
2. Sees landing page with system stats
3. Clicks "View Dashboard"
4. Sees real-time worker pool status
5. No auth required

### User Journey 2: Become Worker

1. User visits landing page
2. Clicks "Download Worker Agent"
3. Gets download link or pip install command
4. Runs locally:
   ```bash
   pip install rma-worker
   rma-worker start --coordinator https://api.rmatool.org.uk
   ```
5. Worker auto-registers and appears in dashboard
6. User can see their contribution

### User Journey 3: Use Services

1. User visits `https://rma-demo.vercel.app`
2. Navigates to "Ask the Manuals" or other service
3. Enters query
4. Request automatically routes to available worker
5. Gets response
6. No payment required (community-funded)

---

## Scaling Strategy (Still Free)

### When to Scale

Monitor Fly.io metrics:
```bash
fly status
fly metrics
```

If hitting limits:
1. **Bandwidth limit**: Add Cloudflare (free CDN)
2. **CPU limit**: Split into multiple Fly.io apps (3 free)
3. **Database size**: Switch from Supabase to SQLite
4. **Cold starts**: Use Railway (always-on free tier)

### Multi-Region for Free

Deploy to multiple regions on free tier:
```bash
# Primary region: London
fly deploy --region lhr

# Backup region: Frankfurt
fly deploy --region fra
```

**Cost: Still $0/month** (within 3 free VMs)

---

## Monitoring & Alerts (Free)

### UptimeRobot (Free Monitoring)

Monitor uptime for free:
1. Sign up at https://uptimerobot.com (free)
2. Add monitors:
   - `https://api.rmatool.org.uk/health`
   - `https://rma-demo.vercel.app`
3. Get email alerts on downtime
4. Free: 50 monitors, 5-min intervals

**Cost: $0/month**

### Fly.io Metrics (Free)

Built-in metrics:
```bash
fly dashboard metrics
```

Shows:
- CPU usage
- Memory usage
- Request count
- Response times

**Cost: $0/month**

---

## Complete Deployment Script

```bash
#!/bin/bash
# deploy-free-tier.sh - Deploy entire RMA system to free tiers

set -e

echo "🚀 Deploying RMA Distributed System (Free Tier)"

# 1. Deploy Coordinator to Fly.io
echo "📡 Deploying coordinator..."
cd coordinator-service
fly launch --name rma-coordinator --region lhr --no-deploy
fly deploy
COORDINATOR_URL=$(fly status --json | jq -r '.Hostname')
echo "✅ Coordinator: https://$COORDINATOR_URL"

# 2. Deploy Frontend to Vercel
echo "🌐 Deploying frontend..."
cd ../frontend
echo "NEXT_PUBLIC_COORDINATOR_URL=https://$COORDINATOR_URL" > .env.local
npm run build
vercel deploy --prod --yes
echo "✅ Frontend deployed"

# 3. Deploy Admin Dashboard to Vercel
echo "📊 Deploying admin dashboard..."
cd ../admin-dashboard
npm run build
vercel deploy --prod --yes
echo "✅ Admin dashboard deployed"

# 4. Deploy Landing Page to GitHub Pages
echo "🏠 Deploying landing page..."
cd ../landing-page
git add .
git commit -m "Deploy landing page"
git push origin gh-pages
echo "✅ Landing page deployed"

echo ""
echo "🎉 Deployment Complete!"
echo "Frontend: Check Vercel dashboard"
echo "Admin: Check Vercel dashboard"
echo "Coordinator: https://$COORDINATOR_URL"
echo ""
echo "💰 Total Cost: $0/month"
```

---

## Recommended: $0/month Setup

**Stack:**
1. **Coordinator**: Fly.io (free tier, SQLite)
2. **Frontend**: Vercel (free tier)
3. **Admin**: Vercel (free tier)
4. **Landing**: GitHub Pages (free)
5. **Domain**: Use free subdomains
6. **Auth**: Open access (or simple API keys)
7. **Monitoring**: UptimeRobot (free)

**Total: $0/month**

**Limitations:**
- Coordinator spins down after idle (2-3s cold start)
- SQLite limits (fine for demo, <1000 workers)
- No advanced features (fine for MVP)

**Perfect for:**
- Public demo
- Community project
- Proof of concept
- Research/education

---

## Summary

**Absolute Cheapest:** $0/month
- Fly.io + Vercel + GitHub Pages
- Free subdomains
- SQLite database
- Open access

**With Domain:** ~$1/month
- Same as above
- + .xyz domain from Namecheap

**Both setups support:**
- ✅ Public access
- ✅ Unlimited viewers
- ✅ Worker registration
- ✅ Real-time dashboard
- ✅ Auto-scaling (via worker pool)

Ready to deploy? Just run the deployment script above! 🚀
