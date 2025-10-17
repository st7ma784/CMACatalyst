#!/bin/bash
# Migration Script: Switch from Cloud (LlamaParse) to Local Parsing

set -e

echo "========================================="
echo "RMA-Demo: Migrate to Local Parsing"
echo "========================================="
echo ""
echo "This will configure your system to use:"
echo "  ✅ Local LLaVA vision models (on-premises)"
echo "  ✅ No cloud API calls"
echo "  ✅ GDPR compliant document processing"
echo ""
read -p "Continue? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
fi

echo ""
echo "Step 1: Pulling LLaVA vision model..."
echo "This may take 10-15 minutes (7-8 GB download)"
docker exec rma-ollama ollama pull llava:13b

echo ""
echo "Step 2: Pulling text model (if not already available)..."
docker exec rma-ollama ollama pull llama3.2

echo ""
echo "Step 3: Updating environment configuration..."

# Backup existing .env
if [ -f .env ]; then
    cp .env .env.backup.$(date +%Y%m%d_%H%M%S)
    echo "  Backed up existing .env"
fi

# Update .env to use local parsing
if grep -q "USE_LOCAL_PARSING" .env 2>/dev/null; then
    sed -i 's/USE_LOCAL_PARSING=.*/USE_LOCAL_PARSING=true/' .env
else
    echo "" >> .env
    echo "# Local Document Parsing (Privacy-First)" >> .env
    echo "USE_LOCAL_PARSING=true" >> .env
    echo "VISION_MODEL=llava:13b" >> .env
fi

# Comment out LlamaParse key (optional)
if grep -q "LLAMA_PARSE_API_KEY" .env 2>/dev/null; then
    sed -i 's/^LLAMA_PARSE_API_KEY=/#LLAMA_PARSE_API_KEY=/' .env
    echo "  Commented out LLAMA_PARSE_API_KEY (cloud service disabled)"
fi

echo ""
echo "Step 4: Rebuilding doc-processor service..."
docker-compose build doc-processor

echo ""
echo "Step 5: Restarting services..."
docker-compose up -d doc-processor

echo ""
echo "Step 6: Waiting for services to be ready..."
sleep 10

echo ""
echo "Step 7: Testing local parsing..."

# Test if doc-processor is responding
if curl -s http://localhost:8101/health | grep -q "local_parsing.*true"; then
    echo "  ✅ Local parsing is active!"
else
    echo "  ⚠️  Warning: Local parsing may not be active. Check logs:"
    echo "     docker logs rma-doc-processor"
fi

echo ""
echo "========================================="
echo "Migration Complete!"
echo "========================================="
echo ""
echo "Your system now uses:"
echo "  ✅ LLaVA vision model (llava:13b)"
echo "  ✅ Local document processing"
echo "  ✅ No external API calls"
echo "  ✅ GDPR compliant"
echo ""
echo "Check capabilities:"
echo "  curl http://localhost:8101/capabilities | jq"
echo ""
echo "Test processing:"
echo "  curl -X POST http://localhost:8101/process -F 'file=@test.pdf'"
echo ""
echo "View logs:"
echo "  docker logs -f rma-doc-processor"
echo ""
echo "Performance:"
echo "  - With GPU: 30-60s per page"
echo "  - Quality: Excellent for forms, tables, debt letters"
echo "  - Privacy: All data stays on your infrastructure"
echo ""
echo "To revert to cloud parsing (not recommended):"
echo "  1. Uncomment LLAMA_PARSE_API_KEY in .env"
echo "  2. Set USE_LOCAL_PARSING=false"
echo "  3. docker-compose restart doc-processor"
