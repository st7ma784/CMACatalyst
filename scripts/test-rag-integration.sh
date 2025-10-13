#!/bin/bash

# RAG Integration Test Script
# This script tests the complete RAG integration across all services

set -e

# Configuration
BASE_URL=${BASE_URL:-"http://localhost:5000"}
RAG_INGESTION_URL=${RAG_INGESTION_URL:-"http://localhost:8004"}
OLLAMA_URL=${OLLAMA_URL:-"http://localhost:11434"}
CHROMADB_URL=${CHROMADB_URL:-"http://localhost:8005"}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_test() {
    echo -e "${BLUE}[TEST]${NC} $1"
}

print_pass() {
    echo -e "${GREEN}[PASS]${NC} $1"
}

print_fail() {
    echo -e "${RED}[FAIL]${NC} $1"
}

print_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

# Test counters
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

run_test() {
    local test_name="$1"
    local test_command="$2"

    print_test "$test_name"
    TESTS_RUN=$((TESTS_RUN + 1))

    if eval "$test_command"; then
        print_pass "$test_name"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        return 0
    else
        print_fail "$test_name"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        return 1
    fi
}

# Test functions
test_service_health() {
    local service_name="$1"
    local url="$2"

    curl -s --connect-timeout 5 --max-time 10 "$url" > /dev/null 2>&1
}

test_rag_search() {
    local response=$(curl -s --connect-timeout 10 --max-time 15 \
        -X POST "$RAG_INGESTION_URL/search" \
        -H "Content-Type: application/json" \
        -d '{"query":"priority debts","top_k":3,"score_threshold":0.5}' 2>/dev/null)

    echo "$response" | grep -q "results"
}

test_rag_chat() {
    local response=$(curl -s --connect-timeout 15 --max-time 30 \
        -X POST "$BASE_URL/api/rag/chat" \
        -H "Content-Type: application/json" \
        -d '{"message":"What are priority debts?","use_rag":true}' 2>/dev/null)

    echo "$response" | grep -q "response"
}

test_ollama_model() {
    local response=$(curl -s --connect-timeout 10 --max-time 30 \
        -X POST "$OLLAMA_URL/api/generate" \
        -H "Content-Type: application/json" \
        -d '{"model":"llama3.1:8b","prompt":"Hello","stream":false}' 2>/dev/null)

    echo "$response" | grep -q "response"
}

test_chromadb_collection() {
    local response=$(curl -s --connect-timeout 5 --max-time 10 \
        "$RAG_INGESTION_URL/collections/stats" 2>/dev/null)

    echo "$response" | grep -q "total_chunks"
}

# Main test execution
echo "🧪 RAG Integration Test Suite"
echo "============================="
echo ""

# Test 1: Service Health Checks
echo "📊 Service Health Tests"
echo "-----------------------"

run_test "Main Application Health" \
    "test_service_health 'Main App' '$BASE_URL/api/test'"

run_test "RAG Ingestion Service Health" \
    "test_service_health 'RAG Ingestion' '$RAG_INGESTION_URL/health'"

run_test "ChromaDB Health" \
    "test_service_health 'ChromaDB' '$CHROMADB_URL/api/v1/heartbeat'"

run_test "Ollama Health" \
    "test_service_health 'Ollama' '$OLLAMA_URL/api/version'"

echo ""

# Test 2: Core RAG Functionality
echo "🔍 RAG Functionality Tests"
echo "---------------------------"

run_test "Vector Collection Statistics" \
    "test_chromadb_collection"

run_test "RAG Search Functionality" \
    "test_rag_search"

run_test "Ollama Model Generation" \
    "test_ollama_model"

run_test "RAG-Enhanced Chat" \
    "test_rag_chat"

echo ""

# Test 3: API Endpoint Tests
echo "🌐 API Endpoint Tests"
echo "---------------------"

run_test "RAG Health Endpoint" \
    "test_service_health 'RAG Health' '$BASE_URL/api/rag/health'"

run_test "RAG Stats Endpoint" \
    "test_service_health 'RAG Stats' '$BASE_URL/api/rag/stats'"

echo ""

# Test 4: Integration Tests
echo "🔗 Integration Tests"
echo "--------------------"

# Test N8N workflow endpoint (if N8N is running)
if curl -s --connect-timeout 3 "http://localhost:5678/healthz" > /dev/null 2>&1; then
    run_test "N8N RAG Assistant Workflow" \
        "curl -s --connect-timeout 10 --max-time 20 \
         -X POST 'http://localhost:5678/webhook/rag-assistant' \
         -H 'Content-Type: application/json' \
         -d '{\"client_id\":\"test_123\",\"question\":\"What are priority debts?\"}' | grep -q 'response'"
else
    print_warn "N8N not available - skipping workflow tests"
fi

# Test document processing with RAG context
run_test "Document Processing with RAG" \
    "curl -s --connect-timeout 10 --max-time 20 \
     '$RAG_INGESTION_URL/search' \
     -X POST -H 'Content-Type: application/json' \
     -d '{\"query\":\"document analysis\",\"manual_type\":\"debt-procedures\"}' | grep -q 'results'"

echo ""

# Test Results Summary
echo "📋 Test Results Summary"
echo "======================="
echo "Tests Run: $TESTS_RUN"
echo "Tests Passed: $TESTS_PASSED"
echo "Tests Failed: $TESTS_FAILED"

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ All tests passed! RAG integration is working correctly.${NC}"
    echo ""
    echo "🎉 RAG System Status: OPERATIONAL"
    echo ""
    echo "Next steps:"
    echo "1. Upload training manuals via the web interface"
    echo "2. Test real conversations with the enhanced chatbot"
    echo "3. Monitor system performance under load"

    exit 0
else
    echo -e "${RED}❌ Some tests failed. Please check the service logs.${NC}"
    echo ""
    echo "🔧 Troubleshooting suggestions:"
    echo "1. Check service logs: docker-compose logs -f"
    echo "2. Verify all services are running: docker-compose ps"
    echo "3. Run initialization script: ./scripts/rag-init.sh"
    echo "4. Check network connectivity between services"

    exit 1
fi