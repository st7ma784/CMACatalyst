# Quick Setup: Auto-Deployment

## 🚀 3-Minute Setup

### Step 1: Get Cloudflare Credentials (2 min)

1. **API Token**: https://dash.cloudflare.com/profile/api-tokens
   - Click "Create Token"
   - Use template: "Edit Cloudflare Workers"
   - Add: Account > Cloudflare Pages > Edit
   - Copy token (you'll only see it once!)

2. **Account ID**: https://dash.cloudflare.com
   - Visible in right sidebar
   - 32-character hex string

### Step 2: Add to GitHub (1 min)

Go to: https://github.com/st7ma784/CMACatalyst/settings/secrets/actions

Add two secrets:
```
Name: CLOUDFLARE_API_TOKEN
Value: <your-token>

Name: CLOUDFLARE_ACCOUNT_ID  
Value: <your-account-id>
```

### Step 3: Test (30 sec)

```bash
cd /data/CMACatalyst
echo "# Test auto-deploy" >> RMA-Demo/cloudflare-worker-coordinator/README.md
git add .
git commit -m "test: Auto-deployment"
git push origin master
```

Watch: https://github.com/st7ma784/CMACatalyst/actions

## ✅ Done!

Now every push to master automatically deploys:
- Coordinator → https://api.rmatool.org.uk
- Dashboard → https://dashboard.rmatool.org.uk  
- Frontend → https://rmatool.org.uk

**Cost: $0/month** (all free tier)

See `AUTO_DEPLOYMENT_GUIDE.md` for full documentation.
