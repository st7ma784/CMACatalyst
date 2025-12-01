#!/usr/bin/env python3
"""
Notes to CoA Service - LangGraph Edition
Converts advisor notes into client-friendly letters using multi-step reasoning.

MIGRATION: From simple prompt-based to LangGraph-powered agentic workflow
- Single generic prompt → 5-step reasoning pipeline
- Output now directly follows advisor notes
- Financial context preserved through workflow
- Issues clearly identified and addressed
- Actions specific and actionable
"""

import os
import logging
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn

from llm_provider import get_provider
from notes_graph import create_notes_graph

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Notes to CoA Service",
    description="Convert advisor notes to client-friendly letters using LangGraph",
    version="2.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize LLM provider and graph
llm_provider = get_provider("ollama")
notes_workflow = create_notes_graph(llm_provider)


class NotesRequest(BaseModel):
    """Request model for notes conversion."""
    notes: str
    client_name: str = "the client"


class NotesResponse(BaseModel):
    """Response model for converted notes."""
    matters_discussed: str
    our_actions: str
    your_actions: str
    full_text: str


def convert_notes_to_letter(notes: str, client_name: str) -> dict:
    """Convert advisor notes to client letter using LangGraph workflow."""
    
    try:
        # Prepare initial state
        initial_state = {
            "advisor_notes": notes,
            "client_name": client_name,
            "financial_context": "",
            "issues": "",
            "extraction_analysis": "",
            "action_plan": "",
            "client_letter": ""
        }
        
        # Run the workflow
        logger.info(f"Starting notes conversion workflow for {client_name}")
        result = notes_workflow.invoke(initial_state)
        
        full_letter = result.get("client_letter", "")
        
        # Extract sections from the letter for structured response
        # Try to parse the letter into sections
        sections = {
            "matters_discussed": result.get("extraction_analysis", ""),
            "our_actions": result.get("action_plan", ""),
            "your_actions": "Please contact us if you have any questions.",
            "full_text": full_letter
        }
        
        # Try to extract sections from the actual letter if formatted
        if "YOUR SITUATION" in full_letter:
            try:
                situation_start = full_letter.find("YOUR SITUATION") + len("YOUR SITUATION")
                situation_end = full_letter.find("WHAT WE'LL DO") if "WHAT WE'LL DO" in full_letter else len(full_letter)
                sections["matters_discussed"] = full_letter[situation_start:situation_end].strip()
            except:
                pass
        
        if "WHAT WE'LL DO" in full_letter:
            try:
                actions_start = full_letter.find("WHAT WE'LL DO") + len("WHAT WE'LL DO")
                actions_end = full_letter.find("WHAT YOU SHOULD DO") if "WHAT YOU SHOULD DO" in full_letter else len(full_letter)
                sections["our_actions"] = full_letter[actions_start:actions_end].strip()
            except:
                pass
        
        if "WHAT YOU SHOULD DO" in full_letter:
            try:
                client_start = full_letter.find("WHAT YOU SHOULD DO") + len("WHAT YOU SHOULD DO")
                sections["your_actions"] = full_letter[client_start:].strip()
            except:
                pass
        
        return sections
    
    except Exception as e:
        logger.error(f"Error converting notes: {e}")
        # Return fallback response
        return {
            "matters_discussed": "Your case has been reviewed.",
            "our_actions": "We will contact you within 5 business days.",
            "your_actions": "Please provide any additional documents if needed.",
            "full_text": f"Dear {client_name},\n\nThank you for meeting with us. We have reviewed your case and will be in touch soon.\n\nBest regards,\nYour Advice Team"
        }


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    try:
        # Test Ollama connection
        if llm_provider.is_available():
            return {"status": "healthy", "ollama": "connected"}
    except:
        pass
    
    return {"status": "ready", "ollama": "checking"}


@app.post("/convert", response_model=NotesResponse)
async def convert_notes(request: NotesRequest):
    """Convert advisor notes to client-friendly letter using LangGraph workflow."""
    try:
        result = convert_notes_to_letter(request.notes, request.client_name)
        return NotesResponse(**result)
    except Exception as e:
        logger.error(f"Error in convert_notes: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "service": "Notes to CoA Service - LangGraph Edition",
        "description": "Convert advisor notes to client-friendly letters using agentic reasoning",
        "version": "2.0.0",
        "endpoints": {
            "health": "/health",
            "convert": "/convert"
        },
        "status": "operational"
    }


if __name__ == "__main__":
    port = int(os.getenv("NOTES_SERVICE_PORT", "8100"))
    logger.info(f"Starting Notes Service v2.0.0 (LangGraph) on port {port}")
    uvicorn.run(app, host="0.0.0.0", port=port)
