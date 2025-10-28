#!/usr/bin/env python3
"""
MCP (Model Context Protocol) Server for RMA Agent

This server exposes the RMA RAG agent's capabilities as MCP tools,
making them accessible to n8n, Claude Desktop, and other MCP clients.

MCP enables:
- Tool discovery and invocation
- Resource exposure (documents, statistics)
- Prompt templates for common tasks
- Secure API key authentication
"""

import os
import logging
from typing import Dict, List, Any, Optional
from fastapi import FastAPI, HTTPException, Header, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import httpx
import uvicorn

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="RMA MCP Server",
    description="Model Context Protocol server for Riverside Money Advice agent",
    version="1.0.0"
)

# CORS for n8n and web clients
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configuration
RAG_SERVICE_URL = os.getenv("RAG_SERVICE_URL", "http://rag-service:8102")
CLIENT_RAG_URL = os.getenv("CLIENT_RAG_URL", "http://client-rag-service:8104")
MCP_API_KEY = os.getenv("MCP_API_KEY", "dev-key-change-in-production")


# ============================================================
# AUTHENTICATION
# ============================================================

async def verify_api_key(x_api_key: str = Header(...)):
    """Verify MCP API key for security."""
    if x_api_key != MCP_API_KEY:
        raise HTTPException(status_code=401, detail="Invalid API key")
    return x_api_key


# ============================================================
# REQUEST/RESPONSE MODELS
# ============================================================

class ToolRequest(BaseModel):
    """Generic tool invocation request."""
    tool_name: str
    arguments: Dict[str, Any]


class ToolResponse(BaseModel):
    """Generic tool response."""
    success: bool
    result: Any
    error: Optional[str] = None


class ResourceRequest(BaseModel):
    """Request for a resource."""
    resource_type: str
    resource_id: Optional[str] = None


# ============================================================
# MCP ENDPOINTS
# ============================================================

@app.get("/")
async def root():
    """MCP server information."""
    return {
        "name": "RMA MCP Server",
        "version": "1.0.0",
        "protocol": "MCP",
        "capabilities": {
            "tools": True,
            "resources": True,
            "prompts": True
        },
        "services": {
            "rag_service": RAG_SERVICE_URL,
            "client_rag": CLIENT_RAG_URL
        }
    }


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    # Check if RAG service is accessible
    try:
        async with httpx.AsyncClient() as client:
            rag_health = await client.get(f"{RAG_SERVICE_URL}/health", timeout=5.0)
            rag_healthy = rag_health.status_code == 200
    except Exception as e:
        logger.error(f"RAG service health check failed: {e}")
        rag_healthy = False

    return {
        "status": "healthy" if rag_healthy else "degraded",
        "rag_service": "connected" if rag_healthy else "unreachable",
        "mcp_version": "1.0.0"
    }


# ============================================================
# TOOL DISCOVERY
# ============================================================

@app.get("/mcp/tools")
async def list_tools(api_key: str = Depends(verify_api_key)):
    """
    List all available MCP tools.

    This endpoint is called by n8n and other MCP clients to discover
    what tools are available.
    """
    return {
        "tools": [
            {
                "name": "check_client_eligibility",
                "description": "Check if a client is eligible for DRO, bankruptcy, or IVA",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "question": {
                            "type": "string",
                            "description": "The eligibility question"
                        },
                        "debt": {
                            "type": "number",
                            "description": "Client's total debt amount"
                        },
                        "income": {
                            "type": "number",
                            "description": "Client's monthly surplus income"
                        },
                        "assets": {
                            "type": "number",
                            "description": "Client's total assets value"
                        },
                        "topic": {
                            "type": "string",
                            "enum": ["dro_eligibility", "bankruptcy", "iva"],
                            "description": "Type of debt solution"
                        }
                    },
                    "required": ["question", "topic"]
                }
            },
            {
                "name": "ask_the_manuals",
                "description": "Query the training manuals using agentic reasoning",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "question": {
                            "type": "string",
                            "description": "Question to ask the manuals"
                        },
                        "show_reasoning": {
                            "type": "boolean",
                            "description": "Include reasoning steps in response",
                            "default": True
                        }
                    },
                    "required": ["question"]
                }
            },
            {
                "name": "get_client_documents",
                "description": "Retrieve uploaded documents for a specific client",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "client_id": {
                            "type": "string",
                            "description": "Unique client identifier"
                        }
                    },
                    "required": ["client_id"]
                }
            },
            {
                "name": "get_centre_statistics",
                "description": "Get statistics for the advice centre",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "date_range": {
                            "type": "string",
                            "enum": ["today", "week", "month", "year"],
                            "description": "Time period for statistics"
                        }
                    },
                    "required": ["date_range"]
                }
            },
            {
                "name": "extract_client_values",
                "description": "Extract financial values from client documents",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "client_id": {
                            "type": "string",
                            "description": "Client identifier"
                        },
                        "fields": {
                            "type": "array",
                            "items": {"type": "string"},
                            "description": "Fields to extract: debt, income, assets"
                        }
                    },
                    "required": ["client_id"]
                }
            }
        ]
    }


# ============================================================
# TOOL EXECUTION
# ============================================================

