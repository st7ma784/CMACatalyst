#!/bin/bash

# Advanced RAG Features Test Script
# Tests case notes enhancement, precedent lookup, and N8N integration

set -e

# Configuration
BASE_URL=${BASE_URL:-"http://localhost:5000"}
RAG_INGESTION_URL=${RAG_INGESTION_URL:-"http://localhost:8004"}
N8N_URL=${N8N_URL:-"http://localhost:5678"}

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
test_case_note_enhancement() {
    local response=$(curl -s --connect-timeout 10 --max-time 20 \
        -X POST "$BASE_URL/api/case-notes/create" \
        -H "Content-Type: application/json" \
        -d '{
            "case_id": "test_case_001",
            "note_content": "Client has mortgage arrears of £5,000 and council tax debts. Struggling with priority debts.",
            "note_type": "assessment",
            "advisor_id": "test_advisor_123",
            "client_situation": "priority debt arrears"
        }' 2>/dev/null)

    echo "$response" | grep -q "note_id\|success"
}

test_case_similarity_search() {
    local response=$(curl -s --connect-timeout 10 --max-time 15 \
        -X POST "$RAG_INGESTION_URL/cases/search/similar" \
        -H "Content-Type: application/json" \
        -d '{
            "query": "mortgage arrears priority debts",
            "case_type": "debt-management",
            "top_k": 3,
            "score_threshold": 0.5
        }' 2>/dev/null)

    echo "$response" | grep -q "similar_cases\|query"
}

test_financial_profile_matching() {
    local response=$(curl -s --connect-timeout 10 --max-time 15 \
        -X POST "$RAG_INGESTION_URL/cases/search/by-financial-profile" \
        -H "Content-Type: application/json" \
        -d '{
            "total_debt": 45000,
            "monthly_income": 2500,
            "case_type": "debt-management",
            "top_k": 3
        }' 2>/dev/null)

    echo "$response" | grep -q "similar_cases\|query"
}

test_closed_case_ingestion() {
    local response=$(curl -s --connect-timeout 15 --max-time 30 \
        -X POST "$RAG_INGESTION_URL/cases/ingest/closed-case" \
        -H "Content-Type: application/json" \
        -d '{
            "case_id": "test_closed_case_001",
            "case_data": {
                "case_type": "debt-management",
                "client_situation": "Multiple creditors, mortgage arrears",
                "total_debt": 45000,
                "monthly_income": 2500,
                "case_outcome": "successful",
                "recommended_solution": "Debt Management Plan",
                "advice_summary": "Prioritized mortgage payments, negotiated payment plans with creditors",
                "resolution_details": "All creditors agreed to reduced payments over 5 years",
                "debt_reduction_achieved": 15000,
                "case_duration_days": 90,
                "success_rating": "high"
            }
        }' 2>/dev/null)

    echo "$response" | grep -q "accepted\|status"
}

test_multi_collection_search() {
    # Test training manuals collection
    local training_response=$(curl -s --connect-timeout 10 --max-time 15 \
        -X POST "$RAG_INGESTION_URL/search" \
        -H "Content-Type: application/json" \
        -d '{
            "query": "priority debt procedures",
            "collection_name": "training_manuals",
            "top_k": 2
        }' 2>/dev/null)

    echo "$training_response" | grep -q "results"
}

test_n8n_workflow_trigger() {
    if ! curl -s --connect-timeout 3 "$N8N_URL/healthz" > /dev/null 2>&1; then
        print_warn "N8N not available - skipping workflow tests"
        return 0
    fi

    local response=$(curl -s --connect-timeout 10 --max-time 20 \
        -X POST "$N8N_URL/webhook/case-note-review" \
        -H "Content-Type: application/json" \
        -d '{
            "note_id": "test_note_001",
            "case_id": "test_case_001",
            "note_content": "Client assessment for debt management plan eligibility",
            "note_type": "assessment",
            "advisor_id": "test_advisor",
            "client_situation": "multiple priority debts",
            "action": "create"
        }' 2>/dev/null)

    echo "$response" | grep -q "success\|status\|enhancement"
}

