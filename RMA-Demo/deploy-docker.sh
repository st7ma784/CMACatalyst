#!/bin/bash

# Neo4j Graph UI - Docker Deployment Script
# This script builds and runs everything via docker-compose

set -e

echo "🐳 Neo4j Graph UI - Docker Deployment"
echo "======================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
COMPOSE_FILE="docker-compose.vllm.yml"
PROJECT_NAME="rma-demo"

# Functions
print_step() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

# Check prerequisites
echo "📋 Checking prerequisites..."
echo ""

if ! command -v docker &> /dev/null; then
    print_error "Docker not found. Please install Docker."
    exit 1
fi
print_step "Docker found"

if ! command -v docker-compose &> /dev/null; then
    print_warning "docker-compose CLI not found, using 'docker compose' instead"
    DOCKER_COMPOSE="docker compose"
else
    DOCKER_COMPOSE="docker-compose"
fi
print_step "Docker Compose available"

# Check GPU availability
echo ""
echo "🖥️  Checking GPU availability..."
if command -v nvidia-smi &> /dev/null; then
    print_step "NVIDIA GPU detected"
    nvidia-smi --query-gpu=index,name --format=csv,noheader | while read gpu; do
        echo "   - $gpu"
    done
else
    print_warning "NVIDIA GPU not detected - will run on CPU (slower)"
    echo "   Note: Some services (Ollama, vLLM) require GPU for good performance"
fi

# Check disk space
echo ""
echo "💾 Checking disk space..."
AVAILABLE_SPACE=$(df /data | awk 'NR==2 {print $4}')
REQUIRED_SPACE=20000000  # ~20GB in KB
if [ "$AVAILABLE_SPACE" -lt "$REQUIRED_SPACE" ]; then
    print_warning "Less than 20GB available disk space"
    echo "   Available: $(($AVAILABLE_SPACE / 1024 / 1024))GB"
    echo "   Recommended: 20GB+"
else
    print_step "Sufficient disk space available"
    echo "   Available: $(($AVAILABLE_SPACE / 1024 / 1024))GB"
fi

# Check ports
echo ""
echo "🔌 Checking required ports..."
PORTS=(3000 5678 7474 7687 8000 8100 8101 8102 8103 8104 8105 8106 8107 8108 11434)
BLOCKED_PORTS=()

for port in "${PORTS[@]}"; do
    if netstat -tulpn 2>/dev/null | grep -q ":$port "; then
        BLOCKED_PORTS+=($port)
    fi
done

