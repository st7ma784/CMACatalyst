#!/usr/bin/env python3
"""
Notes to CoA Service
Converts advisor notes into simple language for clients using Ollama LLM
"""

import os
import logging
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import ollama
import uvicorn

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Notes to CoA Service",
    description="Convert advisor notes to client-friendly language",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class NotesRequest(BaseModel):
    """Request model for notes conversion."""
    notes: str
    client_name: str = "the client"
    model: str = "llama3.2"


class NotesResponse(BaseModel):
    """Response model for converted notes."""
    matters_discussed: str
    our_actions: str
    your_actions: str
    full_text: str


class NotesService:
    """Service for converting advisor notes to client-friendly language."""

    def __init__(self):
        self.base_url = os.getenv('OLLAMA_URL', 'http://ollama:11434')
        self.client = ollama.Client(host=self.base_url)
        self.available = False
        self._check_availability()

    def _check_availability(self):
        """Check if Ollama service is available."""
        try:
            models = self.client.list()
            self.available = True
            logger.info(f"Ollama service available at {self.base_url}")
        except Exception as e:
            logger.error(f"Ollama service not available: {e}")
            self.available = False

    def convert_notes_to_client_letter(self, notes: str, client_name: str, model: str = "llama3.2") -> dict:
        """
        Convert advisor notes into a structured client-friendly letter.

        Args:
            notes: Raw advisor notes
            client_name: Name of the client
            model: Ollama model to use

        Returns:
            Dictionary with matters_discussed, our_actions, your_actions
        """
        if not self.available:
            raise ValueError("Ollama service not available")

        prompt = f"""
You are writing a letter to {client_name} about their case. Convert these advisor notes into simple, clear language
that the client can understand. Organize the information into three sections:

1. MATTERS DISCUSSED - What was talked about in plain language
2. OUR ACTIONS - What we (the advisors) will do to help
3. YOUR ACTIONS - What the client needs to do

Advisor Notes:
{notes}

Requirements:
- Use simple, friendly language (reading age 12-14)
- Avoid legal jargon - explain things clearly
- Be encouraging and supportive
- Use "we" for advisor actions and "you" for client actions
- Keep each section to 2-4 clear points
- Format as if writing directly to the client

Provide your response in this exact format:

MATTERS DISCUSSED:
[Clear explanation of what was discussed]

OUR ACTIONS:
[List what advisors will do]

YOUR ACTIONS:
[List what client needs to do]
"""

        try:
            response = self.client.generate(
                model=model,
                prompt=prompt,
                options={
                    'temperature': 0.7,  # Balanced creativity
                    'top_p': 0.9,
                    'num_predict': 800
                }
            )

            response_text = response['response'].strip()

            # Parse the response into sections
            sections = self._parse_response_sections(response_text)

            # Create full text
            full_text = f"""Dear {client_name},

{sections['matters_discussed']}

{sections['our_actions']}

{sections['your_actions']}

If you have any questions or concerns, please don't hesitate to contact us.

Best regards,
Your Advice Team"""

            return {
                'matters_discussed': sections['matters_discussed'],
                'our_actions': sections['our_actions'],
                'your_actions': sections['your_actions'],
                'full_text': full_text
            }

        except Exception as e:
            logger.error(f"Error converting notes: {e}")
            raise

    def _parse_response_sections(self, response_text: str) -> dict:
        """Parse the LLM response into structured sections."""
        sections = {
            'matters_discussed': '',
            'our_actions': '',
            'your_actions': ''
        }

        # Split by section headers
        import re

        # Extract MATTERS DISCUSSED
        matters_match = re.search(r'MATTERS DISCUSSED:?\s*\n(.*?)(?=OUR ACTIONS:|YOUR ACTIONS:|$)',
                                 response_text, re.DOTALL | re.IGNORECASE)
        if matters_match:
            sections['matters_discussed'] = "MATTERS DISCUSSED:\n" + matters_match.group(1).strip()

        # Extract OUR ACTIONS
        our_match = re.search(r'OUR ACTIONS:?\s*\n(.*?)(?=YOUR ACTIONS:|$)',
                             response_text, re.DOTALL | re.IGNORECASE)
        if our_match:
            sections['our_actions'] = "OUR ACTIONS:\n" + our_match.group(1).strip()

        # Extract YOUR ACTIONS
        your_match = re.search(r'YOUR ACTIONS:?\s*\n(.*?)$',
                              response_text, re.DOTALL | re.IGNORECASE)
        if your_match:
            sections['your_actions'] = "YOUR ACTIONS:\n" + your_match.group(1).strip()

        return sections


# Initialize service
notes_service = NotesService()


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "service": "Notes to CoA Service",
        "status": "healthy" if notes_service.available else "ollama unavailable",
        "endpoints": {
            "/convert": "POST - Convert advisor notes to client letter",
            "/health": "GET - Health check"
        }
    }


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy" if notes_service.available else "degraded",
        "ollama_available": notes_service.available
    }


@app.post("/convert", response_model=NotesResponse)
async def convert_notes(request: NotesRequest):
    """Convert advisor notes to client-friendly letter."""
    if not notes_service.available:
        raise HTTPException(
            status_code=503,
            detail="Ollama service not available"
        )

    try:
        result = notes_service.convert_notes_to_client_letter(
            notes=request.notes,
            client_name=request.client_name,
            model=request.model
        )

        return NotesResponse(**result)

    except Exception as e:
        logger.error(f"Error processing request: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Error converting notes: {str(e)}"
        )


if __name__ == "__main__":
    logger.info("Starting Notes to CoA Service...")
    uvicorn.run(app, host="0.0.0.0", port=8100)
