# GitHub Actions Workflows

Automated deployment pipelines for RMA-Demo to Cloudflare infrastructure.

## 📁 Workflows

### 1. deploy-coordinator.yml
**Deploys:** Coordinator Worker to api.rmatool.org.uk

**Triggers:**
- Push to master (if `RMA-Demo/cloudflare-worker-coordinator/` changes)
- Manual workflow dispatch

**Steps:**
1. Install Node.js 20
2. Install dependencies
3. Deploy with Wrangler
4. Verify health endpoint

**Cost:** $0 (Cloudflare Workers free tier)

---

### 2. deploy-frontend.yml
**Deploys:** 
- Admin Dashboard to dashboard.rmatool.org.uk
- Main Frontend to rmatool.org.uk

**Triggers:**
- Push to master (if frontend files change)
- Manual workflow dispatch

**Steps:**
1. Install Node.js 20
2. Build with environment variables
3. Deploy to Cloudflare Pages
4. Verify deployments

**Cost:** $0 (Cloudflare Pages free tier)

---

### 3. deploy-all.yml (Smart Deploy)
**Deploys:** All services with path filtering

**Triggers:**
- Push to master (any RMA-Demo changes)
- Manual workflow dispatch

**Features:**
- Only deploys changed services
- Parallel execution
- Deployment summary

**Cost:** $0 (all free tier)

---

## 🔧 Setup Required

Add these GitHub secrets: https://github.com/st7ma784/CMACatalyst/settings/secrets/actions

```
CLOUDFLARE_API_TOKEN    - Get from https://dash.cloudflare.com/profile/api-tokens
CLOUDFLARE_ACCOUNT_ID   - Get from https://dash.cloudflare.com (right sidebar)
```

See: `../RMA-Demo/AUTO_DEPLOY_QUICKSTART.md` for setup instructions.

---

## 📊 Monitoring

- **Live Status**: https://github.com/st7ma784/CMACatalyst/actions
- **Deployments**: https://dash.cloudflare.com

---

## 🎯 Usage

### Automatic (Default)
```bash
git add .
git commit -m "feat: Your changes"
git push origin master
# Automatically deploys changed services
```

### Manual Trigger
```bash
gh workflow run deploy-coordinator.yml
gh workflow run deploy-frontend.yml
gh workflow run deploy-all.yml
```

---

## 💰 Cost: $0/month

- GitHub Actions: 2,000 free minutes/month (uses ~30 min/month)
- Cloudflare Workers: 100K free requests/day
- Cloudflare Pages: Unlimited free builds

**Total: FREE** 🎉
