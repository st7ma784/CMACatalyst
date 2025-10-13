import logging
from typing import List
import httpx
import numpy as np

logger = logging.getLogger(__name__)

class EmbeddingService:
    """Handles text embedding generation using Ollama"""

    def __init__(self, ollama_url: str, model_name: str = "nomic-embed-text"):
        self.ollama_url = ollama_url
        self.model_name = model_name
        self.embedding_dim = 768  # Default dimension for nomic-embed-text

    async def generate_embedding(self, text: str) -> List[float]:
        """Generate embedding for given text using Ollama"""
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    f"{self.ollama_url}/api/embeddings",
                    json={
                        "model": self.model_name,
                        "prompt": text
                    }
                )
                response.raise_for_status()

                result = response.json()
                embedding = result.get("embedding", [])

                if not embedding:
                    logger.warning(f"Empty embedding returned for text: {text[:100]}...")
                    # Return zero vector as fallback
                    return [0.0] * self.embedding_dim

                return embedding

        except httpx.HTTPError as e:
            logger.error(f"HTTP error generating embedding: {str(e)}")
            # Fallback to zero vector
            return [0.0] * self.embedding_dim
        except Exception as e:
            logger.error(f"Unexpected error generating embedding: {str(e)}")
            # Fallback to zero vector
            return [0.0] * self.embedding_dim

    async def generate_batch_embeddings(self, texts: List[str]) -> List[List[float]]:
        """Generate embeddings for multiple texts"""
        embeddings = []

        for text in texts:
            embedding = await self.generate_embedding(text)
            embeddings.append(embedding)

        return embeddings

    async def ensure_model_available(self) -> bool:
        """Ensure the embedding model is available in Ollama"""
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                # Check if model is available
                response = await client.get(f"{self.ollama_url}/api/tags")
                response.raise_for_status()

                models = response.json().get("models", [])
                model_names = [model["name"] for model in models]

                if self.model_name not in model_names:
                    logger.info(f"Model {self.model_name} not found, attempting to pull...")

                    # Pull the model
                    pull_response = await client.post(
                        f"{self.ollama_url}/api/pull",
                        json={"name": self.model_name},
                        timeout=300.0  # 5 minutes for model download
                    )
                    pull_response.raise_for_status()

                    logger.info(f"Successfully pulled model {self.model_name}")

                return True

        except Exception as e:
            logger.error(f"Failed to ensure model availability: {str(e)}")
            return False

    def cosine_similarity(self, embedding1: List[float], embedding2: List[float]) -> float:
        """Calculate cosine similarity between two embeddings"""
        try:
            vec1 = np.array(embedding1)
            vec2 = np.array(embedding2)

            # Calculate cosine similarity
            dot_product = np.dot(vec1, vec2)
            norm_vec1 = np.linalg.norm(vec1)
            norm_vec2 = np.linalg.norm(vec2)

            if norm_vec1 == 0 or norm_vec2 == 0:
                return 0.0

            similarity = dot_product / (norm_vec1 * norm_vec2)
            return float(similarity)

        except Exception as e:
            logger.error(f"Error calculating cosine similarity: {str(e)}")
            return 0.0