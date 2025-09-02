const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { authenticateToken } = require('../middleware/auth');
const documentOCR = require('../services/documentOCR');
const db = require('../config/database');

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/documents/');
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|pdf|tiff/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);

        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Only image and PDF files are allowed'));
        }
    }
});

/**
 * POST /api/document-ocr/upload
 * Upload and process document with OCR
 */
router.post('/upload', authenticateToken, upload.single('document'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const { caseId, documentType = 'auto' } = req.body;

        if (!caseId) {
            return res.status(400).json({ error: 'Case ID is required' });
        }

        // Verify case exists and user has access
        const caseQuery = await db.query(
            'SELECT id FROM cases WHERE id = $1 AND centre_id = $2',
            [caseId, req.user.centre_id]
        );

        if (caseQuery.rows.length === 0) {
            return res.status(404).json({ error: 'Case not found' });
        }

        // Create file record
        const fileQuery = `
            INSERT INTO files (case_id, filename, original_name, file_path, file_size, uploaded_by)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id
        `;

        const fileResult = await db.query(fileQuery, [
            caseId,
            req.file.filename,
            req.file.originalname,
            req.file.path,
            req.file.size,
            req.user.id
        ]);

        const fileId = fileResult.rows[0].id;

        // Process document with OCR
        const ocrResult = await documentOCR.processDocument(
            fileId,
            req.file.path,
            documentType
        );

        if (ocrResult.success) {
            res.json({
                success: true,
                fileId,
                documentType: ocrResult.documentType,
                confidence: ocrResult.confidence,
                extractedData: ocrResult.parsedData,
                autoPopulationSuggestions: ocrResult.suggestions,
                message: 'Document processed successfully'
            });
        } else {
            res.status(500).json({
                success: false,
                error: 'OCR processing failed',
                details: ocrResult.error
            });
        }

    } catch (error) {
        console.error('Document upload error:', error);
        res.status(500).json({ error: 'Failed to process document' });
    }
});

/**
 * POST /api/document-ocr/apply-suggestions
 * Apply OCR suggestions to case data
 */
router.post('/apply-suggestions', authenticateToken, async (req, res) => {
    try {
        const { caseId, suggestions } = req.body;

        if (!caseId || !suggestions || !Array.isArray(suggestions)) {
            return res.status(400).json({ error: 'Case ID and suggestions array required' });
        }

        // Verify case access
        const caseQuery = await db.query(
            'SELECT id FROM cases WHERE id = $1 AND centre_id = $2',
            [caseId, req.user.centre_id]
        );

        if (caseQuery.rows.length === 0) {
            return res.status(404).json({ error: 'Case not found' });
        }

        const appliedSuggestions = [];

        for (const suggestion of suggestions) {
            if (suggestion.apply && suggestion.field && suggestion.value !== undefined) {
                try {
                    await this.applySuggestionToCase(caseId, suggestion, req.user.id);
                    appliedSuggestions.push(suggestion);
                } catch (error) {
                    console.error(`Failed to apply suggestion for field ${suggestion.field}:`, error);
                }
            }
        }

        res.json({
            success: true,
            appliedSuggestions,
            message: `Applied ${appliedSuggestions.length} suggestions successfully`
        });

    } catch (error) {
        console.error('Apply suggestions error:', error);
        res.status(500).json({ error: 'Failed to apply suggestions' });
    }
});

/**
 * Apply individual suggestion to case
 */
async function applySuggestionToCase(caseId, suggestion, userId) {
    const fieldMappings = {
        'bank_balance': {
            table: 'assets',
            field: 'estimated_value',
            type: 'Bank Account'
        },
        'monthly_benefits': {
            table: 'income',
            field: 'amount',
            type: 'Benefits'
        },
        'monthly_income': {
            table: 'income',
            field: 'amount',
            type: 'Employment'
        }
    };

    const mapping = fieldMappings[suggestion.field];
    if (!mapping) {
        throw new Error(`Unknown field mapping: ${suggestion.field}`);
    }

    if (mapping.table === 'assets') {
        await db.query(`
            INSERT INTO assets (case_id, asset_type, estimated_value, created_by)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (case_id, asset_type) 
            DO UPDATE SET estimated_value = $3, updated_at = NOW()
        `, [caseId, mapping.type, suggestion.value, userId]);
    } else if (mapping.table === 'income') {
        await db.query(`
            INSERT INTO income (case_id, income_type, amount, frequency, created_by)
            VALUES ($1, $2, $3, 'monthly', $4)
            ON CONFLICT (case_id, income_type) 
            DO UPDATE SET amount = $3, updated_at = NOW()
        `, [caseId, mapping.type, suggestion.value, userId]);
    }
}

