#!/bin/bash

###############################################################################
# RMA-Demo Deployment Script
# Deploys complete Neo4j + vLLM + GPU-optimized stack
# 
# Usage:
#   ./deploy-vllm-local.sh [start|stop|restart|logs|status|clean]
#
# Requirements:
#   - Docker & Docker Compose
#   - 2× GPUs with 24GB+ VRAM each
#   - 32GB+ system RAM
#   - 100GB+ free disk space
###############################################################################

set -e

COMPOSE_FILE="docker-compose.vllm.yml"
PROJECT_NAME="rma-demo"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log() {
    echo -e "${BLUE}[$(date +'%H:%M:%S')]${NC} $1"
}

success() {
    echo -e "${GREEN}✅ $1${NC}"
}

error() {
    echo -e "${RED}❌ $1${NC}"
}

warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# Check prerequisites
check_prerequisites() {
    log "Checking prerequisites..."
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        error "Docker is not installed"
        exit 1
    fi
    success "Docker installed"
    
    # Check Docker Compose
    if ! command -v docker-compose &> /dev/null; then
        error "Docker Compose is not installed"
        exit 1
    fi
    success "Docker Compose installed"
    
    # Check GPU availability
    if ! command -v nvidia-smi &> /dev/null; then
        error "nvidia-smi not found. NVIDIA drivers not installed?"
        exit 1
    fi
    
    GPU_COUNT=$(nvidia-smi --list-gpus | wc -l)
    if [ "$GPU_COUNT" -lt 2 ]; then
        warning "Only $GPU_COUNT GPU(s) found. Recommended: 2 GPUs"
    else
        success "Found $GPU_COUNT GPUs"
    fi
    
    # Check disk space
    DISK_AVAILABLE=$(df "$SCRIPT_DIR" | awk 'NR==2 {print $4}')
    DISK_AVAILABLE_GB=$((DISK_AVAILABLE / 1024 / 1024))
    
    if [ "$DISK_AVAILABLE_GB" -lt 100 ]; then
        error "Insufficient disk space. Required: 100GB, Available: ${DISK_AVAILABLE_GB}GB"
        exit 1
    fi
    success "Disk space: ${DISK_AVAILABLE_GB}GB available"
    
    # Check memory
    MEMORY_AVAILABLE=$(free -g | awk 'NR==2 {print $7}')
    if [ "$MEMORY_AVAILABLE" -lt 32 ]; then
        warning "Available memory: ${MEMORY_AVAILABLE}GB (recommended: 32GB+)"
    else
        success "Memory: ${MEMORY_AVAILABLE}GB available"
    fi
    
    echo ""
}

# Create necessary directories
create_directories() {
    log "Creating necessary directories..."
    
    mkdir -p "$SCRIPT_DIR/data/uploads"
    mkdir -p "$SCRIPT_DIR/data/ollama"
    mkdir -p "$SCRIPT_DIR/data/chroma"
    mkdir -p "$SCRIPT_DIR/data/n8n"
    
    success "Directories created"
    echo ""
}

# Show system information
show_system_info() {
    log "System Information:"
    echo "  Docker version: $(docker --version)"
    echo "  Docker Compose: $(docker-compose --version)"
    echo "  GPU Count: $(nvidia-smi --list-gpus | wc -l)"
    echo "  CUDA Version: $(nvidia-smi --query-gpu=driver_version --format=csv,noheader | head -1)"
    nvidia-smi --query-gpu=name --format=csv,noheader | nl -v 1 | sed 's/^/  GPU /'
    echo ""
}

# Start services
start_services() {
    log "Starting services with $COMPOSE_FILE..."
    
    cd "$SCRIPT_DIR"
    
    # Set GPU environment
    export NVIDIA_VISIBLE_DEVICES=all
    export NVIDIA_DRIVER_CAPABILITIES=compute,utility
    export CUDA_VISIBLE_DEVICES=0,1
    
    docker-compose -f "$COMPOSE_FILE" up -d
    
    log "Services starting... Waiting for health checks (120 seconds)"
    sleep 120
    
    # Check health
    if docker-compose -f "$COMPOSE_FILE" ps | grep -q "unhealthy"; then
        warning "Some services are unhealthy. Waiting additional 60 seconds..."
        sleep 60
    fi
    
    echo ""
}

# Stop services
stop_services() {
    log "Stopping services..."
    
    cd "$SCRIPT_DIR"
    docker-compose -f "$COMPOSE_FILE" down
    
    success "Services stopped"
    echo ""
}

# Restart services
restart_services() {
    stop_services
    start_services
}

