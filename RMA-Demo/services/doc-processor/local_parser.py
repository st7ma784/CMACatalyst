#!/usr/bin/env python3
"""
Local Document Parser - No Cloud Services
Uses Ollama with vision models (LLaVA) for document understanding
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

class LocalDocumentParser:
    """
    Local document parser using Ollama vision models.
    No external API calls - completely on-premises.
    """

    def __init__(self):
        self.ollama_url = os.getenv('OLLAMA_URL', 'http://ollama:11434')
        self.client = ollama.Client(host=self.ollama_url)

        # Use vision-capable model
        # Options: llava:7b, llava:13b, llava:34b, bakllava, or llava-phi3
        self.vision_model = os.getenv('VISION_MODEL', 'llava:13b')
        self.text_model = os.getenv('TEXT_MODEL', 'llama3.2')

    def _image_to_base64(self, image: Image.Image) -> str:
        """Convert PIL Image to base64 string."""
        buffered = io.BytesIO()
        image.save(buffered, format="PNG")
        return base64.b64encode(buffered.getvalue()).decode()

    def parse_document(self, file_path: str) -> Dict[str, Any]:
        """
        Parse document locally using vision models.

        Args:
            file_path: Path to document (PDF, image, etc.)

        Returns:
            Dictionary with parsed content, classification, and structured data
        """
        file_ext = Path(file_path).suffix.lower()

        # Convert to images
        if file_ext == '.pdf':
            images = convert_from_path(file_path, dpi=200)
        elif file_ext in ['.png', '.jpg', '.jpeg', '.tiff']:
            images = [Image.open(file_path)]
        else:
            raise ValueError(f"Unsupported file type: {file_ext}")

        # Process each page/image
        results = []
        for idx, image in enumerate(images):
            page_result = self._process_image(image, idx + 1)
            results.append(page_result)

        # Combine results
        full_text = "\n\n".join([r['text'] for r in results])

        # Classify document
        classification = self._classify_document(full_text, images[0])

        # Extract structured data
        structured_data = self._extract_structured_data(
            full_text,
            classification['document_type']
        )

        return {
            'text': full_text,
            'pages': results,
            'classification': classification,
            'structured_data': structured_data,
            'total_pages': len(images),
            'method': 'local_vision_llm'
        }

    def _process_image(self, image: Image.Image, page_num: int) -> Dict[str, Any]:
        """Process a single image with vision model."""

        # Resize if too large (to save memory)
        max_size = 1920
        if max(image.size) > max_size:
            ratio = max_size / max(image.size)
            new_size = tuple(int(dim * ratio) for dim in image.size)
            image = image.resize(new_size, Image.Resampling.LANCZOS)

        # Convert to base64
        image_b64 = self._image_to_base64(image)

        # Use vision model to extract text and understand layout
        prompt = """Analyze this document image and extract ALL text you see.

Maintain the document structure and formatting:
- Preserve headings and sections
- Keep tables in a readable format
- Note any monetary amounts clearly
- Identify form fields and their values
- Preserve the reading order

Extract everything you can see, including:
- Main text content
- Headers and footers
- Table data
- Form fields
- Dates, amounts, reference numbers
- Signatures or stamps (describe them)

Format the output as clean, structured text."""

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
                'image_size': image.size
            }

        except Exception as e:
            print(f"Error processing page {page_num} with vision model: {e}")
            # Fallback to Tesseract if vision model fails
            import pytesseract
            return {
                'page': page_num,
                'text': pytesseract.image_to_string(image),
                'image_size': image.size,
                'fallback': 'tesseract'
            }

    def _classify_document(self, text: str, first_page_image: Image.Image) -> Dict[str, Any]:
        """Classify document type using vision + text analysis."""

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
- other

Also identify:
- Priority level (priority_debt, non_priority_debt, income_evidence, expenditure_evidence, other)
- Key entities mentioned (creditor names, banks, councils, etc.)
- Monetary amounts found
- Important dates

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
            print(f"Error in classification: {e}")
            return self._fallback_classification(text)

    def _extract_structured_data(self, text: str, doc_type: str) -> Dict[str, Any]:
        """Extract structured data based on document type."""

        # Custom prompts based on document type
        if doc_type in ['bank_statement', 'credit_card_statement']:
            schema_prompt = """Extract financial data in JSON format:
{
  "account_holder": "name",
  "account_number": "last 4 digits",
  "statement_period": {"from": "date", "to": "date"},
  "opening_balance": 0.00,
  "closing_balance": 0.00,
  "transactions": [
    {"date": "YYYY-MM-DD", "description": "text", "amount": 0.00, "type": "debit|credit"}
  ],
  "total_debits": 0.00,
  "total_credits": 0.00
}"""

        elif doc_type == 'debt_collection_letter':
            schema_prompt = """Extract debt information in JSON format:
{
  "creditor": "name",
  "debtor": "name",
  "debt_reference": "ref number",
  "original_debt": 0.00,
  "current_balance": 0.00,
  "interest_charges": 0.00,
  "letter_date": "YYYY-MM-DD",
  "payment_deadline": "YYYY-MM-DD",
  "payment_methods": ["method1", "method2"],
  "consequences_mentioned": ["consequence1"]
}"""

        elif doc_type == 'utility_bill':
            schema_prompt = """Extract utility bill data in JSON format:
{
  "provider": "company name",
  "account_holder": "name",
  "account_number": "number",
  "bill_date": "YYYY-MM-DD",
  "due_date": "YYYY-MM-DD",
  "billing_period": {"from": "date", "to": "date"},
  "current_charges": 0.00,
  "previous_balance": 0.00,
  "payments_received": 0.00,
  "total_due": 0.00,
  "usage": {"amount": 0, "unit": "kwh|m3"}
}"""

        else:
            schema_prompt = """Extract key information in JSON format:
{
  "document_date": "YYYY-MM-DD",
  "reference_number": "ref",
  "parties": ["party1", "party2"],
  "amounts": [{"description": "text", "value": 0.00}],
  "important_dates": [{"description": "text", "date": "YYYY-MM-DD"}],
  "action_required": "text or null"
}"""

        prompt = f"""Analyze this document text and extract structured data.

Document text:
{text[:2000]}

{schema_prompt}

Extract the data and respond with ONLY valid JSON. If information is not found, use null."""

        try:
            response = self.client.generate(
                model=self.text_model,
                prompt=prompt,
                options={
                    'temperature': 0.1,
                    'num_predict': 800
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
            print(f"Error extracting structured data: {e}")
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


# Example usage
if __name__ == '__main__':
    parser = LocalDocumentParser()

    # Test with a document
    result = parser.parse_document('/path/to/document.pdf')

    print("Document Classification:", result['classification']['document_type'])
    print("Confidence:", result['classification']['confidence'])
    print("\nExtracted Text Preview:")
    print(result['text'][:500])
    print("\nStructured Data:")
    print(json.dumps(result['structured_data'], indent=2))
