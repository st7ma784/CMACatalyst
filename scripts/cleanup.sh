#!/bin/bash

# CMA Case Management System - Cleanup Script
# Stops and removes all local development containers and resources

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_status() {
    echo -e "${BLUE}[CLEANUP]${NC} $1"
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

# Stop running Node.js processes
cleanup_node_processes() {
    print_status "Stopping Node.js processes..."
    
    # Find and kill Node.js processes running on port 5000
    if lsof -ti:5000 > /dev/null 2>&1; then
        lsof -ti:5000 | xargs kill -9 2>/dev/null || true
        print_success "Stopped Node.js server on port 5000"
    fi
    
    # Kill any npm start processes
    pkill -f "npm start" 2>/dev/null || true
    pkill -f "node server/index.js" 2>/dev/null || true
}

# Stop and remove Docker containers
cleanup_containers() {
    print_status "Cleaning up Docker containers..."
    
    # Stop and remove PostgreSQL container
    if docker ps -a --format 'table {{.Names}}' | grep -q postgres-test; then
        docker stop postgres-test 2>/dev/null || true
        docker rm postgres-test 2>/dev/null || true
        print_success "Removed PostgreSQL container"
    fi
    
    # Stop and remove Redis container
    if docker ps -a --format 'table {{.Names}}' | grep -q redis-test; then
        docker stop redis-test 2>/dev/null || true
        docker rm redis-test 2>/dev/null || true
        print_success "Removed Redis container"
    fi
    
    # Stop and remove any CMA-related containers
    docker ps -a --format 'table {{.Names}}' | grep -E "cma-|CMA-" | while read container; do
        if [ ! -z "$container" ]; then
            docker stop "$container" 2>/dev/null || true
            docker rm "$container" 2>/dev/null || true
            print_success "Removed container: $container"
        fi
    done
}

# Clean up Docker volumes (optional)
cleanup_volumes() {
    print_status "Cleaning up Docker volumes..."
    
    # Remove named volumes
    docker volume ls -q | grep -E "postgres|redis|cma" | while read volume; do
        if [ ! -z "$volume" ]; then
            docker volume rm "$volume" 2>/dev/null || true
            print_success "Removed volume: $volume"
        fi
    done
    
    # Clean up dangling volumes
    docker volume prune -f > /dev/null 2>&1 || true
}

# Clean up temporary files
cleanup_temp_files() {
    print_status "Cleaning up temporary files..."
    
    # Remove log files
    rm -f *.log 2>/dev/null || true
    rm -f logs/*.log 2>/dev/null || true
    
    # Remove temporary uploads (keep directory structure)
    if [ -d "uploads" ]; then
        find uploads -type f -name "*" -delete 2>/dev/null || true
        print_success "Cleaned upload directory"
    fi
    
    # Remove environment file if it exists
    if [ -f ".env" ]; then
        rm -f .env
        print_success "Removed .env file"
    fi
}

# Clean up node_modules (optional - saves space)
cleanup_node_modules() {
    if [ "$1" = "--full" ]; then
        print_status "Removing node_modules directories..."
        
        rm -rf node_modules 2>/dev/null || true
        rm -rf client/node_modules 2>/dev/null || true
        rm -rf chatbot/__pycache__ 2>/dev/null || true
        
        print_success "Removed node_modules directories"
    fi
}

# Main cleanup function
main() {
    echo "=================================="
    echo "  CMA System - Cleanup Script"
    echo "=================================="
    echo ""
    
    cleanup_node_processes
    cleanup_containers
    cleanup_volumes
    cleanup_temp_files
    cleanup_node_modules "$1"
    
    # Clean up Docker system (removes unused images, networks, etc.)
    print_status "Cleaning up Docker system..."
    docker system prune -f > /dev/null 2>&1 || true
    
    echo ""
    print_success "Cleanup completed successfully!"
    echo ""
    echo "To start the system again, run: ./scripts/local-deploy.sh"
    
    if [ "$1" = "--full" ]; then
        echo "Note: You'll need to run 'npm install' before starting the system."
    fi
}

# Show help
show_help() {
    echo "CMA Cleanup Script"
    echo ""
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --full    Also remove node_modules directories (saves disk space)"
    echo "  --help    Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0                # Standard cleanup"
    echo "  $0 --full         # Full cleanup including node_modules"
}

# Parse command line arguments
case "${1:-}" in
    --help|-h)
        show_help
        exit 0
        ;;
    --full)
        main --full
        ;;
    "")
        main
        ;;
    *)
        echo "Unknown option: $1"
        show_help
        exit 1
        ;;
esac
