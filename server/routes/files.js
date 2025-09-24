const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const pool = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, '../uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueName = `${uuidv4()}-${file.originalname}`;
        cb(null, uniqueName);
    }
});

const upload = multer({
    storage,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    },
    fileFilter: (req, file, cb) => {
        // Allow common document types
        const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|txt|xlsx|xls/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);

        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Invalid file type'));
        }
    }
});

// Get files for a case
router.get('/case/:caseId', authenticateToken, async (req, res) => {
    try {
        const caseId = req.params.caseId;

        const result = await pool.query(`
            SELECT f.*, u.first_name || ' ' || u.last_name as uploaded_by
            FROM files f
            JOIN users u ON f.user_id = u.id
            JOIN cases c ON f.case_id = c.id
            WHERE f.case_id = $1 AND c.centre_id = $2
            ORDER BY f.created_at DESC
        `, [caseId, req.user.centre_id]);

        res.json(result.rows);
    } catch (error) {
        console.error('Get files error:', error);
        res.status(500).json({ message: 'Error fetching files' });
    }
});

// Get files for a client
router.get('/client/:clientId', authenticateToken, async (req, res) => {
    try {
        const clientId = req.params.clientId;

        const result = await pool.query(`
            SELECT f.*, u.first_name || ' ' || u.last_name as uploaded_by
            FROM files f
            JOIN users u ON f.user_id = u.id
            JOIN clients c ON f.client_id = c.id
            WHERE f.client_id = $1 AND c.centre_id = $2
            ORDER BY f.created_at DESC
        `, [clientId, req.user.centre_id]);

        res.json(result.rows);
    } catch (error) {
        console.error('Get client files error:', error);
        res.status(500).json({ message: 'Error fetching client files' });
    }
});

// Upload file to case
router.post('/upload/:caseId', authenticateToken, upload.single('file'), async (req, res) => {
    try {
        const caseId = req.params.caseId;
        const { file_type, description } = req.body;

        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        // Verify case belongs to centre
        const caseCheck = await pool.query(
            'SELECT id FROM cases WHERE id = $1 AND centre_id = $2',
            [caseId, req.user.centre_id]
        );

        if (caseCheck.rows.length === 0) {
            return res.status(404).json({ message: 'Case not found' });
        }

        const result = await pool.query(`
            INSERT INTO files (
                case_id, user_id, filename, original_filename, file_path, 
                file_size, mime_type, file_type, description
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING *
        `, [
            caseId, req.user.id, req.file.filename, req.file.originalname,
            req.file.path, req.file.size, req.file.mimetype, file_type, description
        ]);

        res.status(201).json({
            message: 'File uploaded successfully',
            file: result.rows[0]
        });
    } catch (error) {
        console.error('Upload file error:', error);
        res.status(500).json({ message: 'Error uploading file' });
    }
});

// Upload file to client
router.post('/upload/client/:clientId', authenticateToken, upload.single('file'), async (req, res) => {
    try {
        const clientId = req.params.clientId;
        const { file_type, description } = req.body;

        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        // Verify client belongs to centre
        const clientCheck = await pool.query(
            'SELECT id FROM clients WHERE id = $1 AND centre_id = $2',
            [clientId, req.user.centre_id]
        );

        if (clientCheck.rows.length === 0) {
            return res.status(404).json({ message: 'Client not found' });
        }

        const result = await pool.query(`
            INSERT INTO files (
                client_id, user_id, filename, original_filename, file_path, 
                file_size, mime_type, file_type, description
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING *
        `, [
            clientId, req.user.id, req.file.filename, req.file.originalname,
            req.file.path, req.file.size, req.file.mimetype, file_type, description
        ]);

        res.status(201).json({
            message: 'File uploaded successfully',
            file: result.rows[0]
        });
    } catch (error) {
        console.error('Upload client file error:', error);
        res.status(500).json({ message: 'Error uploading file' });
    }
});

// Download file
router.get('/download/:id', authenticateToken, async (req, res) => {
    try {
        const fileId = req.params.id;

        // Try to get file from either case or client context
        const result = await pool.query(`
            SELECT f.*, COALESCE(c.centre_id, cl.centre_id) as centre_id
            FROM files f
            LEFT JOIN cases c ON f.case_id = c.id
            LEFT JOIN clients cl ON f.client_id = cl.id
            WHERE f.id = $1 AND COALESCE(c.centre_id, cl.centre_id) = $2
        `, [fileId, req.user.centre_id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'File not found' });
        }

        const file = result.rows[0];

        if (!fs.existsSync(file.file_path)) {
            return res.status(404).json({ message: 'File not found on disk' });
        }

        res.setHeader('Content-Disposition', `attachment; filename="${file.original_filename}"`);
        res.setHeader('Content-Type', file.mime_type);

        const fileStream = fs.createReadStream(file.file_path);
        fileStream.pipe(res);
    } catch (error) {
        console.error('Download file error:', error);
        res.status(500).json({ message: 'Error downloading file' });
    }
});

// Delete file
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        const fileId = req.params.id;

        const result = await pool.query(`
            SELECT f.*, c.centre_id
            FROM files f
            JOIN cases c ON f.case_id = c.id
            WHERE f.id = $1 AND c.centre_id = $2
        `, [fileId, req.user.centre_id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'File not found' });
        }

        const file = result.rows[0];

        // Delete from database
        await pool.query('DELETE FROM files WHERE id = $1', [fileId]);

        // Delete from disk
        if (fs.existsSync(file.file_path)) {
            fs.unlinkSync(file.file_path);
        }

        res.json({ message: 'File deleted successfully' });
    } catch (error) {
        console.error('Delete file error:', error);
        res.status(500).json({ message: 'Error deleting file' });
    }
});

module.exports = router;
