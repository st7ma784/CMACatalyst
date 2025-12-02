#!/bin/bash

# Helper script to activate the coordinator's virtual environment
# Usage: source ./activate-env.sh

if [ ! -d "venv" ]; then
    echo "❌ Virtual environment not found!"
    echo "Run ../start-coordinator.sh first to create it"
    return 1 2>/dev/null || exit 1
fi

echo "🐍 Activating coordinator virtual environment..."
source venv/bin/activate

echo "✅ Virtual environment activated"
echo ""
echo "You can now run:"
echo "  python -m uvicorn app.main:app --reload"
echo ""
echo "To deactivate:"
echo "  deactivate"
