const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

/**
 * Digital Referrals System
 * Allows clients to submit referrals through website forms
 */

/**
 * POST /api/digital-referrals/submit
 * Submit a new digital referral (public endpoint)
 */
router.post('/submit', async (req, res) => {
    try {
        const {
            firstName,
            lastName,
            email,
            phone,
            address,
            dateOfBirth,
            referralSource,
            urgencyLevel,
            problemDescription,
            preferredContact,
            consentGiven,
            centreId
        } = req.body;

        // Validate required fields
        if (!firstName || !lastName || !email || !consentGiven) {
            return res.status(400).json({ error: 'Required fields missing' });
        }

        // Create referral record
        const query = `
            INSERT INTO digital_referrals (
                first_name, last_name, email, phone, address, date_of_birth,
                referral_source, urgency_level, problem_description, 
                preferred_contact, consent_given, centre_id, status, submitted_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'pending', NOW())
            RETURNING id
        `;

        const result = await db.query(query, [
            firstName, lastName, email, phone, address, dateOfBirth,
            referralSource, urgencyLevel || 'medium', problemDescription,
            preferredContact || 'email', consentGiven, centreId
        ]);

        res.json({
            success: true,
            referralId: result.rows[0].id,
            message: 'Referral submitted successfully. We will contact you within 2 working days.'
        });

    } catch (error) {
        console.error('Error submitting digital referral:', error);
        res.status(500).json({ error: 'Failed to submit referral' });
    }
});

/**
 * GET /api/digital-referrals
 * Get all digital referrals for a centre
 */
router.get('/', authenticateToken, async (req, res) => {
    try {
        const { status, urgency, page = 1, limit = 20 } = req.query;
        const offset = (page - 1) * limit;

        let whereClause = 'WHERE centre_id = $1';
        const params = [req.user.centre_id];
        let paramCount = 1;

        if (status) {
            whereClause += ` AND status = $${++paramCount}`;
            params.push(status);
        }

        if (urgency) {
            whereClause += ` AND urgency_level = $${++paramCount}`;
            params.push(urgency);
        }

        const query = `
            SELECT 
                id, first_name, last_name, email, phone, 
                referral_source, urgency_level, status, 
                submitted_at, assigned_to, processed_at
            FROM digital_referrals 
            ${whereClause}
            ORDER BY 
                CASE urgency_level 
                    WHEN 'high' THEN 1 
                    WHEN 'medium' THEN 2 
                    WHEN 'low' THEN 3 
                END,
                submitted_at DESC
            LIMIT $${++paramCount} OFFSET $${++paramCount}
        `;

        params.push(limit, offset);

        const result = await db.query(query, params);

        // Get total count
        const countQuery = `
            SELECT COUNT(*) as total 
            FROM digital_referrals 
            ${whereClause}
        `;
        const countResult = await db.query(countQuery, params.slice(0, paramCount - 2));

        res.json({
            referrals: result.rows,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: parseInt(countResult.rows[0].total),
                pages: Math.ceil(countResult.rows[0].total / limit)
            }
        });

    } catch (error) {
        console.error('Error fetching digital referrals:', error);
        res.status(500).json({ error: 'Failed to fetch referrals' });
    }
});

/**
 * GET /api/digital-referrals/:referralId
 * Get specific digital referral details
 */
