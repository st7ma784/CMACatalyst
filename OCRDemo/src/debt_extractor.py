import os
import re
import logging
import json
from typing import Dict, List, Optional
from datetime import datetime
import spacy
from dateparser import parse as parse_date

logger = logging.getLogger(__name__)

class DebtExtractor:
    """Advanced debt information extraction from OCR text"""
    
    def __init__(self):
        self.ai_provider = os.getenv('AI_PROVIDER', 'local')
        
        # Load spaCy model for NLP (if available)
        try:
            self.nlp = spacy.load("en_core_web_sm")
            logger.info("Loaded spaCy model for NLP processing")
        except:
            self.nlp = None
            logger.warning("spaCy model not available - using regex-based extraction")
    
    def extract_debts(self, text: str) -> List[Dict]:
        """
        Extract debt information from OCR text
        Returns list of debt dictionaries with structured data
        """
        try:
            logger.info("Starting debt extraction from text")
            
            # Split text into sections/paragraphs for processing
            sections = self._split_text_into_sections(text)
            
            debts = []
            
            for section in sections:
                # Try to extract debt from each section
                debt_info = self._extract_debt_from_section(section)
                if debt_info and debt_info.get('amount'):
                    debts.append(debt_info)
            
            # If no structured debts found, try to extract from full text
            if not debts:
                logger.info("No structured debts found, trying full text extraction")
                debt_info = self._extract_debt_from_section(text)
                if debt_info and debt_info.get('amount'):
                    debts.append(debt_info)
            
            # Clean and validate debts
            validated_debts = []
            for debt in debts:
                validated_debt = self._validate_and_clean_debt(debt)
                if validated_debt:
                    validated_debts.append(validated_debt)
            
            logger.info(f"Extracted {len(validated_debts)} debt records")
            return validated_debts
            
        except Exception as e:
            logger.error(f"Error extracting debts: {e}")
            return []
    
    def _split_text_into_sections(self, text: str) -> List[str]:
        """Split text into logical sections for processing"""
        # Split by common section separators
        separators = [
            r'\n\s*=+\s*\n',  # Line separators
            r'\n\s*-{3,}\s*\n',  # Dash separators
            r'\n\s*Page \d+\s*\n',  # Page breaks
            r'\n\s*\n\s*\n',  # Double line breaks
        ]
        
        sections = [text]
        
        for separator in separators:
            new_sections = []
            for section in sections:
                new_sections.extend(re.split(separator, section, flags=re.IGNORECASE))
            sections = new_sections
        
        # Filter out very short sections
        return [s.strip() for s in sections if len(s.strip()) > 50]
    
    def _extract_debt_from_section(self, text: str) -> Dict:
        """Extract debt information from a text section"""
        try:
            debt_info = {
                'amount': None,
                'creditor_name': '',
                'account_number': '',
                'reference_number': '',
                'date': '',
                'debt_type': '',
                'status': '',
                'is_priority': False,
                'is_ccj': False,
                'is_hmrc': False,
                'is_dwp': False,
                'additional_info': '',
                'confidence': 0.0
            }
            
            # Extract monetary amounts
            amounts = self._extract_amounts(text)
            if amounts:
                debt_info['amount'] = amounts[0]  # Take the first/largest amount
                debt_info['confidence'] += 0.3
            
            # Extract creditor/company names
            creditor = self._extract_creditor_name(text)
            if creditor:
                debt_info['creditor_name'] = creditor
                debt_info['confidence'] += 0.2
            
            # Extract account/reference numbers
            account_numbers = self._extract_account_numbers(text)
            if account_numbers:
                debt_info['account_number'] = account_numbers[0]
                debt_info['reference_number'] = account_numbers[0]
                debt_info['confidence'] += 0.2
            
            # Extract dates
            dates = self._extract_dates(text)
            if dates:
                debt_info['date'] = dates[0]
                debt_info['confidence'] += 0.1
            
            # Determine debt type
            debt_type = self._classify_debt_type(text)
            if debt_type:
                debt_info['debt_type'] = debt_type
                debt_info['confidence'] += 0.1
            
            # Check for priority indicators
            debt_info['is_priority'] = self._is_priority_debt(text)
            if debt_info['is_priority']:
                debt_info['confidence'] += 0.1
            
            # Check for CCJ indicators
            debt_info['is_ccj'] = self._is_ccj_debt(text)
            
            # Check for HMRC/DWP
            debt_info['is_hmrc'] = self._is_hmrc_debt(text)
            debt_info['is_dwp'] = self._is_dwp_debt(text)
            
            # Extract status
            status = self._extract_debt_status(text)
            if status:
                debt_info['status'] = status
            
            # Store additional context
            debt_info['additional_info'] = self._extract_additional_info(text)
            
            return debt_info
            
        except Exception as e:
            logger.error(f"Error extracting debt from section: {e}")
            return {}
    
    def _extract_amounts(self, text: str) -> List[float]:
        """Extract monetary amounts from text"""
        # Comprehensive money patterns
        money_patterns = [
            r'(?:£|GBP|pounds?)\s*([0-9,]+\.?[0-9]*)',  # £123.45
            r'([0-9,]+\.?[0-9]*)\s*(?:£|GBP|pounds?)',  # 123.45£
            r'(?:total|amount|balance|outstanding|owed?)[:s]?\s*(?:£|GBP)?\s*([0-9,]+\.?[0-9]*)',
            r'([0-9,]+\.[0-9]{2})(?!\d)',  # Amounts with exactly 2 decimal places
            r'([0-9]{1,3}(?:,[0-9]{3})+(?:\.[0-9]{2})?)',  # Comma-separated amounts
        ]
        
        amounts = []
        
        for pattern in money_patterns:
            matches = re.findall(pattern, text, re.IGNORECASE)
            for match in matches:
                try:
                    # Clean up the amount string
                    amount_str = match.replace(',', '')
                    amount = float(amount_str)
                    
                    # Filter reasonable amounts (£1 to £1,000,000)
                    if 1.0 <= amount <= 1000000.0:
                        amounts.append(amount)
                        
                except ValueError:
                    continue
        
        # Remove duplicates and sort by value (descending)
        amounts = sorted(list(set(amounts)), reverse=True)
        
        logger.debug(f"Extracted amounts: {amounts}")
        return amounts
    
    def _extract_creditor_name(self, text: str) -> str:
        """Extract creditor/company name from text"""
        # Common creditor patterns
        creditor_patterns = [
            r'(?:from|to|with|owed to)\s+([A-Z][A-Za-z\s&]+(?:Ltd|Limited|PLC|Bank|Building Society|Finance|Credit|Card|Services))',
            r'([A-Z][A-Za-z\s&]+(?:Bank|Building Society|Finance|Credit|Card|Services))',
            r'(?:Dear|From):\s*([A-Z][A-Za-z\s&]+)',
            r'^([A-Z][A-Z\s&]+)$',  # All caps company names
        ]
        
        # Known creditor list
        known_creditors = [
            'HSBC', 'Barclays', 'Lloyds', 'NatWest', 'Santander', 'Halifax', 'TSB',
            'Nationwide', 'First Direct', 'Metro Bank', 'Capital One', 'Vanquis',
            'Aqua', 'NewDay', 'Tesco Bank', 'HMRC', 'HM Revenue', 'DWP',
            'Department for Work', 'Council Tax', 'British Gas', 'E.ON', 'npower',
            'SSE', 'Scottish Power', 'EDF Energy'
        ]
        
        # First, look for known creditors
        for creditor in known_creditors:
            if re.search(rf'\b{re.escape(creditor)}\b', text, re.IGNORECASE):
                return creditor
        
        # Then use patterns
        for pattern in creditor_patterns:
            matches = re.findall(pattern, text, re.MULTILINE)
            for match in matches:
                if len(match.strip()) > 3:  # Minimum length
                    return match.strip()
        
        return ""
    
    def _extract_account_numbers(self, text: str) -> List[str]:
        """Extract account/reference numbers"""
        patterns = [
            r'(?:Account|Ref|Reference|Card)\s*(?:No\.?|Number)?:\s*([A-Z0-9\-\/\s]{6,})',
            r'\b([A-Z]{2,4}\d{6,})\b',  # Letter+number combinations
            r'\b(\d{8,16})\b',  # Long numeric sequences
            r'([A-Z0-9]{8,})',  # General alphanumeric
        ]
        
        numbers = []
        
        for pattern in patterns:
            matches = re.findall(pattern, text, re.IGNORECASE)
            for match in matches:
                # Clean up the number
                clean_number = re.sub(r'\s+', '', match.strip())
                if len(clean_number) >= 6:
                    numbers.append(clean_number)
        
        # Remove duplicates while preserving order
        seen = set()
        unique_numbers = []
        for num in numbers:
            if num not in seen:
                seen.add(num)
                unique_numbers.append(num)
        
        return unique_numbers
    
    def _extract_dates(self, text: str) -> List[str]:
        """Extract dates from text"""
        date_patterns = [
            r'(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})',
            r'(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+\d{4})',
            r'(?:Date|Dated|Due):\s*([^,\n]+)',
        ]
        
        dates = []
        
        for pattern in date_patterns:
            matches = re.findall(pattern, text, re.IGNORECASE)
            for match in matches:
                # Try to parse the date
                try:
                    parsed_date = parse_date(match)
                    if parsed_date:
                        dates.append(parsed_date.strftime('%Y-%m-%d'))
                except:
                    dates.append(match.strip())
        
        return list(set(dates))
    
    def _classify_debt_type(self, text: str) -> str:
        """Classify the type of debt based on text content"""
        debt_types = {
            'Credit Card': ['credit card', 'visa', 'mastercard', 'amex'],
            'Personal Loan': ['personal loan', 'unsecured loan'],
            'Mortgage': ['mortgage', 'home loan', 'property'],
            'Overdraft': ['overdraft', 'od limit'],
            'Council Tax': ['council tax', 'local authority'],
            'Utility Bills': ['gas', 'electric', 'water', 'utility'],
            'HMRC Tax': ['hmrc', 'tax', 'inland revenue', 'hm revenue'],
            'DWP Benefits': ['dwp', 'benefits', 'universal credit', 'jobcentre'],
            'Store Card': ['store card', 'retail card'],
            'Catalog Debt': ['catalog', 'catalogue', 'home shopping'],
            'Payday Loan': ['payday', 'short term loan'],
            'Mobile Phone': ['mobile', 'phone bill', 'vodafone', 'ee', 'o2', 'three'],
        }
        
        text_lower = text.lower()
        
        for debt_type, keywords in debt_types.items():
            for keyword in keywords:
                if keyword in text_lower:
                    return debt_type
        
        return 'Other'
    
    def _is_priority_debt(self, text: str) -> bool:
        """Check if this is a priority debt"""
        priority_indicators = [
            'council tax', 'mortgage', 'rent', 'gas', 'electric', 'water',
            'hmrc', 'tax', 'court', 'magistrates', 'fine', 'maintenance',
            'child support', 'secured loan'
        ]
        
        text_lower = text.lower()
        return any(indicator in text_lower for indicator in priority_indicators)
    
    def _is_ccj_debt(self, text: str) -> bool:
        """Check if this involves a County Court Judgment"""
        ccj_indicators = [
            'ccj', 'county court', 'judgment', 'judgement', 'court order',
            'default judgment', 'money claim'
        ]
        
        text_lower = text.lower()
        return any(indicator in text_lower for indicator in ccj_indicators)
    
    def _is_hmrc_debt(self, text: str) -> bool:
        """Check if this is an HMRC debt"""
        hmrc_indicators = ['hmrc', 'hm revenue', 'inland revenue', 'tax office']
        text_lower = text.lower()
        return any(indicator in text_lower for indicator in hmrc_indicators)
    
    def _is_dwp_debt(self, text: str) -> bool:
        """Check if this is a DWP debt"""
        dwp_indicators = ['dwp', 'department for work', 'benefits', 'jobcentre', 'universal credit']
        text_lower = text.lower()
        return any(indicator in text_lower for indicator in dwp_indicators)
    
    def _extract_debt_status(self, text: str) -> str:
        """Extract debt status from text"""
        status_patterns = {
            'Overdue': ['overdue', 'late', 'missed payment', 'arrears'],
            'In Default': ['default', 'defaulted', 'breach'],
            'Active': ['current', 'active', 'ongoing'],
            'Disputed': ['dispute', 'disputed', 'query'],
            'Settled': ['settled', 'paid', 'closed'],
            'Suspended': ['suspended', 'on hold', 'paused'],
        }
        
        text_lower = text.lower()
        
        for status, keywords in status_patterns.items():
            if any(keyword in text_lower for keyword in keywords):
                return status
        
        return 'Active'  # Default status
    
    def _extract_additional_info(self, text: str) -> str:
        """Extract additional relevant information"""
        # Look for key phrases that might be important
        key_phrases = []
        
        # Payment arrangements
        if re.search(r'payment\s+plan|arrangement|installment', text, re.IGNORECASE):
            key_phrases.append('Payment arrangement mentioned')
        
        # Legal action
        if re.search(r'legal\s+action|court|bailiff|enforcement', text, re.IGNORECASE):
            key_phrases.append('Legal action mentioned')
        
        # Urgency
        if re.search(r'urgent|immediate|final|last', text, re.IGNORECASE):
            key_phrases.append('Urgent action required')
        
        return '; '.join(key_phrases) if key_phrases else ''
    
    def _validate_and_clean_debt(self, debt_info: Dict) -> Optional[Dict]:
        """Validate and clean extracted debt information"""
        try:
            # Must have at least an amount
            if not debt_info.get('amount'):
                return None
            
            # Clean up amount
            amount = debt_info['amount']
            if isinstance(amount, str):
                amount = float(amount.replace(',', '').replace('£', ''))
            
            # Validate amount is reasonable
            if amount <= 0 or amount > 1000000:
                return None
            
            debt_info['amount'] = round(amount, 2)
            
            # Clean up strings
            for field in ['creditor_name', 'account_number', 'debt_type', 'status']:
                if debt_info.get(field):
                    debt_info[field] = str(debt_info[field]).strip()
            
            # Set defaults for missing fields
            if not debt_info.get('debt_type'):
                debt_info['debt_type'] = 'Other'
            
            if not debt_info.get('status'):
                debt_info['status'] = 'Active'
            
            # Ensure confidence is set
            if debt_info.get('confidence', 0) < 0.3:
                logger.warning(f"Low confidence debt extraction: {debt_info.get('confidence', 0)}")
            
            return debt_info
            
        except Exception as e:
            logger.error(f"Error validating debt: {e}")
            return None