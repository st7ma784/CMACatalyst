"""
vLLM to Ollama API Adapter
Bridges existing Ollama-based services to vLLM's OpenAI-compatible API
"""

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional, List
import httpx
import asyncio
import os
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="vLLM-Ollama Adapter", version="1.0.0")

# Configuration
VLLM_URL = os.getenv("VLLM_URL", "http://vllm:8000")
HEALTH_CHECK_TIMEOUT = 60

# Ollama-compatible models that map to vLLM
MODELS_MAPPING = {
    "llama3.2:latest": "meta-llama/Llama-2-7b-hf",
    "llama2:7b": "meta-llama/Llama-2-7b-hf",
    "llama2": "meta-llama/Llama-2-7b-hf",
}

class OllamaGenerateRequest(BaseModel):
    model: str
    prompt: str
    stream: bool = False
    temperature: Optional[float] = 0.7
    top_p: Optional[float] = 0.9
    top_k: Optional[int] = 40
    num_predict: Optional[int] = 512
    repeat_penalty: Optional[float] = 1.1
    context_window: Optional[int] = 4096

class OllamaEmbedRequest(BaseModel):
    model: str
    input: str

class OllamaGenerateResponse(BaseModel):
    model: str
    response: str
    done: bool = True
    context: List[int] = []
    total_duration: int
    load_duration: int
    prompt_eval_duration: int
    eval_duration: int

async def get_vllm_client():
    """Get or create async HTTP client for vLLM"""
    return httpx.AsyncClient(base_url=VLLM_URL, timeout=300.0)

async def wait_for_vllm():
    """Wait for vLLM server to be ready"""
    client = httpx.AsyncClient(base_url=VLLM_URL, timeout=10.0)
    start_time = asyncio.get_event_loop().time()
    
    while asyncio.get_event_loop().time() - start_time < HEALTH_CHECK_TIMEOUT:
        try:
            response = await client.get("/health")
            if response.status_code == 200:
                logger.info("✅ vLLM server is healthy")
                await client.aclose()
                return True
        except Exception as e:
            logger.debug(f"Waiting for vLLM... {e}")
            await asyncio.sleep(2)
    
    await client.aclose()
    raise RuntimeError("vLLM server failed to become ready")

@app.on_event("startup")
async def startup():
    """Wait for vLLM server on startup"""
    try:
        await wait_for_vllm()
    except Exception as e:
        logger.error(f"❌ Failed to connect to vLLM: {e}")
        raise

@app.get("/health")
async def health():
    """Health check endpoint"""
    try:
        async with httpx.AsyncClient(base_url=VLLM_URL, timeout=5.0) as client:
            response = await client.get("/health")
            if response.status_code == 200:
                return {
                    "status": "healthy",
                    "vllm": "connected",
                    "adapter": "operational"
                }
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        raise HTTPException(status_code=503, detail="vLLM service unavailable")

@app.post("/api/generate")
async def generate(request: OllamaGenerateRequest):
    """
    Generate text using vLLM
    Maps Ollama API to vLLM OpenAI API
    """
    try:
        async with httpx.AsyncClient(base_url=VLLM_URL, timeout=300.0) as client:
            # Convert Ollama request to vLLM OpenAI API format
            vllm_request = {
                "model": "llm",  # Model name served by vLLM
                "messages": [
                    {"role": "user", "content": request.prompt}
                ],
                "temperature": request.temperature or 0.7,
                "top_p": request.top_p or 0.9,
                "max_tokens": request.num_predict or 512,
                "stream": request.stream,
            }
            
            logger.info(f"Generating with vLLM... (prompt: {len(request.prompt)} chars)")
            
            response = await client.post(
                "/v1/chat/completions",
                json=vllm_request
            )
            
            if response.status_code != 200:
                logger.error(f"vLLM error: {response.text}")
                raise HTTPException(status_code=response.status_code, detail=response.text)
            
            vllm_response = response.json()
            
            # Convert vLLM response back to Ollama format
            completion_text = vllm_response["choices"][0]["message"]["content"]
            
            return OllamaGenerateResponse(
                model=request.model,
                response=completion_text,
                done=True,
                context=[],
                total_duration=0,
                load_duration=0,
                prompt_eval_duration=0,
                eval_duration=0,
            )
    
    except httpx.TimeoutException:
        logger.error("vLLM request timeout")
        raise HTTPException(status_code=504, detail="vLLM request timeout")
    except Exception as e:
        logger.error(f"Generation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/tags")
async def tags():
    """
    List available models
    Ollama-compatible endpoint
    """
    return {
        "models": [
            {
                "name": "llama3.2:latest",
                "modified_at": "2024-01-01T00:00:00Z",
                "size": 7000000000,
                "digest": "abc123",
                "details": {
                    "format": "gguf",
                    "family": "llama",
                    "families": ["llama"],
                    "parameter_size": "7B",
                    "quantization_level": "q4_0",
                }
            },
            {
                "name": "llama2:7b",
                "modified_at": "2024-01-01T00:00:00Z",
                "size": 7000000000,
                "digest": "abc123",
                "details": {
                    "format": "gguf",
                    "family": "llama",
                    "families": ["llama"],
                    "parameter_size": "7B",
                    "quantization_level": "q4_0",
                }
            }
        ]
    }

@app.get("/")
async def root():
    """Service info"""
    return {
        "name": "vLLM-Ollama Adapter",
        "version": "1.0.0",
        "description": "OpenAI API compatible LLM inference via vLLM",
        "endpoints": {
            "generate": "POST /api/generate",
            "tags": "GET /api/tags",
            "health": "GET /health",
        }
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
