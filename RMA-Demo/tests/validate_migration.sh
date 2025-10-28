#!/bin/bash

echo "=== RMA-Demo Migration Validation ==="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Phase 1: LangGraph Core Files
echo "Phase 1: LangGraph Core Files"
echo "================================"

phase1_files=(
    "services/rag-service/agent_state.py"
    "services/rag-service/agent_graph.py"
    "services/rag-service/agent_nodes.py"
    "services/rag-service/tools/__init__.py"
    "services/rag-service/tools/numerical_tools.py"
    "services/rag-service/tools/symbolic_tools.py"
    "services/rag-service/tools/threshold_tools.py"
    "services/rag-service/tools/decision_tree_tools.py"
)

for file in "${phase1_files[@]}"; do
    if [ -f "$file" ]; then
        echo -e "${GREEN}✓${NC} $file"
    else
        echo -e "${RED}✗${NC} $file (MISSING)"
    fi
done

echo ""
echo "Phase 2: n8n Integration Files"
echo "================================"

phase2_files=(
    "services/mcp-server/server.py"
    "services/mcp-server/requirements.txt"
    "services/mcp-server/Dockerfile"
    "services/n8n/workflows/client-onboarding.json"
    "services/n8n/workflows/document-processing.json"
)

for file in "${phase2_files[@]}"; do
    if [ -f "$file" ]; then
        echo -e "${GREEN}✓${NC} $file"
    else
        echo -e "${RED}✗${NC} $file (MISSING)"
    fi
done

echo ""
echo "Phase 3: Documentation Files"
echo "================================"

phase3_files=(
    "MIGRATION_PLAN_LANGGRAPH_N8N.md"
    "PHASE1_COMPLETE.md"
    "PHASE2_PHASE3_COMPLETE.md"
    "COMPLETE_MIGRATION_SUMMARY.md"
)

for file in "${phase3_files[@]}"; do
    if [ -f "$file" ]; then
        echo -e "${GREEN}✓${NC} $file"
    else
        echo -e "${RED}✗${NC} $file (MISSING)"
    fi
done

echo ""
echo "Environment Configuration"
echo "================================"

if [ -f ".env.example" ]; then
    echo -e "${GREEN}✓${NC} .env.example"
    if grep -q "USE_LANGGRAPH" .env.example; then
        echo -e "${GREEN}✓${NC} USE_LANGGRAPH flag configured"
    else
        echo -e "${RED}✗${NC} USE_LANGGRAPH flag missing"
    fi
    if grep -q "MCP_API_KEY" .env.example; then
        echo -e "${GREEN}✓${NC} MCP_API_KEY configured"
    else
        echo -e "${RED}✗${NC} MCP_API_KEY missing"
    fi
    if grep -q "N8N_USER" .env.example; then
        echo -e "${GREEN}✓${NC} n8n credentials configured"
    else
        echo -e "${RED}✗${NC} n8n credentials missing"
    fi
else
    echo -e "${RED}✗${NC} .env.example (MISSING)"
fi

echo ""
echo "Docker Services"
echo "================================"

if [ -f "docker-compose.yml" ]; then
    echo -e "${GREEN}✓${NC} docker-compose.yml"
    if grep -q "mcp-server:" docker-compose.yml; then
        echo -e "${GREEN}✓${NC} mcp-server service configured"
    else
        echo -e "${RED}✗${NC} mcp-server service missing"
    fi
    if grep -q "n8n:" docker-compose.yml; then
        echo -e "${GREEN}✓${NC} n8n service configured"
    else
        echo -e "${RED}✗${NC} n8n service missing"
    fi
else
    echo -e "${RED}✗${NC} docker-compose.yml (MISSING)"
fi

echo ""
echo "=== Validation Complete ==="
echo ""
echo "Next Steps:"
echo "1. Copy .env.example to .env and configure your values"
echo "2. Run: docker-compose up --build"
echo "3. Access n8n at http://localhost:5678 (admin/changeme123)"
echo "4. Test agentic query at http://localhost:8102/docs"
echo ""
echo "For detailed instructions, see COMPLETE_MIGRATION_SUMMARY.md"
