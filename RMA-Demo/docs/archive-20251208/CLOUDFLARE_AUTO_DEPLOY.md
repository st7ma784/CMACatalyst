# 🚀 Cloudflare Auto-Deploy Setup

Complete guide to set up automatic deployments from GitHub for both the coordinator (Cloudflare Workers) and frontend (Cloudflare Pages).

## 📋 Overview

After setup, every `git push` will automatically:
- ✅ Deploy frontend to Cloudflare Pages
- ✅ Deploy coordinator to Cloudflare Workers
- ✅ Run builds and tests
- ✅ Update production instantly

**Time to setup:** 15 minutes  
**Cost:** $0/month

---

## Part 1: Frontend Auto-Deploy (Cloudflare Pages + GitHub)

### Step 1: Connect GitHub Repository

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Navigate to: **Workers & Pages** → **Create application** → **Pages**
3. Click: **Connect to Git**

### Step 2: Authorize GitHub

1. Click **Connect GitHub**
2. Authorize Cloudflare Pages to access your repositories
3. Select your repository: `st7ma784/CMACatalyst`

### Step 3: Configure Build Settings

**Project name:** `rma-frontend`

**Production branch:** `master` (or `main`)

**Build settings:**

```yaml
Build command:
cd RMA-Demo/frontend && npm ci && npm run build

Build output directory:
RMA-Demo/frontend/out

Root directory:
(leave empty)

Framework preset:
Next.js (Static HTML Export)
```

### Step 4: Environment Variables

Add these in the **Environment variables** section:

```env
NEXT_PUBLIC_API_URL=https://api.rmatool.org.uk
NEXT_PUBLIC_COORDINATOR_URL=https://api.rmatool.org.uk
NEXT_PUBLIC_UPLOAD_SERVICE_URL=https://api.rmatool.org.uk/api/service/upload
NEXT_PUBLIC_NOTES_SERVICE_URL=https://api.rmatool.org.uk/api/service/notes
NEXT_PUBLIC_RAG_SERVICE_URL=https://api.rmatool.org.uk/api/service/rag
NEXT_PUBLIC_NER_SERVICE_URL=https://api.rmatool.org.uk/api/service/ner
```

### Step 5: Deploy

1. Click **Save and Deploy**
2. Wait for first build (2-3 minutes)
3. Once complete, click **Continue to project**

### Step 6: Add Custom Domain

1. In your project, go to **Custom domains** tab
2. Click **Set up a custom domain**
3. Enter: `rmatool.org.uk`
4. Click **Activate domain**

Cloudflare will automatically:
- ✅ Create DNS records
- ✅ Provision SSL certificate
- ✅ Configure routing

### ✅ Frontend Auto-Deploy Complete!

Now every time you push to `master`:
```bash
git add .
git commit -m "Update frontend"
git push origin master
```

Cloudflare Pages will automatically:
1. Detect the push
2. Pull latest code
3. Run build command
4. Deploy to production
5. Update https://rmatool.org.uk

**Build time:** ~2-3 minutes  
**View builds:** Dashboard → Workers & Pages → rma-frontend → Deployments

---

## Part 2: Coordinator Auto-Deploy (Cloudflare Workers + GitHub Actions)

Cloudflare Workers doesn't have direct GitHub integration like Pages, so we'll use GitHub Actions for automatic deployment.

### Step 1: Get Cloudflare API Token

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Click your profile (top right) → **My Profile**
3. Go to **API Tokens** tab
4. Click **Create Token**
5. Use template: **Edit Cloudflare Workers**
6. Configure:
   - **Permissions:** 
     - Account → Workers Scripts → Edit
     - Account → Workers KV Storage → Edit
   - **Account Resources:** Include → Your account
