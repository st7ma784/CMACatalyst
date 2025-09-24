const express = require('express');
const pool = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Get notes for a case
router.get('/case/:caseId', authenticateToken, async (req, res) => {
    try {
        const caseId = req.params.caseId;

        const result = await pool.query(`
            SELECT n.*, u.first_name || ' ' || u.last_name as author_name
            FROM notes n
            JOIN users u ON n.user_id = u.id
            JOIN cases c ON n.case_id = c.id
            WHERE n.case_id = $1 AND c.centre_id = $2
            ORDER BY n.created_at DESC
        `, [caseId, req.user.centre_id]);

        res.json(result.rows);
    } catch (error) {
        console.error('Get notes error:', error);
        res.status(500).json({ message: 'Error fetching notes' });
    }
});

// Get notes for a client
router.get('/client/:clientId', authenticateToken, async (req, res) => {
    try {
        const clientId = req.params.clientId;

        const result = await pool.query(`
            SELECT n.*, u.first_name || ' ' || u.last_name as author_name
            FROM notes n
            JOIN users u ON n.user_id = u.id
            JOIN clients c ON n.client_id = c.id
            WHERE n.client_id = $1 AND c.centre_id = $2
            ORDER BY n.created_at DESC
        `, [clientId, req.user.centre_id]);

        res.json(result.rows);
    } catch (error) {
        console.error('Get client notes error:', error);
        res.status(500).json({ message: 'Error fetching client notes' });
    }
});

// Create note
router.post('/', authenticateToken, async (req, res) => {
    try {
        const { case_id, client_id, title, content, note_type = 'general', is_private = false } = req.body;

        if ((!case_id && !client_id) || !content) {
            return res.status(400).json({ message: 'Either Case ID or Client ID and content are required' });
        }

        if (case_id && client_id) {
            return res.status(400).json({ message: 'Cannot specify both case_id and client_id' });
        }

        let query, params;

        if (case_id) {
            // Verify case belongs to centre
            const caseCheck = await pool.query(
                'SELECT id FROM cases WHERE id = $1 AND centre_id = $2',
                [case_id, req.user.centre_id]
            );

            if (caseCheck.rows.length === 0) {
                return res.status(404).json({ message: 'Case not found' });
            }

            query = `INSERT INTO notes (case_id, user_id, title, content, note_type, is_private) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`;
            params = [case_id, req.user.id, title, content, note_type, is_private];
        } else {
            // Verify client belongs to centre
            const clientCheck = await pool.query(
                'SELECT id FROM clients WHERE id = $1 AND centre_id = $2',
                [client_id, req.user.centre_id]
            );

            if (clientCheck.rows.length === 0) {
                return res.status(404).json({ message: 'Client not found' });
            }

            query = `INSERT INTO notes (client_id, user_id, title, content, note_type, is_private) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`;
            params = [client_id, req.user.id, title, content, note_type, is_private];
        }

        const result = await pool.query(query, params);

        res.status(201).json({
            message: 'Note created successfully',
            note: result.rows[0]
        });
    } catch (error) {
        console.error('Create note error:', error);
        res.status(500).json({ message: 'Error creating note' });
    }
});

// Update note
router.put('/:id', authenticateToken, async (req, res) => {
    try {
        const noteId = req.params.id;
        const { title, content, note_type, is_private } = req.body;

        const result = await pool.query(`
            UPDATE notes SET 
                title = COALESCE($1, title),
                content = COALESCE($2, content),
                note_type = COALESCE($3, note_type),
                is_private = COALESCE($4, is_private),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $5 AND user_id = $6
            RETURNING *
        `, [title, content, note_type, is_private, noteId, req.user.id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Note not found or access denied' });
        }

        res.json({
            message: 'Note updated successfully',
            note: result.rows[0]
        });
    } catch (error) {
        console.error('Update note error:', error);
        res.status(500).json({ message: 'Error updating note' });
    }
});

// Delete note
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        const noteId = req.params.id;

        const result = await pool.query(`
            DELETE FROM notes 
            WHERE id = $1 AND user_id = $2
            RETURNING id
        `, [noteId, req.user.id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Note not found or access denied' });
        }

        res.json({ message: 'Note deleted successfully' });
    } catch (error) {
        console.error('Delete note error:', error);
        res.status(500).json({ message: 'Error deleting note' });
    }
});

// Get note templates
router.get('/templates', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT * FROM note_templates 
            WHERE centre_id = $1 AND is_active = true
            ORDER BY name
        `, [req.user.centre_id]);

        res.json(result.rows);
    } catch (error) {
        console.error('Get note templates error:', error);
        res.status(500).json({ message: 'Error fetching note templates' });
    }
});

// Create note template
router.post('/templates', authenticateToken, async (req, res) => {
    try {
        const { name, content, template_type } = req.body;

        if (!name || !content) {
            return res.status(400).json({ message: 'Name and content are required' });
        }

        const result = await pool.query(`
            INSERT INTO note_templates (centre_id, name, content, template_type)
            VALUES ($1, $2, $3, $4)
            RETURNING *
        `, [req.user.centre_id, name, content, template_type]);

        res.status(201).json({
            message: 'Note template created successfully',
            template: result.rows[0]
        });
    } catch (error) {
        console.error('Create note template error:', error);
        res.status(500).json({ message: 'Error creating note template' });
    }
});

module.exports = router;
