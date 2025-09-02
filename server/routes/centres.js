const express = require('express');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const pool = require('../config/database');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/svg+xml', 'application/pdf'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only JPG, PNG, SVG, and PDF files are allowed.'));
        }
    }
});

// Register new center (public endpoint)
router.post('/register', async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        const { center, manager } = req.body;
        
        if (!center.name || !center.email || !manager.username || !manager.email || !manager.password) {
            return res.status(400).json({ message: 'Missing required fields' });
        }

        // Check if center name already exists
        const existingCenter = await client.query(
            'SELECT id FROM centres WHERE name = $1',
            [center.name]
        );
        
        if (existingCenter.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: 'A center with this name already exists' });
        }

        // Check if username already exists
        const existingUser = await client.query(
            'SELECT id FROM users WHERE username = $1 OR email = $2',
            [manager.username, manager.email]
        );
        
        if (existingUser.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: 'Username or email already exists' });
        }

        // Create center
        const centerResult = await client.query(
            `INSERT INTO centres (name, address, phone, email, letterhead_address, letterhead_contact)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING id`,
            [center.name, center.address, center.phone, center.email, center.letterhead_address, center.letterhead_contact]
        );

        const centerId = centerResult.rows[0].id;

        // Hash password
        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(manager.password, saltRounds);

        // Create manager account
        await client.query(
            `INSERT INTO users (centre_id, username, email, password_hash, first_name, last_name, role, is_active)
             VALUES ($1, $2, $3, $4, $5, $6, 'manager', false)`, // Set to inactive until approved
            [centerId, manager.username, manager.email, passwordHash, manager.first_name, manager.last_name]
        );

        await client.query('COMMIT');
        
        res.status(201).json({
            message: 'Center registration submitted successfully. Account activation pending.',
            centerId: centerId
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Center registration error:', error);
        res.status(500).json({ message: 'Error registering center' });
    } finally {
        client.release();
    }
});

// Get centre details
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const centreId = req.params.id;
        
        // Check if user has access to this centre
        if (req.user.centre_id !== parseInt(centreId)) {
            return res.status(403).json({ message: 'Access denied to this centre' });
        }

        const result = await pool.query(
            'SELECT * FROM centres WHERE id = $1',
            [centreId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Centre not found' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Get centre error:', error);
        res.status(500).json({ message: 'Error fetching centre details' });
    }
});

// Update centre details (managers only)
router.put('/:id', authenticateToken, requireRole(['manager']), async (req, res) => {
    try {
        const centreId = req.params.id;
        const {
            name,
            address,
            phone,
            email,
            letterhead_logo,
            letterhead_address,
            letterhead_contact
        } = req.body;

        // Check if user has access to this centre
        if (req.user.centre_id !== parseInt(centreId)) {
            return res.status(403).json({ message: 'Access denied to this centre' });
        }

        const result = await pool.query(
            `UPDATE centres 
             SET name = $1, address = $2, phone = $3, email = $4, 
                 letterhead_logo = $5, letterhead_address = $6, letterhead_contact = $7,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $8 
             RETURNING *`,
            [name, address, phone, email, letterhead_logo, letterhead_address, letterhead_contact, centreId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Centre not found' });
        }

        res.json({
            message: 'Centre updated successfully',
            centre: result.rows[0]
        });
    } catch (error) {
        console.error('Update centre error:', error);
        res.status(500).json({ message: 'Error updating centre' });
    }
});

// Get current user's centre
router.get('/current', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM centres WHERE id = $1',
            [req.user.centre_id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Centre not found' });
        }

        const centre = result.rows[0];
        
        // Convert binary data to base64 for frontend display
        if (centre.letterhead_logo) {
            centre.letterhead_logo = centre.letterhead_logo.toString('base64');
        }
        if (centre.letterhead_template) {
            centre.letterhead_template = centre.letterhead_template.toString('base64');
        }

        res.json(centre);
    } catch (error) {
        console.error('Get current centre error:', error);
        res.status(500).json({ message: 'Error fetching centre details' });
    }
});

