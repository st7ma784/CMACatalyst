#!/bin/bash
# Open firewall ports for RMA Demo services
# This script configures UFW to allow external access to all RMA services

set -e

echo "🔥 Opening firewall ports for RMA Demo services..."
echo ""

# Check if UFW is installed and active
if ! command -v ufw &> /dev/null; then
    echo "❌ UFW is not installed. Please install it first:"
    echo "   sudo apt-get install ufw"
    exit 1
fi

# Check if running as root or with sudo
if [ "$EUID" -ne 0 ]; then
    echo "❌ This script must be run with sudo"
    echo "   Usage: sudo ./open-firewall-ports.sh"
    exit 1
fi

echo "Opening ports for RMA services..."
echo ""

# Frontend
echo "📱 Opening port 3000 (Frontend)..."
ufw allow 3000/tcp comment 'RMA Frontend'

# N8N Workflows
echo "🔄 Opening port 5678 (N8N Workflows)..."
ufw allow 5678/tcp comment 'N8N Workflows'

# Notes Service
echo "📝 Opening port 8100 (Notes Service)..."
ufw allow 8100/tcp comment 'RMA Notes Service'

# Document Processor
echo "📄 Opening port 8101 (Document Processor)..."
ufw allow 8101/tcp comment 'RMA Document Processor'

# RAG Service (Ask the Manuals)
echo "🤖 Opening port 8102 (RAG Service - Ask the Manuals)..."
ufw allow 8102/tcp comment 'RMA RAG Service'

# Upload Service
echo "📤 Opening port 8103 (Upload Service)..."
ufw allow 8103/tcp comment 'RMA Upload Service'

# Client RAG Service
echo "👤 Opening port 8104 (Client RAG Service)..."
ufw allow 8104/tcp comment 'RMA Client RAG Service'

# MCP Server
echo "🔌 Opening port 8105 (MCP Server)..."
ufw allow 8105/tcp comment 'RMA MCP Server'

# Reload firewall
echo ""
echo "🔄 Reloading firewall..."
ufw reload

echo ""
echo "✅ Firewall configuration complete!"
echo ""
echo "📊 Current firewall status:"
ufw status numbered | grep -E "3000|5678|810[0-5]" || echo "No RMA rules found (this shouldn't happen)"

echo ""
echo "🎉 All RMA service ports are now open!"
echo ""
echo "You can now access the services from external machines:"
echo "  - Frontend:          http://192.168.5.70:3000"
echo "  - N8N Workflows:     http://192.168.5.70:5678"
echo "  - Notes Service:     http://192.168.5.70:8100"
echo "  - Doc Processor:     http://192.168.5.70:8101"
echo "  - RAG Service:       http://192.168.5.70:8102"
echo "  - Upload Service:    http://192.168.5.70:8103"
echo "  - Client RAG:        http://192.168.5.70:8104"
echo "  - MCP Server:        http://192.168.5.70:8105"
echo ""
