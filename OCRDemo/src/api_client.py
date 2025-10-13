import os
import json
import logging
import requests
from typing import Dict, List, Optional, Any
from datetime import datetime
import urllib.parse

logger = logging.getLogger(__name__)

class LegacyAPIClient:
    """API client for integrating with Catalyst CMA system"""
    
    def __init__(self):
        self.base_url = os.getenv('LEGACY_API_BASE_URL', '')
        self.api_key = os.getenv('LEGACY_API_KEY', '')
        self.timeout = int(os.getenv('LEGACY_API_TIMEOUT', 30))
        
        # Skip initialization if no URL provided
        if not self.base_url:
            logger.info("Legacy API disabled - no base URL provided")
            self.enabled = False
            return
        
        self.enabled = True
        
        # Session for maintaining cookies
        self.session = requests.Session()
        
        # Authentication cookies (you'll need to set these)
        self.cookies = {
            'cf_clearance': os.getenv('CF_CLEARANCE_COOKIE', ''),
            'PHPSESSID': os.getenv('PHPSESSID_COOKIE', ''),
            # Add the third cookie name when you identify it
        }
        
        if self.cookies['cf_clearance']:
            self.session.cookies.update(self.cookies)
    
    @property
    def is_authenticated(self) -> bool:
        """Check if the client has authentication credentials"""
        if not getattr(self, 'enabled', True):
            return False
        return bool(self.cookies.get('cf_clearance') or self.api_key)
    
    def is_connected(self) -> bool:
        """Test connection to the legacy API"""
        if not getattr(self, 'enabled', True):
            return False
        
        try:
            # Try to access the main page to test connection
            response = self.session.get(
                f"{self.base_url}/",
                timeout=self.timeout
            )
            return response.status_code == 200
        except Exception as e:
            logger.error(f"Connection test failed: {e}")
            return False
    
    def test_connection(self) -> Dict:
        """More detailed connection test"""
        if not getattr(self, 'enabled', True):
            return {
                'status': 'disabled',
                'message': 'Legacy API disabled'
            }
            
        try:
            response = self.session.get(
                f"{self.base_url}/cases",
                timeout=self.timeout
            )
            
            return {
                'status_code': response.status_code,
                'response_time': response.elapsed.total_seconds(),
                'content_length': len(response.content),
                'authenticated': 'login' not in response.url.lower()
            }
            
        except Exception as e:
            return {'error': str(e)}
    
    def lookup_case_number(self, client_info: Dict[str, Any]) -> Optional[str]:
        """
        Look up case number for a client using search API
        Returns case number if found, None otherwise
        """
        try:
            if not self.is_authenticated:
                logger.error("Not authenticated with API")
                return None

            client_name = client_info.get('name', '').strip()
            if not client_name:
                logger.warning("No client name provided for lookup")
                return None

            # Create search filter for client name
            search_filter = {
                "client_name": {
                    "like": client_name.lower()
                }
            }
            
            # URL encode the filter
            filter_param = urllib.parse.quote(json.dumps(search_filter))
            
            # Make search request to get case list
            url = f"{self.base_url}/cases?perPage=20&filter={filter_param}"
            logger.info(f"Searching for client: {client_name}")
            
            response = self.session.get(url, timeout=self.timeout)
            response.raise_for_status()
            
            # Parse response (assuming JSON response)
            data = response.json()
            
            # Extract cases from response
            cases = data.get('data', []) if isinstance(data, dict) else data
            
            if cases:
                # For each case, we need to get the detailed case information
                # by making a request to the specific case (simulating double-click)
                for case in cases[:3]:  # Check first 3 matches
                    case_id = case.get('id') or case.get('case_id') or case.get('code')
                    
                    if case_id:
                        # Get detailed case information
                        case_details = self.get_case_details(case_id)
                        if case_details:
                            # Extract the actual case number from detailed view
                            case_number = case_details.get('case_number') or case_details.get('reference') or case_details.get('code')
                            if case_number:
                                logger.info(f"Found case number: {case_number} for client: {client_name}")
                                return str(case_number)
                
                logger.warning(f"No valid case number found for client: {client_name}")
                return None
            else:
                logger.info(f"No cases found for client: {client_name}")
                return None
                
        except Exception as e:
            logger.error(f"Error looking up case number: {e}")
            return None
    
    def get_case_details(self, case_id: str) -> Optional[Dict[str, Any]]:
        """
        Get detailed case information by case ID (simulates double-clicking on case)
        """
        try:
            # Make request to get case details
            url = f"{self.base_url}/cases/{case_id}"
            logger.debug(f"Getting case details for ID: {case_id}")
            
            response = self.session.get(url, timeout=self.timeout)
            response.raise_for_status()
            
            case_details = response.json()
            logger.debug(f"Retrieved case details: {case_details}")
            
            return case_details
            
        except Exception as e:
            logger.error(f"Error getting case details for ID {case_id}: {e}")
            return None
    
    def create_case(self, client_info: Dict) -> Dict:
        """
        Create a new case if none exists (if API supports it)
        This might not be available via API - may need manual creation
        """
        try:
            # This would need to be implemented based on the actual API
            # For now, return a placeholder response
            logger.warning("Case creation via API not implemented - manual creation required")
            
            return {
                'case_number': f"PENDING_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
                'status': 'pending_creation',
                'message': 'Case needs to be created manually in the system'
            }
            
        except Exception as e:
            logger.error(f"Error creating case: {e}")
            return {}
    
    def upload_document(self, filename: str, file_path: str, case_number: str) -> Dict:
        """
        Upload document to the case files
        Endpoint: /cases/{case_id}/files
        """
        try:
            # Build upload URL
            url = f"{self.base_url}/cases/{case_number}/files"
            
            # Prepare file for upload
            with open(file_path, 'rb') as file_obj:
                files = {
                    'file': (filename, file_obj, 'application/pdf')
                }
                
                # Additional form data that might be required
                data = {
                    'document_type': 'correspondence',  # or other appropriate type
                    'description': f'Auto-uploaded from OCR: {filename}'
                }
                
                logger.info(f"Uploading document {filename} to case {case_number}")
                
                response = self.session.post(
                    url, 
                    files=files, 
                    data=data,
                    timeout=self.timeout
                )
                
                if response.status_code in [200, 201]:
                    logger.info(f"Successfully uploaded {filename}")
                    return {
                        'success': True,
                        'document_id': response.json().get('id') if response.content else None,
                        'message': 'Document uploaded successfully'
                    }
                else:
                    logger.error(f"Upload failed: {response.status_code} - {response.text}")
                    return {
                        'success': False,
                        'error': f"HTTP {response.status_code}: {response.text}"
                    }
                    
        except Exception as e:
            logger.error(f"Error uploading document: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def create_debt_record(self, case_number: str, debt_info: Dict) -> Dict:
        """
        Create a debt record in the system
        Endpoint: /cases/{case_id}/money/debts/add
        Based on the form fields from innerHTML.html
        """
        try:
            url = f"{self.base_url}/cases/{case_number}/money/debts/add"
            
            # Map extracted debt info to form fields
            form_data = self._map_debt_info_to_form(debt_info)
            
            logger.info(f"Creating debt record for case {case_number}: {debt_info.get('creditor_name', 'Unknown')}")
            
            response = self.session.post(
                url,
                data=form_data,
                timeout=self.timeout
            )
            
            if response.status_code in [200, 201, 302]:  # 302 might be redirect after success
                logger.info(f"Successfully created debt record")
                return {
                    'success': True,
                    'debt_id': self._extract_debt_id_from_response(response),
                    'message': 'Debt record created successfully'
                }
            else:
                logger.error(f"Debt creation failed: {response.status_code} - {response.text}")
                return {
                    'success': False,
                    'error': f"HTTP {response.status_code}: {response.text}"
                }
                
        except Exception as e:
            logger.error(f"Error creating debt record: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def _map_debt_info_to_form(self, debt_info: Dict) -> Dict:
        """
        Map extracted debt information to form fields
        Based on the form structure from innerHTML.html
        """
        try:
            # Default form values
            form_data = {
                # Required fields
                'debt.amount__currency': debt_info.get('amount', '0.00'),
                'debt.latest_account_number': debt_info.get('account_number', debt_info.get('reference_number', '')),
                
                # Optional fields
                'debt.original_account_number': debt_info.get('original_account_number', ''),
                'debt.offer__currency': '0.00',
                'debt.offer_frequency': 'MONTHLY',
                'debt.additional_info': debt_info.get('additional_info', 'Auto-extracted from OCR'),
                
                # Checkboxes (boolean fields)
                'debt.is_priority': debt_info.get('is_priority', False),
                'debt.is_judgement': debt_info.get('is_ccj', False),
                'debt.is_pro_rata': False,
                'debt.show_on_sfs': True,
                'debt.excluded': False,
                'debt.secured': False,
                'debt.is_hmrc_debt': debt_info.get('is_hmrc', False),
                'debt.is_dwp_debt': debt_info.get('is_dwp', False),
                
                # AEO fields (if applicable)
                'debt.aeo_court_name': '',
                'debt.aeo_court_address': '',
                'debt.aeo_court_postcode': '',
                'debt.aeo_court_reference': '',
            }
            
            # Map creditor name (this might need to be looked up in a dropdown)
            creditor_name = debt_info.get('creditor_name', debt_info.get('to_whom', ''))
            if creditor_name:
                form_data['creditor_name'] = creditor_name
            
            # Map debt category (this might need to be looked up in a dropdown)
            debt_type = debt_info.get('debt_type', 'Credit Card')  # Default assumption
            form_data['debt_category'] = debt_type
            
            # Map debt status
            form_data['debt_status'] = debt_info.get('status', 'Active')
            
            # Map liability
            form_data['debt.liability'] = debt_info.get('liability', 'Client')
            
            # Map enforcement
            form_data['debt.enforcement'] = debt_info.get('enforcement', 'None')
            
            return form_data
            
        except Exception as e:
            logger.error(f"Error mapping debt info to form: {e}")
            return {}
    
    def _extract_debt_id_from_response(self, response) -> Optional[str]:
        """Extract debt ID from response (if available)"""
        try:
            # This would need to be implemented based on the actual response format
            # Could be in JSON response, headers, or URL redirect
            if response.headers.get('location'):
                # Extract from redirect URL
                import re
                match = re.search(r'/debts/(\d+)', response.headers['location'])
                if match:
                    return match.group(1)
            
            return None
            
        except Exception as e:
            logger.error(f"Error extracting debt ID: {e}")
            return None
    
    def get_creditor_list(self) -> List[str]:
        """Get list of available creditors (if API provides this)"""
        try:
            # This would fetch creditor options from the system
            # For now, return common creditors as fallback
            return [
                'HSBC', 'Barclays', 'Lloyds', 'NatWest', 'Santander',
                'Halifax', 'TSB', 'Nationwide', 'First Direct', 'Metro Bank',
                'Capital One', 'Vanquis', 'Aqua', 'NewDay', 'Tesco Bank',
                'HMRC', 'DWP', 'Council Tax', 'Utility Company'
            ]
            
        except Exception as e:
            logger.error(f"Error getting creditor list: {e}")
            return []
    
    def get_debt_categories(self) -> List[str]:
        """Get list of available debt categories"""
        try:
            # Based on common debt advice categories
            return [
                'Credit Card', 'Personal Loan', 'Overdraft', 'Store Card',
                'Mortgage', 'Secured Loan', 'Council Tax', 'Rent',
                'Utility Bills', 'HMRC Tax', 'DWP Benefits', 'Court Fine',
                'Child Maintenance', 'Student Loan', 'Hire Purchase',
                'Payday Loan', 'Catalog Debt', 'Mobile Phone', 'Other'
            ]
            
        except Exception as e:
            logger.error(f"Error getting debt categories: {e}")
            return []
    
    def update_session_cookies(self, new_cookies: Dict):
        """Update session cookies for authentication"""
        try:
            self.session.cookies.update(new_cookies)
            logger.info("Session cookies updated")
        except Exception as e:
            logger.error(f"Error updating cookies: {e}")