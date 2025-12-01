#!/usr/bin/env python3
"""
LLM Provider abstraction for Ollama integration.
"""

import logging
import httpx
import os

logger = logging.getLogger(__name__)


class OllamaProvider:
    """LLM provider for Ollama."""
    
    def __init__(self, base_url: str = None, model: str = None):
        self.base_url = base_url or os.getenv("OLLAMA_URL", "http://ollama:11434")
        self.model = model or os.getenv("OLLAMA_MODEL", "llama3.2:latest")
        self.timeout = 120.0
    
    def call_llm(self, prompt: str, temperature: float = 0.7, max_tokens: int = 2000) -> str:
        """Call Ollama LLM with prompt."""
        try:
            with httpx.Client(timeout=self.timeout) as client:
                response = client.post(
                    f"{self.base_url}/api/generate",
                    json={
                        "model": self.model,
                        "prompt": prompt,
                        "stream": False,
                        "temperature": temperature,
                        "top_p": 0.9,
                        "num_predict": max_tokens,
                    },
                    timeout=self.timeout
                )
                
                if response.status_code == 200:
                    result = response.json()
                    return result["response"].strip()
                else:
                    logger.error(f"Ollama error: {response.status_code} {response.text}")
                    raise Exception(f"Ollama API error: {response.status_code}")
        except Exception as e:
            logger.error(f"Error calling Ollama: {e}")
            raise
    
    def is_available(self) -> bool:
        """Check if Ollama is available."""
        try:
            with httpx.Client(timeout=5.0) as client:
                response = client.get(f"{self.base_url}/api/tags")
                return response.status_code == 200
        except:
            return False


def get_provider(provider_type: str = "ollama") -> OllamaProvider:
    """Get LLM provider instance."""
    if provider_type == "ollama":
        return OllamaProvider()
    else:
        raise ValueError(f"Unknown provider type: {provider_type}")
