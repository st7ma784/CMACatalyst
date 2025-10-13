#!/bin/bash

# CMA System Local GPU Deployment Script
set -e

echo "🚀 Starting CMA Case Management System with Local GPU Support"
echo "============================================================"

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker first."
    exit 1
fi

# Check if Docker Compose is available
if ! command -v docker compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

# Check for NVIDIA Docker support (for GPU)
if ! docker run --rm --gpus all nvidia/cuda:13.0.1-cudnn-devel-ubuntu24.04 nvidia-smi &> /dev/null; then
    echo "⚠️  Warning: NVIDIA GPU support not detected. Running in CPU mode."
    echo "   To enable GPU support, ensure:"
    echo "   1. NVIDIA drivers are installed"
    echo "   2. NVIDIA Container Toolkit is installed"
    echo "   3. Docker is configured to use NVIDIA runtime"
    read -p "Continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Function to check if port is available
check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null ; then
        echo "❌ Port $port is already in use. Please free the port or modify docker-compose.local.yml"
        return 1
    fi
    return 0
}

echo "🔍 Checking required ports..."
PORTS=(5432 6379 11434 5678 9000 9001 5672 15672 8001 3001 3002 5000 3000 80)
for port in "${PORTS[@]}"; do
    if ! check_port $port; then
        echo "Please stop services using these ports or modify the configuration."
        exit 1
    fi
done

echo "✅ All required ports are available"

# Create necessary directories
echo "📁 Creating necessary directories..."
mkdir -p ./uploads
mkdir -p ./n8n/workflows
mkdir -p ./scripts

# Make scripts executable
chmod +x ./scripts/ollama-init.sh 2>/dev/null || true

echo "🐳 Building Docker images..."
docker compose -f docker-compose.local.yml build

echo "🔽 Pulling required Docker images..."
docker compose -f docker-compose.local.yml pull

echo "🏗️  Starting services in order..."

# Start core infrastructure first
echo "1. Starting core infrastructure (Postgres, Redis)..."
docker compose -f docker-compose.local.yml up -d postgres redis

# Wait for core services
echo "⏳ Waiting for core services to be ready..."
sleep 10

# Start Ollama and wait for it to download models
echo "2. Starting Ollama service and downloading models..."
docker compose -f docker-compose.local.yml up -d ollama

echo "⏳ Waiting for Ollama to download models (this may take several minutes)..."
echo "   Models being downloaded: llama2:7b, codellama:7b, mistral:7b"

# Wait for Ollama to be ready and models to download
timeout=600  # 10 minutes timeout
counter=0
while ! curl -f http://localhost:11434/api/version &>/dev/null; do
    sleep 5
    counter=$((counter + 5))
    if [ $counter -ge $timeout ]; then
        echo "❌ Timeout waiting for Ollama service"
        exit 1
    fi
    echo "   Still waiting for Ollama... (${counter}s elapsed)"
done

echo "✅ Ollama service is ready"

# Start storage and messaging services
echo "3. Starting storage and messaging services..."
docker compose -f docker-compose.local.yml up -d minio rabbitmq

# Wait for storage services
echo "⏳ Waiting for storage services..."
sleep 15

# Start n8n
echo "4. Starting n8n workflow automation..."
docker compose -f docker-compose.local.yml up -d n8n

# Start processing services
echo "5. Starting document processing services..."
docker compose -f docker-compose.local.yml up -d document-inbox ocr-processor

# Start chatbot with Ollama integration
echo "6. Starting AI chatbot with local GPU support..."
docker compose -f docker-compose.local.yml up -d chatbot

# Start main application
echo "7. Starting main application..."
docker compose -f docker-compose.local.yml up -d app

# Start frontend
echo "8. Starting frontend development server..."
docker compose -f docker-compose.local.yml up -d frontend

# Start nginx proxy
echo "9. Starting Nginx reverse proxy..."
docker compose -f docker-compose.local.yml up -d nginx

echo "🎉 CMA System is starting up!"
echo ""
echo "📋 Service Status:"
echo "==================="

# Check service status
services=("postgres" "redis" "ollama" "n8n" "minio" "rabbitmq" "chatbot" "app" "frontend" "nginx")
for service in "${services[@]}"; do
    if docker compose -f docker-compose.local.yml ps | grep $service | grep -q "Up"; then
        echo "✅ $service: Running"
    else
        echo "❌ $service: Not running"
    fi
done

echo ""
echo "🌐 Access URLs:"
echo "==============="
echo "📱 Main Application:     http://localhost"
echo "🤖 AI Chatbot API:       http://localhost:8001"
echo "🧠 Ollama API:           http://localhost:11434"
echo "🔄 n8n Workflows:        http://localhost:5678 (admin/password)"
echo "📊 MinIO Console:        http://localhost:9001 (minioadmin/minioadmin)"
echo "🐰 RabbitMQ Management:  http://localhost:15672 (admin/password)"
echo "⚛️  React Frontend:       http://localhost:3000"
echo ""
echo "🔧 Development:"
echo "==============="
echo "📁 File uploads: ./uploads/"
echo "📋 Logs: docker compose -f docker-compose.local.yml logs -f [service]"
echo "🔄 Restart: docker compose -f docker-compose.local.yml restart [service]"
echo "🛑 Stop all: docker compose -f docker-compose.local.yml down"
echo ""
echo "🧪 Test the AI Assistant:"
echo "========================="
echo "curl -X POST http://localhost:8001/chat \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '{\"message\": \"Hello, I need help with debt advice\"}'"
echo ""
echo "💡 Tips:"
echo "======="
echo "• First AI requests may be slow as models warm up"
echo "• GPU acceleration will be used if available"
echo "• Check logs if services fail to start: docker compose -f docker-compose.local.yml logs [service]"
echo "• Models are persistent in Docker volumes"
echo ""

# Follow logs for a few seconds to show startup progress
echo "📊 Showing recent logs (press Ctrl+C to stop):"
echo "=============================================="
docker-compose -f docker-compose.local.yml logs --tail=50 -f