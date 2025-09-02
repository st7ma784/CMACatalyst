const express = require('express');
const pool = require('../config/database');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// Get all letter templates for centre (managers only)
router.get('/', authenticateToken, requireRole(['manager']), async (req, res) => {
    try {
        const query = `
            SELECT * FROM letter_templates 
            WHERE centre_id = $1
            ORDER BY category, name
        `;
        
        const result = await pool.query(query, [req.user.centre_id]);
        res.json(result.rows);
    } catch (error) {
        console.error('Get letter templates error:', error);
        res.status(500).json({ message: 'Error fetching letter templates' });
    }
});

// Get active letter templates for advisors
router.get('/active', authenticateToken, async (req, res) => {
    try {
        const query = `
            SELECT * FROM letter_templates 
            WHERE centre_id = $1 AND is_active = true
            ORDER BY category, name
        `;
        
        const result = await pool.query(query, [req.user.centre_id]);
        res.json(result.rows);
    } catch (error) {
        console.error('Get active templates error:', error);
        res.status(500).json({ message: 'Error fetching active templates' });
    }
});

// Get template by ID
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        
        const query = `
            SELECT * FROM letter_templates 
            WHERE id = $1 AND centre_id = $2
        `;
        
        const result = await pool.query(query, [id, req.user.centre_id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Template not found' });
        }
        
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Get template error:', error);
        res.status(500).json({ message: 'Error fetching template' });
    }
});

// Create new letter template (managers only)
router.post('/', authenticateToken, requireRole(['manager']), async (req, res) => {
    try {
        const { 
            name, description, category, subject, content, 
            variables, is_active 
        } = req.body;
        
        const query = `
            INSERT INTO letter_templates (
                name, description, category, subject, content, 
                variables, is_active, centre_id, created_by
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING *
        `;
        
        const values = [
            name,
            description,
            category || 'general',
            subject,
            content,
            variables,
            is_active !== false,
            req.user.centre_id,
            req.user.id
        ];
        
        const result = await pool.query(query, values);
        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Create template error:', error);
        res.status(500).json({ message: 'Error creating template' });
    }
});

// Update letter template (managers only)
router.put('/:id', authenticateToken, requireRole(['manager']), async (req, res) => {
    try {
        const { id } = req.params;
        const { 
            name, description, category, subject, content, 
            variables, is_active 
        } = req.body;
        
        const query = `
            UPDATE letter_templates 
            SET name = $1, description = $2, category = $3, subject = $4, 
                content = $5, variables = $6, is_active = $7, updated_at = CURRENT_TIMESTAMP
            WHERE id = $8 AND centre_id = $9
            RETURNING *
        `;
        
        const values = [
            name, description, category, subject, content, 
            variables, is_active, id, req.user.centre_id
        ];
        
        const result = await pool.query(query, values);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Template not found' });
        }
        
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Update template error:', error);
        res.status(500).json({ message: 'Error updating template' });
    }
});

// Delete letter template (managers only)
router.delete('/:id', authenticateToken, requireRole(['manager']), async (req, res) => {
    try {
        const { id } = req.params;
        
        const result = await pool.query(
            'DELETE FROM letter_templates WHERE id = $1 AND centre_id = $2 RETURNING id',
            [id, req.user.centre_id]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Template not found' });
        }
        
        res.json({ message: 'Template deleted successfully' });
    } catch (error) {
        console.error('Delete template error:', error);
        res.status(500).json({ message: 'Error deleting template' });
    }
});

module.exports = router;
