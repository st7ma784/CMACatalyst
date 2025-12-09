# Frontend Deployment Instructions

## Current Status
✅ **Build Complete**: Frontend with distributed worker gateway architecture
📍 **Build Location**: `/data/CMACatalyst/RMA-Demo/frontend/out`
🌐 **Gateway**: Cloudflare Worker (free tier, 100k req/day)

## System Architecture (Updated 2025-12-09)

```
Frontend (rmatool.org.uk)
    ↓ HTTPS
Cloudflare Worker Gateway (free tier)
    ↓ HTTPS (via Cloudflare Tunnel)
Coordinator (local-coordinator)
    ↓ HTTP (internal worker-mesh network)
Workers (distributed GPU/CPU/Storage nodes)
```

**Key Features:**
- Zero KV storage usage (no quota concerns)
- $0/month operational cost
- 100k requests/day on free tier
- Automatic CORS handling
- Simple reverse proxy (86 lines of code)

## Deployment Options

### Option 1: Cloudflare Dashboard (Recommended)

1. Go to [Cloudflare Pages Dashboard](https://dash.cloudflare.com/pages)
2. Select the **rma-frontend** project
3. Click **"Create deployment"**
4. Select **"Direct Upload"**
5. Drag and drop the entire `out/` folder
6. Deployment URL: https://rmatool.org.uk

### Option 2: Wrangler CLI (Requires Node.js v20+)

```bash
# Install nvm (if not already installed)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.nvm/nvm.sh

# Install and use Node.js v20
nvm install 20
nvm use 20

# Deploy
cd /data/CMACatalyst/RMA-Demo/frontend
npx wrangler pages deploy out --project-name=rma-frontend
```

### Option 3: GitHub Actions

The frontend can be configured to auto-deploy on push to main branch using the existing GitHub Actions workflow.

## What's New in This Build

### Added: Distributed Worker Deployment Documentation

A new **"Distributed Workers"** section has been added to the Documentation tab with:

1. **Quick Start Examples**
   - Public network deployment (no tunnel)
   - Behind firewall deployment (with Cloudflare Tunnels)

2. **Cloudflare Credentials Guide**
   - Step-by-step API token creation
   - Account ID retrieval instructions
   - Direct links to Cloudflare dashboard

3. **Deployment Options**
   - Docker commands
   - Docker Compose examples
   - Kubernetes manifests

4. **Environment Variables Reference**
   - Complete table of all worker environment variables
   - Required vs optional flags
   - Example values

5. **How It Works**
   - Worker lifecycle explanation
   - Tunnel creation process
   - Service assignment logic

6. **Troubleshooting**
   - Common issues and solutions
   - EOF error fixes (firewall blocking)
   - API token validation
   - Worker heartbeat issues

7. **Multiple Workers**
   - Examples deploying workers in different locations
   - Automatic load balancing explanation

8. **Security Best Practices**
   - Never commit API tokens
   - Use environment variables
   - Token rotation recommendations

## Verification

After deployment, verify the new documentation is visible:

1. Go to https://rmatool.org.uk
2. Click the **Documentation** icon in the navigation
3. Look for the **"Distributed Workers"** section in the left sidebar
4. Verify the content includes:
   - Cloudflare API token instructions
   - Docker deployment examples
   - Environment variables reference
   - Troubleshooting guide

## Gateway Deployment (Required)

The frontend requires the Cloudflare Worker gateway to access backend services.

### Deploy Cloudflare Worker Gateway

```bash
cd /home/user/CMACatalyst/RMA-Demo/services/cloudflare-gateway

# Install Wrangler (if not already installed)
npm install -g wrangler

# Login to Cloudflare
wrangler login

# Set coordinator URL as secret
wrangler secret put COORDINATOR_URL
# When prompted, enter your coordinator's tunnel URL

# Deploy gateway
wrangler deploy

# Output will show your worker URL:
# https://rma-gateway.<your-subdomain>.workers.dev
```

### Update Frontend API Configuration

After deploying the gateway, update your frontend to use the gateway URL:

```typescript
// frontend/src/config.ts or environment variables
const API_BASE_URL = process.env.NODE_ENV === 'production'
  ? 'https://rma-gateway.<your-subdomain>.workers.dev'  // Production
  : 'http://localhost:8080';  // Development
```

### Test Gateway Connection

```bash
# Test health endpoint
curl https://rma-gateway.<your-subdomain>.workers.dev/health

# Expected response:
{
  "status": "healthy",
  "coordinator": "local-fastapi",
  "workers": {...}
}
```

See `/services/cloudflare-gateway/README.md` for complete deployment guide.

## Next Steps

After frontend and gateway are deployed:

1. ✅ Frontend can access distributed workers via gateway
2. ✅ Zero KV quota usage (simple reverse proxy)
3. ✅ Free tier compatible (100k requests/day)
4. ⚠️ Test complete request flow through gateway
5. ⚠️ Monitor gateway performance (Cloudflare dashboard)
6. ⚠️ Optional: Add custom domain (api.rmatool.org.uk)

## Build Details

- **Build Time**: 2024-12-06 12:19 UTC
- **Next.js Version**: 14.1.0
- **Build Output**: Static export in `out/` directory
- **Total Routes**: 10 pages
- **New Component**: `WorkerDeploymentGuide` in `Documentation.tsx`
- **Lines Added**: ~600 lines of documentation