@app.post("/mcp/tools/execute", response_model=ToolResponse)
async def execute_tool(
    request: ToolRequest,
    api_key: str = Depends(verify_api_key)
):
    """
    Execute an MCP tool.

    This is the main endpoint that n8n calls to invoke RMA agent capabilities.
    """
    try:
        logger.info(f"Executing tool: {request.tool_name}")

        # Route to appropriate handler
        if request.tool_name == "check_client_eligibility":
            result = await _check_eligibility(request.arguments)
        elif request.tool_name == "ask_the_manuals":
            result = await _ask_manuals(request.arguments)
        elif request.tool_name == "get_client_documents":
            result = await _get_client_documents(request.arguments)
        elif request.tool_name == "get_centre_statistics":
            result = await _get_statistics(request.arguments)
        elif request.tool_name == "extract_client_values":
            result = await _extract_values(request.arguments)
        else:
            return ToolResponse(
                success=False,
                result=None,
                error=f"Unknown tool: {request.tool_name}"
            )

        return ToolResponse(success=True, result=result)

    except Exception as e:
        logger.error(f"Tool execution failed: {e}")
        return ToolResponse(
            success=False,
            result=None,
            error=str(e)
        )


# ============================================================
# TOOL IMPLEMENTATIONS
# ============================================================

async def _check_eligibility(args: Dict[str, Any]) -> Dict[str, Any]:
    """Check client eligibility using RAG service."""
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{RAG_SERVICE_URL}/eligibility-check",
            json={
                "question": args["question"],
                "debt": args.get("debt"),
                "income": args.get("income"),
                "assets": args.get("assets"),
                "topic": args.get("topic", "dro_eligibility")
            },
            timeout=30.0
        )
        response.raise_for_status()
        return response.json()


async def _ask_manuals(args: Dict[str, Any]) -> Dict[str, Any]:
    """Query manuals using agentic reasoning."""
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{RAG_SERVICE_URL}/agentic-query",
            json={
                "question": args["question"],
                "model": "llama3.2",
                "show_reasoning": args.get("show_reasoning", True)
            },
            timeout=30.0
        )
        response.raise_for_status()
        return response.json()


async def _get_client_documents(args: Dict[str, Any]) -> Dict[str, Any]:
    """Get documents for a client."""
    client_id = args["client_id"]

    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"{CLIENT_RAG_URL}/clients/{client_id}/documents",
            timeout=10.0
        )
        response.raise_for_status()
        return response.json()


async def _get_statistics(args: Dict[str, Any]) -> Dict[str, Any]:
    """Get centre statistics."""
    # This would query your database/analytics system
    # For now, return mock data
    date_range = args.get("date_range", "week")

    return {
        "date_range": date_range,
        "clients_seen": 45,
        "eligibility_checks": 38,
        "dro_eligible": 12,
        "bankruptcy_eligible": 8,
        "iva_eligible": 15,
        "follow_ups_needed": 10
    }


async def _extract_values(args: Dict[str, Any]) -> Dict[str, Any]:
    """Extract financial values from client documents."""
    client_id = args["client_id"]
    fields = args.get("fields", ["debt", "income", "assets"])

    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{CLIENT_RAG_URL}/extract-values",
            json={
                "client_id": client_id,
                "fields": fields
            },
            timeout=20.0
        )
        response.raise_for_status()
        return response.json()


# ============================================================
# RESOURCE ENDPOINTS
# ============================================================

@app.get("/mcp/resources")
async def list_resources(api_key: str = Depends(verify_api_key)):
    """List available resources."""
    return {
        "resources": [
            {
                "uri": "rma://manuals/dro",
                "name": "DRO Guidance Manual",
                "description": "Debt Relief Order guidance and eligibility rules",
                "mimeType": "application/pdf"
            },
            {
                "uri": "rma://manuals/bankruptcy",
                "name": "Bankruptcy Manual",
                "description": "Bankruptcy procedure and eligibility guidance",
                "mimeType": "application/pdf"
            },
            {
                "uri": "rma://thresholds",
                "name": "Eligibility Thresholds",
                "description": "Current debt solution thresholds and limits",
                "mimeType": "application/json"
            }
        ]
    }


@app.get("/mcp/resources/{resource_uri:path}")
async def get_resource(
    resource_uri: str,
    api_key: str = Depends(verify_api_key)
):
    """Get a specific resource."""
    if resource_uri == "rma://thresholds":
        # Get thresholds from RAG service
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{RAG_SERVICE_URL}/thresholds/list",
                timeout=5.0
            )
            if response.status_code == 200:
                return response.json()

    return {"error": "Resource not found"}


# ============================================================
# PROMPT TEMPLATES
# ============================================================

@app.get("/mcp/prompts")
async def list_prompts(api_key: str = Depends(verify_api_key)):
    """List available prompt templates."""
    return {
        "prompts": [
            {
                "name": "eligibility_assessment",
                "description": "Comprehensive eligibility assessment for a client",
                "arguments": [
                    {
                        "name": "client_id",
                        "description": "Client identifier",
                        "required": True
                    }
                ]
            },
            {
                "name": "debt_solution_comparison",
                "description": "Compare DRO, bankruptcy, and IVA for a client",
                "arguments": [
                    {
                        "name": "debt",
                        "description": "Total debt amount",
                        "required": True
                    },
                    {
                        "name": "income",
                        "description": "Monthly surplus income",
                        "required": True
                    }
                ]
            }
        ]
    }


# ============================================================
# MAIN
# ============================================================

if __name__ == "__main__":
    port = int(os.getenv("PORT", "8105"))
    uvicorn.run(app, host="0.0.0.0", port=port)
