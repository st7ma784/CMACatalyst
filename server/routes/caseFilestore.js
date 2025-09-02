const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const caseFilestoreService = require('../services/caseFilestore');
const { authenticateToken } = require('../middleware/auth');

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: async (req, file, cb) => {
        const uploadPath = path.join(process.env.FILE_STORAGE_PATH || './uploads', 'cases', req.params.caseId || 'temp');
        try {
            await fs.mkdir(uploadPath, { recursive: true });
            cb(null, uploadPath);
        } catch (error) {
            cb(error);
        }
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 50 * 1024 * 1024 // 50MB limit
    },
    fileFilter: (req, file, cb) => {
        // Allow common document types
        const allowedTypes = [
            'application/pdf',
            'image/jpeg',
            'image/jpg',
            'image/png',
            'image/tiff',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'text/plain'
        ];
        
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only PDF, images, Word documents, and text files are allowed.'));
        }
    }
});

// Initialize folder structure for a case
router.post('/:caseId/initialize', authenticateToken, async (req, res) => {
    try {
        const { caseId } = req.params;
        const folderMap = await caseFilestoreService.initializeCaseFolders(caseId, req.user.id);
        
        res.json({
            message: 'Case folder structure initialized successfully',
            folders: Array.from(folderMap.entries()).map(([path, id]) => ({ path, id }))
        });
    } catch (error) {
        console.error('Initialize folders error:', error);
        res.status(500).json({ error: 'Failed to initialize folder structure' });
    }
});

// Get folder structure for a case
router.get('/:caseId/folders', authenticateToken, async (req, res) => {
    try {
        const { caseId } = req.params;
        const folderStructure = await caseFilestoreService.getCaseFolderStructure(caseId);
        
        res.json({ folders: folderStructure });
    } catch (error) {
        console.error('Get folders error:', error);
        res.status(500).json({ error: 'Failed to retrieve folder structure' });
    }
});

// Create a new folder
router.post('/:caseId/folders', authenticateToken, async (req, res) => {
    try {
        const { caseId } = req.params;
        const { folderName, parentPath } = req.body;
        
        if (!folderName) {
            return res.status(400).json({ error: 'Folder name is required' });
        }
        
        const folder = await caseFilestoreService.createFolder(caseId, folderName, parentPath, req.user.id);
        
        res.status(201).json({ folder });
    } catch (error) {
        console.error('Create folder error:', error);
        res.status(500).json({ error: 'Failed to create folder' });
    }
});

