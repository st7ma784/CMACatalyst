# services/rag-service/llm_provider.py
# LLM Provider Abstraction Layer - Use this to support both Ollama and vLLM

"""
LLM Provider Abstraction Layer
Supports both Ollama and vLLM with automatic fallback
Drop-in replacement for existing Ollama code
"""

import os
import logging
from typing import Optional
from abc import ABC, abstractmethod

logger = logging.getLogger(__name__)


class LLMProvider(ABC):
    """Abstract base class for LLM providers"""
    
    @abstractmethod
    def initialize_embeddings(self):
        """Initialize and return embeddings"""
        pass
    
    @abstractmethod
    def initialize_llm(self, temperature: float = 0.7):
        """Initialize and return LLM"""
        pass


class OllamaProvider(LLMProvider):
    """Ollama-based LLM provider"""
    
    def __init__(self, base_url: str = None):
        self.base_url = base_url or os.getenv('OLLAMA_URL', 'http://ollama:11434')
        logger.info(f"Initializing Ollama provider with base_url: {self.base_url}")
        
        try:
            from langchain_community.embeddings import OllamaEmbeddings
            from langchain_community.llms import Ollama as OllamaLLM
            self.OllamaEmbeddings = OllamaEmbeddings
            self.Ollama = OllamaLLM
        except ImportError as e:
            logger.error(f"Failed to import Ollama components: {e}")
            raise
    
    def initialize_embeddings(self):
        """Initialize Ollama embeddings"""
        return self.OllamaEmbeddings(
            model="nomic-embed-text",
            base_url=self.base_url
        )
    
    def initialize_llm(self, temperature: float = 0.7):
        """Initialize Ollama LLM"""
        return self.Ollama(
            model="llama3.2",
            base_url=self.base_url,
            temperature=temperature
        )


class VLLMProvider(LLMProvider):
    """vLLM-based LLM provider (OpenAI compatible)"""
    
    def __init__(self, api_base: str = None, api_key: str = None):
        self.api_base = api_base or os.getenv('VLLM_URL', 'http://vllm:8000')
        self.api_key = api_key or os.getenv('VLLM_API_KEY', 'sk-vllm')
        self.full_api_base = f"{self.api_base}/v1"
        
        logger.info(f"Initializing vLLM provider with base_url: {self.api_base}")
        
        try:
            from langchain.embeddings.openai import OpenAIEmbeddings
            from langchain.llms.openai import OpenAI as LangChainOpenAI
            from openai import OpenAI
            
            self.OpenAIEmbeddings = OpenAIEmbeddings
            self.LangChainOpenAI = LangChainOpenAI
            self.OpenAI = OpenAI
        except ImportError as e:
            logger.error(f"Failed to import vLLM components: {e}")
            raise
    
    def initialize_embeddings(self):
        """Initialize vLLM embeddings (OpenAI compatible)"""
        return self.OpenAIEmbeddings(
            model="nomic-embed-text",
            openai_api_base=self.full_api_base,
            openai_api_key=self.api_key
        )
    
    def initialize_llm(self, temperature: float = 0.7):
        """Initialize vLLM LLM (OpenAI compatible)"""
        return self.LangChainOpenAI(
            model_name="llama3.2",
            openai_api_base=self.full_api_base,
            openai_api_key=self.api_key,
            temperature=temperature
        )
    
    def get_direct_client(self):
        """Get direct OpenAI client for advanced features"""
        return self.OpenAI(
            api_key=self.api_key,
            base_url=self.full_api_base
        )


def get_provider(force_provider: str = None) -> LLMProvider:
    """
    Factory function to get the configured LLM provider
    
    Args:
        force_provider: Override configured provider ("ollama" or "vllm")
    
    Returns:
        LLMProvider instance (Ollama or vLLM)
    
    Raises:
        ImportError: If provider initialization fails
    """
    provider = force_provider or os.getenv('LLM_PROVIDER', 'vllm').lower()
    
    logger.info(f"Getting LLM provider: {provider}")
    
    try:
        if provider == 'ollama':
            return OllamaProvider()
        elif provider == 'vllm':
            return VLLMProvider()
        else:
            logger.warning(f"Unknown provider '{provider}', defaulting to vLLM")
            return VLLMProvider()
    except ImportError as e:
        logger.error(f"Provider initialization failed: {e}")
        logger.warning("Attempting fallback provider...")
        
        # Try fallback
        if provider == 'vllm':
            try:
                logger.info("Falling back to Ollama")
                return OllamaProvider()
            except ImportError:
                raise RuntimeError("All LLM providers failed to initialize")
        else:
            try:
                logger.info("Falling back to vLLM")
                return VLLMProvider()
            except ImportError:
                raise RuntimeError("All LLM providers failed to initialize")


# Convenience function for direct API calls
def get_direct_llm_client():
    """
    Get a direct LLM client for making raw API calls.
    Returns OpenAI client for vLLM, or creates one for Ollama.
    """
    provider = os.getenv('LLM_PROVIDER', 'vllm').lower()
    
    if provider == 'vllm':
        vllm_provider = VLLMProvider()
        return vllm_provider.get_direct_client()
    else:
        # For Ollama, create a wrapper that uses requests
        import requests
        
        class OllamaDirectClient:
            def __init__(self, base_url):
                self.base_url = base_url
            
            def generate(self, prompt, model="llama3.2", temperature=0.7, max_tokens=1000):
                response = requests.post(
                    f"{self.base_url}/api/generate",
                    json={
                        "model": model,
                        "prompt": prompt,
                        "stream": False,
                        "options": {
                            "temperature": temperature,
                            "num_predict": max_tokens
                        }
                    },
                    timeout=60
                )
                return response.json()
        
        ollama_url = os.getenv('OLLAMA_URL', 'http://ollama:11434')
        return OllamaDirectClient(ollama_url)
