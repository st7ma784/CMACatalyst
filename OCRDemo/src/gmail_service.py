import os
import base64
import json
import logging
from typing import List, Dict, Optional
from datetime import datetime, timedelta
import pickle

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

logger = logging.getLogger(__name__)

class GmailService:
    """Gmail API service for monitoring +RMA emails and extractments"""
    
    SCOPES = [
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/gmail.modify'
    ]
    
    def __init__(self):
        self.service = None
        self.credentials = None
        self.processed_emails = set()  # Track processed email IDs
        self.initialize_service()
    
    def initialize_service(self):
        """Initialize Gmail service with existing credentials if available"""
        try:
            credentials_file = os.getenv('GMAIL_CREDENTIALS_FILE', '/app/credentials/credentials.json')
            token_file = os.getenv('GMAIL_TOKEN_FILE', '/app/credentials/token.json')
            
            # Check if we have existing valid credentials
            creds = None
            if os.path.exists(token_file):
                with open(token_file, 'rb') as token:
                    creds = pickle.load(token)
            
            # Only proceed if we have valid credentials
            if creds and creds.valid:
                self.credentials = creds
                self.service = build('gmail', 'v1', credentials=creds)
                logger.info("Gmail service initialized with existing credentials")
            elif creds and creds.expired and creds.refresh_token:
                # Try to refresh the token
                try:
                    creds.refresh(Request())
                    self.credentials = creds
                    self.service = build('gmail', 'v1', credentials=creds)
                    
                    # Save refreshed credentials
                    with open(token_file, 'wb') as token:
                        pickle.dump(creds, token)
                    
                    logger.info("Gmail service initialized with refreshed credentials")
                except Exception as refresh_error:
                    logger.warning(f"Failed to refresh credentials: {refresh_error}")
                    logger.info("Gmail service requires re-authentication")
            else:
                logger.info("Gmail service requires authentication - visit /auth/gmail to authenticate")
            
        except Exception as e:
            logger.warning(f"Gmail service initialization skipped: {e}")
            logger.info("Visit /auth/gmail to set up Gmail authentication")
    
    def get_authorization_url(self) -> str:
        """Get the authorization URL for OAuth2 flow"""
        try:
            credentials_file = os.getenv('GMAIL_CREDENTIALS_FILE', '/app/credentials/credentials.json')
            
            if not os.path.exists(credentials_file):
                raise FileNotFoundError("Gmail credentials file not found. Please download credentials.json from Google Cloud Console")
            
            # Use Flow for web applications (not InstalledAppFlow)
            from google_auth_oauthlib.flow import Flow
            
            flow = Flow.from_client_secrets_file(
                credentials_file, 
                scopes=self.SCOPES)
            
            # Set the redirect URI from environment
            redirect_uri = os.getenv('GMAIL_REDIRECT_URI', 'http://localhost:5001/auth/gmail/callback')
            flow.redirect_uri = redirect_uri
            
            # Generate the authorization URL
            auth_url, _ = flow.authorization_url(
                prompt='consent',
                access_type='offline',
                include_granted_scopes='true'
            )
            
            # Store the flow for later use in callback
            self._temp_flow = flow
            
            return auth_url
            
        except Exception as e:
            logger.error(f"Error generating authorization URL: {e}")
            raise
    
    def complete_authorization(self, authorization_code: str) -> bool:
        """Complete the OAuth2 authorization with the code from callback"""
        try:
            if not hasattr(self, '_temp_flow') or not self._temp_flow:
                raise ValueError("No authorization flow in progress")
            
            # Exchange the authorization code for credentials
            self._temp_flow.fetch_token(code=authorization_code)
            creds = self._temp_flow.credentials
            
            # Save the credentials
            token_file = os.getenv('GMAIL_TOKEN_FILE', '/app/credentials/token.json')
            with open(token_file, 'wb') as token:
                pickle.dump(creds, token)
            
            # Initialize the service
            self.credentials = creds
            self.service = build('gmail', 'v1', credentials=creds)
            
            # Clean up
            delattr(self, '_temp_flow')
            
            logger.info("Gmail authorization completed successfully")
            return True
            
        except Exception as e:
            logger.error(f"Error completing authorization: {e}")
            return False
    
    def is_connected(self) -> bool:
        """Check if Gmail service is properly connected"""
        try:
            if not self.service:
                return False
            
            # Test connection with a simple API call
            self.service.users().getProfile(userId='me').execute()
            return True
            
        except Exception as e:
            logger.error(f"Gmail connection test failed: {e}")
            return False
    
    def get_new_emails(self, target_email: str, hours_back: int = 24) -> List[Dict]:
        """
        Get new emails sent to the target address (e.g., +RMA@gmail.com)
        
        Args:
            target_email: Email address pattern to search for
            hours_back: How many hours back to search for emails
        
        Returns:
            List of email message dictionaries
        """
        try:
            if not self.service:
                logger.error("Gmail service not initialized")
                return []
            
            # Calculate date filter
            cutoff_date = datetime.now() - timedelta(hours=hours_back)
            date_str = cutoff_date.strftime('%Y/%m/%d')
            
            # Build search query
            query = f'to:{target_email} after:{date_str} has:attachment'
            
            logger.info(f"Searching for emails with query: {query}")
            
            # Search for messages
            result = self.service.users().messages().list(
                userId='me',
                q=query
            ).execute()
            
            messages = result.get('messages', [])
            
            # Filter out already processed emails
            new_messages = []
            for msg in messages:
                if msg['id'] not in self.processed_emails:
                    # Get full message details
                    full_msg = self.service.users().messages().get(
                        userId='me',
                        id=msg['id']
                    ).execute()
                    new_messages.append(full_msg)
            
            logger.info(f"Found {len(new_messages)} new emails to process")
            return new_messages
            
        except HttpError as e:
            logger.error(f"Gmail API error: {e}")
            return []
        except Exception as e:
            logger.error(f"Error getting new emails: {e}")
            return []
    
    def get_attachments(self, message_id: str) -> List[Dict]:
        """
        Extract all attachments from an email message
        
        Args:
            message_id: Gmail message ID
            
        Returns:
            List of attachment dictionaries with filename and data
        """
        try:
            message = self.service.users().messages().get(
                userId='me',
                id=message_id
            ).execute()
            
            attachments = []
            
            def extract_attachments_from_part(part):
                """Recursively extract attachments from message parts"""
                if part.get('filename'):
                    attachment_id = part['body'].get('attachmentId')
                    if attachment_id:
                        # Download attachment
                        attachment = self.service.users().messages().attachments().get(
                            userId='me',
                            messageId=message_id,
                            id=attachment_id
                        ).execute()
                        
                        # Decode attachment data
                        file_data = base64.urlsafe_b64decode(
                            attachment['data'].encode('UTF-8')
                        )
                        
                        attachments.append({
                            'filename': part['filename'],
                            'data': file_data,
                            'mime_type': part.get('mimeType', 'application/octet-stream'),
                            'size': len(file_data)
                        })
                        
                        logger.info(f"Extracted attachment: {part['filename']} ({len(file_data)} bytes)")
                
                # Check for nested parts
                if 'parts' in part:
                    for subpart in part['parts']:
                        extract_attachments_from_part(subpart)
            
            # Process message payload
            payload = message.get('payload', {})
            extract_attachments_from_part(payload)
            
            return attachments
            
        except Exception as e:
            logger.error(f"Error extracting attachments from message {message_id}: {e}")
            return []
    
    def mark_as_processed(self, message_id: str):
        """Mark an email as processed to avoid reprocessing"""
        try:
            self.processed_emails.add(message_id)
            
            # Add a label to mark as processed (optional)
            # You can create a custom label in Gmail for tracking
            try:
                self.service.users().messages().modify(
                    userId='me',
                    id=message_id,
                    body={'addLabelIds': ['PROCESSED']}  # Create this label in Gmail
                ).execute()
            except:
                # Label might not exist, that's OK
                pass
                
            logger.info(f"Marked email {message_id} as processed")
            
        except Exception as e:
            logger.error(f"Error marking email {message_id} as processed: {e}")
    
    def get_email_details(self, message_id: str) -> Dict:
        """Get detailed information about an email"""
        try:
            message = self.service.users().messages().get(
                userId='me',
                id=message_id
            ).execute()
            
            headers = {h['name']: h['value'] for h in message['payload'].get('headers', [])}
            
            return {
                'id': message_id,
                'thread_id': message.get('threadId'),
                'subject': headers.get('Subject', ''),
                'from': headers.get('From', ''),
                'to': headers.get('To', ''),
                'date': headers.get('Date', ''),
                'received_time': datetime.fromtimestamp(int(message['internalDate']) / 1000),
                'snippet': message.get('snippet', '')
            }
            
        except Exception as e:
            logger.error(f"Error getting email details for {message_id}: {e}")
            return {}
    
    def search_emails_by_criteria(self, 
                                 from_email: Optional[str] = None,
                                 subject_contains: Optional[str] = None,
                                 has_attachment: bool = True,
                                 days_back: int = 7) -> List[Dict]:
        """
        Advanced email search with multiple criteria
        
        Args:
            from_email: Filter by sender email
            subject_contains: Filter by subject content
            has_attachment: Whether email must have attachments
            days_back: How many days back to search
            
        Returns:
            List of matching email messages
        """
        try:
            query_parts = []
            
            if from_email:
                query_parts.append(f'from:{from_email}')
            
            if subject_contains:
                query_parts.append(f'subject:"{subject_contains}"')
            
            if has_attachment:
                query_parts.append('has:attachment')
            
            if days_back:
                cutoff_date = datetime.now() - timedelta(days=days_back)
                date_str = cutoff_date.strftime('%Y/%m/%d')
                query_parts.append(f'after:{date_str}')
            
            query = ' '.join(query_parts)
            logger.info(f"Searching emails with query: {query}")
            
            result = self.service.users().messages().list(
                userId='me',
                q=query
            ).execute()
            
            messages = result.get('messages', [])
            
            # Get full details for each message
            detailed_messages = []
            for msg in messages:
                full_msg = self.service.users().messages().get(
                    userId='me',
                    id=msg['id']
                ).execute()
                detailed_messages.append(full_msg)
            
            return detailed_messages
            
        except Exception as e:
            logger.error(f"Error searching emails: {e}")
            return []