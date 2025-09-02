const express = require('express');
const pool = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Get dashboard statistics
router.get('/', authenticateToken, async (req, res) => {
    try {
        const centreId = req.user.centre_id;

        // Get case statistics
        const caseStats = await pool.query(`
            SELECT 
                COUNT(*) as total_cases,
                COUNT(CASE WHEN status = 'active' THEN 1 END) as active_cases,
                COUNT(CASE WHEN status = 'closed' THEN 1 END) as closed_cases,
                COUNT(CASE WHEN priority = 'urgent' THEN 1 END) as urgent_cases,
                COUNT(CASE WHEN priority = 'high' THEN 1 END) as high_priority_cases
            FROM cases 
            WHERE centre_id = $1
        `, [centreId]);

        // Get client statistics
        const clientStats = await pool.query(`
            SELECT 
                COUNT(*) as total_clients,
                COUNT(CASE WHEN created_at >= CURRENT_DATE - INTERVAL '30 days' THEN 1 END) as new_clients_30_days
            FROM clients 
            WHERE centre_id = $1
        `, [centreId]);

        // Get recent cases
        const recentCases = await pool.query(`
            SELECT c.*, 
                   cl.first_name || ' ' || cl.last_name as client_name,
                   u.first_name || ' ' || u.last_name as advisor_name
            FROM cases c
            JOIN clients cl ON c.client_id = cl.id
            LEFT JOIN users u ON c.assigned_advisor_id = u.id
            WHERE c.centre_id = $1
            ORDER BY c.updated_at DESC
            LIMIT 5
        `, [centreId]);

        // Get upcoming appointments (if appointments table exists)
        let upcomingAppointments = { rows: [] };
        try {
            upcomingAppointments = await pool.query(`
                SELECT a.*, 
                       c.case_number,
                       cl.first_name || ' ' || cl.last_name as client_name
                FROM appointments a
                JOIN cases c ON a.case_id = c.id
                JOIN clients cl ON c.client_id = cl.id
                WHERE c.centre_id = $1 
                AND a.appointment_date >= CURRENT_DATE
                ORDER BY a.appointment_date ASC
                LIMIT 5
            `, [centreId]);
        } catch (error) {
            console.log('Appointments table not found, skipping upcoming appointments');
        }

        // Get debt totals
        const debtTotals = await pool.query(`
            SELECT 
                SUM(total_debt::numeric) as total_debt,
                AVG(total_debt::numeric) as avg_debt_per_case,
                SUM(monthly_income::numeric) as total_monthly_income,
                SUM(monthly_expenses::numeric) as total_monthly_expenses
            FROM cases 
            WHERE centre_id = $1 AND status = 'active'
        `, [centreId]);

        res.json({
            caseStats: caseStats.rows[0],
            clientStats: clientStats.rows[0],
            recentCases: recentCases.rows,
            upcomingAppointments: upcomingAppointments.rows,
            debtTotals: debtTotals.rows[0]
        });

    } catch (error) {
        console.error('Error fetching dashboard data:', error);
        res.status(500).json({ 
            message: 'Error fetching dashboard data',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
});

module.exports = router;
