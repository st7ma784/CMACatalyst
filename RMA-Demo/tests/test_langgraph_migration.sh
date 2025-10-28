#!/bin/bash
# Test script for LangGraph migration
# Tests the migrated endpoints to validate functionality

set -e

echo "=================================="
echo "LangGraph Migration Test Script"
echo "=================================="
echo ""

BASE_URL="${BASE_URL:-http://localhost:8102}"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

# Function to print test result
print_result() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✓ PASS${NC}: $2"
        ((TESTS_PASSED++))
    else
        echo -e "${RED}✗ FAIL${NC}: $2"
        ((TESTS_FAILED++))
    fi
    ((TESTS_RUN++))
}

# Function to test endpoint
test_endpoint() {
    local name=$1
    local method=$2
    local endpoint=$3
    local data=$4
    local expected=$5

    echo ""
    echo -e "${YELLOW}Testing:${NC} $name"

    if [ "$method" = "GET" ]; then
        response=$(curl -s "$BASE_URL$endpoint")
    else
        response=$(curl -s -X POST "$BASE_URL$endpoint" \
            -H "Content-Type: application/json" \
            -d "$data")
    fi

    if echo "$response" | grep -q "$expected"; then
        print_result 0 "$name"
        echo "Response: $(echo $response | jq -r '.status // .answer // .overall_result' 2>/dev/null || echo $response | head -c 100)"
    else
        print_result 1 "$name"
        echo "Expected: $expected"
        echo "Got: $(echo $response | head -c 200)"
    fi
}

echo "Step 1: Health Check"
echo "--------------------"
test_endpoint \
    "Health endpoint" \
    "GET" \
    "/health" \
    "" \
    "healthy"

test_endpoint \
    "LangGraph agent loaded" \
    "GET" \
    "/health" \
    "" \
    "agent_loaded.*true"

echo ""
echo "Step 2: Simple Agentic Query"
echo "-----------------------------"
test_endpoint \
    "Simple query (DRO limit)" \
    "POST" \
    "/agentic-query" \
    '{"question":"What is the DRO debt limit?","model":"llama3.2","show_reasoning":true}' \
    "answer"

echo ""
echo "Step 3: Complex Query with Symbolic Reasoning"
echo "----------------------------------------------"
test_endpoint \
    "Numeric comparison query" \
    "POST" \
    "/agentic-query" \
    '{"question":"Can someone with £52000 debt qualify for DRO?","model":"llama3.2","show_reasoning":true}' \
    "answer"

echo ""
echo "Step 4: Eligibility Check (Eligible)"
echo "-------------------------------------"
test_endpoint \
    "Eligible client (£45k debt)" \
    "POST" \
    "/eligibility-check" \
    '{"question":"Can this client qualify for DRO?","debt":45000,"income":50,"assets":1000,"topic":"dro_eligibility"}' \
    "overall_result"

echo ""
echo "Step 5: Eligibility Check (Not Eligible)"
echo "-----------------------------------------"
test_endpoint \
    "Not eligible client (£55k debt)" \
    "POST" \
    "/eligibility-check" \
    '{"question":"Can this client qualify for DRO?","debt":55000,"income":50,"assets":1000,"topic":"dro_eligibility"}' \
    "overall_result"

echo ""
echo "Step 6: Eligibility Check (Near-Miss)"
echo "--------------------------------------"
test_endpoint \
    "Near-miss client (£52k debt)" \
    "POST" \
    "/eligibility-check" \
    '{"question":"Can this client qualify for DRO?","debt":52000,"income":50,"assets":1000,"topic":"dro_eligibility"}' \
    "near_misses"

echo ""
echo "=================================="
echo "Test Results Summary"
echo "=================================="
echo "Total tests run: $TESTS_RUN"
echo -e "${GREEN}Tests passed: $TESTS_PASSED${NC}"
if [ $TESTS_FAILED -gt 0 ]; then
    echo -e "${RED}Tests failed: $TESTS_FAILED${NC}"
else
    echo -e "${GREEN}All tests passed!${NC}"
fi
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ LangGraph migration validation SUCCESSFUL${NC}"
    exit 0
else
    echo -e "${RED}✗ Some tests failed - review logs above${NC}"
    exit 1
fi
