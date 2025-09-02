const express = require('express');
const pool = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Get all creditors for centre
router.get('/', authenticateToken, async (req, res) => {
    try {
        const query = `
            SELECT c.*, 
                   COUNT(DISTINCT cc.case_id) as case_count
            FROM creditors c
            LEFT JOIN case_creditors cc ON c.id = cc.creditor_id
            WHERE c.centre_id = $1
            GROUP BY c.id
            ORDER BY c.name
        `;
        
        const result = await pool.query(query, [req.user.centre_id]);
        res.json(result.rows);
    } catch (error) {
        console.error('Get creditors error:', error);
        res.status(500).json({ message: 'Error fetching creditors' });
    }
});

// Get creditor by ID with correspondence history
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        
        const creditorQuery = `
            SELECT * FROM creditors 
            WHERE id = $1 AND centre_id = $2
        `;
        
        const creditorResult = await pool.query(creditorQuery, [id, req.user.centre_id]);
        
        if (creditorResult.rows.length === 0) {
            return res.status(404).json({ message: 'Creditor not found' });
        }
        
        res.json(creditorResult.rows[0]);
    } catch (error) {
        console.error('Get creditor error:', error);
        res.status(500).json({ message: 'Error fetching creditor' });
    }
});

// Get correspondence history for creditor
router.get('/:id/correspondence', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        
        const query = `
            SELECT ch.*, c.case_number, cl.first_name || ' ' || cl.last_name as client_name
            FROM creditor_correspondence ch
            JOIN cases c ON ch.case_id = c.id
            JOIN clients cl ON c.client_id = cl.id
            WHERE ch.creditor_id = $1 AND c.centre_id = $2
            ORDER BY ch.correspondence_date DESC
        `;
        
        const result = await pool.query(query, [id, req.user.centre_id]);
        res.json(result.rows);
    } catch (error) {
        console.error('Get correspondence error:', error);
        res.status(500).json({ message: 'Error fetching correspondence' });
    }
});

// Create new creditor
router.post('/', authenticateToken, async (req, res) => {
    try {
        const { 
            name, contact_person, phone, email, address, website, 
            notes, creditor_type, preferred_contact_method 
        } = req.body;
        
        const query = `
            INSERT INTO creditors (
                name, contact_person, phone, email, address, website, 
                notes, creditor_type, preferred_contact_method, centre_id
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING *
        `;
        
        const values = [
            name,
            contact_person,
            phone,
            email,
            address,
            website,
            notes,
            creditor_type || 'credit_card',
            preferred_contact_method || 'email',
            req.user.centre_id
        ];
        
        const result = await pool.query(query, values);
        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Create creditor error:', error);
        res.status(500).json({ message: 'Error creating creditor' });
    }
});

// Update creditor
router.put('/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { 
            name, contact_person, phone, email, address, website, 
            notes, creditor_type, preferred_contact_method 
        } = req.body;
        
        const query = `
            UPDATE creditors 
            SET name = $1, contact_person = $2, phone = $3, email = $4, 
                address = $5, website = $6, notes = $7, creditor_type = $8, 
                preferred_contact_method = $9, updated_at = CURRENT_TIMESTAMP
            WHERE id = $10 AND centre_id = $11
            RETURNING *
        `;
        
        const values = [
            name, contact_person, phone, email, address, website, 
            notes, creditor_type, preferred_contact_method, id, req.user.centre_id
        ];
        
        const result = await pool.query(query, values);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Creditor not found' });
        }
        
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Update creditor error:', error);
        res.status(500).json({ message: 'Error updating creditor' });
    }
});

// Delete creditor
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        
        const result = await pool.query(
            'DELETE FROM creditors WHERE id = $1 AND centre_id = $2 RETURNING id',
            [id, req.user.centre_id]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Creditor not found' });
        }
        
        res.json({ message: 'Creditor deleted successfully' });
    } catch (error) {
        console.error('Delete creditor error:', error);
        res.status(500).json({ message: 'Error deleting creditor' });
    }
});

module.exports = router;
