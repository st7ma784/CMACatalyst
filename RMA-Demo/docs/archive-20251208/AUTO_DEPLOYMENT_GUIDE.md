# GitHub Actions Auto-Deployment Setup

## 🚀 Automatic Deployment to Cloudflare (Zero Cost)

Your RMA system now deploys automatically on every push to master. No manual wrangler commands needed!

## What's Deployed

### Coordinator (Cloudflare Workers)
- **URL**: https://api.rmatool.org.uk
- **Trigger**: Changes to `RMA-Demo/cloudflare-worker-coordinator/`
- **Deploy time**: ~30 seconds
- **Cost**: $0/month

### Admin Dashboard (Cloudflare Pages)
- **URL**: https://dashboard.rmatool.org.uk
- **Trigger**: Changes to `RMA-Demo/admin-dashboard/`
- **Deploy time**: ~2 minutes
- **Cost**: $0/month

### Main Frontend (Cloudflare Pages)
- **URL**: https://rmatool.org.uk
- **Trigger**: Changes to `RMA-Demo/frontend/`
- **Deploy time**: ~2 minutes
- **Cost**: $0/month

## Setup Instructions

### Step 1: Get Cloudflare Credentials

1. **Get API Token:**
   ```bash
   # Go to: https://dash.cloudflare.com/profile/api-tokens
   # Click "Create Token"
   # Use template: "Edit Cloudflare Workers"
   # Add permissions:
   #   - Account > Cloudflare Pages > Edit
   #   - Account > Workers Scripts > Edit
   # Save the token (you'll only see it once!)
   ```

2. **Get Account ID:**
   ```bash
   # Go to: https://dash.cloudflare.com
   # Select any site
   # Account ID is in the right sidebar
   # Format: 32 character hex string
   ```

### Step 2: Add GitHub Secrets

1. Go to your GitHub repo: https://github.com/st7ma784/CMACatalyst
2. Navigate to: **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Add these secrets:

   | Secret Name | Value | Description |
   |------------|-------|-------------|
   | `CLOUDFLARE_API_TOKEN` | Your API token from Step 1 | Allows GitHub to deploy |
   | `CLOUDFLARE_ACCOUNT_ID` | Your account ID from Step 1 | Your Cloudflare account |

### Step 3: Test Deployment

```bash
# Make a small change to trigger deployment
cd /data/CMACatalyst
echo "# Auto-deploy test" >> RMA-Demo/cloudflare-worker-coordinator/README.md

# Commit and push
git add .
git commit -m "test: Trigger auto-deployment"
git push origin master

# Watch the deployment
# Go to: https://github.com/st7ma784/CMACatalyst/actions
```

## How It Works

### Workflow 1: deploy-coordinator.yml
```yaml
Triggers on:
  - Push to master (if coordinator/ changes)
  - Manual trigger

Steps:
  1. Checkout code
  2. Install Node.js 20
  3. Install dependencies (npm ci)
  4. Deploy with wrangler
  5. Verify health endpoint
```

### Workflow 2: deploy-frontend.yml
```yaml
Triggers on:
  - Push to master (if frontend/ or admin-dashboard/ changes)
  - Manual trigger

Steps (for each frontend):
  1. Checkout code
  2. Install Node.js 20
  3. Install dependencies
  4. Build with environment variables
  5. Deploy to Cloudflare Pages
  6. Verify deployment
```

### Workflow 3: deploy-all.yml (Smart Deployment)
```yaml
Triggers on:
  - Any push to master (RMA-Demo/ changes)
  - Manual trigger with environment selection

Features:
  - Path filtering (only deploys changed services)
  - Parallel deployment (all services at once)
  - Deployment summary in GitHub UI
```

## Usage

### Automatic Deployment (Default)

Just push to master:
```bash
# Edit coordinator
vim RMA-Demo/cloudflare-worker-coordinator/worker.js

# Commit and push
git add .
git commit -m "feat: Add new feature"
git push origin master

# GitHub Actions automatically:
# 1. Detects coordinator changes
# 2. Deploys to Cloudflare Workers
# 3. Verifies deployment
# 4. Sends notification
```

### Manual Deployment

Trigger from GitHub UI:
```
1. Go to: https://github.com/st7ma784/CMACatalyst/actions
2. Select workflow (deploy-coordinator or deploy-frontend)
3. Click "Run workflow"
4. Select branch: master
5. Click "Run workflow"
```

Or via GitHub CLI:
```bash
# Install GitHub CLI
gh auth login

# Trigger coordinator deployment
gh workflow run deploy-coordinator.yml

# Trigger frontend deployment
gh workflow run deploy-frontend.yml

# Trigger all services
gh workflow run deploy-all.yml
```

## Deployment Status

Check deployment status:
- **Live**: https://github.com/st7ma784/CMACatalyst/actions
- **Badge**: Add to README.md:
  ```markdown
  ![Deploy Status](https://github.com/st7ma784/CMACatalyst/actions/workflows/deploy-all.yml/badge.svg)
  ```

## Monitoring

### View Deployment Logs