// Upload branding files
router.post('/upload-branding', authenticateToken, requireRole(['manager']), upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        const { type } = req.body;
        if (!['logo', 'letterhead'].includes(type)) {
            return res.status(400).json({ message: 'Invalid upload type' });
        }

        const fileBuffer = req.file.buffer;
        const fileName = req.file.originalname;
        const centreId = req.user.centre_id;

        let updateQuery, updateParams;
        if (type === 'logo') {
            updateQuery = `
                UPDATE centres 
                SET letterhead_logo = $1, logo_filename = $2, updated_at = CURRENT_TIMESTAMP
                WHERE id = $3 
                RETURNING *
            `;
            updateParams = [fileBuffer, fileName, centreId];
        } else {
            updateQuery = `
                UPDATE centres 
                SET letterhead_template = $1, letterhead_filename = $2, updated_at = CURRENT_TIMESTAMP
                WHERE id = $3 
                RETURNING *
            `;
            updateParams = [fileBuffer, fileName, centreId];
        }

        const result = await pool.query(updateQuery, updateParams);

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Centre not found' });
        }

        res.json({
            message: `${type} uploaded successfully`,
            centre: result.rows[0]
        });
    } catch (error) {
        console.error('Upload branding error:', error);
        res.status(500).json({ message: 'Error uploading file' });
    }
});

// Delete branding files
router.delete('/branding/:type', authenticateToken, requireRole(['manager']), async (req, res) => {
    try {
        const { type } = req.params;
        if (!['logo', 'letterhead'].includes(type)) {
            return res.status(400).json({ message: 'Invalid branding type' });
        }

        const centreId = req.user.centre_id;
        let updateQuery;

        if (type === 'logo') {
            updateQuery = `
                UPDATE centres 
                SET letterhead_logo = NULL, logo_filename = NULL, updated_at = CURRENT_TIMESTAMP
                WHERE id = $1 
                RETURNING *
            `;
        } else {
            updateQuery = `
                UPDATE centres 
                SET letterhead_template = NULL, letterhead_filename = NULL, updated_at = CURRENT_TIMESTAMP
                WHERE id = $1 
                RETURNING *
            `;
        }

        const result = await pool.query(updateQuery, [centreId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Centre not found' });
        }

        res.json({
            message: `${type} deleted successfully`,
            centre: result.rows[0]
        });
    } catch (error) {
        console.error('Delete branding error:', error);
        res.status(500).json({ message: 'Error deleting branding' });
    }
});

// Update letterhead information
router.put('/letterhead', authenticateToken, requireRole(['manager']), async (req, res) => {
    try {
        const { letterhead_address, letterhead_contact } = req.body;
        const centreId = req.user.centre_id;

        const result = await pool.query(
            `UPDATE centres 
             SET letterhead_address = $1, letterhead_contact = $2, updated_at = CURRENT_TIMESTAMP
             WHERE id = $3 
             RETURNING *`,
            [letterhead_address, letterhead_contact, centreId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Centre not found' });
        }

        res.json({
            message: 'Letterhead information updated successfully',
            centre: result.rows[0]
        });
    } catch (error) {
        console.error('Update letterhead error:', error);
        res.status(500).json({ message: 'Error updating letterhead information' });
    }
});

// Download letterhead template
router.get('/letterhead-download', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT letterhead_template, letterhead_filename FROM centres WHERE id = $1',
            [req.user.centre_id]
        );

        if (result.rows.length === 0 || !result.rows[0].letterhead_template) {
            return res.status(404).json({ message: 'Letterhead template not found' });
        }

        const template = result.rows[0].letterhead_template;
        const filename = result.rows[0].letterhead_filename || 'letterhead-template.pdf';

        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(template);
    } catch (error) {
        console.error('Download letterhead error:', error);
        res.status(500).json({ message: 'Error downloading letterhead template' });
    }
});

// Get centre statistics
router.get('/:id/stats', authenticateToken, async (req, res) => {
    try {
        const centreId = req.params.id;
        
        if (req.user.centre_id !== parseInt(centreId)) {
            return res.status(403).json({ message: 'Access denied to this centre' });
        }

        const stats = await pool.query(`
            SELECT 
                (SELECT COUNT(*) FROM users WHERE centre_id = $1 AND is_active = true) as active_users,
                (SELECT COUNT(*) FROM clients WHERE centre_id = $1) as total_clients,
                (SELECT COUNT(*) FROM cases WHERE centre_id = $1 AND status = 'active') as active_cases,
                (SELECT COUNT(*) FROM appointments WHERE case_id IN (SELECT id FROM cases WHERE centre_id = $1) AND appointment_date >= CURRENT_DATE) as upcoming_appointments,
                (SELECT COALESCE(SUM(total_debt), 0) FROM cases WHERE centre_id = $1 AND status = 'active') as total_debt_managed
        `, [centreId]);

        res.json(stats.rows[0]);
    } catch (error) {
        console.error('Get centre stats error:', error);
        res.status(500).json({ message: 'Error fetching centre statistics' });
    }
});

module.exports = router;