7. Click **Continue to summary** → **Create Token**
8. **Copy the token** (you won't see it again!)

### Step 2: Add Secrets to GitHub

1. Go to your GitHub repository: https://github.com/st7ma784/CMACatalyst
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Add these secrets:

**Secret 1:**
```
Name: CLOUDFLARE_API_TOKEN
Value: [paste your API token]
```

**Secret 2:**
```
Name: CLOUDFLARE_ACCOUNT_ID
Value: [your account ID - see step 3]
```

### Step 3: Get Account ID

Find your Account ID:
1. Dashboard → Workers & Pages → Overview
2. Copy your **Account ID** from the right sidebar
3. Add it as the second secret

### Step 4: Create GitHub Actions Workflow

Create this file in your repository:

**File:** `.github/workflows/deploy-coordinator.yml`

```yaml
name: Deploy Coordinator to Cloudflare Workers

on:
  push:
    branches:
      - master
    paths:
      - 'RMA-Demo/cloudflare-worker-coordinator/**'
      - '.github/workflows/deploy-coordinator.yml'

jobs:
  deploy:
    runs-on: ubuntu-latest
    name: Deploy to Cloudflare Workers
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: RMA-Demo/cloudflare-worker-coordinator/package-lock.json

      - name: Install dependencies
        run: |
          cd RMA-Demo/cloudflare-worker-coordinator
          npm ci

      - name: Deploy to Cloudflare Workers
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          workingDirectory: 'RMA-Demo/cloudflare-worker-coordinator'
          command: deploy
          
      - name: Deployment Summary
        run: |
          echo "✅ Coordinator deployed to Cloudflare Workers"
          echo "🌐 Live at: https://api.rmatool.org.uk"
          echo "📊 View at: https://dash.cloudflare.com"
```

### Step 5: Test Auto-Deploy

1. Commit the workflow file:
```bash
mkdir -p .github/workflows
# Copy the workflow file above to .github/workflows/deploy-coordinator.yml

git add .github/workflows/deploy-coordinator.yml
git commit -m "Add auto-deploy workflow for coordinator"
git push origin master
```

2. Watch the deployment:
   - Go to GitHub → Your repository → **Actions** tab
   - You should see the workflow running
   - Click on it to watch progress

3. Verify deployment:
```bash
curl https://api.rmatool.org.uk/health
# Should return: {"status":"healthy","edge":true}
```

### ✅ Coordinator Auto-Deploy Complete!

Now every time you update coordinator code:
```bash
cd RMA-Demo/cloudflare-worker-coordinator
# Make your changes to worker.js

git add .
git commit -m "Update coordinator logic"
git push origin master
```

GitHub Actions will automatically:
1. Detect changes in coordinator directory
2. Install dependencies
3. Run wrangler deploy
4. Update production
5. Notify you of success/failure

**Build time:** ~30-60 seconds  
**View builds:** GitHub → Repository → Actions

---

## 🎯 Advanced: Deploy Previews

### Frontend Preview Deployments

Cloudflare Pages automatically creates preview deployments for:
- **Pull Requests:** Every PR gets a unique URL
- **Branches:** Every branch gets its own URL

Access preview URLs in:
- PR comments (automatic)
- Dashboard → rma-frontend → Deployments

### Coordinator Preview Deployments

To enable preview deployments for PRs, update the workflow:

```yaml
name: Deploy Coordinator

on:
  push:
    branches: [master]
    paths: ['RMA-Demo/cloudflare-worker-coordinator/**']
  pull_request:
    branches: [master]
    paths: ['RMA-Demo/cloudflare-worker-coordinator/**']

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      
      - name: Install dependencies
        run: |
          cd RMA-Demo/cloudflare-worker-coordinator
          npm ci
      
      - name: Deploy to Production
        if: github.event_name == 'push' && github.ref == 'refs/heads/master'
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          workingDirectory: 'RMA-Demo/cloudflare-worker-coordinator'
          command: deploy
      
      - name: Deploy Preview
        if: github.event_name == 'pull_request'
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          workingDirectory: 'RMA-Demo/cloudflare-worker-coordinator'
          command: deploy --env preview
```

---

## 🔧 Troubleshooting

### Frontend Build Fails

**Check build logs:**
1. Dashboard → Workers & Pages → rma-frontend
2. Click on failed deployment
3. View **Build logs**

**Common issues:**
- ❌ Wrong build output directory → Check `next.config.js` has `output: 'export'`
- ❌ Missing env vars → Add them in project settings
- ❌ Build command wrong → Should be: `cd RMA-Demo/frontend && npm ci && npm run build`

**Fix:**
1. Update settings in Cloudflare Dashboard
2. Click **Retry deployment**

### Coordinator Deploy Fails

**Check GitHub Actions logs:**
1. GitHub → Repository → Actions
2. Click failed workflow
3. Expand failed step

**Common issues:**
- ❌ API token expired → Generate new token, update secret
- ❌ Wrong account ID → Verify in Cloudflare dashboard
- ❌ wrangler.toml issues → Check file is valid

**Fix:**
1. Update secrets if needed
2. Fix code issues
3. Push again to retry

### Workflow Not Triggering

**Frontend (Pages):**
- Check repository is connected: Dashboard → Workers & Pages → rma-frontend → Settings → Builds & deployments
- Ensure branch is `master` (or your default branch)
- Try manual deployment: Dashboard → Deployments → Retry deployment

**Coordinator (Actions):**
- Check workflow file is in `.github/workflows/`
- Verify paths match: changes must be in `RMA-Demo/cloudflare-worker-coordinator/**`
- Check Actions are enabled: GitHub → Settings → Actions → General

---

## 📊 Monitoring Deployments

### Frontend Deployments

**Dashboard view:**
```
https://dash.cloudflare.com
→ Workers & Pages
→ rma-frontend
→ Deployments tab
```

Shows:
- ✅ All deployments with timestamps
- 📊 Build logs and duration
- 🌐 Preview URLs
- 📈 Analytics and usage

### Coordinator Deployments

**GitHub Actions view:**
```
https://github.com/st7ma784/CMACatalyst/actions
```

Shows:
- ✅ All workflow runs
- 📊 Build logs and steps
- ⏱️ Duration and status
- 📧 Email notifications on failure

### Get Notifications

**Email notifications:**
1. GitHub → Settings → Notifications
2. Enable: **Actions** → Email on workflow failure

**Slack/Discord webhooks:**
Add to workflow:
```yaml
- name: Notify on Success
  if: success()
  run: |
    curl -X POST ${{ secrets.WEBHOOK_URL }} \
      -H 'Content-Type: application/json' \
      -d '{"text":"✅ Coordinator deployed successfully!"}'
```

---

## 🎉 Success Checklist

- [ ] Frontend auto-deploys from GitHub (Cloudflare Pages)
- [ ] Coordinator auto-deploys from GitHub (GitHub Actions)
- [ ] Custom domain configured (rmatool.org.uk)
- [ ] Environment variables set correctly
- [ ] Test deployment by pushing changes
- [ ] Verify both services update automatically
- [ ] Set up notifications (optional)

---

## 🚀 Quick Reference

### Deploy Frontend Manually (if needed)
```bash
cd RMA-Demo/frontend
npm run build
npx wrangler pages deploy --project-name=rma-frontend
```

**Note:** The `wrangler.toml` is now configured with `pages_build_output_dir = "out"` so wrangler will automatically use the correct output directory.

### Deploy Coordinator Manually (if needed)
```bash
cd RMA-Demo/cloudflare-worker-coordinator
npx wrangler deploy
```

### Check Deployment Status
```bash
# Frontend
curl -I https://rmatool.org.uk

# Coordinator
curl https://api.rmatool.org.uk/health
```

### Rollback Deployment

**Frontend:**
1. Dashboard → rma-frontend → Deployments
2. Find previous working deployment
3. Click **...** → **Rollback to this deployment**

**Coordinator:**
1. GitHub → Actions → Find working workflow
2. Re-run the workflow
3. Or manually deploy previous version

---

## 💡 Best Practices

1. **Use branches for testing:**
   ```bash
   git checkout -b feature/new-feature
   # Make changes
   git push origin feature/new-feature
   # Creates preview deployment
   # Merge to master when ready
   ```

2. **Test locally first:**
   ```bash
   cd RMA-Demo/frontend
   npm run build  # Test builds locally
   npm run dev    # Test functionality
   ```

3. **Use semantic commits:**
   ```bash
   git commit -m "feat: add new service routing"
   git commit -m "fix: correct authentication flow"
   git commit -m "docs: update deployment guide"
   ```

4. **Monitor deployments:**
   - Check build logs after each push
   - Set up Slack/email notifications
   - Keep an eye on error rates

---

**Setup Date:** December 2, 2025  
**Status:** Production Ready  
**Deployment:** Fully Automated  
**Cost:** $0/month
