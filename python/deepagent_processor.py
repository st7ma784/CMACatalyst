#!/usr/bin/env python3
"""
DeepAgent Processor Script
Called by the Node.js API to process client cases with AI
"""

import os
import sys
import json
import argparse
from pathlib import Path

# Add the catalyst directory to Python path to import Deepagents
sys.path.append(str(Path(__file__).parent.parent.parent))

try:
    from catalyst.Deepagents import process_client_case
except ImportError:
    try:
        # Alternative path if running from different location
        sys.path.append('/home/user/Documents/catalyst')
        from Deepagents import process_client_case
    except ImportError as e:
        print(json.dumps({
            "error": f"Failed to import Deepagents module: {str(e)}",
            "status": "failed"
        }))
        sys.exit(1)

def main():
    parser = argparse.ArgumentParser(description='Process client case with DeepAgent AI')
    parser.add_argument('--client_input', required=True, help='Client input text')
    parser.add_argument('--case_id', help='Case ID')
    parser.add_argument('--client_name', help='Client name')
    parser.add_argument('--api_token', required=True, help='JWT token for API authentication')
    parser.add_argument('--api_base_url', required=True, help='API base URL')
    
    args = parser.parse_args()
    
    # Set environment variables for the Deepagents module
    os.environ['API_TOKEN'] = args.api_token
    os.environ['API_BASE_URL'] = args.api_base_url
    
    try:
        # Process the case using DeepAgent
        result = process_client_case(
            client_input=args.client_input,
            case_id=args.case_id,
            client_name=args.client_name
        )
        
        # Output the result as JSON
        print(json.dumps(result, indent=2))
        
    except Exception as e:
        error_result = {
            "error": str(e),
            "status": "failed",
            "client_input": args.client_input,
            "case_id": args.case_id,
            "client_name": args.client_name
        }
        print(json.dumps(error_result, indent=2))
        sys.exit(1)

if __name__ == "__main__":
    main()
