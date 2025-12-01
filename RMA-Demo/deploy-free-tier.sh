#!/bin/bash
# Deploy RMA Distributed System to Free Tier Services
# Total Cost: $0/month

set -e

echo "🚀 RMA Distributed System - Free Tier Deployment"
echo "=================================================="
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check prerequisites
echo -e "${BLUE}📋 Checking prerequisites...${NC}"

if ! command -v fly &> /dev/null; then
    echo -e "${YELLOW}⚠️  Fly.io CLI not found. Install it:${NC}"
    echo "   curl -L https://fly.io/install.sh | sh"
    exit 1
fi

if ! command -v vercel &> /dev/null; then
    echo -e "${YELLOW}⚠️  Vercel CLI not found. Install it:${NC}"
    echo "   npm i -g vercel"
    exit 1
fi

echo -e "${GREEN}✅ Prerequisites OK${NC}"
echo ""

# 1. Deploy Coordinator to Fly.io
echo -e "${BLUE}📡 Step 1/4: Deploying Coordinator to Fly.io...${NC}"
cd coordinator-service

# Check if fly.toml exists
if [ ! -f fly.toml ]; then
    echo "Creating fly.toml..."
    fly launch --name rma-coordinator --region lhr --no-deploy
fi

# Deploy
fly deploy

# Get coordinator URL
COORDINATOR_URL="https://$(fly info --json | jq -r '.Hostname')"
echo -e "${GREEN}✅ Coordinator deployed: $COORDINATOR_URL${NC}"
echo ""

# 2. Deploy Frontend to Vercel
echo -e "${BLUE}🌐 Step 2/4: Deploying Frontend to Vercel...${NC}"
cd ../frontend

# Update environment variable
cat > .env.production <<EOF
NEXT_PUBLIC_COORDINATOR_URL=$COORDINATOR_URL
NEXT_PUBLIC_NER_SERVICE_URL=$COORDINATOR_URL/api/inference/graph/extract
NEXT_PUBLIC_RAG_SERVICE_URL=$COORDINATOR_URL/api/inference/rag/query
EOF

echo "Environment configured for production"

# Build
npm install
npm run build

# Deploy to Vercel
echo "Deploying to Vercel..."
FRONTEND_URL=$(vercel deploy --prod --yes 2>&1 | grep -o 'https://[^[:space:]]*')
echo -e "${GREEN}✅ Frontend deployed: $FRONTEND_URL${NC}"
echo ""

# 3. Deploy Admin Dashboard to Vercel
echo -e "${BLUE}📊 Step 3/4: Deploying Admin Dashboard to Vercel...${NC}"
cd ../admin-dashboard

# Update vite.config.js with production coordinator
cat > vite.config.js <<EOF
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3001,
    proxy: {
      '/api': {
        target: '$COORDINATOR_URL',
        changeOrigin: true
      }
    }
  }
})
EOF

# Build
npm install
npm run build

# Deploy to Vercel
echo "Deploying to Vercel..."
ADMIN_URL=$(vercel deploy --prod --yes 2>&1 | grep -o 'https://[^[:space:]]*')
echo -e "${GREEN}✅ Admin Dashboard deployed: $ADMIN_URL${NC}"
echo ""

# 4. Create Landing Page
echo -e "${BLUE}🏠 Step 4/4: Creating Landing Page...${NC}"
cd ../landing-page

if [ -f index.html ]; then
    # Update URLs in landing page
    sed -i.bak "s|COORDINATOR_URL|$COORDINATOR_URL|g" index.html
    sed -i.bak "s|FRONTEND_URL|$FRONTEND_URL|g" index.html
    sed -i.bak "s|ADMIN_URL|$ADMIN_URL|g" index.html
    rm index.html.bak

    # Deploy to Vercel
    LANDING_URL=$(vercel deploy --prod --yes 2>&1 | grep -o 'https://[^[:space:]]*')
    echo -e "${GREEN}✅ Landing Page deployed: $LANDING_URL${NC}"
else
    echo -e "${YELLOW}⚠️  Landing page not found. Skipping...${NC}"
fi

echo ""
echo "=================================================="
echo -e "${GREEN}🎉 Deployment Complete!${NC}"
echo "=================================================="
echo ""
echo "📍 Your URLs:"
echo "   Landing Page:     $LANDING_URL"
echo "   Frontend:         $FRONTEND_URL"
echo "   Admin Dashboard:  $ADMIN_URL"
echo "   Coordinator API:  $COORDINATOR_URL"
echo ""
echo "💰 Total Cost: \$0/month"
echo ""
echo "📚 Next Steps:"
echo "   1. Visit the landing page to see your live system"
echo "   2. Download worker agent and start contributing compute"
echo "   3. Share the URLs with your community!"
echo ""
echo "🔧 Useful Commands:"
echo "   fly logs                    # View coordinator logs"
echo "   fly status                  # Check coordinator status"
echo "   vercel ls                   # List all deployments"
echo "   curl $COORDINATOR_URL/health  # Test coordinator"
echo ""
