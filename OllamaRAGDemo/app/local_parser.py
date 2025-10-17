#!/usr/bin/env python3
"""
Local Document Parser - No Cloud Services
Uses Ollama with vision models (LLaVA) for document understanding
Adapted for OllamaRAGDemo RAG ingestion
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
import re

logging.basicConfig(level=logging.INFO)
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
        elif file_ext in ['.png', '.jpg', '.jpeg', '.tiff', '.tif']:
            images = [Image.open(file_path)]
        else:
            raise ValueError(f"Unsupported file type: {file_ext}")

        # Process each page/image
        results = []
        for idx, image in enumerate(images):
            logger.info(f"Processing page {idx + 1}/{len(images)} with LLaVA vision model")
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
            'method': 'local_vision_llm',
            'model': self.vision_model,
            'dpi': dpi
        }

    def _process_image(self, image: Image.Image, page_num: int) -> Dict[str, Any]:
        """Process a single image with vision model."""

        # Resize if too large (to save memory and improve speed)
        max_size = 2048
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

Format the output as clean, structured text with proper paragraphs and sections."""

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
            try:
                import pytesseract
                return {
                    'page': page_num,
                    'text': pytesseract.image_to_string(image),
                    'image_size': image.size,
                    'method': 'tesseract_fallback'
                }
            except:
                return {
                    'page': page_num,
                    'text': f'[Error extracting text from page {page_num}]',
                    'image_size': image.size,
                    'method': 'error'
                }

    def _classify_document(self, text: str, first_page_image: Image.Image) -> Dict[str, Any]:
        """Classify document type using vision + text analysis."""

        image_b64 = self._image_to_base64(first_page_image)

        prompt = f"""Analyze this document and classify it.

Document text preview:
{text[:1000]}

Classify this document into ONE of these categories:
- financial_guide
- benefit_information
- tax_guide
- pension_guide
- insurance_guide
- debt_advice
- business_finance
- student_finance
- budget_planning
- legal_document
- form
- statement
- letter
- report
- manual
- other

Also identify:
- Main topic/subject
- Key entities or organizations mentioned
- Document purpose
- Target audience

Respond ONLY with valid JSON in this format:
{{
  "document_type": "type_here",
  "main_topic": "topic description",
  "confidence": 0.95,
  "entities": ["entity1", "entity2"],
  "purpose": "what this document is for",
  "audience": "who this is for"
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
            json_match = re.search(r'\{.*\}', response_text, re.DOTALL)
            if json_match:
                return json.loads(json_match.group())
            else:
                # Fallback classification
                return self._fallback_classification(text)

        except Exception as e:
            logger.error(f"Error in classification: {e}")
            return self._fallback_classification(text)

    def _extract_structured_data(self, text: str, doc_type: str) -> Dict[str, Any]:
        """Extract structured data based on document type."""

        # Schema for general information extraction
        schema_prompt = """Extract key information in JSON format:
{
  "title": "document title if present",
  "author": "author or organization",
  "date": "publication date if found",
  "key_topics": ["topic1", "topic2", "topic3"],
  "important_sections": [
    {"heading": "section name", "summary": "brief summary"}
  ],
  "key_facts": ["fact1", "fact2"],
  "definitions": [
    {"term": "term", "definition": "definition"}
  ],
  "references": ["reference1", "reference2"]
}

Extract the data and respond with ONLY valid JSON. If information is not found, use null or empty array."""

        prompt = f"""Analyze this document text and extract structured data.

Document text:
{text[:2500]}

{schema_prompt}"""

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

        # Simple keyword matching for common document types
        if any(word in text_lower for word in ['pension', 'retirement', 'annuity']):
            doc_type = 'pension_guide'
        elif any(word in text_lower for word in ['tax', 'hmrc', 'vat', 'income tax']):
            doc_type = 'tax_guide'
        elif any(word in text_lower for word in ['benefit', 'universal credit', 'allowance']):
            doc_type = 'benefit_information'
        elif any(word in text_lower for word in ['debt', 'credit', 'loan', 'borrowing']):
            doc_type = 'debt_advice'
        elif any(word in text_lower for word in ['budget', 'spending', 'saving']):
            doc_type = 'budget_planning'
        elif any(word in text_lower for word in ['insurance', 'policy', 'coverage']):
            doc_type = 'insurance_guide'
        elif any(word in text_lower for word in ['business', 'self-employed', 'entrepreneur']):
            doc_type = 'business_finance'
        elif any(word in text_lower for word in ['student', 'tuition', 'student loan']):
            doc_type = 'student_finance'
        else:
            doc_type = 'other'

        return {
            'document_type': doc_type,
            'main_topic': 'Financial advice/guidance',
            'confidence': 0.5,
            'entities': [],
            'purpose': 'Information and guidance',
            'audience': 'General public'
        }