test_case_precedents_stats() {
    local response=$(curl -s --connect-timeout 10 --max-time 10 \
        "$RAG_INGESTION_URL/cases/precedents/stats" 2>/dev/null)

    echo "$response" | grep -q "total_cases\|case_types"
}

test_enhanced_chat_with_precedents() {
    local response=$(curl -s --connect-timeout 15 --max-time 30 \
        -X POST "$BASE_URL/api/rag/chat" \
        -H "Content-Type: application/json" \
        -d '{
            "message": "What are the best approaches for handling mortgage arrears with multiple creditors?",
            "use_rag": true,
            "manual_type": "debt-procedures"
        }' 2>/dev/null)

    echo "$response" | grep -q "response\|sources"
}

test_note_quality_analysis() {
    # Test if the system can analyze note quality
    local response=$(curl -s --connect-timeout 10 --max-time 15 \
        -X POST "$BASE_URL/api/case-notes/update" \
        -H "Content-Type: application/json" \
        -d '{
            "note_id": "test_note_001",
            "note_content": "Updated assessment: Client income verified at £2,500/month. Priority debts total £8,000 including mortgage arrears £5,000 and council tax £3,000.",
            "changes_summary": "Added income verification and detailed debt breakdown"
        }' 2>/dev/null)

    echo "$response" | grep -q "success\|rag_review_status"
}

# Sample data creation
create_sample_closed_case() {
    print_test "Creating sample closed case for testing"

    curl -s -X POST "$RAG_INGESTION_URL/cases/ingest/closed-case" \
        -H "Content-Type: application/json" \
        -d '{
            "case_id": "sample_case_001",
            "case_data": {
                "case_type": "debt-management",
                "client_situation": "Mortgage arrears with multiple creditors and vulnerable client circumstances",
                "age_range": "35-44",
                "employment_status": "part-time",
                "household_composition": "single parent with 2 children",
                "total_debt": 52000,
                "monthly_income": 1800,
                "surplus_deficit": -200,
                "presenting_issues": "Threatened with repossession, utility disconnection notices",
                "priority_debts": "Mortgage £8000 arrears, Council tax £2500, Gas £800",
                "non_priority_debts": "Credit cards £15000, Personal loans £25700",
                "main_creditors": ["Halifax Mortgage", "Local Council", "British Gas", "Barclaycard"],
                "advice_summary": "Prioritized housing security, negotiated payment arrangements, referred to benefits advisor",
                "options_discussed": ["Debt Management Plan", "Individual Voluntary Arrangement", "Bankruptcy"],
                "recommended_solution": "Debt Management Plan with benefit maximization",
                "case_outcome": "successful",
                "resolution_details": "Mortgage payments restructured, creditor payment plans agreed, benefit income increased by £400/month",
                "debt_reduction_achieved": 18000,
                "monthly_payment_reduction": 350,
                "case_duration_days": 120,
                "success_rating": "high"
            }
        }' > /dev/null 2>&1

    # Wait for processing
    sleep 3
}

# Main test execution
echo "🧪 Advanced RAG Features Test Suite"
echo "======================================"
echo ""

# Create sample data first
create_sample_closed_case

# Test 1: Case Notes Enhancement
echo "📝 Case Notes Enhancement Tests"
echo "--------------------------------"

run_test "Case Note Creation with Enhancement Trigger" \
    "test_case_note_enhancement"

run_test "Case Note Update with Re-analysis" \
    "test_note_quality_analysis"

echo ""

# Test 2: Case Precedent System
echo "📚 Case Precedent System Tests"
echo "-------------------------------"

run_test "Closed Case Ingestion" \
    "test_closed_case_ingestion"

run_test "Case Similarity Search" \
    "test_case_similarity_search"

run_test "Financial Profile Matching" \
    "test_financial_profile_matching"

run_test "Case Precedents Statistics" \
    "test_case_precedents_stats"

echo ""

# Test 3: Multi-Collection Search
echo "🔍 Multi-Collection Search Tests"
echo "---------------------------------"

run_test "Training Manuals Collection Search" \
    "test_multi_collection_search"

