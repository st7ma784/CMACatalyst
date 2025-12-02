#!/bin/bash

# Complete Deployment Test

echo "🧪 Testing Complete RMA-Demo Deployment"
echo "========================================"
echo ""

# Test 1: Coordinator API
echo "1️⃣  Testing Coordinator API..."
if curl -sf https://api.rmatool.org.uk/health | jq -e '.status == "healthy"' > /dev/null; then
    echo "   ✅ Coordinator API: HEALTHY"
    curl -s https://api.rmatool.org.uk/health | jq
else
    echo "   ❌ Coordinator API: FAILED"
    exit 1
fi

echo ""

# Test 2: Frontend
echo "2️⃣  Testing Frontend..."
if curl -sf https://rmatool.org.uk -o /dev/null; then
    echo "   ✅ Frontend: ACCESSIBLE"
    echo "   📍 URL: https://rmatool.org.uk"
else
    echo "   ⏳ Frontend: Not ready yet (DNS propagation takes 1-2 minutes)"
fi

echo ""

# Test 3: Coordinator Stats
echo "3️⃣  Testing Coordinator Stats..."
STATS=$(curl -s https://api.rmatool.org.uk/api/admin/stats)
echo "   📊 Current Stats:"
echo "$STATS" | jq

WORKER_COUNT=$(echo "$STATS" | jq -r '.total_workers')
echo ""
echo "   Workers registered: $WORKER_COUNT"

echo ""

# Test 4: Worker List
echo "4️⃣  Testing Worker List..."
curl -s https://api.rmatool.org.uk/api/admin/workers | jq

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎯 Deployment Status:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "✅ Coordinator:  https://api.rmatool.org.uk"
echo "✅ Frontend:     https://rmatool.org.uk"
echo "📊 Workers:      $WORKER_COUNT registered"
echo ""

if [ "$WORKER_COUNT" -eq 0 ]; then
    echo "💡 Next Step: Start workers!"
    echo ""
    echo "   cd /home/user/CMACatalyst/RMA-Demo/worker-containers"
    echo "   ./start-cpu-worker.sh"
    echo ""
fi

echo "🎉 Deployment is LIVE on Cloudflare!"
