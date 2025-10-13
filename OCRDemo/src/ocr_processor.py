import os
import tempfile
import logging
import re
import cv2
import numpy as np
from typing import Dict, List, Optional, Tuple
from datetime import datetime
import pytesseract
from PIL import Image
import pdf2image
import magic
import asyncio
from ollama_analyzer import OllamaDocumentAnalyzer

logger = logging.getLogger(__name__)

class OCRProcessor:
    """Advanced OCR processor for debt advice documents"""
    
    def __init__(self):
        self.tesseract_cmd = os.getenv('TESSERACT_CMD', '/usr/bin/tesseract')
        self.language = os.getenv('OCR_LANGUAGE', 'eng')
        self.dpi = int(os.getenv('OCR_DPI', 300))
        self.confidence_threshold = int(os.getenv('CONFIDENCE_THRESHOLD', 60))

        # Set tesseract command path
        pytesseract.pytesseract.tesseract_cmd = self.tesseract_cmd

        # Initialize Ollama analyzer
        ollama_url = os.getenv('OLLAMA_URL', 'http://localhost:11434')
        self.ollama_analyzer = OllamaDocumentAnalyzer(ollama_url)
        
    def is_available(self) -> bool:
        """Check if OCR system is available"""
        try:
            version = pytesseract.get_tesseract_version()
            logger.info(f"Tesseract version: {version}")
            return True
        except Exception as e:
            logger.error(f"Tesseract not available: {e}")
            return False
    
    def save_temp_file(self, file_data: bytes, filename: str) -> str:
        """Save uploaded file data to temporary file"""
        temp_dir = os.getenv('TEMP_DIR', '/app/temp')
        os.makedirs(temp_dir, exist_ok=True)
        
        # Create temporary file with original extension
        _, ext = os.path.splitext(filename)
        with tempfile.NamedTemporaryFile(delete=False, suffix=ext, dir=temp_dir) as temp_file:
            temp_file.write(file_data)
            temp_path = temp_file.name
        
        logger.info(f"Saved temporary file: {temp_path}")
        return temp_path
    
    def extract_text(self, file_path: str) -> str:
        """Extract text from document using OCR"""
        try:
            # Detect file type
            file_type = magic.from_file(file_path, mime=True)
            logger.info(f"Processing file type: {file_type}")
            
            if file_type == 'application/pdf':
                return self._extract_text_from_pdf(file_path)
            elif file_type.startswith('image/'):
                return self._extract_text_from_image(file_path)
            else:
                logger.warning(f"Unsupported file type: {file_type}")
                return ""
                
        except Exception as e:
            logger.error(f"Error extracting text from {file_path}: {e}")
            return ""
    
    def _extract_text_from_pdf(self, pdf_path: str) -> str:
        """Extract text from PDF using OCR"""
        try:
            # Convert PDF pages to images
            pages = pdf2image.convert_from_path(
                pdf_path, 
                dpi=self.dpi,
                first_page=1,
                last_page=5  # Limit to first 5 pages for performance
            )
            
            all_text = []
            
            for i, page in enumerate(pages):
                logger.info(f"Processing PDF page {i+1}")
                
                # Enhance image for better OCR
                enhanced_page = self._enhance_image_for_ocr(page)
                
                # Extract text with confidence data
                text_data = pytesseract.image_to_data(
                    enhanced_page,
                    lang=self.language,
                    output_type=pytesseract.Output.DICT,
                    config='--psm 6'
                )
                
                # Filter by confidence and combine text
                page_text = self._filter_text_by_confidence(text_data)
                if page_text.strip():
                    all_text.append(f"=== Page {i+1} ===")
                    all_text.append(page_text)
            
            return '\n\n'.join(all_text)
            
        except Exception as e:
            logger.error(f"Error processing PDF: {e}")
            return ""
    
    def _extract_text_from_image(self, image_path: str) -> str:
        """Extract text from image using OCR"""
        try:
            # Load and enhance image
            image = Image.open(image_path)
            enhanced_image = self._enhance_image_for_ocr(image)
            
            # Extract text with confidence data
            text_data = pytesseract.image_to_data(
                enhanced_image,
                lang=self.language,
                output_type=pytesseract.Output.DICT,
                config='--psm 6'
            )
            
            # Filter by confidence and return text
            return self._filter_text_by_confidence(text_data)
            
        except Exception as e:
            logger.error(f"Error processing image: {e}")
            return ""
    
    def _enhance_image_for_ocr(self, image: Image.Image) -> Image.Image:
        """Enhance image quality for better OCR results"""
        try:
            # Convert PIL to OpenCV format
            cv_image = cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)
            
            # Convert to grayscale
            gray = cv2.cvtColor(cv_image, cv2.COLOR_BGR2GRAY)
            
            # Apply denoising
            denoised = cv2.fastNlMeansDenoising(gray)
            
            # Apply adaptive thresholding
            thresh = cv2.adaptiveThreshold(
                denoised, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 11, 2
            )
            
            # Apply morphological operations to clean up
            kernel = np.ones((1, 1), np.uint8)
            opening = cv2.morphologyEx(thresh, cv2.MORPH_OPEN, kernel)
            
            # Convert back to PIL
            enhanced_image = Image.fromarray(opening)
            
            # Resize if image is too small (improve OCR accuracy)
            width, height = enhanced_image.size
            if width < 1000 or height < 1000:
                scale_factor = max(1000 / width, 1000 / height)
                new_width = int(width * scale_factor)
                new_height = int(height * scale_factor)
                enhanced_image = enhanced_image.resize((new_width, new_height), Image.LANCZOS)
            
            return enhanced_image
            
        except Exception as e:
            logger.error(f"Error enhancing image: {e}")
            return image
    
    def _filter_text_by_confidence(self, text_data: Dict) -> str:
        """Filter OCR results by confidence threshold"""
        try:
            filtered_words = []
            
            for i in range(len(text_data['text'])):
                confidence = int(text_data['conf'][i])
                word = text_data['text'][i].strip()
                
                if confidence >= self.confidence_threshold and word:
                    filtered_words.append(word)
            
            return ' '.join(filtered_words)
            
        except Exception as e:
            logger.error(f"Error filtering text by confidence: {e}")
            return ""
    
    async def extract_client_info_with_ai(self, text: str) -> Dict:
        """Extract client information using AI analysis (preferred method)"""
        try:
            # First try AI extraction
            ai_analysis = await self.ollama_analyzer.analyze_document(text)

            if ai_analysis.get('extraction_method') == 'ollama_ai':
                logger.info("Successfully extracted client info using AI")
                return ai_analysis
            else:
                logger.warning("AI extraction failed, falling back to regex")
                return self._extract_client_info_regex(text)

        except Exception as e:
            logger.error(f"Error in AI extraction: {e}")
            return self._extract_client_info_regex(text)

    def extract_client_info(self, text: str) -> Dict:
        """Extract client information from OCR text (synchronous wrapper)"""
        try:
            # Try to run async AI extraction
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            result = loop.run_until_complete(self.extract_client_info_with_ai(text))
            loop.close()
            return result
        except Exception as e:
            logger.error(f"Error running AI extraction: {e}")
            return self._extract_client_info_regex(text)

    def _extract_client_info_regex(self, text: str) -> Dict:
        """Fallback regex-based extraction (legacy method)"""
        try:
            client_info = {
                'file_summary': 'regex extraction',
                'client_name': '',
                'debt_type': 'unknown',
                'debt_amount': 0.0,
                'creditor_name': '',
                'account_reference': '',
                'document_date': '',
                'additional_references': [],
                'document_type': 'unknown',
                'urgency_level': 'normal',
                'extraction_method': 'regex_fallback'
            }

            # Extract name patterns
            name_patterns = [
                r'(?:Dear|Mr|Mrs|Ms|Miss|Dr)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)',
                r'(?:Name|Client):\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)',
                r'^([A-Z][a-z]+\s+[A-Z][a-z]+)',  # First line name pattern
            ]

            for pattern in name_patterns:
                match = re.search(pattern, text, re.MULTILINE | re.IGNORECASE)
                if match:
                    client_info['client_name'] = match.group(1).strip()
                    break

            # Extract amounts
            amount_patterns = [
                r'(?:Balance|Amount|Owe[ds]?|Total):\s*£?([0-9,]+\.?[0-9]*)',
                r'£([0-9,]+\.?[0-9]*)'
            ]

            for pattern in amount_patterns:
                match = re.search(pattern, text, re.IGNORECASE)
                if match:
                    amount_str = match.group(1).replace(',', '')
                    try:
                        client_info['debt_amount'] = float(amount_str)
                        break
                    except ValueError:
                        continue

            # Extract reference numbers
            ref_patterns = [
                r'(?:Ref|Reference|Account|Case)(?:\s*No\.?|\s*Number)?:\s*([A-Z0-9\-\/]{6,})',
                r'\b([A-Z]{2,4}\d{6,})\b',  # Common reference format
                r'\b(\d{8,})\b'  # Long numbers
            ]

            refs = []
            for pattern in ref_patterns:
                matches = re.findall(pattern, text, re.IGNORECASE)
                refs.extend(matches)

            client_info['additional_references'] = list(set(refs))[:3]  # Limit to 3

            # Simple debt type classification
            priority_keywords = ['mortgage', 'rent', 'council tax', 'gas', 'electric', 'court']
            non_priority_keywords = ['credit card', 'loan', 'overdraft', 'catalogue']

            text_lower = text.lower()
            if any(keyword in text_lower for keyword in priority_keywords):
                client_info['debt_type'] = 'priority'
            elif any(keyword in text_lower for keyword in non_priority_keywords):
                client_info['debt_type'] = 'non-priority'

            # Extract creditor name (simple)
            creditor_patterns = [
                r'(?:From|Dear Customer of|Account with)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)',
                r'^([A-Z][A-Z\s]+)(?:LIMITED|LTD|PLC)?'  # Company name pattern
            ]

            for pattern in creditor_patterns:
                match = re.search(pattern, text, re.MULTILINE | re.IGNORECASE)
                if match:
                    client_info['creditor_name'] = match.group(1).strip()
                    break

            logger.info(f"Extracted client info with regex: {client_info}")
            return client_info

        except Exception as e:
            logger.error(f"Error extracting client info with regex: {e}")
            return {
                'extraction_method': 'error',
                'error': str(e)
            }
    
    def extract_case_number_from_text(self, text: str) -> Optional[str]:
        """Look for existing case/RMA numbers in the document"""
        try:
            # Common case number patterns
            case_patterns = [
                r'(?:Case|RMA|Reference)\s*(?:No\.?|Number)?:\s*([A-Z0-9\-\/]{6,})',
                r'\b(RMA\d{6,})\b',
                r'\b(CMA\d{6,})\b',
                r'\b(\d{6,}[A-Z]{2,})\b'
            ]
            
            for pattern in case_patterns:
                match = re.search(pattern, text, re.IGNORECASE)
                if match:
                    case_number = match.group(1)
                    logger.info(f"Found case number in text: {case_number}")
                    return case_number
            
            return None
            
        except Exception as e:
            logger.error(f"Error extracting case number: {e}")
            return None
    
    def extract_document_metadata(self, text: str) -> Dict:
        """Extract document metadata like date, sender, etc."""
        try:
            metadata = {
                'document_date': '',
                'sender': '',
                'document_type': '',
                'urgency': 'normal'
            }
            
            # Extract document date
            date_patterns = [
                r'(?:Date|Dated):\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})',
                r'(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+\d{4})'
            ]
            
            for pattern in date_patterns:
                match = re.search(pattern, text, re.IGNORECASE)
                if match:
                    metadata['document_date'] = match.group(1)
                    break
            
            # Detect document type
            if re.search(r'(?:statement|balance|account)', text, re.IGNORECASE):
                metadata['document_type'] = 'statement'
            elif re.search(r'(?:demand|payment|overdue)', text, re.IGNORECASE):
                metadata['document_type'] = 'demand'
            elif re.search(r'(?:court|judgment|ccj)', text, re.IGNORECASE):
                metadata['document_type'] = 'legal'
            elif re.search(r'(?:correspondence|letter)', text, re.IGNORECASE):
                metadata['document_type'] = 'correspondence'
            
            # Detect urgency
            urgency_keywords = ['urgent', 'immediate', 'final', 'court', 'bailiff', 'enforcement']
            for keyword in urgency_keywords:
                if re.search(rf'\b{keyword}\b', text, re.IGNORECASE):
                    metadata['urgency'] = 'high'
                    break
            
            return metadata
            
        except Exception as e:
            logger.error(f"Error extracting document metadata: {e}")
            return {}
    
    def cleanup_temp_file(self, file_path: str):
        """Clean up temporary file"""
        try:
            if os.path.exists(file_path):
                os.unlink(file_path)
                logger.info(f"Cleaned up temporary file: {file_path}")
        except Exception as e:
            logger.error(f"Error cleaning up temp file {file_path}: {e}")