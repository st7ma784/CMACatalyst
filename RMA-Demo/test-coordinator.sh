#!/bin/bash

# Test RMA Coordinator Deployment

echo "🧪 Testing RMA Coordinator"
echo "=========================="
echo ""

# Test workers.dev URL
echo "1️⃣ Testing workers.dev URL..."
WORKERS_URL="https://rma-coordinator.s-mander3.workers.dev"
if curl -sf "$WORKERS_URL/health" | jq -e '.status == "healthy"' > /dev/null; then
    echo "   ✅ Workers.dev URL working"
    curl -s "$WORKERS_URL/health" | jq
else
    echo "   ❌ Workers.dev URL failed"
fi

echo ""

# Test custom domain
echo "2️⃣ Testing custom domain..."
CUSTOM_URL="https://api.rmatool.org.uk"
if curl -sf "$CUSTOM_URL/health" | jq -e '.status == "healthy"' > /dev/null 2>&1; then
    echo "   ✅ Custom domain working"
    curl -s "$CUSTOM_URL/health" | jq
else
    echo "   ⏳ Custom domain not ready yet (this is normal, can take 1-2 minutes)"
    echo "   Error: $(curl -s "$CUSTOM_URL/health" 2>&1 | head -1)"
fi

echo ""

# Test stats endpoint
echo "3️⃣ Testing stats endpoint..."
if curl -sf "$CUSTOM_URL/api/admin/stats" > /dev/null 2>&1; then
    echo "   ✅ Stats endpoint working"
    curl -s "$CUSTOM_URL/api/admin/stats" | jq
else
    echo "   ⚠️  Using workers.dev URL instead:"
    curl -s "$WORKERS_URL/api/admin/stats" | jq
fi

echo ""
echo "🎯 Summary:"
echo "   Workers URL: $WORKERS_URL"
echo "   Custom URL:  $CUSTOM_URL"
echo ""
echo "If custom domain isn't working yet, wait 1-2 minutes and run this script again."
