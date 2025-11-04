"""
LLM client for vLLM with structured output support.
Handles entity/relationship extraction with JSON schema enforcement.
"""

import json
import logging
from typing import Dict, Optional
import requests
from tenacity import retry, stop_after_attempt, wait_exponential

logger = logging.getLogger(__name__)


class VLLMClient:
    """vLLM client with structured output support."""
    
    # JSON schemas for structured outputs
    SCHEMAS = {
        "entity_extraction": {
            "type": "object",
            "properties": {
                "entities": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "entity_text": {"type": "string"},
                            "entity_type": {"type": "string"},
                            "confidence": {"type": "number"},
                            "start_position": {"type": "integer"},
                            "end_position": {"type": "integer"},
                            "context": {"type": "string"}
                        },
                        "required": ["entity_text", "entity_type", "confidence"]
                    }
                }
            },
            "required": ["entities"]
        },
        "relationship_extraction": {
            "type": "object",
            "properties": {
                "relationships": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "entity1_text": {"type": "string"},
                            "entity2_text": {"type": "string"},
                            "relation_type": {"type": "string"},
                            "confidence": {"type": "number"},
                            "condition": {"type": ["string", "null"]},
                            "effective_date": {"type": ["string", "null"]},
                            "expiry_date": {"type": ["string", "null"]},
                            "logic_gate": {"type": ["string", "null"]},
                            "source_sentences": {
                                "type": "array",
                                "items": {"type": "string"}
                            }
                        },
                        "required": ["entity1_text", "entity2_text", "relation_type", "confidence"]
                    }
                }
            },
            "required": ["relationships"]
        }
    }
    
    def __init__(self, vllm_url: str, model: str = "llama3.2"):
        """
        Initialize vLLM client.
        
        Args:
            vllm_url: vLLM server URL (e.g., http://vllm:8000)
            model: Model name to use for completions
        """
        self.vllm_url = vllm_url.rstrip("/")
        self.model = model
        self.chat_endpoint = f"{self.vllm_url}/v1/chat/completions"
        self.completions_endpoint = f"{self.vllm_url}/v1/completions"
    
    def health_check(self) -> bool:
        """Check if vLLM server is available."""
        try:
            response = requests.get(
                f"{self.vllm_url}/health",
                timeout=5
            )
            is_healthy = response.status_code == 200
            if is_healthy:
                logger.info(f"vLLM server healthy at {self.vllm_url}")
            return is_healthy
        except Exception as e:
            logger.error(f"vLLM health check failed: {e}")
            return False
    
    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10)
    )
    def _call_vllm(self, prompt: str, max_tokens: int = 2000) -> str:
        """
        Call vLLM with retry logic.
        
        Args:
            prompt: Prompt to send
            max_tokens: Maximum tokens in response
            
        Returns:
            Generated text
        """
        try:
            response = requests.post(
                self.chat_endpoint,
                json={
                    "model": self.model,
                    "messages": [
                        {
                            "role": "system",
                            "content": "You are a precise data extraction specialist. Return only valid JSON, no markdown formatting."
                        },
                        {
                            "role": "user",
                            "content": prompt
                        }
                    ],
                    "temperature": 0.1,  # Low temperature for consistency
                    "max_tokens": max_tokens,
                    "top_p": 0.9
                },
                timeout=60
            )
            
            response.raise_for_status()
            
            result = response.json()
            if "choices" in result and len(result["choices"]) > 0:
                return result["choices"][0]["message"]["content"]
            else:
                raise ValueError(f"Unexpected response format: {result}")
                
        except requests.exceptions.RequestException as e:
            logger.error(f"vLLM request failed: {e}")
            raise
    
    def create_extraction(self,
                         prompt: str,
                         schema_name: str = "entity_extraction",
                         max_tokens: int = 2000) -> str:
        """
        Create structured extraction with vLLM.
        
        Args:
            prompt: Extraction prompt
            schema_name: Schema to enforce ("entity_extraction" or "relationship_extraction")
            max_tokens: Maximum tokens
            
        Returns:
            JSON string with extraction results
        """
        try:
            # Add schema instructions to prompt
            schema = self.SCHEMAS.get(schema_name, {})
            
            enhanced_prompt = f"""{prompt}

Return ONLY valid JSON in this exact format:
{json.dumps(schema, indent=2)}

Return the JSON array directly without any markdown formatting or extra text."""
            
            response_text = self._call_vllm(enhanced_prompt, max_tokens)
            
            # Clean up response (remove markdown formatting if present)
            response_text = response_text.strip()
            if response_text.startswith("```"):
                # Remove markdown code blocks
                response_text = response_text.split("```")[1]
                if response_text.startswith("json"):
                    response_text = response_text[4:]
            response_text = response_text.strip()
            
            # Validate JSON
            try:
                json.loads(response_text)
            except json.JSONDecodeError:
                logger.warning(f"Invalid JSON response, attempting repair: {response_text[:100]}")
                # Try to extract JSON from response
                import re
                json_match = re.search(r'\{.*\}|\[.*\]', response_text, re.DOTALL)
                if json_match:
                    response_text = json_match.group(0)
                else:
                    raise
            
            return response_text
            
        except Exception as e:
            logger.error(f"Extraction failed: {e}")
            raise
    
    def extract_entities_from_text(self, text: str, max_tokens: int = 2000) -> Dict:
        """
        Extract entities from text using structured extraction.
        
        Args:
            text: Text to extract from
            max_tokens: Maximum tokens
            
        Returns:
            Dict with entities list
        """
        prompt = f"""Extract all named entities from this text. For each entity, identify:
1. entity_text (exact text from document)
2. entity_type (one of: DEBT_TYPE, OBLIGATION, RULE, GATE, MONEY_THRESHOLD, CREDITOR, REPAYMENT_TERM, LEGAL_STATUS, CLIENT_ATTRIBUTE, PERSON, ORGANIZATION, DATE, MONEY, PERCENT, LOCATION, DURATION)
3. confidence (0.0-1.0)
4. start_position (character index where entity starts)
5. end_position (character index where entity ends)
6. context (the full sentence containing this entity)

Text to analyze:
{text}"""
        
        response = self.create_extraction(
            prompt=prompt,
            schema_name="entity_extraction",
            max_tokens=max_tokens
        )
        
        try:
            data = json.loads(response)
            return data.get("entities", [])
        except json.JSONDecodeError:
            logger.error(f"Failed to parse extraction response: {response}")
            return []
    
    def extract_relationships_from_text(self,
                                       text: str,
                                       entities_text: str,
                                       max_tokens: int = 3000) -> Dict:
        """
        Extract relationships from text using structured extraction.
        
        Args:
            text: Text to extract from
            entities_text: Formatted entity list
            max_tokens: Maximum tokens
            
        Returns:
            Dict with relationships list
        """
        prompt = f"""Given these entities extracted from a financial/debt advice document:

{entities_text}

Extract relationships between these entities. For each relationship:
1. entity1_text (first entity text - must match an entity from above)
2. entity2_text (second entity text - must match an entity from above)
3. relation_type (one of: IS_A, PART_OF, SYNONYMOUS, TRIGGERS, REQUIRES, BLOCKS, FOLLOWS, AFFECTS_REPAYMENT, HAS_GATE, CONTRADICTS, EXTENDS, APPLICABLE_TO, ENABLES, RESTRICTS)
4. confidence (0.0-1.0)
5. condition (if applicable: "if X then Y" format, or null)
6. effective_date (if applicable: "2025-01-01" format, or null)
7. expiry_date (if applicable: null unless specified)
8. logic_gate (if applicable: "when condition" format, or null)
9. source_sentences (list of sentences supporting this relationship)

Text for context:
{text}"""
        
        response = self.create_extraction(
            prompt=prompt,
            schema_name="relationship_extraction",
            max_tokens=max_tokens
        )
        
        try:
            data = json.loads(response)
            return data.get("relationships", [])
        except json.JSONDecodeError:
            logger.error(f"Failed to parse relationships response: {response}")
            return []
    
    def generate_reasoning_chain(self,
                                question: str,
                                applicable_rules: str,
                                client_facts: str) -> str:
        """
        Generate reasoning chain from rules and facts.
        
        Args:
            question: Advisory question
            applicable_rules: Formatted applicable rules
            client_facts: Formatted client facts
            
        Returns:
            Generated reasoning text
        """
        prompt = f"""Given:
Question: {question}

Applicable Rules from Manual:
{applicable_rules}

Client Facts:
{client_facts}

Generate a clear reasoning chain that explains how the rules apply to the client's situation.
Include:
1. Which rules are applicable
2. Why they apply (cite specific facts)
3. Any temporal gates or conditions
4. Final advisory recommendation

Be concise and cite all rules and facts used."""
        
        response = self._call_vllm(prompt, max_tokens=1000)
        return response
