const express = require('express');
const pool = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Get appointments for centre
router.get('/', authenticateToken, async (req, res) => {
    try {
        const { start_date, end_date, user_id, user_ids, case_id, status } = req.query;

        let query = `
            SELECT a.*, 
                   c.first_name || ' ' || c.last_name as client_name,
                   cases.case_number,
                   u.first_name || ' ' || u.last_name as advisor_name
            FROM appointments a
            JOIN cases ON a.case_id = cases.id
            JOIN clients c ON cases.client_id = c.id
            JOIN users u ON a.user_id = u.id
            WHERE cases.centre_id = $1
        `;
        const params = [req.user.centre_id];

        if (start_date) {
            query += ` AND a.appointment_date >= $${params.length + 1}`;
            params.push(start_date);
        }
        if (end_date) {
            query += ` AND a.appointment_date <= $${params.length + 1}`;
            params.push(end_date);
        }
        if (user_id) {
            query += ` AND a.user_id = $${params.length + 1}`;
            params.push(user_id);
        }
        if (user_ids) {
            // Support multiple user IDs for multi-user calendar view
            const userIdArray = user_ids.split(',').map(id => parseInt(id)).filter(id => !isNaN(id));
            if (userIdArray.length > 0) {
                query += ` AND a.user_id = ANY($${params.length + 1})`;
                params.push(userIdArray);
            }
        }
        if (case_id) {
            query += ` AND a.case_id = $${params.length + 1}`;
            params.push(case_id);
        }
        if (status) {
            query += ` AND a.status = $${params.length + 1}`;
            params.push(status);
        }

        query += ' ORDER BY a.appointment_date ASC';

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error('Get appointments error:', error);
        res.status(500).json({ message: 'Error fetching appointments' });
    }
});

// Create appointment
router.post('/', authenticateToken, async (req, res) => {
    try {
        const {
            case_id,
            user_id,
            title,
            description,
            appointment_date,
            duration_minutes = 60,
            location,
            appointment_type = 'consultation'
        } = req.body;

        if (!case_id || !user_id || !title || !appointment_date) {
            return res.status(400).json({ message: 'Case ID, user ID, title, and appointment date are required' });
        }

        // Verify case belongs to centre
        const caseCheck = await pool.query(
            'SELECT id FROM cases WHERE id = $1 AND centre_id = $2',
            [case_id, req.user.centre_id]
        );

        if (caseCheck.rows.length === 0) {
            return res.status(404).json({ message: 'Case not found' });
        }

        // Verify user belongs to centre
        const userCheck = await pool.query(
            'SELECT id FROM users WHERE id = $1 AND centre_id = $2',
            [user_id, req.user.centre_id]
        );

        if (userCheck.rows.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }

        const result = await pool.query(`
            INSERT INTO appointments (
                case_id, user_id, title, description, appointment_date, 
                duration_minutes, location, appointment_type
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *
        `, [case_id, user_id, title, description, appointment_date, duration_minutes, location, appointment_type]);

        res.status(201).json({
            message: 'Appointment created successfully',
            appointment: result.rows[0]
        });
    } catch (error) {
        console.error('Create appointment error:', error);
        res.status(500).json({ message: 'Error creating appointment' });
    }
});

// Update appointment
router.put('/:id', authenticateToken, async (req, res) => {
    try {
        const appointmentId = req.params.id;
        const {
            title,
            description,
            appointment_date,
            duration_minutes,
            location,
            appointment_type,
            status,
            client_confirmed
        } = req.body;

        const result = await pool.query(`
            UPDATE appointments SET 
                title = COALESCE($1, title),
                description = COALESCE($2, description),
                appointment_date = COALESCE($3, appointment_date),
                duration_minutes = COALESCE($4, duration_minutes),
                location = COALESCE($5, location),
                appointment_type = COALESCE($6, appointment_type),
                status = COALESCE($7, status),
                client_confirmed = COALESCE($8, client_confirmed),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $9 AND case_id IN (SELECT id FROM cases WHERE centre_id = $10)
            RETURNING *
        `, [
            title, description, appointment_date, duration_minutes, location,
            appointment_type, status, client_confirmed, appointmentId, req.user.centre_id
        ]);

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Appointment not found' });
        }

        res.json({
            message: 'Appointment updated successfully',
            appointment: result.rows[0]
        });
    } catch (error) {
        console.error('Update appointment error:', error);
        res.status(500).json({ message: 'Error updating appointment' });
    }
});

// Delete appointment
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        const appointmentId = req.params.id;

        const result = await pool.query(`
            DELETE FROM appointments 
            WHERE id = $1 AND case_id IN (SELECT id FROM cases WHERE centre_id = $2)
            RETURNING id
        `, [appointmentId, req.user.centre_id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Appointment not found' });
        }

        res.json({ message: 'Appointment deleted successfully' });
    } catch (error) {
        console.error('Delete appointment error:', error);
        res.status(500).json({ message: 'Error deleting appointment' });
    }
});

// Get calendar view (grouped by date)
router.get('/calendar', authenticateToken, async (req, res) => {
    try {
        const { start_date, end_date, user_id, user_ids } = req.query;

        let query = `
            SELECT 
                DATE(a.appointment_date) as date,
                json_agg(
                    json_build_object(
                        'id', a.id,
                        'title', a.title,
                        'time', TO_CHAR(a.appointment_date, 'HH24:MI'),
                        'duration_minutes', a.duration_minutes,
                        'client_name', c.first_name || ' ' || c.last_name,
                        'case_number', cases.case_number,
                        'advisor_name', u.first_name || ' ' || u.last_name,
                        'status', a.status,
                        'client_confirmed', a.client_confirmed,
                        'appointment_type', a.appointment_type,
                        'location', a.location
                    ) ORDER BY a.appointment_date
                ) as appointments
            FROM appointments a
            JOIN cases ON a.case_id = cases.id
            JOIN clients c ON cases.client_id = c.id
            JOIN users u ON a.user_id = u.id
            WHERE cases.centre_id = $1
        `;
        const params = [req.user.centre_id];

        if (start_date) {
            query += ` AND a.appointment_date >= $${params.length + 1}`;
            params.push(start_date);
        }
        if (end_date) {
            query += ` AND a.appointment_date <= $${params.length + 1}`;
            params.push(end_date);
        }
        if (user_id) {
            query += ` AND a.user_id = $${params.length + 1}`;
            params.push(user_id);
        }
        if (user_ids) {
            // Support multiple user IDs for multi-user calendar view
            const userIdArray = user_ids.split(',').map(id => parseInt(id)).filter(id => !isNaN(id));
            if (userIdArray.length > 0) {
                query += ` AND a.user_id = ANY($${params.length + 1})`;
                params.push(userIdArray);
            }
        }

        query += ' GROUP BY DATE(a.appointment_date) ORDER BY date';

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error('Get calendar error:', error);
        res.status(500).json({ message: 'Error fetching calendar data' });
    }
});

module.exports = router;