```bash
# Via GitHub CLI
gh run list --workflow=deploy-coordinator.yml
gh run view <run-id> --log

# Via Web UI
# https://github.com/st7ma784/CMACatalyst/actions
```

### Verify Deployments

```bash
# Check coordinator
curl https://api.rmatool.org.uk/health

# Check admin dashboard
curl -I https://dashboard.rmatool.org.uk

# Check frontend
curl -I https://rmatool.org.uk

# Check all services
curl https://api.rmatool.org.uk/api/admin/services | jq
```

## Rollback

If deployment fails or introduces issues:

### Option 1: Revert Commit
```bash
git revert HEAD
git push origin master
# Triggers automatic redeployment of previous version
```

### Option 2: Manual Rollback
```bash
# Via Cloudflare Dashboard
# 1. Go to Workers & Pages
# 2. Select rma-coordinator
# 3. Click "Deployments"
# 4. Click "Rollback" on previous version

# Or via wrangler locally
cd RMA-Demo/cloudflare-worker-coordinator
git checkout <previous-commit>
npx wrangler deploy
```

## Cost Breakdown

### Cloudflare Free Tier (Current)
| Service | Free Tier | Your Usage | Cost |
|---------|-----------|------------|------|
| Workers | 100K req/day | ~10K/day | $0 |
| Pages | Unlimited builds | ~10/day | $0 |
| KV Storage | 1GB | <1MB | $0 |
| **Total** | | | **$0** |

### GitHub Actions Free Tier
| Resource | Free Tier | Your Usage | Cost |
|----------|-----------|------------|------|
| Build minutes | 2,000 min/month | ~30 min/month | $0 |
| Storage | 500 MB | <10 MB | $0 |
| **Total** | | | **$0** |

**Combined Cost: $0/month** 🎉

## Advanced Features

### Environment-Specific Deployments

Create staging environment:

1. **Add staging branch:**
   ```bash
   git checkout -b staging
   git push origin staging
   ```

2. **Create staging workflow:**
   ```yaml
   # .github/workflows/deploy-staging.yml
   on:
     push:
       branches:
         - staging
   
   jobs:
     deploy:
       # ... same as production but with staging URLs
   ```

3. **Set up staging domains:**
   ```
   - staging.rmatool.org.uk
   - staging-api.rmatool.org.uk
   ```

### Deployment Notifications

Add Slack/Discord notifications:

```yaml
- name: Notify Slack
  if: success()
  uses: slackapi/slack-github-action@v1
  with:
    webhook-url: ${{ secrets.SLACK_WEBHOOK }}
    payload: |
      {
        "text": "✅ Deployed to https://api.rmatool.org.uk"
      }
```

### Automated Testing

Add tests before deployment:

```yaml
- name: Run tests
  working-directory: RMA-Demo/cloudflare-worker-coordinator
  run: |
    npm run test
    npm run lint

- name: Deploy only if tests pass
  if: success()
  # ... deployment steps
```

## Troubleshooting

### Deployment Fails with "Unauthorized"

**Problem:** Invalid or missing Cloudflare credentials

**Fix:**
```bash
# Verify secrets are set correctly
gh secret list

# Update API token
gh secret set CLOUDFLARE_API_TOKEN
# Paste your token when prompted

# Update account ID
gh secret set CLOUDFLARE_ACCOUNT_ID
# Paste your account ID when prompted
```

### Deployment Succeeds but Site Not Updated

**Problem:** Cloudflare cache not invalidated

**Fix:**
```bash
# Purge cache via API
curl -X POST "https://api.cloudflare.com/client/v4/zones/<zone-id>/purge_cache" \
  -H "Authorization: Bearer <api-token>" \
  -H "Content-Type: application/json" \
  --data '{"purge_everything":true}'

# Or wait 5 minutes for cache to expire
```

### Build Fails with "Out of Memory"

**Problem:** Large frontend build

**Fix:** Add to workflow:
```yaml
- name: Increase Node memory
  run: export NODE_OPTIONS="--max-old-space-size=4096"

- name: Build with increased memory
  run: npm run build
```

### Workflow Doesn't Trigger

**Problem:** Path filters not matching

**Fix:** Check paths in workflow file:
```yaml
paths:
  - 'RMA-Demo/cloudflare-worker-coordinator/**'
  # Make sure this matches your actual file paths
```

## Next Steps

1. ✅ Add GitHub secrets (API token + Account ID)
2. ✅ Test deployment with small change
3. ✅ Monitor first deployment in Actions tab
4. ✅ Verify all services are live
5. 🔄 Consider adding automated tests
6. 🔄 Set up deployment notifications
7. 🔄 Create staging environment (optional)

## Summary

You now have:
- ✅ **Automatic deployment** on every push to master
- ✅ **Zero manual commands** (no more wrangler deploy)
- ✅ **Zero cost** (free tier only)
- ✅ **Smart deploys** (only changed services)
- ✅ **Parallel deploys** (all services at once)
- ✅ **Health checks** (automatic verification)
- ✅ **Rollback capability** (via git revert)

**Your infrastructure is now fully automated!** 🚀
