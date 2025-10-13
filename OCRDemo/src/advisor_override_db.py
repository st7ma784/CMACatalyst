"""
Advisor Override Database Schema
Tracks corrections made by advisors to AI-detected debt amounts
"""

import sqlite3
import json
from datetime import datetime
from typing import Dict, List, Optional, Any
import logging

logger = logging.getLogger(__name__)

class AdvisorOverrideDB:
    def __init__(self, db_path: str = "/app/data/advisor_overrides.db"):
        self.db_path = db_path
        self.init_database()
    
    def init_database(self):
        """Initialize the advisor override database with required tables"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                
                # Create advisor_overrides table
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS advisor_overrides (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        email_id TEXT NOT NULL,
                        document_filename TEXT NOT NULL,
                        original_filename TEXT NOT NULL,
                        client_name TEXT,
                        case_number TEXT,
                        processing_timestamp TEXT,
                        advisor_id TEXT DEFAULT 'unknown',
                        override_timestamp TEXT NOT NULL,
                        original_extracted_text TEXT,
                        original_debts_json TEXT,
                        corrected_debts_json TEXT,
                        override_reason TEXT,
                        confidence_before REAL,
                        confidence_after REAL,
                        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                        UNIQUE(email_id, override_timestamp)
                    )
                """)
                
                # Create debt_corrections table for individual debt item changes
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS debt_corrections (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        override_id INTEGER,
                        debt_index INTEGER,
                        original_amount REAL,
                        corrected_amount REAL,
                        original_creditor TEXT,
                        corrected_creditor TEXT,
                        original_account_number TEXT,
                        corrected_account_number TEXT,
                        correction_type TEXT, -- 'amount', 'creditor', 'account', 'new', 'deleted'
                        advisor_notes TEXT,
                        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (override_id) REFERENCES advisor_overrides (id)
                    )
                """)
                
                # Create advisor_feedback table for learning
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS advisor_feedback (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        override_id INTEGER,
                        feedback_type TEXT, -- 'ocr_error', 'extraction_error', 'validation_error'
                        feedback_details TEXT,
                        suggested_improvement TEXT,
                        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (override_id) REFERENCES advisor_overrides (id)
                    )
                """)
                
                conn.commit()
                logger.info("Advisor override database initialized successfully")
                
        except Exception as e:
            logger.error(f"Error initializing advisor override database: {e}")
            raise
    
    def save_advisor_override(self, document_data: Dict, original_debts: List[Dict], 
                            corrected_debts: List[Dict], advisor_id: str = "unknown",
                            override_reason: str = "", advisor_notes: str = "") -> int:
        """
        Save an advisor override with original and corrected debt data
        
        Args:
            document_data: Document information from ProcessedDocument
            original_debts: AI-detected debts
            corrected_debts: Advisor-corrected debts
            advisor_id: ID of the advisor making the correction
            override_reason: Reason for the override
            advisor_notes: Additional advisor notes
            
        Returns:
            override_id: ID of the created override record
        """
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                
                # Insert main override record
                cursor.execute("""
                    INSERT OR REPLACE INTO advisor_overrides 
                    (email_id, document_filename, original_filename, client_name, case_number,
                     processing_timestamp, advisor_id, override_timestamp, original_extracted_text,
                     original_debts_json, corrected_debts_json, override_reason)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    document_data.get('email_id'),
                    document_data.get('processed_filename'),
                    document_data.get('original_filename'),
                    document_data.get('client_name'),
                    document_data.get('case_number'),
                    document_data.get('processing_timestamp'),
                    advisor_id,
                    datetime.now().isoformat(),
                    document_data.get('extracted_text'),
                    json.dumps(original_debts),
                    json.dumps(corrected_debts),
                    override_reason
                ))
                
                override_id = cursor.lastrowid
                
                # Track individual debt corrections
                self._save_debt_corrections(cursor, override_id, original_debts, corrected_debts, advisor_notes)
                
                conn.commit()
                logger.info(f"Advisor override saved with ID: {override_id}")
                return override_id
                
        except Exception as e:
            logger.error(f"Error saving advisor override: {e}")
            raise
    
    def _save_debt_corrections(self, cursor, override_id: int, original_debts: List[Dict], 
                              corrected_debts: List[Dict], advisor_notes: str):
        """Save individual debt corrections for detailed tracking"""
        
        # Track changes to existing debts
        for i, (orig, corr) in enumerate(zip(original_debts, corrected_debts[:len(original_debts)])):
            changes = []
            
            # Check for amount changes
            orig_amount = float(orig.get('amount', 0))
            corr_amount = float(corr.get('amount', 0))
            if abs(orig_amount - corr_amount) > 0.01:  # Avoid floating point issues
                cursor.execute("""
                    INSERT INTO debt_corrections 
                    (override_id, debt_index, original_amount, corrected_amount, 
                     original_creditor, corrected_creditor, original_account_number, 
                     corrected_account_number, correction_type, advisor_notes)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    override_id, i, orig_amount, corr_amount,
                    orig.get('creditor_name'), corr.get('creditor_name'),
                    orig.get('account_number'), corr.get('account_number'),
                    'amount', advisor_notes
                ))
            
            # Check for creditor changes
            if orig.get('creditor_name') != corr.get('creditor_name'):
                cursor.execute("""
                    INSERT INTO debt_corrections 
                    (override_id, debt_index, original_amount, corrected_amount,
                     original_creditor, corrected_creditor, correction_type, advisor_notes)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    override_id, i, orig_amount, corr_amount,
                    orig.get('creditor_name'), corr.get('creditor_name'),
                    'creditor', advisor_notes
                ))
            
            # Check for account number changes
            if orig.get('account_number') != corr.get('account_number'):
                cursor.execute("""
                    INSERT INTO debt_corrections 
                    (override_id, debt_index, original_amount, corrected_amount,
                     original_account_number, corrected_account_number, correction_type, advisor_notes)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    override_id, i, orig_amount, corr_amount,
                    orig.get('account_number'), corr.get('account_number'),
                    'account', advisor_notes
                ))
        
        # Track new debts added by advisor
        if len(corrected_debts) > len(original_debts):
            for i in range(len(original_debts), len(corrected_debts)):
                new_debt = corrected_debts[i]
                cursor.execute("""
                    INSERT INTO debt_corrections 
                    (override_id, debt_index, corrected_amount, corrected_creditor, 
                     corrected_account_number, correction_type, advisor_notes)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                """, (
                    override_id, i, float(new_debt.get('amount', 0)),
                    new_debt.get('creditor_name'), new_debt.get('account_number'),
                    'new', advisor_notes
                ))
    
    def get_override_history(self, email_id: str) -> List[Dict]:
        """Get override history for a specific document"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    SELECT * FROM advisor_overrides 
                    WHERE email_id = ? 
                    ORDER BY override_timestamp DESC
                """, (email_id,))
                
                columns = [desc[0] for desc in cursor.description]
                overrides = []
                
                for row in cursor.fetchall():
                    override_dict = dict(zip(columns, row))
                    override_dict['original_debts'] = json.loads(override_dict['original_debts_json'] or '[]')
                    override_dict['corrected_debts'] = json.loads(override_dict['corrected_debts_json'] or '[]')
                    overrides.append(override_dict)
                
                return overrides
                
        except Exception as e:
            logger.error(f"Error retrieving override history: {e}")
            return []
    
    def get_correction_analytics(self) -> Dict[str, Any]:
        """Get analytics on advisor corrections for system improvement"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                
                # Total overrides
                cursor.execute("SELECT COUNT(*) FROM advisor_overrides")
                total_overrides = cursor.fetchone()[0]
                
                # Most common correction types
                cursor.execute("""
                    SELECT correction_type, COUNT(*) as count 
                    FROM debt_corrections 
                    GROUP BY correction_type 
                    ORDER BY count DESC
                """)
                correction_types = dict(cursor.fetchall())
                
                # Average amount corrections
                cursor.execute("""
                    SELECT AVG(ABS(corrected_amount - original_amount)) as avg_correction
                    FROM debt_corrections 
                    WHERE correction_type = 'amount' AND original_amount IS NOT NULL
                """)
                avg_amount_correction = cursor.fetchone()[0] or 0
                
                # Most corrected creditors
                cursor.execute("""
                    SELECT original_creditor, COUNT(*) as correction_count
                    FROM debt_corrections 
                    WHERE correction_type = 'creditor' AND original_creditor IS NOT NULL
                    GROUP BY original_creditor 
                    ORDER BY correction_count DESC
                    LIMIT 10
                """)
                problem_creditors = dict(cursor.fetchall())
                
                return {
                    'total_overrides': total_overrides,
                    'correction_types': correction_types,
                    'avg_amount_correction': round(avg_amount_correction, 2),
                    'problem_creditors': problem_creditors,
                    'last_updated': datetime.now().isoformat()
                }
                
        except Exception as e:
            logger.error(f"Error generating correction analytics: {e}")
            return {}
    
    def has_override(self, email_id: str) -> bool:
        """Check if a document has any advisor overrides"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT COUNT(*) FROM advisor_overrides WHERE email_id = ?", (email_id,))
                return cursor.fetchone()[0] > 0
        except Exception as e:
            logger.error(f"Error checking for overrides: {e}")
            return False
    
    def get_latest_corrected_debts(self, email_id: str) -> Optional[List[Dict]]:
        """Get the latest corrected debts for a document"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    SELECT corrected_debts_json FROM advisor_overrides 
                    WHERE email_id = ? 
                    ORDER BY override_timestamp DESC 
                    LIMIT 1
                """, (email_id,))
                
                result = cursor.fetchone()
                if result and result[0]:
                    return json.loads(result[0])
                return None
                
        except Exception as e:
            logger.error(f"Error retrieving latest corrected debts: {e}")
            return None