if [ ${#BLOCKED_PORTS[@]} -gt 0 ]; then
    print_warning "Some ports are already in use: ${BLOCKED_PORTS[@]}"
    echo "   These services may fail to start:"
    for port in "${BLOCKED_PORTS[@]}"; do
        netstat -tulpn 2>/dev/null | grep ":$port " || true
    done
    read -p "   Continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
else
    print_step "All required ports available"
fi

# Build frontend
echo ""
echo "🔨 Building frontend..."
if [ -f "frontend/package.json" ]; then
    cd frontend
    
    if [ ! -d "node_modules" ]; then
        print_warning "Installing npm dependencies..."
        npm install --silent 2>/dev/null || npm install
    fi
    
    print_step "Building Next.js frontend..."
    npm run build
    
    cd ..
    print_step "Frontend build complete"
else
    print_warning "frontend/package.json not found, skipping frontend build"
fi

# Create .env file if doesn't exist
echo ""
echo "⚙️  Configuring environment..."
if [ ! -f ".env" ]; then
    print_step "Creating .env file with defaults"
    cat > .env << 'EOF'
# Neo4j Configuration
NEO4J_AUTH=neo4j/changeme-in-production

# vLLM Configuration
VLLM_API_KEY=sk-vllm

# JWT Configuration
JWT_SECRET=change-this-in-production-jwt-secret

# MCP Server
MCP_API_KEY=dev-key-change-in-production

# n8n Configuration
N8N_USER=admin
N8N_PASSWORD=changeme123

# Application URL
APP_BASE_URL=http://localhost:3000
EOF
else
    print_step "Using existing .env file"
fi

# Stop existing containers
echo ""
echo "🛑 Stopping existing containers..."
$DOCKER_COMPOSE -f "$COMPOSE_FILE" down 2>/dev/null || true
print_step "Previous containers stopped"

# Pull latest images
echo ""
echo "📥 Pulling latest Docker images..."
$DOCKER_COMPOSE -f "$COMPOSE_FILE" pull 2>/dev/null || print_warning "Could not pull all images"

# Start services
echo ""
echo "🚀 Starting services..."
echo ""
$DOCKER_COMPOSE -f "$COMPOSE_FILE" up -d

print_step "Docker services starting..."
sleep 5

# Check service health
echo ""
echo "🏥 Checking service health..."
echo ""

SERVICES=(
    "rma-frontend:3000"
    "rma-neo4j:7687"
    "rma-ner-graph-service:8108"
    "rma-rag-service:8102"
    "rma-ollama:11434"
    "rma-vllm:8000"
)

for service in "${SERVICES[@]}"; do
    IFS=':' read -r name port <<< "$service"
    if $DOCKER_COMPOSE -f "$COMPOSE_FILE" ps "$name" 2>/dev/null | grep -q "Up"; then
        print_step "$name is running"
    else
        print_warning "$name is starting... (check later with 'docker ps')"
    fi
done

# Show service URLs
echo ""
echo "================================"
echo "✅ Deployment Complete!"
echo "================================"
echo ""
echo "🌐 Access the application at:"
echo ""
echo "   Dashboard:   ${GREEN}http://localhost:3000${NC}"
echo "   Neo4j Graph: ${GREEN}http://localhost:3000/graph${NC}"
echo "   Extract:     ${GREEN}http://localhost:3000/graph/extract${NC}"
echo "   Ingest:      ${GREEN}http://localhost:3000/graph/ingest${NC}"
echo "   Compare:     ${GREEN}http://localhost:3000/graph/compare${NC}"
echo ""
echo "📊 Admin Interfaces:"
echo ""
echo "   Neo4j Browser: ${GREEN}http://localhost:7474${NC}"
echo "   n8n Workflows: ${GREEN}http://localhost:5678${NC}"
echo "   API Docs:      ${GREEN}http://localhost:8100/docs${NC}"
echo ""
echo "🔌 Backend Services:"
echo ""
echo "   NER Service:        http://localhost:8108"
echo "   RAG Service:        http://localhost:8102"
echo "   Doc Processor:      http://localhost:8101"
echo "   OCR Service:        http://localhost:8104"
echo "   vLLM:               http://localhost:8000"
echo "   Ollama:             http://localhost:11434"
echo ""
echo "📝 Sample Documents:"
echo ""
echo "   /manuals/debt-relief-guide.md"
echo "   /manuals/tax-planning-manual.md"
echo ""
echo "🔐 Neo4j Credentials:"
echo ""
echo "   Username: neo4j"
echo "   Password: changeme-in-production"
echo ""
echo "📚 Documentation:"
echo ""
echo "   Quick Start:  README_GRAPH_UI.md"
echo "   User Guide:   GRAPH_UI_QUICK_START.md"
echo "   Deployment:   GRAPH_UI_DEPLOYMENT_CHECKLIST.md"
echo ""
echo "📊 Monitor services:"
echo ""
echo "   docker ps                          # Show running containers"
echo "   docker logs -f rma-frontend        # Frontend logs"
echo "   docker logs -f rma-ner-graph-service # NER service logs"
echo "   docker compose -f docker-compose.vllm.yml logs -f"
echo ""
echo "Stop all services:"
echo ""
echo "   docker compose -f docker-compose.vllm.yml down"
echo ""
echo "================================"
echo ""

# Wait for frontend to be ready
echo "⏳ Waiting for services to be ready..."
sleep 10

# Final health check
echo "Final health check..."
if curl -s http://localhost:3000 > /dev/null 2>&1; then
    print_step "Frontend is accessible!"
    echo ""
    print_step "🎉 Everything is ready to use!"
else
    print_warning "Frontend is still starting, please wait a moment and try again"
    echo ""
    echo "Check logs with:"
    echo "   docker logs -f rma-frontend"
fi

echo ""
echo "Start coding! 🚀"
