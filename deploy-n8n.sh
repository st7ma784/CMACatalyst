#!/bin/bash

# N8N Workflow System Deployment Script
# This script sets up and deploys the complete N8N workflow system with local AI

set -e

echo "🚀 Starting N8N Workflow System Deployment..."

# Create necessary directories
echo "📁 Creating required directories..."
mkdir -p ./uploads ./temp ./logs ./n8n-data ./workflows-import

# Copy environment file
if [ ! -f .env ]; then
    echo "📋 Setting up environment configuration..."
    cp .env.n8n .env
    echo "✅ Environment file created. Please review .env and update credentials as needed."
fi

# Build and start services
echo "🔨 Building Docker services..."
docker-compose -f docker-compose.n8n.yml build

echo "🏃 Starting N8N workflow system..."
docker-compose -f docker-compose.n8n.yml up -d

# Wait for services to be ready
echo "⏳ Waiting for services to start..."
sleep 30

# Check service health
echo "🔍 Checking service health..."

# Check Ollama
echo "Checking Ollama..."
timeout 60 bash -c 'until curl -s http://localhost:11434/api/version > /dev/null; do sleep 2; done' || {
    echo "❌ Ollama failed to start"
    exit 1
}
echo "✅ Ollama is running"

# Check N8N
echo "Checking N8N..."
timeout 60 bash -c 'until curl -s -u admin:workflow_admin_2024 http://localhost:5678 > /dev/null; do sleep 2; done' || {
    echo "❌ N8N failed to start"
    exit 1
}
echo "✅ N8N is running"

# Check MCP Server
echo "Checking MCP Server..."
timeout 60 bash -c 'until curl -s http://localhost:3001/health > /dev/null; do sleep 2; done' || {
    echo "❌ MCP Server failed to start"
    exit 1
}
echo "✅ MCP Server is running"

# Check OCR Services
echo "Checking OCR Services..."
timeout 30 bash -c 'until curl -s http://localhost:8080/health > /dev/null; do sleep 2; done' || {
    echo "⚠️ Node.js OCR service not responding"
}

timeout 30 bash -c 'until curl -s http://localhost:8082/health > /dev/null; do sleep 2; done' || {
    echo "⚠️ Python OCR service not responding"
}
echo "✅ OCR services checked"

# Download and setup Ollama model
echo "🤖 Setting up LLaMA model in Ollama..."
docker exec cascade-ollama ollama pull llama3.1:8b || {
    echo "⚠️ Failed to pull LLaMA model. You can do this manually later with:"
    echo "docker exec cascade-ollama ollama pull llama3.1:8b"
}

# Import N8N workflows
echo "📥 Importing N8N workflows..."

# Function to import workflow
import_workflow() {
    local workflow_file=$1
    local workflow_name=$2
    
    if [ -f "$workflow_file" ]; then
        echo "Importing $workflow_name..."
        curl -s -u admin:workflow_admin_2024 \
             -H "Content-Type: application/json" \
             -X POST \
             "http://localhost:5678/rest/workflows/import" \
             -d @"$workflow_file" > /dev/null || {
            echo "⚠️ Failed to import $workflow_name"
        }
    else
        echo "⚠️ Workflow file $workflow_file not found"
    fi
}

# Import workflows
import_workflow "n8n/workflows/document-audit.json" "Document Audit Workflow"
import_workflow "n8n/workflows/qr-sfs-generator.json" "QR SFS Generator Workflow"
import_workflow "n8n/workflows/dashboard-analytics.json" "Dashboard Analytics Workflow"

echo "🎉 N8N Workflow System deployment completed!"
echo ""
echo "📊 Service Access Points:"
echo "  • N8N Workflow Engine: http://localhost:5678"
echo "    Username: admin"
echo "    Password: workflow_admin_2024"
echo ""
echo "  • MCP Workflow Server: http://localhost:3001"
echo "  • Ollama AI Service: http://localhost:11434"
echo "  • ChromaDB Vector Database: http://localhost:8001"
echo "  • Redis Cache: localhost:6380"
echo "  • OCR Service (Node.js): http://localhost:8080"
echo "  • OCR Service (Python): http://localhost:8082"
echo ""
echo "🔧 Management Commands:"
echo "  • View logs: docker-compose -f docker-compose.n8n.yml logs -f"
echo "  • Stop system: docker-compose -f docker-compose.n8n.yml down"
echo "  • Restart system: docker-compose -f docker-compose.n8n.yml restart"
echo ""
echo "📖 Next Steps:"
echo "  1. Access N8N at http://localhost:5678 with the credentials above"
echo "  2. Review and activate the imported workflows"
echo "  3. Test workflow execution using the MCP server endpoints"
echo "  4. Monitor logs for any issues"
echo ""
echo "🔗 Integration with Main Application:"
echo "  The MCP server provides these endpoints for your main app:"
echo "  • POST /api/workflows/document-audit"
echo "  • POST /api/workflows/qr-sfs"
echo "  • POST /api/workflows/dashboard-analytics"
echo "  • POST /api/workflows/compliance-check"
echo "  • GET /api/workflows/status/:id"
echo ""
echo "Happy workflow automation! 🎯"
