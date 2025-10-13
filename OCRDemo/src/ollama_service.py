"""
Ollama LLM Service Integration
Provides intelligent document analysis and debt information extraction using local LLM
"""

import os
import logging
import ollama
from typing import Dict, List, Optional, Any
from datetime import datetime
import json
import re

logger = logging.getLogger(__name__)

class OllamaService:
    def __init__(self):
        self.base_url = os.getenv('OLLAMA_BASE_URL', 'http://localhost:11434')
        self.client = ollama.Client(host=self.base_url)
        self.model = os.getenv('OLLAMA_MODEL', 'llama2:7b')
        self.available = False
        self._check_availability()
    
    def _check_availability(self):
        """Check if Ollama service is available and model is loaded"""
        try:
            # Test connection
            models = self.client.list()
            self.available = True
            
            # Check if our preferred model is available
            model_names = [model['name'] for model in models.get('models', [])]
            if self.model not in model_names:
                logger.warning(f"Model {self.model} not found. Available models: {model_names}")
                # Try to pull the model
                try:
                    logger.info(f"Pulling model {self.model}...")
                    self.client.pull(self.model)
                    logger.info(f"Model {self.model} pulled successfully")
                except Exception as e:
                    logger.error(f"Failed to pull model {self.model}: {e}")
                    # Fallback to available model
                    if model_names:
                        self.model = model_names[0]
                        logger.info(f"Using fallback model: {self.model}")
            
            logger.info(f"Ollama service available with model: {self.model}")
            
        except Exception as e:
            logger.error(f"Ollama service not available: {e}")
            self.available = False
    
    def is_available(self) -> bool:
        """Check if Ollama service is available"""
        return self.available
    
    def extract_client_info(self, ocr_text: str) -> Dict[str, Any]:
        """Extract client information from OCR text using LLM"""
        if not self.available:
            return self._fallback_client_extraction(ocr_text)
        
        try:
            prompt = f"""
            Extract client information from this document text. Return ONLY a JSON object with these fields:
            - name: Full client name
            - address: Full address if found
            - phone: Phone number if found
            - email: Email address if found
            - reference: Any reference numbers found
            
            Document text:
            {ocr_text[:2000]}
            
            JSON response:
            """
            
            response = self.client.generate(
                model=self.model,
                prompt=prompt,
                options={
                    'temperature': 0.1,  # Low temperature for factual extraction
                    'top_p': 0.9,
                    'num_predict': 200
                }
            )
            
            # Extract JSON from response
            response_text = response['response']
            json_match = re.search(r'\{.*\}', response_text, re.DOTALL)
            
            if json_match:
                client_info = json.loads(json_match.group())
                logger.info(f"LLM extracted client info: {client_info}")
                return client_info
            else:
                logger.warning("No valid JSON found in LLM response")
                return self._fallback_client_extraction(ocr_text)
                
        except Exception as e:
            logger.error(f"Error extracting client info with LLM: {e}")
            return self._fallback_client_extraction(ocr_text)
    
    def enhance_debt_extraction(self, ocr_text: str, basic_debts: List[Dict]) -> List[Dict]:
        """Enhance debt extraction using LLM analysis"""
        if not self.available or not basic_debts:
            return basic_debts
        
        try:
            prompt = f"""
            Analyze this financial document and enhance the debt information. 
            
            Current extracted debts: {json.dumps(basic_debts, indent=2)}
            
            Document text:
            {ocr_text[:1500]}
            
            Please enhance each debt entry with:
            - More accurate creditor names (clean up OCR errors)
            - Debt categories (priority/non-priority)
            - Payment status (current, arrears, defaulted)
            - Account types (credit card, loan, utility, etc.)
            
            Return enhanced debt list as JSON:
            """
            
            response = self.client.generate(
                model=self.model,
                prompt=prompt,
                options={
                    'temperature': 0.2,
                    'top_p': 0.9,
                    'num_predict': 500
                }
            )
            
            # Extract JSON from response
            response_text = response['response']
            json_match = re.search(r'\[.*\]', response_text, re.DOTALL)
            
            if json_match:
                enhanced_debts = json.loads(json_match.group())
                logger.info(f"LLM enhanced {len(enhanced_debts)} debt entries")
                return enhanced_debts
            else:
                logger.warning("No valid JSON array found in LLM response")
                return basic_debts
                
        except Exception as e:
            logger.error(f"Error enhancing debts with LLM: {e}")
            return basic_debts
    
    def classify_document_type(self, ocr_text: str) -> Dict[str, Any]:
        """Classify the type of financial document using LLM"""
        if not self.available:
            return {'type': 'unknown', 'confidence': 0.0}
        
        try:
            prompt = f"""
            Classify this financial document. What type of document is this?
            
            Options:
            - bank_statement
            - credit_card_statement  
            - loan_statement
            - utility_bill
            - court_document
            - debt_collection_letter
            - benefit_statement
            - other
            
            Document text (first 1000 characters):
            {ocr_text[:1000]}
            
            Respond with JSON: {{"type": "document_type", "confidence": 0.95, "reasoning": "brief explanation"}}
            """
            
            response = self.client.generate(
                model=self.model,
                prompt=prompt,
                options={
                    'temperature': 0.1,
                    'top_p': 0.9,
                    'num_predict': 150
                }
            )
            
            # Extract JSON from response
            response_text = response['response']
            json_match = re.search(r'\{.*\}', response_text, re.DOTALL)
            
            if json_match:
                classification = json.loads(json_match.group())
                return classification
            else:
                return {'type': 'unknown', 'confidence': 0.0}
                
        except Exception as e:
            logger.error(f"Error classifying document with LLM: {e}")
            return {'type': 'unknown', 'confidence': 0.0}
    
    def _fallback_client_extraction(self, ocr_text: str) -> Dict[str, Any]:
        """Fallback client extraction using regex patterns"""
        client_info = {
            'name': None,
            'address': None,
            'phone': None,
            'email': None,
            'reference': None
        }
        
        # Name extraction patterns
        name_patterns = [
            r'(?:Dear|Mr|Mrs|Ms|Miss)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)',
            r'Account\s+holder:\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)',
            r'Name:\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)'
        ]
        
        for pattern in name_patterns:
            match = re.search(pattern, ocr_text, re.IGNORECASE)
            if match:
                client_info['name'] = match.group(1).strip()
                break
        
        # Email extraction
        email_match = re.search(r'([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})', ocr_text)
        if email_match:
            client_info['email'] = email_match.group(1)
        
        # Phone extraction
        phone_match = re.search(r'(\+?44\s*\d{3,4}\s*\d{3}\s*\d{3,4}|\d{5}\s*\d{6})', ocr_text)
        if phone_match:
            client_info['phone'] = phone_match.group(1)
        
        # Reference number extraction
        ref_patterns = [
            r'(?:Ref|Reference|Account):\s*([A-Z0-9]+)',
            r'Account\s+Number:\s*([A-Z0-9]+)'
        ]
        
        for pattern in ref_patterns:
            match = re.search(pattern, ocr_text, re.IGNORECASE)
            if match:
                client_info['reference'] = match.group(1)
                break
        
        return client_info
    
    def test_connection(self) -> Dict[str, Any]:
        """Test connection to Ollama service"""
        try:
            models = self.client.list()
            return {
                'status': 'connected',
                'available_models': [model['name'] for model in models.get('models', [])],
                'current_model': self.model,
                'base_url': self.base_url
            }
        except Exception as e:
            return {
                'status': 'error',
                'error': str(e),
                'base_url': self.base_url
            }
    
    def generate_document_filename(self, extracted_text: str, original_filename: str, client_info: Dict, 
                                 processing_timestamp: Optional[datetime] = None) -> str:
        """
        Generate an intelligent filename based on document content using Ollama
        Format: date_initials_description.pdf with monetary validation
        
        Args:
            extracted_text: The OCR text from the document
            original_filename: Original filename of the document
            client_info: Dictionary containing client information
            processing_timestamp: When the document was processed
            
        Returns:
            Suggested filename based on content analysis with format: date_initials_description.pdf
        """
        if not self.available:
            logger.warning("Ollama not available, using fallback filename generation")
            return self._generate_fallback_filename(original_filename, client_info, processing_timestamp)
        
        try:
            # Use provided timestamp or current time
            timestamp = processing_timestamp or datetime.now()
            date_str = timestamp.strftime('%Y%m%d')
            
            # Extract and validate monetary amounts
            monetary_info = self._extract_and_validate_monetary_amounts(extracted_text)
            
            # Prepare context for analysis
            client_name = client_info.get('name', 'Unknown')
            case_number = client_info.get('case_number', '')
            
            # Create client initials
            client_initials = self._generate_client_initials(client_name)
            
            # Create a focused prompt for filename generation
            prompt = f"""
Analyze this debt/financial document and suggest a descriptive filename component.

Client: {client_name}
Case: {case_number}
Monetary amounts found: {monetary_info['summary']}
Document text preview: {extracted_text[:800]}

Generate ONLY the description part for a filename with format: {date_str}_{client_initials}_[YOUR_DESCRIPTION].pdf

Requirements for the description:
- Describe what the document is (e.g., DebtNotice, CreditStatement, Invoice, ParkingFine, UtilityBill)
- Include main amount if significant (e.g., DebtNotice_£1234, Invoice_£567)
- Keep description under 40 characters
- Use CamelCase or underscores, no spaces
- Be specific and professional

Examples of description parts:
- DebtNotice_£1234
- CreditCard_Statement
- ParkingFine_£60
- UtilityBill_Overdue
- CourtClaim_£2500

Only respond with the description part, no date or initials.
"""

            response = self.client.generate(
                model=self.model,
                prompt=prompt,
                options={'temperature': 0.1, 'top_p': 0.1}  # Low temperature for consistent output
            )
            
            description = response['response'].strip()
            
            # Clean and validate the description
            cleaned_description = self._clean_filename_component(description)
            
            # Construct final filename
            file_ext = os.path.splitext(original_filename)[1].lower()
            final_filename = f"{date_str}_{client_initials}_{cleaned_description}{file_ext}"
            
            # Validate final filename length
            if len(final_filename) > 120:
                final_filename = f"{date_str}_{client_initials}_Document{file_ext}"
                
            logger.info(f"Generated structured filename: {final_filename}")
            logger.info(f"Monetary validation: {monetary_info['validation_status']}")
            
            return final_filename
            
        except Exception as e:
            logger.error(f"Error generating filename with Ollama: {e}")
            return self._generate_fallback_filename(original_filename, client_info, processing_timestamp)
    
    def _generate_fallback_filename(self, original_filename: str, client_info: Dict, 
                                  processing_timestamp: Optional[datetime] = None) -> str:
        """Generate a basic filename when Ollama is not available"""
        
        timestamp = processing_timestamp or datetime.now()
        date_str = timestamp.strftime('%Y%m%d')
        
        client_name = client_info.get('name', 'Unknown')
        client_initials = self._generate_client_initials(client_name)
        
        base_name = os.path.splitext(original_filename)[0]
        base_name = self._clean_filename_component(base_name)
        file_ext = os.path.splitext(original_filename)[1]
        
        return f"{date_str}_{client_initials}_{base_name}{file_ext}"
    
    def _generate_client_initials(self, client_name: str) -> str:
        """Generate client initials from full name"""
        if not client_name or client_name == 'Unknown':
            return 'UNK'
            
        # Clean the name and split into parts
        cleaned_name = re.sub(r'[^\w\s]', '', client_name).strip()
        name_parts = cleaned_name.split()
        
        if len(name_parts) == 1:
            # Single name - take first 3 characters
            return name_parts[0][:3].upper()
        elif len(name_parts) == 2:
            # First and last name - take first letter of each
            return f"{name_parts[0][0]}{name_parts[1][0]}".upper()
        else:
            # Multiple names - take first letter of first and last
            return f"{name_parts[0][0]}{name_parts[-1][0]}".upper()
    
    def _extract_and_validate_monetary_amounts(self, text: str) -> Dict[str, Any]:
        """Extract and validate monetary amounts from text"""
        
        # Pattern to match various currency formats
        currency_patterns = [
            r'£\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)',  # £1,234.56
            r'(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)\s*pounds?',  # 1,234.56 pounds
            r'(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)\s*pence',  # 123 pence
            r'(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)\s*p\b',  # 123p
            r'\$\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)',  # $1,234.56
        ]
        
        amounts = []
        for pattern in currency_patterns:
            matches = re.finditer(pattern, text, re.IGNORECASE)
            for match in matches:
                amount_str = match.group(1) if match.groups() else match.group(0)
                try:
                    # Clean and convert to float
                    cleaned_amount = amount_str.replace(',', '').replace('£', '').replace('$', '')
                    amount = float(cleaned_amount)
                    amounts.append({
                        'amount': amount,
                        'original_text': match.group(0),
                        'position': match.span()
                    })
                except ValueError:
                    continue
        
        # Validation logic
        validation_status = "VALID"
        issues = []
        
        for amount_info in amounts:
            amount = amount_info['amount']
            
            # Check for unrealistic amounts
            if amount > 1000000:  # Over £1M
                issues.append(f"Unusually high amount: £{amount:,.2f}")
                validation_status = "WARNING"
            elif amount < 0.01:  # Less than 1p
                issues.append(f"Unusually low amount: £{amount:.4f}")
                validation_status = "WARNING"
            
            # Check for likely OCR errors (e.g., 1O instead of 10)
            original = amount_info['original_text']
            if 'O' in original or 'l' in original.replace('£', ''):
                issues.append(f"Possible OCR error in: {original}")
                validation_status = "WARNING"
        
        # Prepare summary
        if amounts:
            max_amount = max(amounts, key=lambda x: x['amount'])
            summary = f"£{max_amount['amount']:,.2f}"
            if len(amounts) > 1:
                summary += f" (and {len(amounts)-1} other amounts)"
        else:
            summary = "No monetary amounts found"
        
        return {
            'amounts': amounts,
            'summary': summary,
            'validation_status': validation_status,
            'issues': issues,
            'count': len(amounts)
        }
    
    def _clean_filename_component(self, component: str) -> str:
        """Clean filename component to be filesystem safe"""
        # Remove invalid characters
        cleaned = re.sub(r'[<>:"/\\|?*]', '', component)
        # Replace spaces with underscores
        cleaned = re.sub(r'\s+', '_', cleaned)
        # Remove multiple underscores
        cleaned = re.sub(r'_+', '_', cleaned)
        # Remove leading/trailing underscores
        cleaned = cleaned.strip('_')
        # Limit length
        if len(cleaned) > 40:
            cleaned = cleaned[:40]
        return cleaned or 'Document'
    
    def generate_rma_download_filename(self, extracted_text: str, original_filename: str, 
                                     client_info: Dict, processing_timestamp: Optional[datetime] = None) -> str:
        """
        Generate RMA-specific download filename
        Format: date_RMA_clientinitials_documentsummary.pdf
        
        Args:
            extracted_text: The OCR text from the document
            original_filename: Original filename of the document
            client_info: Dictionary containing client information
            processing_timestamp: When the document was processed
            
        Returns:
            RMA download filename in format: date_RMA_clientinitials_documentsummary.pdf
        """
        try:
            # Use provided timestamp or current time
            timestamp = processing_timestamp or datetime.now()
            date_str = timestamp.strftime('%Y%m%d')
            
            # Generate client initials
            client_initials = self._generate_client_initials(client_info.get('name', 'Unknown'))
            
            # Generate 2-word document summary using Ollama
            doc_summary = self._generate_document_summary(extracted_text)
            
            # Get file extension
            file_ext = os.path.splitext(original_filename)[1].lower()
            
            # Construct RMA filename: date_RMA_clientinitials_documentsummary.pdf
            rma_filename = f"{date_str}_RMA_{client_initials}_{doc_summary}{file_ext}"
            
            # Clean and validate
            rma_filename = self._clean_filename_component(rma_filename.replace(file_ext, '')) + file_ext
            
            logger.info(f"Generated RMA download filename: {rma_filename}")
            return rma_filename
            
        except Exception as e:
            logger.error(f"Error generating RMA download filename: {e}")
            # Fallback to simple format
            timestamp = processing_timestamp or datetime.now()
            date_str = timestamp.strftime('%Y%m%d')
            client_initials = self._generate_client_initials(client_info.get('name', 'Unknown'))
            file_ext = os.path.splitext(original_filename)[1].lower()
            return f"{date_str}_RMA_{client_initials}_Document{file_ext}"
    
    def _generate_document_summary(self, extracted_text: str) -> str:
        """
        Generate a 2-word summary of the document using Ollama
        
        Args:
            extracted_text: The OCR text from the document
            
        Returns:
            2-word summary of the document
        """
        if not self.available:
            return "Debt_Notice"  # Default fallback
        
        try:
            prompt = f"""
Analyze this financial/debt document and create a 2-word summary that describes what it is.

Document text: {extracted_text[:1000]}

Create ONLY a 2-word description using this format:
- Use underscores between words (no spaces)
- Be specific and professional
- Focus on document type and purpose
- Keep it under 20 characters total

Examples of good 2-word summaries:
- Debt_Notice
- Credit_Statement  
- Parking_Fine
- Utility_Bill
- Court_Claim
- Payment_Demand
- Account_Summary
- Collection_Letter

Respond with ONLY the 2-word summary, nothing else.
"""

            response = self.client.generate(
                model=self.model,
                prompt=prompt,
                options={'temperature': 0.1, 'top_p': 0.1}
            )
            
            summary = response['response'].strip()
            
            # Clean and validate the summary
            cleaned_summary = self._clean_filename_component(summary)
            
            # Ensure it's maximum 2 words
            words = cleaned_summary.split('_')
            if len(words) > 2:
                cleaned_summary = '_'.join(words[:2])
            elif len(words) == 1:
                # If only one word, try to make it more descriptive
                cleaned_summary = f"{words[0]}_Doc"
            
            # Ensure it's not empty
            if not cleaned_summary or cleaned_summary == '_':
                cleaned_summary = "Debt_Notice"
                
            return cleaned_summary
            
        except Exception as e:
            logger.error(f"Error generating document summary: {e}")
            return "Debt_Notice"  # Fallback