// Upload file to specific folder
router.post('/:caseId/folders/:folderId/upload', authenticateToken, upload.single('file'), async (req, res) => {
    try {
        const { caseId, folderId } = req.params;
        const { description, documentCategory, documentSubcategory } = req.body;
        
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        // Calculate file hash for duplicate detection
        const fileHash = await caseFilestoreService.calculateFileHash(req.file.path);
        
        // Check for duplicates
        const duplicates = await caseFilestoreService.checkForDuplicates(caseId, fileHash);
        if (duplicates.length > 0) {
            // Delete uploaded file since it's a duplicate
            await fs.unlink(req.file.path);
            return res.status(409).json({ 
                error: 'Duplicate file detected',
                existingFiles: duplicates
            });
        }

        // Insert file record
        const pool = require('../config/database');
        const client = await pool.connect();
        
        try {
            const result = await client.query(`
                INSERT INTO files (
                    case_id, filename, original_filename, file_path, file_size, mime_type,
                    folder_id, document_category, document_subcategory, file_hash,
                    description, uploaded_by
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                RETURNING *
            `, [
                caseId,
                req.file.filename,
                req.file.originalname,
                req.file.path,
                req.file.size,
                req.file.mimetype,
                folderId,
                documentCategory,
                documentSubcategory,
                fileHash,
                description,
                req.user.id
            ]);

            const fileRecord = result.rows[0];

            // Log the upload action
            await caseFilestoreService.logDocumentAction(
                fileRecord.id, 
                'uploaded', 
                req.user.id, 
                { 
                    folder_id: folderId,
                    file_size: req.file.size,
                    mime_type: req.file.mimetype
                },
                req
            );

            res.status(201).json({ file: fileRecord });
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('File upload error:', error);
        // Clean up uploaded file on error
        if (req.file) {
            try {
                await fs.unlink(req.file.path);
            } catch (unlinkError) {
                console.error('Error deleting uploaded file:', unlinkError);
            }
        }
        res.status(500).json({ error: 'Failed to upload file' });
    }
});

// Move file to different folder
router.put('/files/:fileId/move', authenticateToken, async (req, res) => {
    try {
        const { fileId } = req.params;
        const { folderId } = req.body;
        
        if (!folderId) {
            return res.status(400).json({ error: 'Target folder ID is required' });
        }
        
        await caseFilestoreService.moveFileToFolder(fileId, folderId, req.user.id);
        
        res.json({ message: 'File moved successfully' });
    } catch (error) {
        console.error('Move file error:', error);
        res.status(500).json({ error: 'Failed to move file' });
    }
});

// Auto-organize file based on document type
router.put('/files/:fileId/auto-organize', authenticateToken, async (req, res) => {
    try {
        const { fileId } = req.params;
        const { documentType, documentSubcategory, caseId } = req.body;
        
        const folderId = await caseFilestoreService.autoOrganizeFile(
            fileId, 
            documentType, 
            documentSubcategory, 
            caseId, 
            req.user.id
        );
        
        if (folderId) {
            res.json({ message: 'File organized successfully', folderId });
        } else {
            res.status(404).json({ error: 'Target folder not found' });
        }
    } catch (error) {
        console.error('Auto-organize error:', error);
        res.status(500).json({ error: 'Failed to auto-organize file' });
    }
});

// Get files in a folder
router.get('/folders/:folderId/files', authenticateToken, async (req, res) => {
    try {
        const { folderId } = req.params;
        const { includeSubfolders } = req.query;
        
        const files = await caseFilestoreService.getFilesInFolder(
            folderId, 
            includeSubfolders === 'true'
        );
        
        res.json({ files });
    } catch (error) {
        console.error('Get folder files error:', error);
        res.status(500).json({ error: 'Failed to retrieve files' });
    }
});

// Search files in case
router.get('/:caseId/search', authenticateToken, async (req, res) => {
    try {
        const { caseId } = req.params;
        const { q: searchTerm, category, folderId, dateFrom, dateTo } = req.query;
        
        const filters = {
            category,
            folderId: folderId ? parseInt(folderId) : undefined,
            dateFrom,
            dateTo
        };
        
        const files = await caseFilestoreService.searchCaseFiles(caseId, searchTerm, filters);
        
        res.json({ files });
    } catch (error) {
        console.error('Search files error:', error);
        res.status(500).json({ error: 'Failed to search files' });
    }
});

// Get file audit history
router.get('/files/:fileId/audit', authenticateToken, async (req, res) => {
    try {
        const { fileId } = req.params;
        const auditHistory = await caseFilestoreService.getFileAuditHistory(fileId);
        
        res.json({ auditHistory });
    } catch (error) {
        console.error('Get audit history error:', error);
        res.status(500).json({ error: 'Failed to retrieve audit history' });
    }
});

// Add tag to file
router.post('/files/:fileId/tags', authenticateToken, async (req, res) => {
    try {
        const { fileId } = req.params;
        const { tagName } = req.body;
        
        if (!tagName) {
            return res.status(400).json({ error: 'Tag name is required' });
        }
        
        const tagId = await caseFilestoreService.addFileTag(fileId, tagName, req.user.id);
        
        res.status(201).json({ tagId, tagName });
    } catch (error) {
        console.error('Add tag error:', error);
        res.status(500).json({ error: 'Failed to add tag' });
    }
});

// Create new file version
router.post('/files/:fileId/versions', authenticateToken, upload.single('file'), async (req, res) => {
    try {
        const { fileId } = req.params;
        
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        
        const newVersion = await caseFilestoreService.createFileVersion(
            fileId, 
            req.file.path, 
            req.user.id
        );
        
        res.status(201).json({ file: newVersion });
    } catch (error) {
        console.error('Create version error:', error);
        // Clean up uploaded file on error
        if (req.file) {
            try {
                await fs.unlink(req.file.path);
            } catch (unlinkError) {
                console.error('Error deleting uploaded file:', unlinkError);
            }
        }
        res.status(500).json({ error: 'Failed to create file version' });
    }
});

// Get all document tags
router.get('/tags', authenticateToken, async (req, res) => {
    try {
        const pool = require('../config/database');
        const result = await pool.query(`
            SELECT dt.*, u.name as created_by_name,
                   COUNT(ft.file_id) as usage_count
            FROM document_tags dt
            LEFT JOIN users u ON dt.created_by = u.id
            LEFT JOIN file_tags ft ON dt.id = ft.tag_id
            GROUP BY dt.id, u.name
            ORDER BY dt.tag_name
        `);
        
        res.json({ tags: result.rows });
    } catch (error) {
        console.error('Get tags error:', error);
        res.status(500).json({ error: 'Failed to retrieve tags' });
    }
});

// Get case storage statistics
router.get('/:caseId/stats', authenticateToken, async (req, res) => {
    try {
        const { caseId } = req.params;
        const pool = require('../config/database');
        
        const result = await pool.query(`
            SELECT 
                COUNT(*) as total_files,
                SUM(file_size) as total_size,
                COUNT(DISTINCT document_category) as categories_count,
                COUNT(CASE WHEN is_generated = true THEN 1 END) as generated_files,
                COUNT(CASE WHEN is_generated = false THEN 1 END) as uploaded_files,
                MAX(uploaded_at) as last_upload
            FROM files 
            WHERE case_id = $1 AND is_current_version = true
        `, [caseId]);
        
        const folderResult = await pool.query(`
            SELECT COUNT(*) as folder_count
            FROM case_folders
            WHERE case_id = $1
        `, [caseId]);
        
        const stats = {
            ...result.rows[0],
            folder_count: folderResult.rows[0].folder_count
        };
        
        res.json({ stats });
    } catch (error) {
        console.error('Get stats error:', error);
        res.status(500).json({ error: 'Failed to retrieve statistics' });
    }
});

module.exports = router;