# Show service status
show_status() {
    log "Service Status:"
    cd "$SCRIPT_DIR"
    docker-compose -f "$COMPOSE_FILE" ps
    echo ""
    
    log "Health Checks:"
    
    # OCR Service
    if curl -s http://localhost:8104/health > /dev/null 2>&1; then
        success "OCR Service (8104)"
    else
        error "OCR Service (8104) - NOT RESPONDING"
    fi
    
    # NER Graph Service
    if curl -s http://localhost:8108/health > /dev/null 2>&1; then
        success "NER Graph Service (8108)"
    else
        error "NER Graph Service (8108) - NOT RESPONDING"
    fi
    
    # ChromaDB
    if curl -s http://localhost:8005/api/v1 > /dev/null 2>&1; then
        success "ChromaDB (8005)"
    else
        error "ChromaDB (8005) - NOT RESPONDING"
    fi
    
    # vLLM
    if curl -s http://localhost:8000/v1/models > /dev/null 2>&1; then
        success "vLLM (8000)"
    else
        error "vLLM (8000) - NOT RESPONDING"
    fi
    
    # Neo4j
    if docker exec rma-neo4j cypher-shell -u neo4j -p "changeme-in-production" "RETURN 1" > /dev/null 2>&1; then
        success "Neo4j (7687)"
    else
        error "Neo4j (7687) - NOT RESPONDING"
    fi
    
    echo ""
    
    log "Access Points:"
    echo "  Frontend:      http://localhost:3000"
    echo "  Neo4j Browser: http://localhost:7474 (neo4j/changeme-in-production)"
    echo "  N8n:           http://localhost:5678"
    echo "  OCR Service:   http://localhost:8104/health"
    echo "  NER Service:   http://localhost:8108/health"
    echo ""
}

# Show logs
show_logs() {
    SERVICE="${1:-all}"
    log "Showing logs for: $SERVICE"
    cd "$SCRIPT_DIR"
    docker-compose -f "$COMPOSE_FILE" logs -f --tail=100 "$SERVICE"
}

# Clean up
cleanup() {
    warning "This will remove all containers, volumes, and data."
    read -p "Are you sure? (yes/no): " -r
    if [[ $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
        log "Cleaning up..."
        cd "$SCRIPT_DIR"
        docker-compose -f "$COMPOSE_FILE" down -v
        success "Cleanup complete"
    else
        log "Cleanup cancelled"
    fi
    echo ""
}

# Verify deployment
verify_deployment() {
    log "Verifying deployment..."
    
    FAILED=0
    
    # Test OCR service
    if curl -s -X POST http://localhost:8104/health | grep -q "healthy"; then
        success "OCR Service verification"
    else
        error "OCR Service verification failed"
        FAILED=$((FAILED + 1))
    fi
    
    # Test NER service
    if curl -s -X GET http://localhost:8108/health | grep -q "healthy"; then
        success "NER Graph Service verification"
    else
        error "NER Graph Service verification failed"
        FAILED=$((FAILED + 1))
    fi
    
    # Test Neo4j
    if docker exec rma-neo4j cypher-shell -u neo4j -p "changeme-in-production" "RETURN 1" > /dev/null 2>&1; then
        success "Neo4j verification"
    else
        error "Neo4j verification failed"
        FAILED=$((FAILED + 1))
    fi
    
    # Test vLLM
    if curl -s http://localhost:8000/v1/models | grep -q "model_name"; then
        success "vLLM verification"
    else
        error "vLLM verification failed"
        FAILED=$((FAILED + 1))
    fi
    
    echo ""
    
    if [ $FAILED -eq 0 ]; then
        success "All services verified successfully!"
        return 0
    else
        error "$FAILED service(s) failed verification"
        return 1
    fi
}

# Main command handling
case "${1:-status}" in
    start)
        check_prerequisites
        show_system_info
        create_directories
        start_services
        show_status
        verify_deployment
        ;;
    stop)
        stop_services
        ;;
    restart)
        check_prerequisites
        restart_services
        show_status
        ;;
    logs)
        show_logs "$2"
        ;;
    status)
        show_status
        ;;
    verify)
        verify_deployment
        ;;
    clean)
        cleanup
        ;;
    *)
        echo "Usage: $0 {start|stop|restart|logs|status|verify|clean} [service]"
        echo ""
        echo "Commands:"
        echo "  start     - Start all services (with prerequisite checks)"
        echo "  stop      - Stop all services"
        echo "  restart   - Restart all services"
        echo "  logs      - Show service logs (default: all)"
        echo "  status    - Show service status and health checks"
        echo "  verify    - Verify deployment health"
        echo "  clean     - Remove all containers and volumes"
        echo ""
        echo "Examples:"
        echo "  $0 start                    # Start everything"
        echo "  $0 logs ner-graph-service   # Show specific service logs"
        echo "  $0 status                   # Check all services"
        exit 1
        ;;
esac
