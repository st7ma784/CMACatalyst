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

// Income routes
router.get('/:id/income', authenticateToken, async (req, res) => {
    try {
        const clientId = req.params.id;
        const result = await pool.query(
            'SELECT * FROM client_income WHERE client_id = $1 ORDER BY created_at DESC',
            [clientId]
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Get client income error:', error);
        res.status(500).json({ message: 'Error fetching client income' });
    }
});

router.post('/:id/income', authenticateToken, async (req, res) => {
    try {
        const clientId = req.params.id;
        const { source, amount, frequency, type } = req.body;
        
        const result = await pool.query(
            'INSERT INTO client_income (client_id, source, amount, frequency, type) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [clientId, source, amount, frequency, type]
        );
        
        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Add client income error:', error);
        res.status(500).json({ message: 'Error adding income' });
    }
});

// Expenditure routes
router.get('/:id/expenditure', authenticateToken, async (req, res) => {
    try {
        const clientId = req.params.id;
        const result = await pool.query(
            'SELECT * FROM client_expenditure WHERE client_id = $1 ORDER BY created_at DESC',
            [clientId]
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Get client expenditure error:', error);
        res.status(500).json({ message: 'Error fetching client expenditure' });
    }
});

router.post('/:id/expenditure', authenticateToken, async (req, res) => {
    try {
        const clientId = req.params.id;
        const { category, amount, frequency, description } = req.body;
        
        const result = await pool.query(
            'INSERT INTO client_expenditure (client_id, category, amount, frequency, description) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [clientId, category, amount, frequency, description]
        );
        
        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Add client expenditure error:', error);
        res.status(500).json({ message: 'Error adding expenditure' });
    }
});

// Debts routes
router.get('/:id/debts', authenticateToken, async (req, res) => {
    try {
        const clientId = req.params.id;
        const result = await pool.query(
            'SELECT * FROM client_debts WHERE client_id = $1 ORDER BY created_at DESC',
            [clientId]
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Get client debts error:', error);
        res.status(500).json({ message: 'Error fetching client debts' });
    }
});

router.post('/:id/debts', authenticateToken, async (req, res) => {
    try {
        const clientId = req.params.id;
        const { creditor_name, debt_type, current_balance, minimum_payment, is_priority } = req.body;
        
        const result = await pool.query(
            'INSERT INTO client_debts (client_id, creditor_name, debt_type, current_balance, minimum_payment, is_priority) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
            [clientId, creditor_name, debt_type, current_balance, minimum_payment, is_priority]
        );
        
        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Add client debt error:', error);
        res.status(500).json({ message: 'Error adding debt' });
    }
});

// Savings routes (reusing assets table but filtering by type)
router.get('/:id/savings', authenticateToken, async (req, res) => {
    try {
        const clientId = req.params.id;
        const result = await pool.query(
            'SELECT * FROM client_assets WHERE client_id = $1 AND asset_type = \'savings\' ORDER BY created_at DESC',
            [clientId]
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Get client savings error:', error);
        res.status(500).json({ message: 'Error fetching client savings' });
    }
});

// Assets routes
router.get('/:id/assets', authenticateToken, async (req, res) => {
    try {
        const clientId = req.params.id;
        const result = await pool.query(
            'SELECT * FROM client_assets WHERE client_id = $1 ORDER BY created_at DESC',
            [clientId]
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Get client assets error:', error);
        res.status(500).json({ message: 'Error fetching client assets' });
    }
});

router.post('/:id/assets', authenticateToken, async (req, res) => {
    try {
        const clientId = req.params.id;
        const { asset_type, description, estimated_value, is_secured } = req.body;
        
        const result = await pool.query(
            'INSERT INTO client_assets (client_id, asset_type, description, estimated_value, is_secured) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [clientId, asset_type, description, estimated_value, is_secured]
        );
        
        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Add client asset error:', error);
        res.status(500).json({ message: 'Error adding asset' });
    }
});

// Caseworkers routes
router.get('/:id/caseworkers', authenticateToken, async (req, res) => {
    try {
        const clientId = req.params.id;
        const result = await pool.query(
            'SELECT * FROM client_caseworkers WHERE client_id = $1 ORDER BY created_at DESC',
            [clientId]
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Get client caseworkers error:', error);
        res.status(500).json({ message: 'Error fetching client caseworkers' });
    }
});

router.post('/:id/caseworkers', authenticateToken, async (req, res) => {
    try {
        const clientId = req.params.id;
        const { name, role, email, phone } = req.body;
        
        const result = await pool.query(
            'INSERT INTO client_caseworkers (client_id, name, role, email, phone) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [clientId, name, role, email, phone]
        );
        
        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Add client caseworker error:', error);
        res.status(500).json({ message: 'Error adding caseworker' });
    }
});

// Household members routes
router.get('/:id/household', authenticateToken, async (req, res) => {
    try {
        const clientId = req.params.id;
        const result = await pool.query(
            'SELECT * FROM client_household WHERE client_id = $1 ORDER BY created_at DESC',
            [clientId]
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Get client household error:', error);
        res.status(500).json({ message: 'Error fetching household members' });
    }
});

router.post('/:id/household', authenticateToken, async (req, res) => {
    try {
        const clientId = req.params.id;
        const { name, relationship, age, dependent } = req.body;
        
        const result = await pool.query(
            'INSERT INTO client_household (client_id, name, relationship, age, dependent) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [clientId, name, relationship, age, dependent]
        );
        
        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Add household member error:', error);
        res.status(500).json({ message: 'Error adding household member' });
    }
});

module.exports = router;
