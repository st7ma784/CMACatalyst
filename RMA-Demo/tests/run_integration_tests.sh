#!/bin/bash

echo "======================================================================"
echo "RMA-Demo Integration Tests - Phase 4"
echo "LangGraph Migration Validation"
echo "======================================================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if services are running
echo -e "${BLUE}Step 1: Checking service availability...${NC}"
echo ""

check_service() {
    local name=$1
    local url=$2

    if curl -s -f -o /dev/null "$url"; then
        echo -e "${GREEN}✓${NC} $name is running"
        return 0
    else
        echo -e "${RED}✗${NC} $name is not responding"
        return 1
    fi
}

# Check all required services
services_ok=true

check_service "RAG Service" "http://localhost:8102/health" || services_ok=false
check_service "MCP Server" "http://localhost:8105/health" || services_ok=false
check_service "Ollama" "http://localhost:11434/api/tags" || services_ok=false
check_service "ChromaDB" "http://localhost:8005/api/v1/heartbeat" || services_ok=false

echo ""

if [ "$services_ok" = false ]; then
    echo -e "${RED}ERROR: Not all services are running!${NC}"
    echo ""
    echo "Please start services first:"
    echo "  docker-compose up -d"
    echo ""
    exit 1
fi

echo -e "${GREEN}All services are running!${NC}"
echo ""

# Check if pytest is installed
echo -e "${BLUE}Step 2: Checking test dependencies...${NC}"
echo ""

if ! command -v pytest &> /dev/null; then
    echo -e "${YELLOW}⚠${NC} pytest not found. Installing..."
    pip install pytest httpx
else
    echo -e "${GREEN}✓${NC} pytest is installed"
fi

echo ""

# Check if USE_LANGGRAPH is enabled
echo -e "${BLUE}Step 3: Checking LangGraph configuration...${NC}"
echo ""

if docker-compose exec -T rag-service env | grep -q "USE_LANGGRAPH=true"; then
    echo -e "${GREEN}✓${NC} LangGraph is enabled"
else
    echo -e "${YELLOW}⚠${NC} LangGraph may not be enabled"
    echo "  Set USE_LANGGRAPH=true in .env if you want to test the new implementation"
fi

echo ""

# Run tests
echo -e "${BLUE}Step 4: Running integration tests...${NC}"
echo ""

# Create test results directory
mkdir -p test_results

# Run pytest with coverage and generate report
pytest tests/test_integration.py \
    -v \
    --tb=short \
    --color=yes \
    --junit-xml=test_results/junit.xml \
    2>&1 | tee test_results/test_output.log

test_exit_code=${PIPESTATUS[0]}

echo ""
echo "======================================================================"

if [ $test_exit_code -eq 0 ]; then
    echo -e "${GREEN}✓ All tests passed!${NC}"
    echo ""
    echo "Test results saved to test_results/"
    echo ""
    echo "Next steps:"
    echo "  1. Review test output above"
    echo "  2. Check performance metrics"
    echo "  3. Compare with legacy implementation"
    echo "  4. Proceed to Phase 5 (n8n workflows) or Phase 6 (deployment)"
else
    echo -e "${RED}✗ Some tests failed${NC}"
    echo ""
    echo "Please review the test output above and:"
    echo "  1. Check service logs: docker-compose logs rag-service"
    echo "  2. Verify environment configuration"
    echo "  3. Ensure all dependencies are installed"
    echo "  4. Re-run tests after fixing issues"
fi

echo "======================================================================"
echo ""

exit $test_exit_code
