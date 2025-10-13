#!/bin/bash

# RAG System Initialization Script
# This script sets up the RAG environment by pulling required models and initializing services

set -e

echo "🚀 Initializing RAG System for CMA Catalyst..."

# Configuration
OLLAMA_URL=${OLLAMA_URL:-"http://localhost:11434"}
RAG_INGESTION_URL=${RAG_INGESTION_URL:-"http://localhost:8004"}
CHROMADB_URL=${CHROMADB_URL:-"http://localhost:8005"}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to wait for service to be ready
wait_for_service() {
    local url=$1
    local service_name=$2
    local max_attempts=30
    local attempt=1

    print_status "Waiting for $service_name to be ready..."

    while [ $attempt -le $max_attempts ]; do
        if curl -s --connect-timeout 2 "$url" > /dev/null 2>&1; then
            print_success "$service_name is ready!"
            return 0
        fi

        print_status "Attempt $attempt/$max_attempts - $service_name not ready yet..."
        sleep 2
        ((attempt++))
    done

    print_error "$service_name failed to start after $max_attempts attempts"
    return 1
}

# Function to pull Ollama model
pull_ollama_model() {
    local model=$1
    print_status "Pulling Ollama model: $model"

    if docker exec cma-ollama ollama pull "$model"; then
        print_success "Successfully pulled $model"
    else
        print_error "Failed to pull $model"
        return 1
    fi
}

# Function to test model
test_ollama_model() {
    local model=$1
    print_status "Testing model: $model"

    local test_response=$(curl -s -X POST "$OLLAMA_URL/api/generate" \
        -H "Content-Type: application/json" \
        -d "{\"model\":\"$model\",\"prompt\":\"Hello\",\"stream\":false}" \
        --connect-timeout 10 --max-time 30)

    if echo "$test_response" | grep -q "response"; then
        print_success "Model $model is working correctly"
        return 0
    else
        print_error "Model $model test failed"
        return 1
    fi
}

# Function to create sample training manual
create_sample_manual() {
    print_status "Creating sample training manual..."

    local sample_dir="./uploads/training-manuals"
    mkdir -p "$sample_dir"

    cat > "$sample_dir/sample-debt-advice-guide.txt" << 'EOF'
# Sample Debt Advice Training Manual

## FCA Guidelines for Debt Advice

### Priority Debts
Priority debts are those that can result in serious consequences if not paid:
- Mortgage or rent arrears
- Council tax
- Gas and electricity bills
- Court fines
- TV licence
- Child maintenance

### Non-Priority Debts
Non-priority debts typically cannot result in loss of home or imprisonment:
- Credit card debts
- Store cards
- Personal loans
- Overdrafts
- Hire purchase agreements

### Debt Solutions
1. **Debt Management Plan (DMP)**: Informal arrangement to pay creditors
2. **Individual Voluntary Arrangement (IVA)**: Formal insolvency procedure
3. **Debt Relief Order (DRO)**: For people with low income and assets
4. **Bankruptcy**: Last resort for severe debt problems

### Affordability Assessment
When assessing affordability:
- Calculate total monthly income
- List all essential expenditure
- Identify disposable income
- Ensure basic living standards are maintained
- Consider future changes in circumstances

### Vulnerable Customers
Special care must be taken with vulnerable customers:
- Mental health issues
- Learning difficulties
- Physical disabilities
- Recent bereavement
- Language barriers

### FCA Principles
- Treat customers fairly
- Provide clear information
- Act in customer's best interests
- Maintain professional standards
- Keep accurate records
EOF

    print_success "Sample training manual created at $sample_dir/sample-debt-advice-guide.txt"
}

# Function to ingest sample manual
ingest_sample_manual() {
    print_status "Ingesting sample training manual..."

    local response=$(curl -s -X POST "$RAG_INGESTION_URL/ingest/manual" \
        -H "Content-Type: application/json" \
        -d '{"file_path":"training-manuals/sample-debt-advice-guide.txt","manual_type":"fca-guidelines","force_reprocess":true}' \
        --connect-timeout 10 --max-time 60)

    if echo "$response" | grep -q "success\|accepted"; then
        print_success "Sample manual ingestion started"
    else
        print_warning "Sample manual ingestion may have failed: $response"
    fi
}

