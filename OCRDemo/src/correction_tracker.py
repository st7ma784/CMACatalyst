import os
import json
import logging
from typing import Dict, List, Optional
from datetime import datetime
import sqlite3
from pathlib import Path

logger = logging.getLogger(__name__)

class CorrectionTracker:
    """Track user corrections to model extractions for refinement and learning"""

    def __init__(self, db_path: Optional[str] = None):
        if db_path is None:
            db_path = os.getenv('CORRECTION_DB_PATH', '/app/data/corrections.db')

        self.db_path = db_path
        self._ensure_db_directory()
        self._initialize_database()

    def _ensure_db_directory(self):
        """Ensure the database directory exists"""
        db_dir = os.path.dirname(self.db_path)
        if db_dir:
            os.makedirs(db_dir, exist_ok=True)

    def _initialize_database(self):
        """Initialize the corrections database with required tables"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()

            # Table for corrections
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS corrections (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    document_id TEXT NOT NULL,
                    email_id TEXT NOT NULL,
                    original_filename TEXT NOT NULL,
                    correction_timestamp TEXT NOT NULL,
                    user_id TEXT,
                    correction_type TEXT NOT NULL,
                    field_name TEXT NOT NULL,
                    original_value TEXT,
                    corrected_value TEXT,
                    confidence_score REAL,
                    extraction_method TEXT,
                    notes TEXT,
                    status TEXT DEFAULT 'pending'
                )
            ''')

            # Table for full extraction corrections
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS extraction_corrections (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    document_id TEXT NOT NULL,
                    email_id TEXT NOT NULL,
                    original_filename TEXT NOT NULL,
                    correction_timestamp TEXT NOT NULL,
                    user_id TEXT,
                    original_json TEXT,
                    corrected_json TEXT,
                    extraction_method TEXT,
                    notes TEXT,
                    status TEXT DEFAULT 'pending',
                    review_status TEXT DEFAULT 'unreviewed'
                )
            ''')

            # Table for correction analytics
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS correction_analytics (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    field_name TEXT NOT NULL,
                    total_corrections INTEGER DEFAULT 0,
                    avg_confidence REAL,
                    last_correction_date TEXT,
                    extraction_method TEXT
                )
            ''')

            conn.commit()
            conn.close()
            logger.info(f"Correction database initialized at {self.db_path}")

        except Exception as e:
            logger.error(f"Error initializing correction database: {e}")
            raise

    def save_field_correction(
        self,
        document_id: str,
        email_id: str,
        original_filename: str,
        field_name: str,
        original_value: any,
        corrected_value: any,
        user_id: str = 'unknown',
        correction_type: str = 'field_correction',
        extraction_method: str = 'unknown',
        confidence_score: float = None,
        notes: str = ''
    ) -> int:
        """
        Save a field-level correction

        Returns:
            int: The correction ID
        """
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()

            correction_timestamp = datetime.now().isoformat()

            cursor.execute('''
                INSERT INTO corrections (
                    document_id, email_id, original_filename, correction_timestamp,
                    user_id, correction_type, field_name, original_value, corrected_value,
                    confidence_score, extraction_method, notes, status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                document_id, email_id, original_filename, correction_timestamp,
                user_id, correction_type, field_name, json.dumps(original_value),
                json.dumps(corrected_value), confidence_score, extraction_method,
                notes, 'pending'
            ))

            correction_id = cursor.lastrowid

            # Update analytics
            self._update_field_analytics(cursor, field_name, extraction_method, confidence_score)

            conn.commit()
            conn.close()

            logger.info(f"Saved field correction {correction_id} for document {document_id}, field {field_name}")
            return correction_id

        except Exception as e:
            logger.error(f"Error saving field correction: {e}")
            raise

    def save_extraction_correction(
        self,
        document_id: str,
        email_id: str,
        original_filename: str,
        original_json: Dict,
        corrected_json: Dict,
        user_id: str = 'unknown',
        extraction_method: str = 'unknown',
        notes: str = ''
    ) -> int:
        """
        Save a complete extraction correction

        Returns:
            int: The correction ID
        """
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()

            correction_timestamp = datetime.now().isoformat()

            cursor.execute('''
                INSERT INTO extraction_corrections (
                    document_id, email_id, original_filename, correction_timestamp,
                    user_id, original_json, corrected_json, extraction_method, notes,
                    status, review_status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                document_id, email_id, original_filename, correction_timestamp,
                user_id, json.dumps(original_json), json.dumps(corrected_json),
                extraction_method, notes, 'pending', 'unreviewed'
            ))

            correction_id = cursor.lastrowid
            conn.commit()
            conn.close()

            logger.info(f"Saved extraction correction {correction_id} for document {document_id}")
            return correction_id

        except Exception as e:
            logger.error(f"Error saving extraction correction: {e}")
            raise

    def _update_field_analytics(self, cursor, field_name: str, extraction_method: str, confidence_score: float):
        """Update analytics for a field"""
        try:
            # Check if analytics entry exists
            cursor.execute('''
                SELECT id, total_corrections, avg_confidence
                FROM correction_analytics
                WHERE field_name = ? AND extraction_method = ?
            ''', (field_name, extraction_method))

            result = cursor.fetchone()

            if result:
                # Update existing entry
                analytics_id, total_corrections, avg_confidence = result
                new_total = total_corrections + 1

                if confidence_score is not None and avg_confidence is not None:
                    new_avg = ((avg_confidence * total_corrections) + confidence_score) / new_total
                elif confidence_score is not None:
                    new_avg = confidence_score
                else:
                    new_avg = avg_confidence

                cursor.execute('''
                    UPDATE correction_analytics
                    SET total_corrections = ?, avg_confidence = ?, last_correction_date = ?
                    WHERE id = ?
                ''', (new_total, new_avg, datetime.now().isoformat(), analytics_id))
            else:
                # Create new entry
                cursor.execute('''
                    INSERT INTO correction_analytics (
                        field_name, total_corrections, avg_confidence,
                        last_correction_date, extraction_method
                    ) VALUES (?, ?, ?, ?, ?)
                ''', (field_name, 1, confidence_score, datetime.now().isoformat(), extraction_method))

        except Exception as e:
            logger.error(f"Error updating field analytics: {e}")

    def get_corrections_for_document(self, document_id: str) -> List[Dict]:
        """Get all corrections for a specific document"""
        try:
            conn = sqlite3.connect(self.db_path)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()

            cursor.execute('''
                SELECT * FROM corrections WHERE document_id = ?
                ORDER BY correction_timestamp DESC
            ''', (document_id,))

            corrections = [dict(row) for row in cursor.fetchall()]
            conn.close()

            return corrections

        except Exception as e:
            logger.error(f"Error getting corrections for document: {e}")
            return []

    def get_extraction_corrections_for_document(self, document_id: str) -> List[Dict]:
        """Get all extraction corrections for a specific document"""
        try:
            conn = sqlite3.connect(self.db_path)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()

            cursor.execute('''
                SELECT * FROM extraction_corrections WHERE document_id = ?
                ORDER BY correction_timestamp DESC
            ''', (document_id,))

            corrections = [dict(row) for row in cursor.fetchall()]

            # Parse JSON strings
            for correction in corrections:
                if correction['original_json']:
                    correction['original_json'] = json.loads(correction['original_json'])
                if correction['corrected_json']:
                    correction['corrected_json'] = json.loads(correction['corrected_json'])

            conn.close()
            return corrections

        except Exception as e:
            logger.error(f"Error getting extraction corrections for document: {e}")
            return []

    def get_field_analytics(self) -> List[Dict]:
        """Get analytics for all fields"""
        try:
            conn = sqlite3.connect(self.db_path)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()

            cursor.execute('''
                SELECT * FROM correction_analytics
                ORDER BY total_corrections DESC
            ''')

            analytics = [dict(row) for row in cursor.fetchall()]
            conn.close()

            return analytics

        except Exception as e:
            logger.error(f"Error getting field analytics: {e}")
            return []

    def get_corrections_for_training(
        self,
        extraction_method: Optional[str] = None,
        status: str = 'pending',
        limit: int = 100
    ) -> List[Dict]:
        """
        Get corrections suitable for model training

        Args:
            extraction_method: Filter by extraction method
            status: Filter by status (pending, reviewed, applied)
            limit: Maximum number of corrections to return
        """
        try:
            conn = sqlite3.connect(self.db_path)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()

            query = 'SELECT * FROM extraction_corrections WHERE status = ?'
            params = [status]

            if extraction_method:
                query += ' AND extraction_method = ?'
                params.append(extraction_method)

            query += ' ORDER BY correction_timestamp DESC LIMIT ?'
            params.append(limit)

            cursor.execute(query, params)
            corrections = [dict(row) for row in cursor.fetchall()]

            # Parse JSON strings
            for correction in corrections:
                if correction['original_json']:
                    correction['original_json'] = json.loads(correction['original_json'])
                if correction['corrected_json']:
                    correction['corrected_json'] = json.loads(correction['corrected_json'])

            conn.close()
            return corrections

        except Exception as e:
            logger.error(f"Error getting corrections for training: {e}")
            return []

    def mark_correction_applied(self, correction_id: int, correction_table: str = 'extraction_corrections'):
        """Mark a correction as applied"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()

            if correction_table == 'extraction_corrections':
                cursor.execute('''
                    UPDATE extraction_corrections
                    SET status = 'applied', review_status = 'reviewed'
                    WHERE id = ?
                ''', (correction_id,))
            else:
                cursor.execute('''
                    UPDATE corrections SET status = 'applied' WHERE id = ?
                ''', (correction_id,))

            conn.commit()
            conn.close()

            logger.info(f"Marked correction {correction_id} as applied")

        except Exception as e:
            logger.error(f"Error marking correction as applied: {e}")

    def get_correction_statistics(self) -> Dict:
        """Get overall correction statistics"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()

            # Total corrections
            cursor.execute('SELECT COUNT(*) FROM corrections')
            total_field_corrections = cursor.fetchone()[0]

            cursor.execute('SELECT COUNT(*) FROM extraction_corrections')
            total_extraction_corrections = cursor.fetchone()[0]

            # Corrections by status
            cursor.execute('''
                SELECT status, COUNT(*)
                FROM extraction_corrections
                GROUP BY status
            ''')
            status_counts = dict(cursor.fetchall())

            # Most corrected fields
            cursor.execute('''
                SELECT field_name, COUNT(*) as count
                FROM corrections
                GROUP BY field_name
                ORDER BY count DESC
                LIMIT 10
            ''')
            most_corrected_fields = [{'field': row[0], 'count': row[1]} for row in cursor.fetchall()]

            conn.close()

            return {
                'total_field_corrections': total_field_corrections,
                'total_extraction_corrections': total_extraction_corrections,
                'status_counts': status_counts,
                'most_corrected_fields': most_corrected_fields
            }

        except Exception as e:
            logger.error(f"Error getting correction statistics: {e}")
            return {}
