import os
import tempfile
import logging
import json
import re
from typing import Dict, List, Optional
from datetime import datetime
import magic
import ollama

logger = logging.getLogger(__name__)

class LlamaParseProcessor:
    """Process PDFs using LlamaParse with local Llama model to extract markdown and structured JSON"""

    def __init__(self):
        self.ollama_url = os.getenv('OLLAMA_URL', 'http://localhost:11434')
        self.model_name = os.getenv('OLLAMA_MODEL', 'llama3.2')
        self.temp_dir = os.getenv('TEMP_DIR', '/app/temp')
        os.makedirs(self.temp_dir, exist_ok=True)

        # Initialize ollama client
        self.client = ollama.Client(host=self.ollama_url)

    def is_available(self) -> bool:
        """Check if Llama model is available"""
        try:
            response = self.client.list()
            models = [model['name'] for model in response.get('models', [])]
            available = any(self.model_name in model for model in models)
            if available:
                logger.info(f"Llama model {self.model_name} is available")
            else:
                logger.warning(f"Llama model {self.model_name} not found. Available models: {models}")
            return available
        except Exception as e:
            logger.error(f"Error checking Llama availability: {e}")
            return False

    def save_temp_file(self, file_data: bytes, filename: str) -> str:
        """Save uploaded file data to temporary file"""
        os.makedirs(self.temp_dir, exist_ok=True)

        # Create temporary file with original extension
        _, ext = os.path.splitext(filename)
        with tempfile.NamedTemporaryFile(delete=False, suffix=ext, dir=self.temp_dir) as temp_file:
            temp_file.write(file_data)
            temp_path = temp_file.name

        logger.info(f"Saved temporary file: {temp_path}")
        return temp_path

    def extract_text_and_parse(self, file_path: str) -> Dict:
        """
        Extract text from document and convert to markdown, then parse to structured JSON

        Returns:
            Dict containing:
                - markdown: The markdown representation of the document
                - json_data: Structured data extracted from the document
                - success: Boolean indicating success/failure
                - error: Error message if failed
        """
        try:
            # Detect file type
            file_type = magic.from_file(file_path, mime=True)
            logger.info(f"Processing file type: {file_type}")

            if file_type == 'application/pdf':
                return self._process_pdf(file_path)
            elif file_type.startswith('image/'):
                return self._process_image(file_path)
            else:
                logger.warning(f"Unsupported file type: {file_type}")
                return {
                    'success': False,
                    'error': f'Unsupported file type: {file_type}',
                    'markdown': '',
                    'json_data': {}
                }

        except Exception as e:
            logger.error(f"Error extracting text from {file_path}: {e}")
            return {
                'success': False,
                'error': str(e),
                'markdown': '',
                'json_data': {}
            }

    def _process_pdf(self, pdf_path: str) -> Dict:
        """Process PDF using Llama model to extract markdown and structured data"""
        try:
            # Use pdf2image to convert PDF to images for processing
            from pdf2image import convert_from_path

            # Convert first 5 pages of PDF to images
            pages = convert_from_path(
                pdf_path,
                dpi=150,  # Lower DPI for faster processing
                first_page=1,
                last_page=5
            )

            logger.info(f"Processing {len(pages)} pages from PDF")

            # Process each page and combine
            all_markdown = []

            for i, page in enumerate(pages):
                logger.info(f"Processing page {i+1}")

                # Save page as temporary image
                temp_image_path = os.path.join(self.temp_dir, f"temp_page_{i}.png")
                page.save(temp_image_path, 'PNG')

                try:
                    # Extract text from image using Llama vision if available
                    page_markdown = self._extract_markdown_from_image(temp_image_path)
                    if page_markdown:
                        all_markdown.append(f"## Page {i+1}\n\n{page_markdown}")
                finally:
                    # Clean up temporary image
                    if os.path.exists(temp_image_path):
                        os.unlink(temp_image_path)

            # Combine all markdown
            combined_markdown = "\n\n".join(all_markdown)

            # Extract structured JSON from markdown
            json_data = self._extract_structured_data(combined_markdown, pdf_path)

            return {
                'success': True,
                'markdown': combined_markdown,
                'json_data': json_data,
                'error': None
            }

        except Exception as e:
            logger.error(f"Error processing PDF: {e}")
            return {
                'success': False,
                'error': str(e),
                'markdown': '',
                'json_data': {}
            }

    def _process_image(self, image_path: str) -> Dict:
        """Process image using Llama model to extract markdown and structured data"""
        try:
            # Extract markdown from image
            markdown = self._extract_markdown_from_image(image_path)

            # Extract structured JSON from markdown
            json_data = self._extract_structured_data(markdown, image_path)

            return {
                'success': True,
                'markdown': markdown,
                'json_data': json_data,
                'error': None
            }

        except Exception as e:
            logger.error(f"Error processing image: {e}")
            return {
                'success': False,
                'error': str(e),
                'markdown': '',
                'json_data': {}
            }

    def _extract_markdown_from_image(self, image_path: str) -> str:
        """Use Llama vision model to extract text and convert to markdown"""
        try:
            # Read image as base64
            with open(image_path, 'rb') as f:
                image_data = f.read()

            # Use Llama to analyze the image and convert to markdown
            prompt = """Analyze this document image and convert it to well-formatted markdown.

Extract all visible text, maintaining the document structure.
Use markdown formatting:
- Headers for titles and section headings
- Lists for itemized content
- Tables for tabular data
- Bold/italic for emphasis
- Preserve numerical values exactly as shown

Focus on accuracy and completeness."""

            response = self.client.generate(
                model=self.model_name,
                prompt=prompt,
                images=[image_data],
                stream=False
            )

            markdown = response.get('response', '').strip()
            logger.info(f"Extracted {len(markdown)} characters of markdown from image")

            return markdown

        except Exception as e:
            logger.error(f"Error extracting markdown from image: {e}")
            return ""

    def _extract_structured_data(self, markdown_text: str, file_path: str) -> Dict:
        """
        Extract structured JSON data from markdown text

        Returns JSON with:
            - document_uri: URI to original document
            - document_date: Date of the document
            - client_name: Client name
            - reference_numbers: Nested dictionary of reference numbers
            - contact_info: Contact numbers and emails
            - financial_values: Financial values found
            - summary: Summary of other important information
        """
        try:
            # Create extraction prompt for Llama
            prompt = f"""Analyze this document markdown and extract key information as JSON.

Document Content:
{markdown_text[:4000]}  # Limit to prevent token overflow

Extract and return ONLY a valid JSON object with these exact fields:
{{
    "document_date": "YYYY-MM-DD or date string found in document",
    "client_name": "full name of the client/recipient",
    "reference_numbers": {{
        "account_number": "account number if found",
        "case_number": "case/reference number if found",
        "invoice_number": "invoice number if found",
        "other_references": ["any other reference numbers"]
    }},
    "contact_info": {{
        "phone_numbers": ["list of phone numbers"],
        "email_addresses": ["list of email addresses"]
    }},
    "financial_values": {{
        "total_amount": "total amount owed or main financial value",
        "currency": "GBP or other currency",
        "breakdown": [
            {{"description": "item description", "amount": "value"}}
        ]
    }},
    "creditor_name": "name of creditor/sender if identified",
    "document_type": "type of document (e.g., statement, demand, notice)",
    "summary": "brief summary of the document's purpose and key points"
}}

Return ONLY valid JSON, no additional text or explanation."""

            response = self.client.generate(
                model=self.model_name,
                prompt=prompt,
                stream=False,
                options={
                    'temperature': 0.1,  # Low temperature for consistent extraction
                    'num_predict': 1000
                }
            )

            response_text = response.get('response', '').strip()

            # Try to parse JSON from response
            json_data = self._parse_json_response(response_text)

            # Add document URI
            json_data['document_uri'] = file_path

            # Add processing metadata
            json_data['extraction_timestamp'] = datetime.now().isoformat()
            json_data['extraction_method'] = 'llamaparse'

            logger.info("Successfully extracted structured data from markdown")

            return json_data

        except Exception as e:
            logger.error(f"Error extracting structured data: {e}")
            return {
                'document_uri': file_path,
                'extraction_error': str(e),
                'extraction_method': 'llamaparse',
                'extraction_timestamp': datetime.now().isoformat()
            }

    def _parse_json_response(self, response_text: str) -> Dict:
        """Parse JSON from Llama response, handling various formats"""
        try:
            # Try direct JSON parse
            return json.loads(response_text)
        except json.JSONDecodeError:
            # Try to extract JSON from markdown code blocks
            json_match = re.search(r'```(?:json)?\s*(\{.*?\})\s*```', response_text, re.DOTALL)
            if json_match:
                try:
                    return json.loads(json_match.group(1))
                except json.JSONDecodeError:
                    pass

            # Try to find JSON object in text
            json_match = re.search(r'\{.*\}', response_text, re.DOTALL)
            if json_match:
                try:
                    return json.loads(json_match.group(0))
                except json.JSONDecodeError:
                    pass

            # Fallback: create basic structure
            logger.warning("Could not parse JSON from Llama response, using fallback")
            return {
                'document_date': 'unknown',
                'client_name': 'unknown',
                'reference_numbers': {},
                'contact_info': {'phone_numbers': [], 'email_addresses': []},
                'financial_values': {},
                'summary': response_text[:500],
                'parse_warning': 'Could not extract structured JSON'
            }

    def cleanup_temp_file(self, file_path: str):
        """Clean up temporary file"""
        try:
            if os.path.exists(file_path):
                os.unlink(file_path)
                logger.info(f"Cleaned up temporary file: {file_path}")
        except Exception as e:
            logger.error(f"Error cleaning up temp file {file_path}: {e}")