router.get('/:referralId', authenticateToken, async (req, res) => {
    try {
        const { referralId } = req.params;

        const query = `
            SELECT dr.*, u.first_name as assigned_advisor_name, u.last_name as assigned_advisor_surname
            FROM digital_referrals dr
            LEFT JOIN users u ON dr.assigned_to = u.id
            WHERE dr.id = $1 AND dr.centre_id = $2
        `;

        const result = await db.query(query, [referralId, req.user.centre_id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Referral not found' });
        }

        res.json({ referral: result.rows[0] });

    } catch (error) {
        console.error('Error fetching referral details:', error);
        res.status(500).json({ error: 'Failed to fetch referral details' });
    }
});

/**
 * PUT /api/digital-referrals/:referralId/assign
 * Assign referral to an advisor
 */
router.put('/:referralId/assign', authenticateToken, async (req, res) => {
    try {
        const { referralId } = req.params;
        const { advisorId } = req.body;

        const query = `
            UPDATE digital_referrals 
            SET assigned_to = $1, status = 'assigned', assigned_at = NOW()
            WHERE id = $2 AND centre_id = $3
            RETURNING *
        `;

        const result = await db.query(query, [advisorId, referralId, req.user.centre_id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Referral not found' });
        }

        res.json({ 
            success: true, 
            referral: result.rows[0],
            message: 'Referral assigned successfully'
        });

    } catch (error) {
        console.error('Error assigning referral:', error);
        res.status(500).json({ error: 'Failed to assign referral' });
    }
});

/**
 * POST /api/digital-referrals/:referralId/convert
 * Convert referral to full case
 */
router.post('/:referralId/convert', authenticateToken, async (req, res) => {
    try {
        const { referralId } = req.params;
        const { additionalInfo } = req.body;

        // Start transaction
        await db.query('BEGIN');

        try {
            // Get referral details
            const referralQuery = `
                SELECT * FROM digital_referrals 
                WHERE id = $1 AND centre_id = $2
            `;
            const referralResult = await db.query(referralQuery, [id, req.user.centre_id]);

            if (referralResult.rows.length === 0) {
                throw new Error('Referral not found');
            }

            const referral = referralResult.rows[0];

            // Create client record
            const clientQuery = `
                INSERT INTO clients (
                    centre_id, first_name, last_name, email, phone, 
                    current_address, date_of_birth, how_heard_about_service,
                    data_protection_consent, created_by
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                RETURNING id
            `;

            const clientResult = await db.query(clientQuery, [
                req.user.centre_id,
                referral.first_name,
                referral.last_name,
                referral.email,
                referral.phone,
                referral.address,
                referral.date_of_birth,
                referral.referral_source,
                referral.consent_given,
                req.user.id
            ]);

            const clientId = clientResult.rows[0].id;

            // Create case record
            const caseQuery = `
                INSERT INTO cases (
                    centre_id, client_id, assigned_advisor_id, status,
                    problem_description, created_by
                ) VALUES ($1, $2, $3, 'open', $4, $5)
                RETURNING id
            `;

            const caseResult = await db.query(caseQuery, [
                req.user.centre_id,
                clientId,
                referral.assigned_to || req.user.id,
                referral.problem_description,
                req.user.id
            ]);

            const caseId = caseResult.rows[0].id;

            // Update referral status
            const updateReferralQuery = `
                UPDATE digital_referrals 
                SET status = 'converted', processed_at = NOW(), 
                    case_id = $1, processed_by = $2
                WHERE id = $3
            `;

            await db.query(updateReferralQuery, [caseId, req.user.id, id]);

            // Add initial note if additional info provided
            if (additionalInfo) {
                const noteQuery = `
                    INSERT INTO notes (case_id, content, note_category, created_by)
                    VALUES ($1, $2, 'initial_assessment', $3)
                `;
                await db.query(noteQuery, [caseId, additionalInfo, req.user.id]);
            }

            await db.query('COMMIT');

            res.json({
                success: true,
                clientId,
                caseId,
                message: 'Referral converted to case successfully'
            });

        } catch (error) {
            await db.query('ROLLBACK');
            throw error;
        }

    } catch (error) {
        console.error('Error converting referral:', error);
        res.status(500).json({ error: 'Failed to convert referral' });
    }
});

/**
 * GET /api/digital-referrals/stats/summary
 * Get referral statistics summary
 */
router.get('/stats/summary', authenticateToken, async (req, res) => {
    try {
        const query = `
            SELECT 
                COUNT(*) as total_referrals,
                COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
                COUNT(CASE WHEN status = 'assigned' THEN 1 END) as assigned,
                COUNT(CASE WHEN status = 'converted' THEN 1 END) as converted,
                COUNT(CASE WHEN urgency_level = 'high' THEN 1 END) as high_priority,
                COUNT(CASE WHEN submitted_at >= NOW() - INTERVAL '7 days' THEN 1 END) as this_week,
                COUNT(CASE WHEN submitted_at >= NOW() - INTERVAL '30 days' THEN 1 END) as this_month
            FROM digital_referrals 
            WHERE centre_id = $1
        `;

        const result = await db.query(query, [req.user.centre_id]);

        res.json({ stats: result.rows[0] });

    } catch (error) {
        console.error('Error fetching referral stats:', error);
        res.status(500).json({ error: 'Failed to fetch referral statistics' });
    }
});

module.exports = router;
