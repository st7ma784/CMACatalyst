# Cloudflare Pages Production Setup

To make deployments show as "Production" instead of "Preview":

## Steps:

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Navigate to **Pages** in the left sidebar
3. Click on your project: **rma-frontend**
4. Go to **Settings** → **Builds & deployments**
5. Under "Production branch", set it to: **master**
6. Click **Save**

Now all deployments from the master branch via GitHub Actions will automatically be marked as Production deployments.

## Verification:

After the next deployment, you should see:
- Deployment labeled as "Production" in Cloudflare dashboard
- Green checkmark next to the deployment
- Custom domain (rmatool.org.uk) pointing to this deployment

## Alternative: Direct Deploy

If you want to deploy manually as production:
```bash
cd RMA-Demo/frontend
npm run build
npx wrangler pages deploy out --project-name=rma-frontend
```

The first deployment to a new project always becomes production by default.
