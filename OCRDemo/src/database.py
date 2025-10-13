"""
Simple database module for OCR Demo
Handles storage and retrieval of processed documents
"""

import sqlite3
import json
import os
from datetime import datetime, timedelta
from typing import List, Dict, Optional
import logging

logger = logging.getLogger(__name__)

class Database:
    def __init__(self, db_path: str = "/app/data/ocr_demo.db"):
        self.db_path = db_path
        
        # Ensure directory exists
        os.makedirs(os.path.dirname(db_path), exist_ok=True)
        
        # Initialize database
        self.init_database()
    
    def init_database(self):
        """Initialize database with required tables"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                
                # Create documents table
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS documents (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        email_id TEXT NOT NULL,
                        original_filename TEXT NOT NULL,
                        processed_filename TEXT,
                        client_name TEXT,
                        case_number TEXT,
                        extracted_text TEXT,
                        debts_json TEXT,
                        processing_timestamp TEXT,
                        status TEXT,
                        error_message TEXT,
                        created_at TEXT DEFAULT CURRENT_TIMESTAMP
                    )
                """)
                
                # Create processing_stats table
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS processing_stats (
                        id INTEGER PRIMARY KEY,
                        total_emails INTEGER DEFAULT 0,
                        total_documents INTEGER DEFAULT 0,
                        successful_uploads INTEGER DEFAULT 0,
                        failed_uploads INTEGER DEFAULT 0,
                        last_check TEXT,
                        current_status TEXT DEFAULT 'Idle',
                        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
                    )
                """)
                
                # Initialize stats if empty
                cursor.execute("SELECT COUNT(*) FROM processing_stats")
                if cursor.fetchone()[0] == 0:
                    cursor.execute("""
                        INSERT INTO processing_stats 
                        (id, total_emails, total_documents, successful_uploads, failed_uploads, current_status)
                        VALUES (1, 0, 0, 0, 0, 'Idle')
                    """)
                
                conn.commit()
                logger.info("Database initialized successfully")
                
        except Exception as e:
            logger.error(f"Error initializing database: {e}")
            raise
    
    def save_document(self, document) -> bool:
        """Save processed document to database"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                
                debts_json = json.dumps(document.debts) if document.debts else None
                timestamp_str = document.processing_timestamp.isoformat() if document.processing_timestamp else None
                
                cursor.execute("""
                    INSERT INTO documents 
                    (email_id, original_filename, processed_filename, client_name, case_number,
                     extracted_text, debts_json, processing_timestamp, status, error_message)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    document.email_id,
                    document.original_filename,
                    document.processed_filename,
                    document.client_name,
                    document.case_number,
                    document.extracted_text,
                    debts_json,
                    timestamp_str,
                    document.status,
                    document.error_message
                ))
                
                conn.commit()
                logger.info(f"Document saved: {document.original_filename}")
                return True
                
        except Exception as e:
            logger.error(f"Error saving document: {e}")
            return False
    
    def get_recent_documents(self, limit: int = 50) -> List[Dict]:
        """Get recent processed documents"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                
                cursor.execute("""
                    SELECT email_id, original_filename, processed_filename, client_name, case_number,
                           extracted_text, debts_json, processing_timestamp, status, error_message, created_at
                    FROM documents 
                    ORDER BY created_at DESC 
                    LIMIT ?
                """, (limit,))
                
                documents = []
                for row in cursor.fetchall():
                    debts = json.loads(row[6]) if row[6] else []
                    doc = {
                        'email_id': row[0],
                        'original_filename': row[1],
                        'processed_filename': row[2],
                        'client_name': row[3],
                        'case_number': row[4],
                        'extracted_text': row[5],
                        'debts': debts,
                        'processing_timestamp': row[7],
                        'status': row[8],
                        'error_message': row[9],
                        'created_at': row[10]
                    }
                    documents.append(doc)
                
                return documents
                
        except Exception as e:
            logger.error(f"Error getting recent documents: {e}")
            return []
    
    def get_document_by_email_id(self, email_id: str) -> Optional[Dict]:
        """Get document by email ID"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                
                cursor.execute("""
                    SELECT email_id, original_filename, processed_filename, client_name, case_number,
                           extracted_text, debts_json, processing_timestamp, status, error_message, created_at
                    FROM documents 
                    WHERE email_id = ?
                    ORDER BY created_at DESC 
                    LIMIT 1
                """, (email_id,))
                
                row = cursor.fetchone()
                if row:
                    debts = json.loads(row[6]) if row[6] else []
                    return {
                        'email_id': row[0],
                        'original_filename': row[1],
                        'processed_filename': row[2],
                        'client_name': row[3],
                        'case_number': row[4],
                        'extracted_text': row[5],
                        'debts': debts,
                        'processing_timestamp': row[7],
                        'status': row[8],
                        'error_message': row[9],
                        'created_at': row[10]
                    }
                
                return None
                
        except Exception as e:
            logger.error(f"Error getting document by email ID: {e}")
            return None
    
    def update_stats(self, stats: Dict) -> bool:
        """Update processing statistics"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                
                cursor.execute("""
                    UPDATE processing_stats 
                    SET total_emails = ?, total_documents = ?, successful_uploads = ?, 
                        failed_uploads = ?, last_check = ?, current_status = ?, 
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = 1
                """, (
                    stats.get('total_emails', 0),
                    stats.get('total_documents', 0),
                    stats.get('successful_uploads', 0),
                    stats.get('failed_uploads', 0),
                    stats.get('last_check'),
                    stats.get('current_status', 'Idle')
                ))
                
                conn.commit()
                return True
                
        except Exception as e:
            logger.error(f"Error updating stats: {e}")
            return False
    
    def get_stats(self) -> Dict:
        """Get current processing statistics"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                
                cursor.execute("""
                    SELECT total_emails, total_documents, successful_uploads, failed_uploads,
                           last_check, current_status, updated_at
                    FROM processing_stats 
                    WHERE id = 1
                """)
                
                row = cursor.fetchone()
                if row:
                    return {
                        'total_emails': row[0],
                        'total_documents': row[1],
                        'successful_uploads': row[2],
                        'failed_uploads': row[3],
                        'last_check': row[4],
                        'current_status': row[5],
                        'updated_at': row[6]
                    }
                else:
                    # Return default stats
                    return {
                        'total_emails': 0,
                        'total_documents': 0,
                        'successful_uploads': 0,
                        'failed_uploads': 0,
                        'last_check': None,
                        'current_status': 'Idle',
                        'updated_at': datetime.now().isoformat()
                    }
                
        except Exception as e:
            logger.error(f"Error getting stats: {e}")
            return {
                'total_emails': 0,
                'total_documents': 0,
                'successful_uploads': 0,
                'failed_uploads': 0,
                'last_check': None,
                'current_status': 'Error',
                'updated_at': datetime.now().isoformat()
            }
    
    def cleanup_old_records(self, days: int = 30) -> bool:
        """Clean up old records older than specified days"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                
                cutoff_date = datetime.now() - timedelta(days=days)
                cutoff_str = cutoff_date.isoformat()
                
                cursor.execute("""
                    DELETE FROM documents 
                    WHERE created_at < ?
                """, (cutoff_str,))
                
                deleted_count = cursor.rowcount
                conn.commit()
                
                logger.info(f"Cleaned up {deleted_count} old records")
                return True
                
        except Exception as e:
            logger.error(f"Error cleaning up old records: {e}")
            return False
    
    def get_database_size(self) -> Dict:
        """Get database size information"""
        try:
            file_size = os.path.getsize(self.db_path) if os.path.exists(self.db_path) else 0
            
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                
                cursor.execute("SELECT COUNT(*) FROM documents")
                doc_count = cursor.fetchone()[0]
                
                return {
                    'file_size_bytes': file_size,
                    'file_size_mb': round(file_size / (1024 * 1024), 2),
                    'document_count': doc_count
                }
                
        except Exception as e:
            logger.error(f"Error getting database size: {e}")
            return {
                'file_size_bytes': 0,
                'file_size_mb': 0,
                'document_count': 0
            }