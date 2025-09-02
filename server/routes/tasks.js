const express = require('express');
const pool = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Get all tasks for centre
router.get('/', authenticateToken, async (req, res) => {
    try {
        const query = `
            SELECT t.*, 
                   u.first_name || ' ' || u.last_name as assigned_to_name,
                   c.case_number
            FROM tasks t
            LEFT JOIN users u ON t.assigned_to = u.id
            LEFT JOIN cases c ON t.case_id = c.id
            WHERE t.centre_id = $1
            ORDER BY t.created_at DESC
        `;
        
        const result = await pool.query(query, [req.user.centre_id]);
        res.json(result.rows);
    } catch (error) {
        console.error('Get tasks error:', error);
        res.status(500).json({ message: 'Error fetching tasks' });
    }
});

// Create new task
router.post('/', authenticateToken, async (req, res) => {
    try {
        const { title, description, priority, status, assigned_to, due_date, case_id } = req.body;
        
        const query = `
            INSERT INTO tasks (title, description, priority, status, assigned_to, due_date, case_id, centre_id, created_by)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING *
        `;
        
        const values = [
            title,
            description,
            priority || 'medium',
            status || 'pending',
            assigned_to || null,
            due_date || null,
            case_id || null,
            req.user.centre_id,
            req.user.id
        ];
        
        const result = await pool.query(query, values);
        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Create task error:', error);
        res.status(500).json({ message: 'Error creating task' });
    }
});

// Update task
router.put('/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { title, description, priority, status, assigned_to, due_date, case_id } = req.body;
        
        const query = `
            UPDATE tasks 
            SET title = $1, description = $2, priority = $3, status = $4, 
                assigned_to = $5, due_date = $6, case_id = $7, updated_at = CURRENT_TIMESTAMP
            WHERE id = $8 AND centre_id = $9
            RETURNING *
        `;
        
        const values = [
            title,
            description,
            priority,
            status,
            assigned_to || null,
            due_date || null,
            case_id || null,
            id,
            req.user.centre_id
        ];
        
        const result = await pool.query(query, values);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Task not found' });
        }
        
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Update task error:', error);
        res.status(500).json({ message: 'Error updating task' });
    }
});

// Delete task
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        
        const result = await pool.query(
            'DELETE FROM tasks WHERE id = $1 AND centre_id = $2 RETURNING id',
            [id, req.user.centre_id]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Task not found' });
        }
        
        res.json({ message: 'Task deleted successfully' });
    } catch (error) {
        console.error('Delete task error:', error);
        res.status(500).json({ message: 'Error deleting task' });
    }
});

module.exports = router;
