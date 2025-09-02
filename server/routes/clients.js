const express = require('express');
const pool = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Get all clients for centre
router.get('/', authenticateToken, async (req, res) => {
    try {
        const { search, page = 1, limit = 20 } = req.query;
        const offset = (page - 1) * limit;

        // Simplified query without complex joins that might hang
        let query = `SELECT * FROM clients WHERE centre_id = $1`;
        const params = [req.user.centre_id];

        if (search) {
            query += ` AND (first_name ILIKE $${params.length + 1} OR last_name ILIKE $${params.length + 1} OR email ILIKE $${params.length + 1})`;
            params.push(`%${search}%`);
        }

        query += ` ORDER BY last_name, first_name LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        params.push(limit, offset);

        const result = await pool.query(query, params);

        // Get total count
        let countQuery = 'SELECT COUNT(*) FROM clients WHERE centre_id = $1';
        const countParams = [req.user.centre_id];
        
        if (search) {
            countQuery += ' AND (first_name ILIKE $2 OR last_name ILIKE $2 OR email ILIKE $2)';
            countParams.push(`%${search}%`);
        }

        const countResult = await pool.query(countQuery, countParams);

        res.json({
            clients: result.rows,
            total: parseInt(countResult.rows[0].count),
            page: parseInt(page),
            limit: parseInt(limit)
        });
    } catch (error) {
        console.error('Get clients error:', error);
        res.status(500).json({ message: 'Error fetching clients' });
    }
});

// Get client by ID
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const clientId = req.params.id;

        const result = await pool.query(
            'SELECT * FROM clients WHERE id = $1 AND centre_id = $2',
            [clientId, req.user.centre_id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Client not found' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Get client error:', error);
        res.status(500).json({ message: 'Error fetching client' });
    }
});

// Validate phone number format
const validatePhoneNumber = (phone) => {
    if (!phone) return true; // Phone is optional
    
    // UK phone number patterns
    const ukPhoneRegex = /^(\+44\s?7\d{3}|\(?07\d{3}\)?)\s?\d{3}\s?\d{3}$|^(\+44\s?[1-9]\d{2,4}|\(?0[1-9]\d{2,4}\)?)\s?\d{3,6}$/;
    return ukPhoneRegex.test(phone.replace(/\s/g, ''));
};

// Check for duplicate clients
const checkDuplicateClient = async (centre_id, phone, email, national_insurance_number) => {
    const duplicateChecks = [];
    
    if (phone) {
        duplicateChecks.push(
            pool.query('SELECT id, first_name, last_name FROM clients WHERE centre_id = $1 AND phone = $2', [centre_id, phone])
        );
    }
    
    if (email) {
        duplicateChecks.push(
            pool.query('SELECT id, first_name, last_name FROM clients WHERE centre_id = $1 AND email = $2', [centre_id, email])
        );
    }
    
    if (national_insurance_number) {
        duplicateChecks.push(
            pool.query('SELECT id, first_name, last_name FROM clients WHERE centre_id = $1 AND national_insurance_number = $2', [centre_id, national_insurance_number])
        );
    }
    
    const results = await Promise.all(duplicateChecks);
    const duplicates = results.filter(result => result.rows.length > 0);
    
    return duplicates.length > 0 ? duplicates[0].rows[0] : null;
};

// Create new client
router.post('/', authenticateToken, async (req, res) => {
    try {
        const {
            first_name,
            last_name,
            date_of_birth,
            phone,
            email,
            address,
            national_insurance_number,
            relationship_status,
            dependents,
            employment_status
        } = req.body;

        if (!first_name || !last_name) {
            return res.status(400).json({ message: 'First name and last name are required' });
        }

        // Validate phone number
        if (phone && !validatePhoneNumber(phone)) {
            return res.status(400).json({ 
                message: 'Invalid phone number format. Please use a valid UK phone number.' 
            });
        }

        // Check for duplicates
        const duplicate = await checkDuplicateClient(req.user.centre_id, phone, email, national_insurance_number);
        if (duplicate) {
            return res.status(409).json({ 
                message: `A client with this information already exists: ${duplicate.first_name} ${duplicate.last_name}`,
                existing_client: duplicate
            });
        }

        const result = await pool.query(
            `INSERT INTO clients (
                centre_id, first_name, last_name, date_of_birth, phone, email, 
                address, national_insurance_number, relationship_status, dependents, employment_status
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            RETURNING *`,
            [
                req.user.centre_id, first_name, last_name, date_of_birth, phone, email,
                address, national_insurance_number, relationship_status, dependents, employment_status
            ]
        );

        res.status(201).json({
            message: 'Client created successfully',
            client: result.rows[0]
        });
    } catch (error) {
        console.error('Create client error:', error);
        if (error.code === '23505') { // Unique constraint violation
            res.status(409).json({ message: 'A client with this information already exists' });
        } else {
            res.status(500).json({ message: 'Error creating client' });
        }
    }
});

// Update client
router.put('/:id', authenticateToken, async (req, res) => {
    try {
        const clientId = req.params.id;
        const {
            first_name,
            last_name,
            date_of_birth,
            phone,
            email,
            address,
            national_insurance_number,
            relationship_status,
            dependents,
            employment_status
        } = req.body;

        const result = await pool.query(
            `UPDATE clients SET 
                first_name = $1, last_name = $2, date_of_birth = $3, phone = $4, email = $5,
                address = $6, national_insurance_number = $7, relationship_status = $8,
                dependents = $9, employment_status = $10, updated_at = CURRENT_TIMESTAMP
            WHERE id = $11 AND centre_id = $12
            RETURNING *`,
            [
                first_name, last_name, date_of_birth, phone, email, address,
                national_insurance_number, relationship_status, dependents, employment_status,
                clientId, req.user.centre_id
            ]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Client not found' });
        }

        res.json({
            message: 'Client updated successfully',
            client: result.rows[0]
        });
    } catch (error) {
        console.error('Update client error:', error);
        res.status(500).json({ message: 'Error updating client' });
    }
});

// Get client's cases
router.get('/:id/cases', authenticateToken, async (req, res) => {
    try {
        const clientId = req.params.id;

        const result = await pool.query(
            `SELECT c.*, u.first_name || ' ' || u.last_name as advisor_name
            FROM cases c
            LEFT JOIN users u ON c.assigned_advisor_id = u.id
            WHERE c.client_id = $1 AND c.centre_id = $2
            ORDER BY c.created_at DESC`,
            [clientId, req.user.centre_id]
        );

        res.json(result.rows);
    } catch (error) {
        console.error('Get client cases error:', error);
        res.status(500).json({ message: 'Error fetching client cases' });
    }
});

module.exports = router;
