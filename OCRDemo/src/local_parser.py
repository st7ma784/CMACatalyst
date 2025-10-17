#!/usr/bin/env python3
"""
Local Document Parser - No Cloud Services
Uses Ollama with vision models (LLaVA) for document understanding
Adapted for OCR Demo with debt advice focus
"""

import os
import base64
from pathlib import Path
from typing import Dict, Any, Optional
import ollama
from pdf2image import convert_from_path
from PIL import Image
import io
import json
import logging

logger = logging.getLogger(__name__)

class LocalDocumentParser:
    """
    Local document parser using Ollama vision models.
    No external API calls - completely on-premises.
    """

    def __init__(self):
        self.ollama_url = os.getenv('OLLAMA_BASE_URL', 'http://ollama:11434')
        self.client = ollama.Client(host=self.ollama_url)

        # Use vision-capable model
        # Options: llava:7b, llava:13b, llava:34b, bakllava, or llava-phi3
        self.vision_model = os.getenv('VISION_MODEL', 'llava:7b')
        self.text_model = os.getenv('TEXT_MODEL', 'llama2')
        
        logger.info(f"Initialized LocalDocumentParser with vision model: {self.vision_model}")

    def _image_to_base64(self, image: Image.Image) -> str:
        """Convert PIL Image to base64 string."""
        buffered = io.BytesIO()
        image.save(buffered, format="PNG")
        return base64.b64encode(buffered.getvalue()).decode()

    def parse_document(self, file_path: str, high_quality: bool = True) -> Dict[str, Any]:
        """
        Parse document locally using vision models.

        Args:
            file_path: Path to document (PDF, image, etc.)
            high_quality: Use higher DPI for better quality (slower)

        Returns:
            Dictionary with parsed content, classification, and structured data
        """
        file_ext = Path(file_path).suffix.lower()

        # Convert to images with higher DPI for better quality
        dpi = 400 if high_quality else 200
        
        if file_ext == '.pdf':
            logger.info(f"Converting PDF to images at {dpi} DPI")
            images = convert_from_path(file_path, dpi=dpi)
        elif file_ext in ['.png', '.jpg', '.jpeg', '.tiff']:
            images = [Image.open(file_path)]
        else:
            raise ValueError(f"Unsupported file type: {file_ext}")

        # Process each page/image
        results = []
        for idx, image in enumerate(images):
            logger.info(f"Processing page {idx + 1} with LLaVA vision model")
            page_result = self._process_image(image, idx + 1)
            results.append(page_result)

        # Combine results
        full_text = "\n\n".join([r['text'] for r in results])

        # Classify document
        classification = self._classify_document(full_text, images[0])

        # Extract structured debt data
        structured_data = self._extract_debt_data(full_text, classification['document_type'])

        return {
            'text': full_text,
            'pages': results,
            'classification': classification,
            'structured_data': structured_data,
            'total_pages': len(images),
            'method': 'local_vision_llm',
            'model': self.vision_model,
            'dpi': dpi
        }

    def _process_image(self, image: Image.Image, page_num: int) -> Dict[str, Any]:
        """Process a single image with vision model."""

        # Resize if too large (to save memory and improve speed)
        max_size = 2048  # Increased from 1920 for better quality
        if max(image.size) > max_size:
            ratio = max_size / max(image.size)
            new_size = tuple(int(dim * ratio) for dim in image.size)
            image = image.resize(new_size, Image.Resampling.LANCZOS)

        # Convert to base64
        image_b64 = self._image_to_base64(image)

        # Use vision model to extract text and understand layout
        prompt = """Analyze this debt advice document image and extract ALL text you see.

Focus on:
- Client names and addresses
- Creditor information
- Account numbers and references
- Debt amounts (particularly important - extract all monetary values)
- Payment terms and deadlines
- Interest rates and charges
- Document dates
- Any legal notices or court information

Maintain the document structure and formatting:
- Preserve headings and sections
- Keep tables in a readable format
- Note ALL monetary amounts clearly with currency symbols
- Identify form fields and their values
- Preserve the reading order

Extract everything you can see, including:
- Main text content
- Headers and footers
- Table data
- Form fields
- Dates, amounts, reference numbers
- Signatures or stamps (describe them)

Format the output as clean, structured text with clear identification of debt amounts."""

        try:
            response = self.client.chat(
                model=self.vision_model,
                messages=[{
                    'role': 'user',
                    'content': prompt,
                    'images': [image_b64]
                }],
                options={
                    'temperature': 0.1,
                    'num_predict': 2000
                }
            )

            extracted_text = response['message']['content']

            return {
                'page': page_num,
                'text': extracted_text,
                'image_size': image.size,
                'method': 'llava_vision'
            }

        except Exception as e:
            logger.error(f"Error processing page {page_num} with vision model: {e}")
            # Fallback to Tesseract if vision model fails
            import pytesseract
            return {
                'page': page_num,
                'text': pytesseract.image_to_string(image),
                'image_size': image.size,
                'method': 'tesseract_fallback'
            }

    def _classify_document(self, text: str, first_page_image: Image.Image) -> Dict[str, Any]:
        """Classify debt advice document type using vision + text analysis."""

        image_b64 = self._image_to_base64(first_page_image)

        prompt = f"""Analyze this financial/debt document and classify it.

Document text preview:
{text[:1000]}

Classify this document into ONE of these categories:
- bank_statement
- credit_card_statement
- loan_agreement
- debt_collection_letter
- court_document
- benefit_statement
- utility_bill
- rent_statement
- council_tax_bill
- income_evidence
- expenditure_evidence
- universal_credit_statement
- debt_advice_letter
- creditor_correspondence
- other

Also identify:
- Priority level (priority_debt, non_priority_debt, income_evidence, expenditure_evidence, other)
- Key entities mentioned (creditor names, banks, councils, etc.)
- ALL monetary amounts found (very important for debt advice)
- Important dates (especially payment deadlines)

Respond ONLY with valid JSON in this format:
{{
  "document_type": "type_here",
  "priority_level": "level_here",
  "confidence": 0.95,
  "entities": ["entity1", "entity2"],
  "amounts": [1234.56, 789.00],
  "dates": ["2024-01-15"],
  "reasoning": "brief explanation"
}}"""

        try:
            response = self.client.chat(
                model=self.vision_model,
                messages=[{
                    'role': 'user',
                    'content': prompt,
                    'images': [image_b64]
                }],
                options={
                    'temperature': 0.1,
                    'num_predict': 500
                }
            )

            # Extract JSON from response
            response_text = response['message']['content']

            # Try to find JSON in response
            import re
            json_match = re.search(r'\{.*\}', response_text, re.DOTALL)
            if json_match:
                return json.loads(json_match.group())
            else:
                # Fallback classification
                return self._fallback_classification(text)

        except Exception as e:
            logger.error(f"Error in classification: {e}")
            return self._fallback_classification(text)

    def _extract_debt_data(self, text: str, doc_type: str) -> Dict[str, Any]:
        """Extract structured debt data based on document type."""

        # Debt-focused schema
        schema_prompt = """Extract debt and financial information in JSON format:
{
  "client_name": "full name",
  "creditor_name": "creditor/lender name",
  "account_number": "account or reference number",
  "debts": [
    {
      "creditor_name": "name",
      "amount": 0.00,
      "account_number": "ref",
      "debt_type": "priority|non-priority",
      "status": "current|arrears|default"
    }
  ],
  "total_debt_amount": 0.00,
  "document_date": "YYYY-MM-DD",
  "payment_deadline": "YYYY-MM-DD or null",
  "interest_rate": "percentage or null",
  "monthly_payment": 0.00,
  "arrears_amount": 0.00,
  "additional_charges": 0.00,
  "case_number": "RMA reference if found",
  "priority_status": "priority_debt|non_priority_debt",
  "action_required": "text description"
}

Extract ALL monetary amounts you find. This is critical for debt advice."""

        prompt = f"""Analyze this debt document text and extract structured financial data.

Document text:
{text[:2500]}

{schema_prompt}

Extract the data and respond with ONLY valid JSON. If information is not found, use null.
Pay special attention to all monetary amounts - extract every single one you can find."""

        try:
            response = self.client.generate(
                model=self.text_model,
                prompt=prompt,
                options={
                    'temperature': 0.1,
                    'num_predict': 1000
                }
            )

            response_text = response['response']

            # Extract JSON
            import re
            json_match = re.search(r'\{.*\}', response_text, re.DOTALL)
            if json_match:
                return json.loads(json_match.group())
            else:
                return {"error": "Could not extract structured data"}

        except Exception as e:
            logger.error(f"Error extracting structured data: {e}")
            return {"error": str(e)}

    def _fallback_classification(self, text: str) -> Dict[str, Any]:
        """Simple rule-based classification fallback."""
        text_lower = text.lower()

        # Simple keyword matching
        if any(word in text_lower for word in ['bank statement', 'account balance', 'sort code']):
            doc_type = 'bank_statement'
        elif any(word in text_lower for word in ['credit card', 'card number', 'minimum payment']):
            doc_type = 'credit_card_statement'
        elif any(word in text_lower for word in ['debt', 'collection', 'owe', 'overdue']):
            doc_type = 'debt_collection_letter'
        elif any(word in text_lower for word in ['council tax', 'local authority']):
            doc_type = 'council_tax_bill'
        elif any(word in text_lower for word in ['universal credit', 'benefit', 'dwp']):
            doc_type = 'benefit_statement'
        elif any(word in text_lower for word in ['electricity', 'gas', 'water', 'utility']):
            doc_type = 'utility_bill'
        elif any(word in text_lower for word in ['court', 'claim', 'judgment', 'ccj']):
            doc_type = 'court_document'
        else:
            doc_type = 'other'

        return {
            'document_type': doc_type,
            'priority_level': 'unknown',
            'confidence': 0.5,
            'entities': [],
            'amounts': [],
            'dates': [],
            'reasoning': 'Fallback keyword matching'
        }