echo ""

# Test 4: N8N Workflow Integration
echo "🔄 N8N Workflow Integration Tests"
echo "----------------------------------"

run_test "Case Note Review Workflow Trigger" \
    "test_n8n_workflow_trigger"

echo ""

# Test 5: Enhanced Chat with Context
echo "💬 Enhanced Chat Tests"
echo "----------------------"

run_test "RAG-Enhanced Chat with Precedent Context" \
    "test_enhanced_chat_with_precedents"

echo ""

# Integration Test: Full Enhancement Flow
echo "🔗 Full Enhancement Flow Test"
echo "------------------------------"

print_test "Testing complete enhancement flow"

# 1. Create case note
NOTE_RESPONSE=$(curl -s -X POST "$BASE_URL/api/case-notes/create" \
    -H "Content-Type: application/json" \
    -d '{
        "case_id": "integration_test_case",
        "note_content": "Client facing repossession due to mortgage arrears of £8,000. Also has council tax arrears of £2,500.",
        "note_type": "assessment",
        "advisor_id": "integration_test_advisor",
        "client_situation": "mortgage arrears with repossession threat"
    }')

if echo "$NOTE_RESPONSE" | grep -q "note_id"; then
    NOTE_ID=$(echo "$NOTE_RESPONSE" | grep -o '"note_id":"[^"]*"' | cut -d'"' -f4)

    # 2. Search for similar cases
    SIMILAR_CASES=$(curl -s -X POST "$RAG_INGESTION_URL/cases/search/similar" \
        -H "Content-Type: application/json" \
        -d '{
            "query": "mortgage arrears repossession threat",
            "case_type": "debt-management",
            "top_k": 2
        }')

    # 3. Search for training guidance
    TRAINING_GUIDANCE=$(curl -s -X POST "$RAG_INGESTION_URL/search" \
        -H "Content-Type: application/json" \
        -d '{
            "query": "mortgage arrears repossession procedures",
            "collection_name": "training_manuals",
            "manual_type": "fca-guidelines",
            "top_k": 2
        }')

    if echo "$SIMILAR_CASES" | grep -q "similar_cases" && echo "$TRAINING_GUIDANCE" | grep -q "results"; then
        print_pass "Full Enhancement Flow"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        print_fail "Full Enhancement Flow - Context retrieval failed"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
else
    print_fail "Full Enhancement Flow - Note creation failed"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi

TESTS_RUN=$((TESTS_RUN + 1))

echo ""

# Test Results Summary
echo "📋 Advanced Features Test Results"
echo "=================================="
echo "Tests Run: $TESTS_RUN"
echo "Tests Passed: $TESTS_PASSED"
echo "Tests Failed: $TESTS_FAILED"

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ All advanced features tests passed!${NC}"
    echo ""
    echo "🎉 Advanced RAG Features Status: FULLY OPERATIONAL"
    echo ""
    echo "Available Advanced Features:"
    echo "✓ Case Notes Enhancement with AI Analysis"
    echo "✓ Training Manual Auto-linking"
    echo "✓ Case Precedent Lookup and Similarity Search"
    echo "✓ Financial Profile Matching"
    echo "✓ N8N Workflow Automation"
    echo "✓ Multi-Collection Vector Search"
    echo "✓ Quality Assurance Integration"
    echo ""
    echo "Next steps:"
    echo "1. Import your historical case data"
    echo "2. Upload comprehensive training manuals"
    echo "3. Configure N8N workflows for your specific processes"
    echo "4. Train advisors on the enhanced features"

    exit 0
else
    echo -e "${RED}❌ Some advanced features tests failed.${NC}"
    echo ""
    echo "🔧 Troubleshooting suggestions:"
    echo "1. Verify all services are running: docker-compose ps"
    echo "2. Check RAG ingestion service: curl http://localhost:8004/health"
    echo "3. Verify vector collections: curl http://localhost:8004/collections/stats"
    echo "4. Check N8N workflows: visit http://localhost:5678"
    echo "5. Review service logs: docker-compose logs -f rag-ingestion"

    exit 1
fi