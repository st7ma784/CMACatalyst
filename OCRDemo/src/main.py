import os
import shutil
import logging
import asyncio
from typing import Dict, List, Optional
from datetime import datetime, timedelta
from dataclasses import dataclass

from flask import Flask, render_template, jsonify, request, redirect
from flask.logging import default_handler
import schedule
import time
from threading import Thread

from gmail_service import GmailService
from ocr_processor import OCRProcessor
from debt_extractor import DebtExtractor
from api_client import LegacyAPIClient
from database import Database
from ollama_service import OllamaService
from advisor_override_db import AdvisorOverrideDB
from llamaparse_processor import LlamaParseProcessor
from correction_tracker import CorrectionTracker

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('/app/logs/ocr_demo.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

@dataclass
class ProcessedDocument:
    email_id: str
    original_filename: str
    processed_filename: str
    original_filepath: str  # Path to original file
    client_name: str
    case_number: str
    extracted_text: str
    debts: List[Dict]
    processing_timestamp: datetime
    status: str
    error_message: Optional[str] = None

class OCRDemoApp:
    def __init__(self):
        # Initialize Flask app with correct template and static directories
        self.app = Flask(__name__, 
                         template_folder='../templates',
                         static_folder='../static')
        self.app.secret_key = os.getenv('SECRET_KEY', 'dev-secret-key')
        
        # Initialize services
        self.gmail_service = GmailService()
        self.ocr_processor = OCRProcessor()
        self.llamaparse_processor = LlamaParseProcessor()
        self.debt_extractor = DebtExtractor()
        self.api_client = LegacyAPIClient()
        self.database = Database()
        self.ollama_service = OllamaService()
        self.advisor_db = AdvisorOverrideDB()
        self.correction_tracker = CorrectionTracker()
        
        # Processing state
        self.processing_stats = {
            'total_emails': 0,
            'total_documents': 0,
            'successful_uploads': 0,
            'failed_uploads': 0,
            'last_check': None,
            'current_status': 'Idle'
        }
        
        self.recent_documents = []
        self.setup_routes()
        self.start_background_monitoring()

    def setup_routes(self):
        @self.app.route('/')
        def dashboard():
            return render_template('dashboard.html', 
                                 stats=self.processing_stats,
                                 recent_docs=self.recent_documents[-10:])

        @self.app.route('/api/stats')
        def api_stats():
            return jsonify(self.processing_stats)

        @self.app.route('/api/documents')
        def api_documents():
            return jsonify([doc.__dict__ for doc in self.recent_documents])

        @self.app.route('/api/process_now', methods=['GET', 'POST'])
        def api_process_now():
            """Trigger immediate email check"""
            try:
                self.process_emails()
                return jsonify({'status': 'success', 'message': 'Email processing triggered'})
            except Exception as e:
                return jsonify({'status': 'error', 'message': str(e)}), 500

        @self.app.route('/health')
        def health_check():
            return jsonify({
                'status': 'healthy',
                'timestamp': datetime.now().isoformat(),
                'services': {
                    'gmail': self.gmail_service.is_connected(),
                    'ocr': self.ocr_processor.is_available(),
                    'api': self.api_client.is_connected(),
                    'ollama': self.ollama_service.is_available()
                }
            })

        @self.app.route('/api/test_api')
        def test_api():
            """Test connection to legacy API"""
            try:
                result = self.api_client.test_connection()
                return jsonify({'status': 'success', 'result': result})
            except Exception as e:
                return jsonify({'status': 'error', 'message': str(e)}), 500

        @self.app.route('/api/recent_documents')
        def api_recent_documents():
            """Get recent processed documents"""
            try:
                docs = []
                for doc in self.recent_documents[-20:]:  # Last 20 documents
                    doc_dict = {
                        'email_id': doc.email_id,
                        'original_filename': doc.original_filename,
                        'processed_filename': doc.processed_filename,
                        'client_name': doc.client_name,
                        'case_number': doc.case_number,
                        'processing_timestamp': doc.processing_timestamp.isoformat() if doc.processing_timestamp else None,
                        'status': doc.status,
                        'error_message': doc.error_message,
                        'debts': doc.debts,
                        'confidence': getattr(doc, 'confidence', 0.8)  # Default confidence
                    }
                    docs.append(doc_dict)
                
                return jsonify({'status': 'success', 'documents': docs})
            except Exception as e:
                return jsonify({'status': 'error', 'message': str(e)}), 500

        @self.app.route('/api/document/<email_id>')
        def api_document_details(email_id):
            """Get detailed information about a specific document"""
            try:
                # Find document by email_id
                doc = next((d for d in self.recent_documents if d.email_id == email_id), None)
                if not doc:
                    return jsonify({'status': 'error', 'message': 'Document not found'}), 404
                
                doc_dict = {
                    'email_id': doc.email_id,
                    'original_filename': doc.original_filename,
                    'processed_filename': doc.processed_filename,
                    'client_name': doc.client_name,
                    'case_number': doc.case_number,
                    'extracted_text': doc.extracted_text,
                    'processing_timestamp': doc.processing_timestamp.isoformat() if doc.processing_timestamp else None,
                    'status': doc.status,
                    'error_message': doc.error_message,
                    'debts': doc.debts,
                    'ocr_text': doc.extracted_text[:2000] if doc.extracted_text else None  # First 2000 chars
                }
                
                return jsonify({'status': 'success', 'document': doc_dict})
            except Exception as e:
                return jsonify({'status': 'error', 'message': str(e)}), 500

        @self.app.route('/api/document/<email_id>/detailed')
        def api_document_detailed(email_id):
            """Get comprehensive detailed information about a specific document for modal view"""
            try:
                # Find document by email_id
                doc = next((d for d in self.recent_documents if d.email_id == email_id), None)
                if not doc:
                    return jsonify({'status': 'error', 'message': 'Document not found'}), 404

                # Analyze the extracted text for monetary amounts
                monetary_info = self.ollama_service._extract_and_validate_monetary_amounts(doc.extracted_text) if doc.extracted_text else {
                    'amounts': [],
                    'summary': 'No monetary amounts found',
                    'validation_status': 'N/A',
                    'issues': [],
                    'count': 0
                }

                # Get AI-enhanced client information extraction
                ai_extracted_info = None
                try:
                    if doc.extracted_text and self.ocr_processor.ollama_analyzer:
                        # Use the enhanced OCR processor with AI analysis
                        loop = asyncio.new_event_loop()
                        asyncio.set_event_loop(loop)
                        ai_extracted_info = loop.run_until_complete(
                            self.ocr_processor.extract_client_info_with_ai(doc.extracted_text)
                        )
                        loop.close()
                        logger.info(f"AI extraction completed for document {email_id}")
                    else:
                        logger.warning("Ollama analyzer not available, using fallback")
                        ai_extracted_info = self.ocr_processor._extract_client_info_regex(doc.extracted_text or "")
                except Exception as e:
                    logger.error(f"Error in AI extraction for document {email_id}: {e}")
                    ai_extracted_info = {
                        'extraction_method': 'error',
                        'error': str(e),
                        'file_summary': 'extraction failed',
                        'client_name': 'unknown',
                        'debt_type': 'unknown',
                        'debt_amount': 0.0,
                        'creditor_name': 'unknown',
                        'account_reference': 'unknown',
                        'document_date': 'unknown',
                        'additional_references': [],
                        'document_type': 'unknown',
                        'urgency_level': 'normal'
                    }

                # Check for advisor overrides
                override_info = None
                try:
                    overrides = self.advisor_db.get_override_history(email_id)
                    if overrides:
                        latest_override = max(overrides, key=lambda x: x['override_timestamp'])
                        override_info = {
                            'has_override': True,
                            'override_date': latest_override['override_timestamp'],
                            'advisor_name': latest_override['advisor_name'],
                            'original_debt_total': latest_override['original_debt_total'],
                            'corrected_debt_total': latest_override['corrected_debt_total'],
                            'debt_corrections': latest_override['debt_corrections'],
                            'notes': latest_override['notes']
                        }
                    else:
                        override_info = {'has_override': False}
                except Exception as e:
                    print(f"Error checking advisor overrides: {e}")
                    override_info = {'has_override': False}

                # Extract additional metadata
                doc_dict = {
                    'basic_info': {
                        'email_id': doc.email_id,
                        'original_filename': doc.original_filename,
                        'processed_filename': doc.processed_filename,
                        'original_filepath': getattr(doc, 'original_filepath', None),  # For backward compatibility
                        'client_name': doc.client_name,
                        'case_number': doc.case_number,
                        'processing_timestamp': doc.processing_timestamp.isoformat() if doc.processing_timestamp else None,
                        'status': doc.status,
                        'error_message': doc.error_message
                    },
                    'extracted_data': {
                        'debts': doc.debts,
                        'debt_count': len(doc.debts) if doc.debts else 0,
                        'total_debt_amount': sum(float(debt.get('amount', 0)) for debt in doc.debts) if doc.debts else 0,
                        'monetary_analysis': monetary_info
                    },
                    'ai_extracted_info': ai_extracted_info,
                    'advisor_override': override_info,
                    'ocr_analysis': {
                        'full_text': doc.extracted_text,
                        'text_length': len(doc.extracted_text) if doc.extracted_text else 0,
                        'line_count': len(doc.extracted_text.split('\n')) if doc.extracted_text else 0,
                        'word_count': len(doc.extracted_text.split()) if doc.extracted_text else 0,
                        'preview': doc.extracted_text[:500] + '...' if doc.extracted_text and len(doc.extracted_text) > 500 else doc.extracted_text
                    }
                }

                return jsonify({'status': 'success', 'document': doc_dict})
            except Exception as e:
                return jsonify({'status': 'error', 'message': str(e)}), 500

        @self.app.route('/api/processing_status')
        def api_processing_status():
            """Get current processing status"""
            try:
                is_processing = 'processing' in self.processing_stats['current_status'].lower()
                return jsonify({
                    'status': 'success',
                    'is_processing': is_processing,
                    'current_status': self.processing_stats['current_status'],
                    'current_task': self.processing_stats.get('current_task', None),
                    'last_check': self.processing_stats['last_check']
                })
            except Exception as e:
                return jsonify({'status': 'error', 'message': str(e)}), 500

        @self.app.route('/api/advisor/override', methods=['POST'])
        def save_advisor_override():
            """Save advisor override for debt corrections"""
            try:
                data = request.get_json()
                
                email_id = data.get('email_id')
                corrected_debts = data.get('corrected_debts', [])
                advisor_id = data.get('advisor_id', 'unknown')
                override_reason = data.get('override_reason', '')
                advisor_notes = data.get('advisor_notes', '')
                
                if not email_id or not corrected_debts:
                    return jsonify({'status': 'error', 'message': 'Missing required fields'}), 400
                
                # Find the original document
                doc = next((d for d in self.recent_documents if d.email_id == email_id), None)
                if not doc:
                    return jsonify({'status': 'error', 'message': 'Document not found'}), 404
                
                # Prepare document data for override
                document_data = {
                    'email_id': doc.email_id,
                    'processed_filename': doc.processed_filename,
                    'original_filename': doc.original_filename,
                    'client_name': doc.client_name,
                    'case_number': doc.case_number,
                    'processing_timestamp': doc.processing_timestamp.isoformat() if doc.processing_timestamp else None,
                    'extracted_text': doc.extracted_text
                }
                
                # Save the override
                override_id = self.advisor_db.save_advisor_override(
                    document_data=document_data,
                    original_debts=doc.debts or [],
                    corrected_debts=corrected_debts,
                    advisor_id=advisor_id,
                    override_reason=override_reason,
                    advisor_notes=advisor_notes
                )
                
                # Update the document's debts with corrected values
                doc.debts = corrected_debts
                
                logger.info(f"Advisor override saved for document {email_id} with ID {override_id}")
                
                return jsonify({
                    'status': 'success',
                    'override_id': override_id,
                    'message': 'Advisor override saved successfully'
                })
                
            except Exception as e:
                logger.error(f"Error saving advisor override: {e}")
                return jsonify({'status': 'error', 'message': str(e)}), 500

        @self.app.route('/api/advisor/override/<email_id>')
        def get_override_history(email_id):
            """Get override history for a document"""
            try:
                history = self.advisor_db.get_override_history(email_id)
                has_override = self.advisor_db.has_override(email_id)
                latest_corrected = self.advisor_db.get_latest_corrected_debts(email_id)
                
                return jsonify({
                    'status': 'success',
                    'has_override': has_override,
                    'history': history,
                    'latest_corrected_debts': latest_corrected
                })
                
            except Exception as e:
                logger.error(f"Error retrieving override history: {e}")
                return jsonify({'status': 'error', 'message': str(e)}), 500

        @self.app.route('/api/advisor/analytics')
        def get_advisor_analytics():
            """Get analytics on advisor corrections"""
            try:
                analytics = self.advisor_db.get_correction_analytics()
                return jsonify({'status': 'success', 'analytics': analytics})
                
            except Exception as e:
                logger.error(f"Error retrieving advisor analytics: {e}")
                return jsonify({'status': 'error', 'message': str(e)}), 500

        @self.app.route('/auth/gmail')
        def gmail_auth():
            """Initiate Gmail OAuth flow"""
            try:
                auth_url = self.gmail_service.get_authorization_url()
                return redirect(auth_url)
            except Exception as e:
                return jsonify({'status': 'error', 'message': str(e)}), 500

        @self.app.route('/auth/gmail/callback')
        def gmail_auth_callback():
            """Handle Gmail OAuth callback"""
            try:
                code = request.args.get('code')
                if code:
                    success = self.gmail_service.complete_authorization(code)
                    if success:
                        return redirect('/?auth=success')
                    else:
                        return redirect('/?auth=failed')
                else:
                    return redirect('/?auth=failed')
            except Exception as e:
                logger.error(f"Gmail auth callback error: {e}")
                return redirect('/?auth=failed')

        @self.app.route('/api/document/<filename>/view')
        def view_document(filename):
            """Serve processed documents for viewing"""
            try:
                import os
                from flask import send_file, abort
                
                # Security: ensure filename is safe
                if '..' in filename or '/' in filename:
                    abort(404)
                
                file_path = f"/app/processed_docs/{filename}"
                
                if not os.path.exists(file_path):
                    abort(404)
                
                # Determine content type
                if filename.lower().endswith('.pdf'):
                    mimetype = 'application/pdf'
                elif filename.lower().endswith(('.jpg', '.jpeg')):
                    mimetype = 'image/jpeg'
                elif filename.lower().endswith('.png'):
                    mimetype = 'image/png'
                else:
                    mimetype = 'application/octet-stream'
                
                return send_file(file_path, mimetype=mimetype, as_attachment=False)
                
            except Exception as e:
                logger.error(f"Error serving document {filename}: {e}")
                abort(404)

        @self.app.route('/api/document/<filename>/view-original')
        def view_original_document(filename):
            """Serve original documents for viewing"""
            try:
                import os
                from flask import send_file, abort
                
                # Security: ensure filename is safe
                if '..' in filename or '/' in filename:
                    abort(404)
                
                file_path = f"/app/processed_docs/{filename}"
                
                if not os.path.exists(file_path):
                    abort(404)
                
                # Determine content type
                if filename.lower().endswith('.pdf'):
                    mimetype = 'application/pdf'
                elif filename.lower().endswith(('.jpg', '.jpeg')):
                    mimetype = 'image/jpeg'
                elif filename.lower().endswith('.png'):
                    mimetype = 'image/png'
                else:
                    mimetype = 'application/octet-stream'
                
                return send_file(file_path, mimetype=mimetype, as_attachment=False)
                
            except Exception as e:
                logger.error(f"Error serving original document {filename}: {e}")
                abort(404)

        @self.app.route('/api/document/<email_id>/download')
        def download_document_custom(email_id):
            """Download document with custom RMA filename format"""
            try:
                import os
                from flask import send_file, abort
                
                # Find document by email_id
                doc = next((d for d in self.recent_documents if d.email_id == email_id), None)
                if not doc:
                    return jsonify({'status': 'error', 'message': 'Document not found'}), 404
                
                # Check if processed file exists
                file_path = f"/app/processed_docs/{doc.processed_filename}"
                if not os.path.exists(file_path):
                    return jsonify({'status': 'error', 'message': 'Document file not found'}), 404
                
                # Generate custom RMA download filename
                client_info = {'name': doc.client_name}
                custom_filename = self.ollama_service.generate_rma_download_filename(
                    doc.extracted_text or "",
                    doc.original_filename,
                    client_info,
                    doc.processing_timestamp
                )
                
                # Determine content type
                if doc.processed_filename.lower().endswith('.pdf'):
                    mimetype = 'application/pdf'
                elif doc.processed_filename.lower().endswith(('.jpg', '.jpeg')):
                    mimetype = 'image/jpeg'
                elif doc.processed_filename.lower().endswith('.png'):
                    mimetype = 'image/png'
                else:
                    mimetype = 'application/octet-stream'
                
                logger.info(f"Downloading document {doc.processed_filename} as {custom_filename}")
                
                return send_file(
                    file_path, 
                    mimetype=mimetype, 
                    as_attachment=True,
                    download_name=custom_filename
                )
                
            except Exception as e:
                logger.error(f"Error downloading document: {str(e)}")
                return jsonify({'status': 'error', 'message': str(e)}), 500

        @self.app.route('/api/document/<email_id>/image')
        def get_document_image(email_id):
            """Get document as image (PNG) - converts first page of PDF to image"""
            try:
                import os
                from flask import send_file, abort
                from pdf2image import convert_from_path
                from PIL import Image
                import io
                
                # Find document by email_id
                doc = next((d for d in self.recent_documents if d.email_id == email_id), None)
                if not doc:
                    return jsonify({'status': 'error', 'message': 'Document not found'}), 404
                
                # Check if processed file exists
                file_path = f"/app/processed_docs/{doc.processed_filename}"
                if not os.path.exists(file_path):
                    # Try original file path
                    file_path = getattr(doc, 'original_filepath', None)
                    if not file_path or not os.path.exists(file_path):
                        return jsonify({'status': 'error', 'message': 'Document file not found'}), 404
                
                # If it's already an image, just send it
                if file_path.lower().endswith(('.jpg', '.jpeg', '.png')):
                    return send_file(file_path, mimetype='image/png')
                
                # Convert PDF to image (first page only)
                if file_path.lower().endswith('.pdf'):
                    try:
                        # Convert first page to image
                        images = convert_from_path(file_path, first_page=1, last_page=1, dpi=150)
                        if images:
                            # Convert to PNG in memory
                            img_io = io.BytesIO()
                            images[0].save(img_io, 'PNG')
                            img_io.seek(0)
                            return send_file(img_io, mimetype='image/png')
                        else:
                            return jsonify({'status': 'error', 'message': 'Could not convert PDF to image'}), 500
                    except Exception as e:
                        logger.error(f"Error converting PDF to image: {str(e)}")
                        return jsonify({'status': 'error', 'message': f'PDF conversion failed: {str(e)}'}), 500
                
                return jsonify({'status': 'error', 'message': 'Unsupported file type'}), 400
                
            except Exception as e:
                logger.error(f"Error getting document image: {str(e)}")
                return jsonify({'status': 'error', 'message': str(e)}), 500
                
            except Exception as e:
                logger.error(f"Error downloading document for email_id {email_id}: {e}")
                return jsonify({'status': 'error', 'message': str(e)}), 500

        @self.app.route('/api/document/<email_id>/download-original')
        def download_original_document_custom(email_id):
            """Download original document with custom RMA filename format"""
            try:
                import os
                from flask import send_file, abort
                
                # Find document by email_id
                doc = next((d for d in self.recent_documents if d.email_id == email_id), None)
                if not doc:
                    return jsonify({'status': 'error', 'message': 'Document not found'}), 404
                
                # Check if original file exists
                original_file_path = f"/app/processed_docs/{doc.original_filepath}"
                if not os.path.exists(original_file_path):
                    return jsonify({'status': 'error', 'message': 'Original document file not found'}), 404
                
                # Generate custom RMA download filename for original
                client_info = {'name': doc.client_name}
                custom_filename = self.ollama_service.generate_rma_download_filename(
                    doc.extracted_text or "",
                    doc.original_filename,
                    client_info,
                    doc.processing_timestamp
                )
                
                # Determine content type
                if doc.original_filepath.lower().endswith('.pdf'):
                    mimetype = 'application/pdf'
                elif doc.original_filepath.lower().endswith(('.jpg', '.jpeg')):
                    mimetype = 'image/jpeg'
                elif doc.original_filepath.lower().endswith('.png'):
                    mimetype = 'image/png'
                else:
                    mimetype = 'application/octet-stream'
                
                logger.info(f"Downloading original document {doc.original_filepath} as {custom_filename}")
                
                return send_file(
                    original_file_path, 
                    mimetype=mimetype, 
                    as_attachment=True,
                    download_name=custom_filename
                )
                
            except Exception as e:
                logger.error(f"Error downloading original document for email_id {email_id}: {e}")
                return jsonify({'status': 'error', 'message': str(e)}), 500

        @self.app.route('/api/ollama/test')
        def test_ollama():
            """Test Ollama service connection"""
            try:
                result = self.ollama_service.test_connection()
                return jsonify({'status': 'success', 'result': result})
            except Exception as e:
                return jsonify({'status': 'error', 'message': str(e)}), 500

        @self.app.route('/api/llamaparse/test')
        def test_llamaparse():
            """Test LlamaParse service connection"""
            try:
                result = self.llamaparse_processor.is_available()
                return jsonify({
                    'status': 'success',
                    'available': result,
                    'message': 'LlamaParse is available' if result else 'LlamaParse model not found'
                })
            except Exception as e:
                return jsonify({'status': 'error', 'message': str(e)}), 500

        @self.app.route('/api/document/<email_id>/llamaparse', methods=['POST'])
        def process_with_llamaparse(email_id):
            """Process document with LlamaParse to extract markdown and JSON"""
            try:
                # Find document by email_id
                doc = next((d for d in self.recent_documents if d.email_id == email_id), None)
                if not doc:
                    return jsonify({'status': 'error', 'message': 'Document not found'}), 404

                # Get original file path
                original_file_path = f"/app/processed_docs/{doc.original_filepath}"
                if not os.path.exists(original_file_path):
                    return jsonify({'status': 'error', 'message': 'Original document file not found'}), 404

                # Process with LlamaParse
                result = self.llamaparse_processor.extract_text_and_parse(original_file_path)

                if result['success']:
                    # Store the markdown and JSON data with the document
                    doc.llamaparse_markdown = result['markdown']
                    doc.llamaparse_json = result['json_data']

                    return jsonify({
                        'status': 'success',
                        'markdown': result['markdown'],
                        'json_data': result['json_data']
                    })
                else:
                    return jsonify({
                        'status': 'error',
                        'message': result.get('error', 'Unknown error processing document')
                    }), 500

            except Exception as e:
                logger.error(f"Error processing document with LlamaParse: {e}")
                return jsonify({'status': 'error', 'message': str(e)}), 500

        @self.app.route('/api/document/<email_id>/json')
        def get_document_json(email_id):
            """Get extracted JSON data for a document"""
            try:
                # Find document by email_id
                doc = next((d for d in self.recent_documents if d.email_id == email_id), None)
                if not doc:
                    return jsonify({'status': 'error', 'message': 'Document not found'}), 404

                # Check if LlamaParse JSON exists
                llamaparse_json = getattr(doc, 'llamaparse_json', None)

                if llamaparse_json:
                    return jsonify({
                        'status': 'success',
                        'extraction_method': 'llamaparse',
                        'data': llamaparse_json
                    })
                else:
                    # Fallback to creating JSON from OCR data
                    fallback_json = {
                        'document_uri': f"/app/processed_docs/{doc.original_filepath}",
                        'document_date': doc.processing_timestamp.isoformat() if doc.processing_timestamp else 'unknown',
                        'client_name': doc.client_name,
                        'reference_numbers': {
                            'case_number': doc.case_number
                        },
                        'contact_info': {
                            'phone_numbers': [],
                            'email_addresses': []
                        },
                        'financial_values': {
                            'total_amount': sum(float(d.get('amount', 0)) for d in (doc.debts or [])),
                            'currency': 'GBP',
                            'breakdown': doc.debts or []
                        },
                        'summary': doc.extracted_text[:500] if doc.extracted_text else 'No text extracted',
                        'extraction_method': 'ocr_fallback',
                        'extraction_timestamp': doc.processing_timestamp.isoformat() if doc.processing_timestamp else None
                    }

                    return jsonify({
                        'status': 'success',
                        'extraction_method': 'ocr_fallback',
                        'data': fallback_json
                    })

            except Exception as e:
                logger.error(f"Error getting document JSON: {e}")
                return jsonify({'status': 'error', 'message': str(e)}), 500

        @self.app.route('/api/document/<email_id>/markdown')
        def get_document_markdown(email_id):
            """Get markdown representation of a document"""
            try:
                # Find document by email_id
                doc = next((d for d in self.recent_documents if d.email_id == email_id), None)
                if not doc:
                    return jsonify({'status': 'error', 'message': 'Document not found'}), 404

                # Check if LlamaParse markdown exists
                llamaparse_markdown = getattr(doc, 'llamaparse_markdown', None)

                if llamaparse_markdown:
                    return jsonify({
                        'status': 'success',
                        'extraction_method': 'llamaparse',
                        'markdown': llamaparse_markdown
                    })
                else:
                    # Fallback to OCR text as plain text
                    return jsonify({
                        'status': 'success',
                        'extraction_method': 'ocr_fallback',
                        'markdown': f"# Document: {doc.original_filename}\n\n{doc.extracted_text or 'No text extracted'}"
                    })

            except Exception as e:
                logger.error(f"Error getting document markdown: {e}")
                return jsonify({'status': 'error', 'message': str(e)}), 500

        @self.app.route('/api/corrections/submit', methods=['POST'])
        def submit_correction():
            """Submit a correction for model learning"""
            try:
                data = request.get_json()

                document_id = data.get('document_id')
                email_id = data.get('email_id')
                correction_type = data.get('correction_type', 'extraction')
                user_id = data.get('user_id', 'unknown')
                notes = data.get('notes', '')

                if not document_id or not email_id:
                    return jsonify({'status': 'error', 'message': 'Missing required fields'}), 400

                # Find document
                doc = next((d for d in self.recent_documents if d.email_id == email_id), None)
                if not doc:
                    return jsonify({'status': 'error', 'message': 'Document not found'}), 404

                if correction_type == 'field':
                    # Field-level correction
                    field_name = data.get('field_name')
                    original_value = data.get('original_value')
                    corrected_value = data.get('corrected_value')
                    confidence_score = data.get('confidence_score')
                    extraction_method = data.get('extraction_method', 'unknown')

                    correction_id = self.correction_tracker.save_field_correction(
                        document_id=document_id,
                        email_id=email_id,
                        original_filename=doc.original_filename,
                        field_name=field_name,
                        original_value=original_value,
                        corrected_value=corrected_value,
                        user_id=user_id,
                        extraction_method=extraction_method,
                        confidence_score=confidence_score,
                        notes=notes
                    )

                    logger.info(f"Saved field correction {correction_id}")
                    return jsonify({
                        'status': 'success',
                        'correction_id': correction_id,
                        'message': 'Field correction submitted successfully'
                    })

                else:
                    # Full extraction correction
                    original_json = data.get('original_json')
                    corrected_json = data.get('corrected_json')
                    extraction_method = data.get('extraction_method', 'unknown')

                    correction_id = self.correction_tracker.save_extraction_correction(
                        document_id=document_id,
                        email_id=email_id,
                        original_filename=doc.original_filename,
                        original_json=original_json,
                        corrected_json=corrected_json,
                        user_id=user_id,
                        extraction_method=extraction_method,
                        notes=notes
                    )

                    logger.info(f"Saved extraction correction {correction_id}")
                    return jsonify({
                        'status': 'success',
                        'correction_id': correction_id,
                        'message': 'Extraction correction submitted successfully'
                    })

            except Exception as e:
                logger.error(f"Error submitting correction: {e}")
                return jsonify({'status': 'error', 'message': str(e)}), 500

        @self.app.route('/api/corrections/<document_id>')
        def get_corrections(document_id):
            """Get corrections for a document"""
            try:
                field_corrections = self.correction_tracker.get_corrections_for_document(document_id)
                extraction_corrections = self.correction_tracker.get_extraction_corrections_for_document(document_id)

                return jsonify({
                    'status': 'success',
                    'field_corrections': field_corrections,
                    'extraction_corrections': extraction_corrections
                })

            except Exception as e:
                logger.error(f"Error getting corrections: {e}")
                return jsonify({'status': 'error', 'message': str(e)}), 500

        @self.app.route('/api/corrections/statistics')
        def get_correction_statistics():
            """Get correction statistics"""
            try:
                stats = self.correction_tracker.get_correction_statistics()
                field_analytics = self.correction_tracker.get_field_analytics()

                return jsonify({
                    'status': 'success',
                    'statistics': stats,
                    'field_analytics': field_analytics
                })

            except Exception as e:
                logger.error(f"Error getting correction statistics: {e}")
                return jsonify({'status': 'error', 'message': str(e)}), 500

        @self.app.route('/api/documents/unprocessed')
        def get_unprocessed_documents():
            """Get list of unprocessed documents from recent emails"""
            try:
                # This would ideally check Gmail for recent unprocessed emails
                # For now, return documents in 'pending' state or recently added
                pending_docs = [
                    {
                        'email_id': doc.email_id,
                        'original_filename': doc.original_filename,
                        'status': doc.status,
                        'processing_timestamp': doc.processing_timestamp.isoformat() if doc.processing_timestamp else None,
                        'error_message': doc.error_message
                    }
                    for doc in self.recent_documents
                    if doc.status in ['Pending', 'Error', 'Processed'] and not getattr(doc, 'llamaparse_json', None)
                ]

                return jsonify({
                    'status': 'success',
                    'count': len(pending_docs),
                    'documents': pending_docs
                })

            except Exception as e:
                logger.error(f"Error getting unprocessed documents: {e}")
                return jsonify({'status': 'error', 'message': str(e)}), 500

        @self.app.route('/api/documents/detailed_list')
        def get_detailed_documents_list():
            """Get detailed list of all documents with summaries and JSON preview"""
            try:
                detailed_docs = []

                for doc in self.recent_documents[-50:]:  # Last 50 documents
                    llamaparse_json = getattr(doc, 'llamaparse_json', None)

                    # Generate summary
                    summary = ''
                    if llamaparse_json and 'summary' in llamaparse_json:
                        summary = llamaparse_json['summary']
                    elif doc.extracted_text:
                        summary = doc.extracted_text[:200] + '...' if len(doc.extracted_text) > 200 else doc.extracted_text

                    detailed_doc = {
                        'email_id': doc.email_id,
                        'original_filename': doc.original_filename,
                        'processed_filename': doc.processed_filename,
                        'client_name': doc.client_name,
                        'case_number': doc.case_number,
                        'processing_timestamp': doc.processing_timestamp.isoformat() if doc.processing_timestamp else None,
                        'status': doc.status,
                        'summary': summary,
                        'has_llamaparse_data': llamaparse_json is not None,
                        'debts_count': len(doc.debts) if doc.debts else 0,
                        'total_debt_amount': sum(float(d.get('amount', 0)) for d in (doc.debts or [])),
                        'json_preview': {
                            'client_name': llamaparse_json.get('client_name') if llamaparse_json else doc.client_name,
                            'document_date': llamaparse_json.get('document_date') if llamaparse_json else 'unknown',
                            'document_type': llamaparse_json.get('document_type') if llamaparse_json else 'unknown',
                            'extraction_method': llamaparse_json.get('extraction_method') if llamaparse_json else 'ocr'
                        }
                    }

                    detailed_docs.append(detailed_doc)

                return jsonify({
                    'status': 'success',
                    'count': len(detailed_docs),
                    'documents': detailed_docs
                })

            except Exception as e:
                logger.error(f"Error getting detailed documents list: {e}")
                return jsonify({'status': 'error', 'message': str(e)}), 500

    def start_background_monitoring(self):
        """Start background thread for email monitoring"""
        def run_scheduler():
            # Schedule email checking every 5 minutes (configurable)
            interval = int(os.getenv('GMAIL_CHECK_INTERVAL', 300))
            schedule.every(interval).seconds.do(self.process_emails)
            
            while True:
                schedule.run_pending()
                time.sleep(60)  # Check every minute for scheduled tasks

        monitor_thread = Thread(target=run_scheduler, daemon=True)
        monitor_thread.start()
        logger.info("Background email monitoring started")

    def process_emails(self):
        """Main email processing logic"""
        try:
            self.processing_stats['current_status'] = 'Checking emails'
            self.processing_stats['last_check'] = datetime.now().isoformat()
            
            logger.info("Starting email processing cycle")
            
            # Get new emails with +RMA target
            target_email = os.getenv('GMAIL_TARGET_EMAIL', '+RMA@gmail.com')
            emails = self.gmail_service.get_new_emails(target_email)
            
            self.processing_stats['total_emails'] += len(emails)
            
            for email in emails:
                try:
                    self.process_single_email(email)
                except Exception as e:
                    logger.error(f"Error processing email {email.get('id', 'unknown')}: {e}")
                    self.processing_stats['failed_uploads'] += 1

            self.processing_stats['current_status'] = 'Idle'
            logger.info(f"Email processing cycle completed. Processed {len(emails)} emails")

        except Exception as e:
            logger.error(f"Error in email processing: {e}")
            self.processing_stats['current_status'] = f'Error: {str(e)}'

    def process_single_email(self, email: Dict):
        """Process a single email with attachments"""
        email_id = email['id']
        logger.info(f"Processing email {email_id}")

        # Extract attachments
        attachments = self.gmail_service.get_attachments(email_id)
        
        for attachment in attachments:
            try:
                processed_doc = self.process_attachment(email_id, attachment)
                if processed_doc:
                    self.recent_documents.append(processed_doc)
                    self.processing_stats['total_documents'] += 1
                    
                    # Upload to legacy system
                    if self.upload_to_legacy_system(processed_doc):
                        self.processing_stats['successful_uploads'] += 1
                        processed_doc.status = 'Uploaded'
                    else:
                        self.processing_stats['failed_uploads'] += 1
                        processed_doc.status = 'Upload Failed'

            except Exception as e:
                logger.error(f"Error processing attachment in email {email_id}: {e}")

        # Mark email as processed
        self.gmail_service.mark_as_processed(email_id)

    def process_attachment(self, email_id: str, attachment: Dict) -> Optional[ProcessedDocument]:
        """Process a single attachment"""
        filename = attachment['filename']
        file_data = attachment['data']
        
        logger.info(f"Processing attachment: {filename}")

        try:
            # Save temporary file
            temp_path = self.ocr_processor.save_temp_file(file_data, filename)
            
            # Perform OCR
            extracted_text = self.ocr_processor.extract_text(temp_path)
            
            if not extracted_text:
                logger.warning(f"No text extracted from {filename}")
                return None

            # Extract client name and case information
            client_info = self.extract_client_info(extracted_text)
            case_number = self.get_or_create_case_number(client_info)
            
            # Extract debt information
            debts = self.debt_extractor.extract_debts(extracted_text)
            
            # Create processing timestamp
            processing_timestamp = datetime.now()
            
            # Generate intelligent filename using Ollama
            new_filename = self.ollama_service.generate_document_filename(
                extracted_text, filename, client_info, processing_timestamp
            )
            
            # Save original document with timestamp prefix
            original_stored_filename = f"original_{processing_timestamp.strftime('%Y%m%d_%H%M%S')}_{filename}"
            original_path = f"/app/processed_docs/{original_stored_filename}"
            
            # Save processed document
            processed_path = f"/app/processed_docs/{new_filename}"
            
            # Copy original file to original location and processed location
            shutil.copy2(temp_path, original_path)  # Keep original
            shutil.move(temp_path, processed_path)  # Move to processed (with intelligent name)
            
            processed_doc = ProcessedDocument(
                email_id=email_id,
                original_filename=filename,
                processed_filename=new_filename,
                original_filepath=original_stored_filename,  # Store the path to original
                client_name=client_info.get('name', 'Unknown'),
                case_number=case_number,
                extracted_text=extracted_text,
                debts=debts,
                processing_timestamp=processing_timestamp,
                status='Processed'
            )
            
            # Save to database
            self.database.save_document(processed_doc)
            
            return processed_doc

        except Exception as e:
            logger.error(f"Error processing attachment {filename}: {e}")
            error_doc = ProcessedDocument(
                email_id=email_id,
                original_filename=filename,
                processed_filename="",
                client_name="",
                case_number="",
                extracted_text="",
                debts=[],
                processing_timestamp=datetime.now(),
                status='Error',
                error_message=str(e)
            )
            
            # Save error document to database for tracking
            try:
                self.database.save_document(error_doc)
            except Exception as db_error:
                logger.error(f"Failed to save error document to database: {db_error}")
            
            return error_doc

    def extract_client_info(self, text: str) -> Dict:
        """Extract client information from OCR text using AI-enhanced analysis"""
        try:
            # Use the new AI-enhanced OCR processor extraction
            ai_info = self.ocr_processor.extract_client_info(text)

            # If AI extraction was successful, use it
            if ai_info.get('extraction_method') == 'ollama_ai':
                logger.info("Using AI-enhanced client info extraction")
                return {
                    'name': ai_info.get('client_name', 'Unknown'),
                    'case_reference': ai_info.get('account_reference', ''),
                    'debt_amount': ai_info.get('debt_amount', 0.0),
                    'debt_type': ai_info.get('debt_type', 'unknown'),
                    'creditor': ai_info.get('creditor_name', ''),
                    'document_date': ai_info.get('document_date', ''),
                    'ai_enhanced': True,
                    'full_ai_data': ai_info
                }
            else:
                # Fallback to legacy extraction
                logger.info("Using fallback client info extraction")
                if self.ollama_service.is_available():
                    fallback_info = self.ollama_service.extract_client_info(text)
                else:
                    fallback_info = {'name': 'Unknown', 'case_reference': ''}

                fallback_info['ai_enhanced'] = False
                return fallback_info

        except Exception as e:
            logger.error(f"Error in client info extraction: {e}")
            return {
                'name': 'Unknown',
                'case_reference': '',
                'debt_amount': 0.0,
                'debt_type': 'unknown',
                'creditor': '',
                'document_date': '',
                'ai_enhanced': False,
                'error': str(e)
            }

    def get_or_create_case_number(self, client_info: Dict) -> str:
        """Look up or create case number via API"""
        try:
            case_number = self.api_client.lookup_case_number(client_info)
            if case_number:
                return case_number
            
            # If no case found, create new one (if API supports it)
            new_case = self.api_client.create_case(client_info)
            return new_case.get('case_number', f"NEW_{datetime.now().strftime('%Y%m%d_%H%M%S')}")
            
        except Exception as e:
            logger.error(f"Error looking up case number: {e}")
            return f"ERROR_{datetime.now().strftime('%Y%m%d_%H%M%S')}"

    def upload_to_legacy_system(self, doc: ProcessedDocument) -> bool:
        """Upload document and debt information to legacy system"""
        try:
            # Upload document file
            doc_upload_result = self.api_client.upload_document(
                doc.processed_filename,
                f"/app/processed_docs/{doc.processed_filename}",
                doc.case_number
            )
            
            # Upload debt information
            for debt in doc.debts:
                debt_result = self.api_client.create_debt_record(
                    case_number=doc.case_number,
                    debt_info=debt
                )
            
            logger.info(f"Successfully uploaded {doc.processed_filename} to legacy system")
            return True
            
        except Exception as e:
            logger.error(f"Error uploading to legacy system: {e}")
            return False

    def sanitize_filename(self, filename: str) -> str:
        """Sanitize filename for safe storage"""
        import re
        # Remove or replace invalid characters
        sanitized = re.sub(r'[<>:"/\\|?*]', '_', filename)
        return sanitized

def main():
    # Load environment variables
    from dotenv import load_dotenv
    load_dotenv()
    
    # Initialize app
    ocr_app = OCRDemoApp()
    
    # Start Flask app
    host = os.getenv('FLASK_HOST', '0.0.0.0')
    port = int(os.getenv('FLASK_PORT', 5001))
    debug = os.getenv('FLASK_DEBUG', 'false').lower() == 'true'
    
    logger.info(f"Starting OCR Demo App on {host}:{port}")
    ocr_app.app.run(host=host, port=port, debug=debug)

if __name__ == '__main__':
    main()