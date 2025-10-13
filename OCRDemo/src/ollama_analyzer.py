import json
import logging
import httpx
from typing import Dict, Optional
from datetime import datetime

logger = logging.getLogger(__name__)

class OllamaDocumentAnalyzer:
    """Uses local Ollama service to intelligently extract structured data from OCR text"""

    def __init__(self, ollama_url: str = "http://ollama:11434"):
        self.ollama_url = ollama_url
        self.model_name = "llama3.1:8b"
        self.timeout = 30.0

    async def analyze_document(self, ocr_text: str) -> Dict:
        """Analyze OCR text and extract structured information using Ollama"""
        try:
            # Create the analysis prompt
            prompt = self._build_analysis_prompt(ocr_text)

            # Send to Ollama for analysis
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(
                    f"{self.ollama_url}/api/generate",
                    json={
                        "model": self.model_name,
                        "prompt": prompt,
                        "stream": False,
                        "options": {
                            "temperature": 0.1,  # Low temperature for consistent extraction
                            "top_p": 0.9,
                            "num_predict": 500
                        }
                    }
                )

                if response.status_code == 200:
                    result = response.json()
                    ai_response = result.get("response", "")

                    # Extract JSON from the response
                    extracted_data = self._parse_json_response(ai_response)

                    logger.info(f"Successfully analyzed document with Ollama")
                    return extracted_data
                else:
                    logger.error(f"Ollama request failed with status {response.status_code}")
                    return self._fallback_analysis()

        except Exception as e:
            logger.error(f"Error analyzing document with Ollama: {str(e)}")
            return self._fallback_analysis()

    def _build_analysis_prompt(self, ocr_text: str) -> str:
        """Build the analysis prompt for Ollama"""
        prompt = """You are an experienced debt advisor reviewing financial documents. Your task is to extract key information from the document text and provide it in a structured JSON format.

INSTRUCTIONS:
- Analyze the document carefully for debt-related information
- Extract only information that is clearly present in the text
- Classify debts as either "priority" or "non-priority"
- Priority debts include: mortgage, rent, council tax, gas/electricity, court fines, TV licence, child maintenance
- Non-priority debts include: credit cards, personal loans, store cards, overdrafts, catalogue debts
- Use "unknown" for any field you cannot determine from the text
- Amounts should be numbers only (no currency symbols)
- Dates should be in DD/MM/YYYY format where possible

EXAMPLE OUTPUT:
{
  "file_summary": "mortgage statement",
  "client_name": "John Smith",
  "debt_type": "priority",
  "debt_amount": 5000.00,
  "creditor_name": "Halifax Building Society",
  "account_reference": "MORT123456789",
  "document_date": "15/10/2024",
  "additional_references": ["Customer ID: 987654321"],
  "document_type": "statement",
  "urgency_level": "high"
}

DOCUMENT TEXT TO ANALYZE:
{ocr_text}

Please analyze the above document text and provide ONLY the JSON response with the extracted information:"""

        return prompt.format(ocr_text=ocr_text[:3000])  # Limit text length for processing

    def _parse_json_response(self, ai_response: str) -> Dict:
        """Parse JSON from AI response, handling various response formats"""
        try:
            # Try to find JSON in the response
            json_start = ai_response.find('{')
            json_end = ai_response.rfind('}') + 1

            if json_start >= 0 and json_end > json_start:
                json_str = ai_response[json_start:json_end]
                parsed_data = json.loads(json_str)

                # Validate and clean the parsed data
                return self._validate_and_clean_data(parsed_data)
            else:
                logger.warning("No JSON found in AI response, using fallback parsing")
                return self._fallback_parse_response(ai_response)

        except json.JSONDecodeError as e:
            logger.error(f"JSON parsing error: {str(e)}")
            return self._fallback_parse_response(ai_response)
        except Exception as e:
            logger.error(f"Error parsing AI response: {str(e)}")
            return self._fallback_analysis()

    def _validate_and_clean_data(self, data: Dict) -> Dict:
        """Validate and clean the extracted data"""
        cleaned_data = {
            "file_summary": str(data.get("file_summary", "unknown document")).lower()[:50],
            "client_name": str(data.get("client_name", "unknown")).title(),
            "debt_type": self._validate_debt_type(data.get("debt_type", "unknown")),
            "debt_amount": self._parse_amount(data.get("debt_amount")),
            "creditor_name": str(data.get("creditor_name", "unknown")).title(),
            "account_reference": str(data.get("account_reference", "unknown")),
            "document_date": self._validate_date(data.get("document_date")),
            "additional_references": self._clean_references(data.get("additional_references", [])),
            "document_type": str(data.get("document_type", "unknown")).lower(),
            "urgency_level": self._validate_urgency(data.get("urgency_level", "normal")),
            "extraction_method": "ollama_ai",
            "extraction_timestamp": datetime.now().isoformat()
        }

        return cleaned_data

    def _validate_debt_type(self, debt_type: str) -> str:
        """Validate debt type classification"""
        valid_types = ["priority", "non-priority", "unknown"]
        debt_type_lower = str(debt_type).lower()
        return debt_type_lower if debt_type_lower in valid_types else "unknown"

    def _parse_amount(self, amount) -> float:
        """Parse and validate debt amount"""
        try:
            if isinstance(amount, (int, float)):
                return float(amount)
            elif isinstance(amount, str):
                # Remove currency symbols and commas
                cleaned = amount.replace('£', '').replace('$', '').replace(',', '').strip()
                return float(cleaned) if cleaned else 0.0
            else:
                return 0.0
        except (ValueError, TypeError):
            return 0.0

    def _validate_date(self, date_str) -> str:
        """Validate and format date"""
        if not date_str or str(date_str).lower() == "unknown":
            return "unknown"

        # Basic date validation - could be enhanced
        date_str = str(date_str).strip()
        if len(date_str) >= 8 and ('/' in date_str or '-' in date_str):
            return date_str
        else:
            return "unknown"

    def _clean_references(self, references) -> list:
        """Clean and validate reference numbers"""
        if not isinstance(references, list):
            references = [str(references)] if references else []

        cleaned = []
        for ref in references:
            ref_str = str(ref).strip()
            if ref_str and ref_str.lower() != "unknown" and len(ref_str) > 3:
                cleaned.append(ref_str)

        return cleaned[:5]  # Limit to 5 references

    def _validate_urgency(self, urgency: str) -> str:
        """Validate urgency level"""
        valid_urgency = ["low", "normal", "high", "urgent"]
        urgency_lower = str(urgency).lower()
        return urgency_lower if urgency_lower in valid_urgency else "normal"

    def _fallback_parse_response(self, response: str) -> Dict:
        """Fallback parsing when JSON extraction fails"""
        logger.info("Using fallback parsing for AI response")

        # Simple text parsing as fallback
        fallback_data = {
            "file_summary": "ai analysis",
            "client_name": "unknown",
            "debt_type": "unknown",
            "debt_amount": 0.0,
            "creditor_name": "unknown",
            "account_reference": "unknown",
            "document_date": "unknown",
            "additional_references": [],
            "document_type": "unknown",
            "urgency_level": "normal",
            "extraction_method": "ollama_fallback",
            "extraction_timestamp": datetime.now().isoformat(),
            "raw_ai_response": response[:500]  # Store partial response for debugging
        }

        # Try to extract some basic info from the response text
        response_lower = response.lower()

        # Detect debt type
        if any(word in response_lower for word in ["mortgage", "rent", "council tax", "gas", "electric"]):
            fallback_data["debt_type"] = "priority"
        elif any(word in response_lower for word in ["credit card", "loan", "overdraft"]):
            fallback_data["debt_type"] = "non-priority"

        # Detect urgency
        if any(word in response_lower for word in ["urgent", "final", "court", "bailiff"]):
            fallback_data["urgency_level"] = "high"

        return fallback_data

    def _fallback_analysis(self) -> Dict:
        """Return fallback data when Ollama is unavailable"""
        return {
            "file_summary": "ocr extraction",
            "client_name": "unknown",
            "debt_type": "unknown",
            "debt_amount": 0.0,
            "creditor_name": "unknown",
            "account_reference": "unknown",
            "document_date": "unknown",
            "additional_references": [],
            "document_type": "unknown",
            "urgency_level": "normal",
            "extraction_method": "fallback",
            "extraction_timestamp": datetime.now().isoformat(),
            "error": "Ollama service unavailable"
        }

    async def test_connection(self) -> bool:
        """Test connection to Ollama service"""
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(f"{self.ollama_url}/api/version")
                return response.status_code == 200
        except Exception as e:
            logger.error(f"Ollama connection test failed: {str(e)}")
            return False