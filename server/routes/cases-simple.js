const express = require('express');
const pool = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Get all cases for centre - simplified version
router.get('/', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                c.id,
                c.case_number,
                c.status,
                c.priority,
                c.debt_stage,
                c.total_debt,
                c.created_at,
                c.updated_at,
                cl.first_name || ' ' || cl.last_name as client_name
            FROM cases c
            JOIN clients cl ON c.client_id = cl.id
            WHERE c.centre_id = $1
            ORDER BY c.updated_at DESC
        `, [req.user.centre_id]);
        
        res.json(result.rows);
    } catch (error) {
        console.error('Get cases error:', error);
        res.status(500).json({ message: 'Error fetching cases', error: error.message });
    }
});

module.exports = router;