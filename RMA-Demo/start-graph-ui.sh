#!/bin/bash

# Neo4j Graph UI - Quick Start Script
# Run this to get everything up and running

set -e

echo "🚀 Neo4j Graph UI - Quick Start"
echo "================================"
echo ""

# Check Docker
echo "✓ Checking Docker..."
if ! command -v docker &> /dev/null; then
    echo "✗ Docker not found. Please install Docker."
    exit 1
fi

echo "✓ Docker found"
echo ""

# Start services
echo "🐳 Starting Docker services..."
cd /data/CMACatalyst/RMA-Demo
docker-compose -f docker-compose.vllm.yml up -d

echo "⏳ Waiting for services to be ready..."
sleep 10

# Check services
echo ""
echo "🔍 Checking service health..."

# NER Service
if curl -s http://localhost:8108/health > /dev/null 2>&1; then
    echo "  ✓ NER Service (8108) - OK"
else
    echo "  ⚠ NER Service (8108) - Starting..."
fi

# RAG Service
if curl -s http://localhost:8102/health > /dev/null 2>&1; then
    echo "  ✓ RAG Service (8102) - OK"
else
    echo "  ⚠ RAG Service (8102) - Starting..."
fi

# Neo4j
if curl -s http://localhost:7474 > /dev/null 2>&1; then
    echo "  ✓ Neo4j (7474) - OK"
else
    echo "  ⚠ Neo4j (7474) - Starting..."
fi

echo ""
echo "📦 Starting frontend..."
cd /data/CMACatalyst/RMA-Demo/frontend

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "   Installing dependencies..."
    npm install
fi

echo "   Starting Next.js dev server on port 3000..."
npm run dev &
FRONTEND_PID=$!

echo ""
echo "================================"
echo "✅ Application Started!"
echo "================================"
echo ""
echo "📍 Access the dashboard at:"
echo "   🌐 http://localhost:3000/graph"
echo ""
echo "Tools available:"
echo "   📊 Extract: http://localhost:3000/graph/extract"
echo "   📁 Ingest: http://localhost:3000/graph/ingest"
echo "   ⚖️  Compare: http://localhost:3000/graph/compare"
echo ""
echo "Services running:"
echo "   🟢 Frontend: http://localhost:3000"
echo "   🟢 NER Service: http://localhost:8108"
echo "   🟢 RAG Service: http://localhost:8102"
echo "   🟢 Neo4j: http://localhost:7474"
echo ""
echo "Sample documents ready:"
echo "   📄 /manuals/debt-relief-guide.md"
echo "   📄 /manuals/tax-planning-manual.md"
echo ""
echo "Documentation:"
echo "   📖 Quick Start: GRAPH_UI_QUICK_START.md"
echo "   📖 Features: GRAPH_UI_COMPLETE.md"
echo "   📖 Deployment: GRAPH_UI_DEPLOYMENT_CHECKLIST.md"
echo ""
echo "Type Ctrl+C to stop"
echo ""

wait $FRONTEND_PID
