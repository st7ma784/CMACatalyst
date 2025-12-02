# ✅ Auto-Deploy Setup Checklist

Quick checklist for setting up automatic deployments. See `CLOUDFLARE_AUTO_DEPLOY.md` for detailed instructions.

## Prerequisites

- [ ] GitHub repository connected to Cloudflare
- [ ] Cloudflare account with Workers & Pages access
- [ ] Repository: st7ma784/CMACatalyst

---

## Part 1: Frontend Auto-Deploy (5 min)

### Cloudflare Dashboard

- [ ] Go to: https://dash.cloudflare.com → Workers & Pages
- [ ] Click: **Create application** → **Pages** → **Connect to Git**
- [ ] Authorize GitHub and select repository: `st7ma784/CMACatalyst`

### Build Configuration

- [ ] Project name: `rma-frontend`
- [ ] Production branch: `master`
- [ ] Build command: `cd RMA-Demo/frontend && npm ci && npm run build`
- [ ] Build output: `RMA-Demo/frontend/out`
- [ ] Framework: Next.js (Static HTML Export)

### Environment Variables

Add these:
```
NEXT_PUBLIC_API_URL=https://api.rmatool.org.uk
NEXT_PUBLIC_COORDINATOR_URL=https://api.rmatool.org.uk
NEXT_PUBLIC_UPLOAD_SERVICE_URL=https://api.rmatool.org.uk/api/service/upload
NEXT_PUBLIC_NOTES_SERVICE_URL=https://api.rmatool.org.uk/api/service/notes
NEXT_PUBLIC_RAG_SERVICE_URL=https://api.rmatool.org.uk/api/service/rag
NEXT_PUBLIC_NER_SERVICE_URL=https://api.rmatool.org.uk/api/service/ner
```

### Custom Domain

- [ ] Go to: Custom domains → Set up a custom domain
- [ ] Add: `rmatool.org.uk`
- [ ] Wait for DNS propagation (2-5 minutes)

### ✅ Test Frontend Auto-Deploy

```bash
cd RMA-Demo/frontend
# Make a small change
echo "// Updated" >> src/app/page.tsx
git add .
git commit -m "test: trigger auto deploy"
git push origin master
```

- [ ] Check deployment: https://dash.cloudflare.com → rma-frontend → Deployments
- [ ] Verify live: https://rmatool.org.uk

---

## Part 2: Coordinator Auto-Deploy (10 min)

### Get API Token

- [ ] Go to: https://dash.cloudflare.com → Profile → API Tokens
- [ ] Click: **Create Token** → **Edit Cloudflare Workers** template
- [ ] Configure permissions:
  - Account → Workers Scripts → Edit
  - Account → Workers KV Storage → Edit
- [ ] Create and **copy token** (save it!)

### Get Account ID

- [ ] Dashboard → Workers & Pages → Overview
- [ ] Copy **Account ID** from sidebar

### Add GitHub Secrets

Go to: https://github.com/st7ma784/CMACatalyst/settings/secrets/actions

- [ ] Add secret: `CLOUDFLARE_API_TOKEN` = [your API token]
- [ ] Add secret: `CLOUDFLARE_ACCOUNT_ID` = [your account ID]

### Verify Workflow File

- [ ] File exists: `.github/workflows/deploy-coordinator.yml`
- [ ] File is committed and pushed to repository

### ✅ Test Coordinator Auto-Deploy

```bash
cd RMA-Demo/cloudflare-worker-coordinator
# Make a small change
echo "// Updated" >> worker.js
git add .
git commit -m "test: trigger coordinator deploy"
git push origin master
```

- [ ] Check workflow: https://github.com/st7ma784/CMACatalyst/actions
- [ ] Wait for green checkmark (~1 minute)
- [ ] Verify live: `curl https://api.rmatool.org.uk/health`

---

## 🎉 Success Verification

### Frontend
```bash
curl -I https://rmatool.org.uk
# Expected: HTTP/2 200
```

### Coordinator
```bash
curl https://api.rmatool.org.uk/health
# Expected: {"status":"healthy","edge":true,...}
```

### Test Full Deploy Cycle

```bash
# 1. Make changes
cd /home/user/CMACatalyst/RMA-Demo
echo "Test update" >> test.txt

# 2. Commit and push
git add .
git commit -m "test: full auto-deploy cycle"
git push origin master

# 3. Watch deployments
# Frontend: https://dash.cloudflare.com → rma-frontend → Deployments
# Coordinator: https://github.com/st7ma784/CMACatalyst/actions

# 4. Verify both updated (2-3 minutes)
curl https://rmatool.org.uk
curl https://api.rmatool.org.uk/health
```

---

## 📊 Monitoring

### Daily Checks

- [ ] Check deployment history: https://dash.cloudflare.com → rma-frontend → Deployments
- [ ] Check workflow runs: https://github.com/st7ma784/CMACatalyst/actions
- [ ] Verify services: `curl https://api.rmatool.org.uk/health`

### Enable Notifications

- [ ] GitHub: Settings → Notifications → Enable Actions notifications
- [ ] Cloudflare: Dashboard → Notifications → Configure (optional)

---

## 🐛 Troubleshooting

### Frontend build fails
1. Check logs: Dashboard → rma-frontend → Failed deployment → Build logs
2. Common fixes:
   - Verify build output directory is `RMA-Demo/frontend/out`
   - Check environment variables are set
   - Ensure `next.config.js` has `output: 'export'`

### Coordinator deploy fails
1. Check logs: GitHub → Actions → Failed workflow → View logs
2. Common fixes:
   - Verify secrets are correct
   - Check API token hasn't expired
   - Ensure paths in workflow match your structure

### Workflow doesn't trigger
1. Verify `.github/workflows/deploy-coordinator.yml` is in repository
2. Check Actions are enabled: GitHub → Settings → Actions
3. Verify path filter matches: changes must be in `RMA-Demo/cloudflare-worker-coordinator/**`

---

## 📚 Documentation

**Full Guide:** `CLOUDFLARE_AUTO_DEPLOY.md`  
**Architecture:** `TESTING_CHECKLIST.md`  
**Deployment Status:** `DEPLOYMENT_STATUS.md`

---

**Last Updated:** December 2, 2025  
**Status:** ✅ Ready to Use  
**Cost:** $0/month
