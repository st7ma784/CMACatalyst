#!/bin/bash
# Deploy Cloudflare Edge Router
# Run this once to set up the serverless edge routing at api.rmatool.org.uk

set -e

echo "🚀 Deploying Cloudflare Edge Router"
echo ""

cd services/cloudflare-edge-router

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo "📦 Installing Wrangler CLI..."
    npm install
fi

# Check if logged in
echo "🔑 Checking Cloudflare authentication..."
if ! npx wrangler whoami &> /dev/null; then
    echo "⚠️  Not logged in to Cloudflare"
    echo "   Run: npx wrangler login"
    echo ""
    echo "   This will open a browser to authenticate"
    exit 1
fi

echo "✅ Authenticated with Cloudflare"
echo ""

# Deploy
echo "🚀 Deploying edge router..."
npx wrangler deploy

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📊 Your edge router is now live at:"
echo "   https://rma-edge-router.<your-subdomain>.workers.dev"
echo ""
echo "🔧 To add a custom domain (api.rmatool.org.uk):"
echo "   1. Go to Cloudflare Dashboard → Workers & Pages"
echo "   2. Click on 'rma-edge-router'"
echo "   3. Go to 'Custom Domains' tab"
echo "   4. Add 'api.rmatool.org.uk'"
echo ""
echo "📖 Next steps:"
echo "   1. Start an edge coordinator: docker-compose -f edge-coordinator.yml up -d"
echo "   2. Check health: curl https://api.rmatool.org.uk/health"
echo ""
