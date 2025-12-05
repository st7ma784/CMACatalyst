# GitHub Actions Setup

## Required Secrets

To enable automatic deployment of the Cloudflare Edge Router, add this secret to your GitHub repository:

### CLOUDFLARE_API_TOKEN

1. **Get your Cloudflare API Token:**
   - Go to https://dash.cloudflare.com/profile/api-tokens
   - Click "Create Token"
   - Use template: "Edit Cloudflare Workers"
   - Or create custom token with permissions:
     - Account → Workers Scripts → Edit
     - Account → Workers KV Storage → Edit (for Durable Objects)
   - Copy the generated token

2. **Add to GitHub:**
   - Go to your repository → Settings → Secrets and variables → Actions
   - Click "New repository secret"
   - Name: `CLOUDFLARE_API_TOKEN`
   - Value: Paste your token
   - Click "Add secret"

3. **Test the workflow:**
   - Push changes to master branch
   - Or manually trigger: Actions → Deploy Edge Router → Run workflow

## What Gets Auto-Deployed

### On Push to Master

**When these paths change:**
- `RMA-Demo/services/cloudflare-edge-router/**` → Deploys edge router
- `RMA-Demo/worker-containers/universal-worker/**` → Builds universal-worker container
- `RMA-Demo/services/local-coordinator/**` → Builds coordinator container
- `RMA-Demo/edge-coordinator.yml` → Triggers container rebuild

### Manual Deployment

You can also manually trigger deployments:
- Go to Actions → Select workflow → Run workflow

## Workflows

1. **deploy-edge-router.yml** - Deploys Cloudflare Edge Router
2. **build-workers.yml** - Builds and pushes Docker containers to ghcr.io
3. *(existing workflows preserved)*

## Local Testing

Before pushing, test locally:

```bash
# Test edge router
cd RMA-Demo/services/cloudflare-edge-router
npm install
npx wrangler dev  # Local dev server

# Test containers
docker build -t universal-worker:local RMA-Demo/worker-containers/universal-worker
docker run --rm universal-worker:local
```
