const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../config/database');
const { authenticateToken, requireRole, requireCentreAccess } = require('../middleware/auth');

const router = express.Router();

// Get all users in centre
router.get('/', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT id, username, email, first_name, last_name, role, is_active, created_at 
             FROM users 
             WHERE centre_id = $1 
             ORDER BY last_name, first_name`,
            [req.user.centre_id]
        );

        res.json(result.rows);
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ message: 'Error fetching users' });
    }
});

// Create new user (managers only)
router.post('/', authenticateToken, requireRole(['manager']), async (req, res) => {
    try {
        const {
            username,
            email,
            password,
            first_name,
            last_name,
            role = 'advisor'
        } = req.body;

        if (!username || !email || !password || !first_name || !last_name) {
            return res.status(400).json({ message: 'All fields are required' });
        }

        // Check if username or email already exists
        const existingUser = await pool.query(
            'SELECT id FROM users WHERE username = $1 OR email = $2',
            [username, email]
        );

        if (existingUser.rows.length > 0) {
            return res.status(400).json({ message: 'Username or email already exists' });
        }

        // Hash password
        const saltRounds = 12;
        const passwordHash = await bcrypt.hash(password, saltRounds);

        // Create user
        const result = await pool.query(
            `INSERT INTO users (centre_id, username, email, password_hash, first_name, last_name, role)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING id, username, email, first_name, last_name, role, is_active, created_at`,
            [req.user.centre_id, username, email, passwordHash, first_name, last_name, role]
        );

        res.status(201).json({
            message: 'User created successfully',
            user: result.rows[0]
        });
    } catch (error) {
        console.error('Create user error:', error);
        res.status(500).json({ message: 'Error creating user' });
    }
});

// Update user
router.put('/:id', authenticateToken, async (req, res) => {
    try {
        const userId = req.params.id;
        const { first_name, last_name, email, role, is_active } = req.body;

        // Check permissions - users can update themselves, managers can update anyone in their centre
        if (req.user.id !== parseInt(userId) && req.user.role !== 'manager') {
            return res.status(403).json({ message: 'Insufficient permissions' });
        }

        // Get user to check they're in the same centre
        const userCheck = await pool.query(
            'SELECT centre_id FROM users WHERE id = $1',
            [userId]
        );

        if (userCheck.rows.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (userCheck.rows[0].centre_id !== req.user.centre_id) {
            return res.status(403).json({ message: 'Access denied' });
        }

        // Build update query dynamically
        const updates = [];
        const values = [];
        let paramCount = 1;

        if (first_name !== undefined) {
            updates.push(`first_name = $${paramCount++}`);
            values.push(first_name);
        }
        if (last_name !== undefined) {
            updates.push(`last_name = $${paramCount++}`);
            values.push(last_name);
        }
        if (email !== undefined) {
            updates.push(`email = $${paramCount++}`);
            values.push(email);
        }
        if (role !== undefined && req.user.role === 'manager') {
            updates.push(`role = $${paramCount++}`);
            values.push(role);
        }
        if (is_active !== undefined && req.user.role === 'manager') {
            updates.push(`is_active = $${paramCount++}`);
            values.push(is_active);
        }

        if (updates.length === 0) {
            return res.status(400).json({ message: 'No valid fields to update' });
        }

        updates.push('updated_at = CURRENT_TIMESTAMP');
        values.push(userId);

        const result = await pool.query(
            `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramCount}
             RETURNING id, username, email, first_name, last_name, role, is_active, updated_at`,
            values
        );

        res.json({
            message: 'User updated successfully',
            user: result.rows[0]
        });
    } catch (error) {
        console.error('Update user error:', error);
        res.status(500).json({ message: 'Error updating user' });
    }
});

// Get user's appointments
router.get('/:id/appointments', authenticateToken, async (req, res) => {
    try {
        const userId = req.params.id;
        const { start_date, end_date } = req.query;

        // Check permissions
        if (req.user.id !== parseInt(userId) && req.user.role !== 'manager') {
            return res.status(403).json({ message: 'Insufficient permissions' });
        }

        let query = `
            SELECT a.*, c.first_name || ' ' || c.last_name as client_name, 
                   cases.case_number
            FROM appointments a
            JOIN cases ON a.case_id = cases.id
            JOIN clients c ON cases.client_id = c.id
            WHERE a.user_id = $1 AND cases.centre_id = $2
        `;
        const params = [userId, req.user.centre_id];

        if (start_date) {
            query += ` AND a.appointment_date >= $${params.length + 1}`;
            params.push(start_date);
        }
        if (end_date) {
            query += ` AND a.appointment_date <= $${params.length + 1}`;
            params.push(end_date);
        }

        query += ' ORDER BY a.appointment_date ASC';

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error('Get user appointments error:', error);
        res.status(500).json({ message: 'Error fetching appointments' });
    }
});

module.exports = router;
