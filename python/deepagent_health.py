#!/usr/bin/env python3
"""
DeepAgent Health Check Script
"""

import sys
import json
from pathlib import Path

def check_health():
    """Check if DeepAgent system is healthy"""
    health_status = {
        "status": "healthy",
        "checks": {}
    }
    
    try:
        # Check Python modules
        import requests
        health_status["checks"]["requests"] = "✓ Available"
    except ImportError:
        health_status["checks"]["requests"] = "✗ Missing - pip install requests"
        health_status["status"] = "unhealthy"
    
    try:
        from langchain.agents import initialize_agent
        health_status["checks"]["langchain"] = "✓ Available"
    except ImportError:
        health_status["checks"]["langchain"] = "✗ Missing - pip install langchain"
        health_status["status"] = "unhealthy"
    
    try:
        from langchain_openai import ChatOpenAI
        health_status["checks"]["langchain_openai"] = "✓ Available"
    except ImportError:
        health_status["checks"]["langchain_openai"] = "✗ Missing - pip install langchain-openai"
        health_status["status"] = "unhealthy"
    
    # Check environment variables
    import os
    if os.getenv('OPENAI_API_KEY'):
        health_status["checks"]["openai_api_key"] = "✓ Set"
    else:
        health_status["checks"]["openai_api_key"] = "⚠ Not set - required for AI functionality"
    
    # Check Deepagents module
    try:
        sys.path.append(str(Path(__file__).parent.parent.parent))
        from catalyst.Deepagents import entity_extraction
        health_status["checks"]["deepagents_module"] = "✓ Available"
    except ImportError:
        try:
            sys.path.append('/home/user/Documents/catalyst')
            from Deepagents import entity_extraction
            health_status["checks"]["deepagents_module"] = "✓ Available"
        except ImportError:
            health_status["checks"]["deepagents_module"] = "✗ Cannot import Deepagents module"
            health_status["status"] = "unhealthy"
    
    return health_status

if __name__ == "__main__":
    try:
        health = check_health()
        print(json.dumps(health, indent=2))
        
        if health["status"] == "unhealthy":
            sys.exit(1)
        else:
            sys.exit(0)
            
    except Exception as e:
        error_health = {
            "status": "error",
            "error": str(e)
        }
        print(json.dumps(error_health, indent=2))
        sys.exit(1)