/**
 * GET /api/document-ocr/status/:jobId
 * Get OCR processing job status
 */
router.get('/status/:jobId', authenticateToken, async (req, res) => {
    try {
        const { jobId } = req.params;

        const query = `
            SELECT dpj.*, f.case_id
            FROM document_processing_jobs dpj
            JOIN files f ON dpj.file_id = f.id
            JOIN cases c ON f.case_id = c.id
            WHERE dpj.id = $1 AND c.centre_id = $2
        `;

        const result = await db.query(query, [jobId, req.user.centre_id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Processing job not found' });
        }

        const job = result.rows[0];
        res.json({
            jobId: job.id,
            status: job.processing_status,
            confidence: job.ocr_confidence,
            extractedData: job.extracted_data,
            createdAt: job.created_at,
            completedAt: job.completed_at
        });

    } catch (error) {
        console.error('Processing status error:', error);
        res.status(500).json({ error: 'Failed to get processing status' });
    }
});

/**
 * GET /api/document-ocr/case/:caseId/processed-documents
 * Get all processed documents for a case
 */
router.get('/case/:caseId/processed-documents', authenticateToken, async (req, res) => {
    try {
        const { caseId } = req.params;

        // Verify case access
        const caseQuery = await db.query(
            'SELECT id FROM cases WHERE id = $1 AND centre_id = $2',
            [caseId, req.user.centre_id]
        );

        if (caseQuery.rows.length === 0) {
            return res.status(404).json({ error: 'Case not found' });
        }

        const query = `
            SELECT 
                f.id as file_id,
                f.original_name,
                f.uploaded_at,
                dpj.processing_status,
                dpj.ocr_confidence,
                dpj.extracted_data
            FROM files f
            LEFT JOIN document_processing_jobs dpj ON f.id = dpj.file_id
            WHERE f.case_id = $1 AND dpj.id IS NOT NULL
            ORDER BY f.uploaded_at DESC
        `;

        const result = await db.query(query, [caseId]);

        res.json({
            caseId: parseInt(caseId),
            processedDocuments: result.rows
        });

    } catch (error) {
        console.error('Processed documents error:', error);
        res.status(500).json({ error: 'Failed to fetch processed documents' });
    }
});

/**
 * POST /api/document-ocr/reprocess/:jobId
 * Reprocess document with different settings
 */
router.post('/reprocess/:jobId', authenticateToken, async (req, res) => {
    try {
        const { jobId } = req.params;
        const { documentType = 'auto' } = req.body;

        // Get file details and verify access
        const fileQuery = `
            SELECT f.*, c.centre_id
            FROM files f
            JOIN cases c ON f.case_id = c.id
            WHERE f.id = $1 AND c.centre_id = $2
        `;

        const fileResult = await db.query(fileQuery, [fileId, req.user.centre_id]);

        if (fileResult.rows.length === 0) {
            return res.status(404).json({ error: 'File not found' });
        }

        const file = fileResult.rows[0];

        // Check if file still exists
        try {
            await fs.access(file.file_path);
        } catch (error) {
            return res.status(404).json({ error: 'File no longer exists on disk' });
        }

        // Reprocess with OCR
        const ocrResult = await documentOCR.processDocument(
            fileId,
            file.file_path,
            documentType
        );

        if (ocrResult.success) {
            res.json({
                success: true,
                fileId: parseInt(fileId),
                documentType: ocrResult.documentType,
                confidence: ocrResult.confidence,
                extractedData: ocrResult.parsedData,
                autoPopulationSuggestions: ocrResult.suggestions,
                message: 'Document reprocessed successfully'
            });
        } else {
            res.status(500).json({
                success: false,
                error: 'OCR reprocessing failed',
                details: ocrResult.error
            });
        }

    } catch (error) {
        console.error('Document reprocess error:', error);
        res.status(500).json({ error: 'Failed to reprocess document' });
    }
});

module.exports = router;