# Function to test RAG search
test_rag_search() {
    print_status "Testing RAG search functionality..."

    # Wait a bit for ingestion to process
    sleep 10

    local response=$(curl -s -X POST "$RAG_INGESTION_URL/search" \
        -H "Content-Type: application/json" \
        -d '{"query":"What are priority debts?","top_k":3,"score_threshold":0.5}' \
        --connect-timeout 10 --max-time 15)

    if echo "$response" | grep -q "results"; then
        local result_count=$(echo "$response" | grep -o '"total_results":[0-9]*' | cut -d':' -f2)
        print_success "RAG search working - found $result_count results"
    else
        print_warning "RAG search test inconclusive: $response"
    fi
}

# Main initialization sequence
main() {
    print_status "Starting RAG System Initialization..."

    # 1. Wait for services to be ready
    print_status "Step 1: Checking service availability..."
    wait_for_service "$OLLAMA_URL/api/version" "Ollama" || exit 1
    wait_for_service "$CHROMADB_URL/api/v1/heartbeat" "ChromaDB" || exit 1
    wait_for_service "$RAG_INGESTION_URL/health" "RAG Ingestion Service" || exit 1

    # 2. Pull required Ollama models
    print_status "Step 2: Setting up Ollama models..."

    # Pull LLaMA model for chat
    pull_ollama_model "llama3.1:8b" || {
        print_warning "Failed to pull llama3.1:8b, trying smaller model..."
        pull_ollama_model "llama3.1:latest" || {
            print_warning "Failed to pull llama3.1:latest, trying llama2..."
            pull_ollama_model "llama2:7b" || print_error "All LLaMA model pulls failed"
        }
    }

    # Pull embedding model
    pull_ollama_model "nomic-embed-text" || {
        print_warning "Failed to pull nomic-embed-text, trying alternative..."
        pull_ollama_model "all-minilm" || print_error "Embedding model pull failed"
    }

    # 3. Test models
    print_status "Step 3: Testing models..."

    # Test available models
    local available_models=$(curl -s "$OLLAMA_URL/api/tags" | grep -o '"name":"[^"]*"' | cut -d'"' -f4 | head -5)

    for model in $available_models; do
        if [[ "$model" == *"llama"* ]] || [[ "$model" == *"embed"* ]]; then
            test_ollama_model "$model" || print_warning "Model $model test failed"
        fi
    done

    # 4. Set up sample training data
    print_status "Step 4: Setting up sample training data..."
    create_sample_manual
    ingest_sample_manual

    # 5. Test RAG functionality
    print_status "Step 5: Testing RAG functionality..."
    test_rag_search

    # 6. Display system status
    print_status "Step 6: System Status Summary..."

    echo ""
    echo "🎉 RAG System Initialization Complete!"
    echo ""
    echo "📊 Service URLs:"
    echo "  - Ollama API: $OLLAMA_URL"
    echo "  - ChromaDB: $CHROMADB_URL"
    echo "  - RAG Ingestion: $RAG_INGESTION_URL"
    echo ""
    echo "🔍 Available Models:"
    curl -s "$OLLAMA_URL/api/tags" | grep -o '"name":"[^"]*"' | cut -d'"' -f4 | sed 's/^/  - /'
    echo ""
    echo "📚 Collection Stats:"
    curl -s "$RAG_INGESTION_URL/collections/stats" | python3 -m json.tool 2>/dev/null || echo "  - Stats unavailable"
    echo ""
    echo "✅ Next Steps:"
    echo "  1. Upload training manuals via the web interface"
    echo "  2. Test the RAG-enhanced chat functionality"
    echo "  3. Monitor logs for any issues"
    echo ""

    print_success "RAG System is ready for use!"
}

# Handle script interruption
trap 'print_error "Script interrupted"; exit 1' INT TERM

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    print_error "Docker is not running. Please start Docker first."
    exit 1
fi

# Run main function
main "$@"