const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');
const { authenticateToken } = require('../middleware/auth');

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/bmp',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'), false);
    }
  }
});

// Upload document endpoint
router.post('/upload', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    const { caseId } = req.body;
    const file = req.file;
    
    if (!file || !caseId) {
      return res.status(400).json({ message: 'File and case ID required' });
    }

    // Forward to document inbox service
    const formData = new FormData();
    formData.append('file', new Blob([file.buffer]), file.originalname);
    formData.append('caseId', caseId);

    const response = await axios.post(
      `${process.env.DOCUMENT_INBOX_URL || 'http://localhost:3001'}/api/documents/upload`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      }
    );

    res.json(response.data);

  } catch (error) {
    console.error('Document upload error:', error);
    res.status(500).json({ 
      message: 'Upload failed', 
      error: error.response?.data?.message || error.message 
    });
  }
});

// Process OCR endpoint
router.post('/process-ocr', authenticateToken, async (req, res) => {
  try {
    const { fileId, caseId } = req.body;
    
    if (!fileId || !caseId) {
      return res.status(400).json({ message: 'File ID and case ID required' });
    }

    // Forward to OCR processor service
    const response = await axios.post(
      `${process.env.OCR_PROCESSOR_URL || 'http://localhost:3002'}/api/ocr/process`,
      req.body
    );

    res.json(response.data);

  } catch (error) {
    console.error('OCR processing error:', error);
    res.status(500).json({ 
      message: 'OCR processing failed', 
      error: error.response?.data?.message || error.message 
    });
  }
});

// Approve classification endpoint
router.post('/approve-classification', authenticateToken, async (req, res) => {
  try {
    const { fileId, approved, overrides, caseId } = req.body;
    const userId = req.user.id;
    
    if (!fileId || !caseId) {
      return res.status(400).json({ message: 'File ID and case ID required' });
    }

    // Store approval in database
    const query = `
      INSERT INTO document_classifications 
      (file_id, case_id, user_id, approved, overrides, created_at)
      VALUES ($1, $2, $3, $4, $5, NOW())
      ON CONFLICT (file_id) 
      DO UPDATE SET 
        approved = $3,
        overrides = $4,
        updated_at = NOW()
    `;
    
    await req.db.query(query, [
      fileId, 
      caseId, 
      userId, 
      approved, 
      JSON.stringify(overrides)
    ]);

    // If it's a debt document and approved, create/update debt record
    if (approved && overrides.creditorName && overrides.amount) {
      await handleDebtDocument(req.db, caseId, overrides, fileId);
    }

    res.json({ message: 'Classification approved successfully' });

  } catch (error) {
    console.error('Classification approval error:', error);
    res.status(500).json({ 
      message: 'Approval failed', 
      error: error.message 
    });
  }
});

// Generate case email endpoint
router.post('/case/:caseId/email', authenticateToken, async (req, res) => {
  try {
    const { caseId } = req.params;
    
    // Forward to document inbox service
    const response = await axios.post(
      `${process.env.DOCUMENT_INBOX_URL || 'http://localhost:3001'}/api/cases/${caseId}/email`
    );

    res.json(response.data);

  } catch (error) {
    console.error('Email generation error:', error);
    res.status(500).json({ 
      message: 'Email generation failed', 
      error: error.response?.data?.message || error.message 
    });
  }
});

// Get case documents endpoint
router.get('/case/:caseId', authenticateToken, async (req, res) => {
  try {
    const { caseId } = req.params;
    
    const query = `
      SELECT 
        d.*,
        dc.approved,
        dc.overrides,
        u.first_name || ' ' || u.last_name as processed_by
      FROM documents d
      LEFT JOIN document_classifications dc ON d.file_id = dc.file_id
      LEFT JOIN users u ON dc.user_id = u.id
      WHERE d.case_id = $1
      ORDER BY d.created_at DESC
    `;
    
    const result = await req.db.query(query, [caseId]);
    res.json(result.rows);

  } catch (error) {
    console.error('Get documents error:', error);
    res.status(500).json({ 
      message: 'Failed to fetch documents', 
      error: error.message 
    });
  }
});

// Helper function to handle debt documents
const handleDebtDocument = async (db, caseId, overrides, fileId) => {
  try {
    // Check if debt already exists
    const existingDebt = await db.query(
      'SELECT id FROM debts WHERE case_id = $1 AND creditor_name ILIKE $2',
      [caseId, overrides.creditorName]
    );

    if (existingDebt.rows.length > 0) {
      // Update existing debt
      await db.query(`
        UPDATE debts 
        SET 
          current_balance = $1,
          is_priority = $2,
          updated_at = NOW(),
          source_document = $3
        WHERE id = $4
      `, [
        parseFloat(overrides.amount.replace(/[£,]/g, '')),
        overrides.priority === 'priority',
        fileId,
        existingDebt.rows[0].id
      ]);
    } else {
      // Create new debt
      await db.query(`
        INSERT INTO debts 
        (case_id, creditor_name, current_balance, is_priority, source_document, created_at)
        VALUES ($1, $2, $3, $4, $5, NOW())
      `, [
        caseId,
        overrides.creditorName,
        parseFloat(overrides.amount.replace(/[£,]/g, '')),
        overrides.priority === 'priority',
        fileId
      ]);
    }
  } catch (error) {
    console.error('Error handling debt document:', error);
    throw error;
  }
};

module.exports = router;
