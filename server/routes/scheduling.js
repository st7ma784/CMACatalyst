const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticateToken, requireRole } = require('../middleware/auth');
const cron = require('node-cron');

// Automated scheduling rules and patterns
const SCHEDULING_RULES = {
    follow_up_intervals: {
        'initial_contact': 7, // days
        'payment_plan': 14,
        'compliance_review': 30,
        'debt_management': 21,
        'budget_review': 28
    },
    reminder_schedules: {
        'appointment': [24, 2], // hours before
        'payment_due': [72, 24],
        'document_expiry': [336, 168, 24], // 2 weeks, 1 week, 1 day
        'compliance_review': [168, 24] // 1 week, 1 day
    },
    auto_schedule_types: [
        'follow_up_call',
        'payment_reminder',
        'compliance_check',
        'document_review',
        'budget_assessment'
    ]
};

// Get scheduling rules
router.get('/rules', authenticateToken, requireRole(['manager']), async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT * FROM scheduling_rules 
            WHERE centre_id = $1 
            ORDER BY rule_type, priority DESC
        `, [req.user.centre_id]);

        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching scheduling rules:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Create or update scheduling rule
router.post('/rules', authenticateToken, requireRole(['manager']), async (req, res) => {
    try {
        const {
            rule_type,
            trigger_event,
            schedule_offset_days,
            schedule_offset_hours = 0,
            appointment_type,
            auto_assign = false,
            priority = 'normal',
            conditions = {},
            is_active = true
        } = req.body;

        const result = await pool.query(`
            INSERT INTO scheduling_rules (
                centre_id, rule_type, trigger_event, schedule_offset_days,
                schedule_offset_hours, appointment_type, auto_assign, priority,
                conditions, is_active, created_by
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            ON CONFLICT (centre_id, rule_type, trigger_event) 
            DO UPDATE SET
                schedule_offset_days = EXCLUDED.schedule_offset_days,
                schedule_offset_hours = EXCLUDED.schedule_offset_hours,
                appointment_type = EXCLUDED.appointment_type,
                auto_assign = EXCLUDED.auto_assign,
                priority = EXCLUDED.priority,
                conditions = EXCLUDED.conditions,
                is_active = EXCLUDED.is_active,
                updated_at = CURRENT_TIMESTAMP
            RETURNING *
        `, [
            req.user.centre_id, rule_type, trigger_event, schedule_offset_days,
            schedule_offset_hours, appointment_type, auto_assign, priority,
            JSON.stringify(conditions), is_active, req.user.id
        ]);

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error creating scheduling rule:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get auto-scheduled appointments
router.get('/auto-scheduled', authenticateToken, async (req, res) => {
    try {
        const { status = 'pending', limit = 50 } = req.query;

        const result = await pool.query(`
            SELECT asa.*, cl.first_name, cl.last_name, u.first_name as advisor_first_name, u.last_name as advisor_last_name,
                   sr.rule_type, sr.trigger_event
            FROM auto_scheduled_appointments asa
            JOIN cases c ON asa.case_id = c.id
            JOIN clients cl ON c.client_id = cl.id
            LEFT JOIN users u ON asa.assigned_to = u.id
            LEFT JOIN scheduling_rules sr ON asa.rule_id = sr.id
            WHERE c.centre_id = $1 AND asa.status = $2
            ORDER BY asa.scheduled_for ASC
            LIMIT $3
        `, [req.user.centre_id, status, limit]);

        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching auto-scheduled appointments:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Approve auto-scheduled appointment
router.post('/auto-scheduled/:appointmentId/approve', authenticateToken, async (req, res) => {
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');

        const { appointmentId } = req.params;
        const { assigned_to, notes = '' } = req.body;

        // Get auto-scheduled appointment details
        const autoApptResult = await client.query(`
            SELECT asa.*, c.client_id FROM auto_scheduled_appointments asa
            JOIN cases c ON asa.case_id = c.id
            WHERE asa.id = $1 AND c.centre_id = $2 AND asa.status = 'pending'
        `, [appointmentId, req.user.centre_id]);

        if (autoApptResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Auto-scheduled appointment not found' });
        }

        const autoAppt = autoApptResult.rows[0];

        // Create actual appointment
        const appointmentResult = await client.query(`
            INSERT INTO appointments (
                client_id, advisor_id, appointment_type, scheduled_for,
                duration_minutes, notes, status, created_by
            )
            VALUES ($1, $2, $3, $4, $5, $6, 'scheduled', $7)
            RETURNING *
        `, [
            autoAppt.client_id,
            assigned_to || autoAppt.assigned_to,
            autoAppt.appointment_type,
            autoAppt.scheduled_for,
            autoAppt.duration_minutes || 60,
            notes,
            req.user.id
        ]);

        // Update auto-scheduled appointment status
        await client.query(`
            UPDATE auto_scheduled_appointments 
            SET status = 'approved', appointment_id = $2, approved_by = $3, approved_at = CURRENT_TIMESTAMP
            WHERE id = $1
        `, [appointmentId, appointmentResult.rows[0].id, req.user.id]);

        // Schedule reminders for the new appointment
        await scheduleAppointmentReminders(appointmentResult.rows[0]);

        await client.query('COMMIT');
        res.json(appointmentResult.rows[0]);
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error approving auto-scheduled appointment:', error);
        res.status(500).json({ error: 'Internal server error' });
    } finally {
        client.release();
    }
});

// Reject auto-scheduled appointment
router.post('/auto-scheduled/:appointmentId/reject', authenticateToken, async (req, res) => {
    try {
        const { appointmentId } = req.params;
        const { reason = '' } = req.body;

        // Verify access and update status
        const result = await pool.query(`
            UPDATE auto_scheduled_appointments asa
            SET status = 'rejected', rejection_reason = $2, rejected_by = $3, rejected_at = CURRENT_TIMESTAMP
            FROM cases c
            WHERE asa.case_id = c.id AND asa.id = $1 AND c.centre_id = $4 AND asa.status = 'pending'
            RETURNING asa.*
        `, [appointmentId, reason, req.user.id, req.user.centre_id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Auto-scheduled appointment not found' });
        }

        res.json({ message: 'Auto-scheduled appointment rejected', appointment: result.rows[0] });
    } catch (error) {
        console.error('Error rejecting auto-scheduled appointment:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Trigger automated scheduling for a case
router.post('/trigger', authenticateToken, async (req, res) => {
    try {
        const { case_id, trigger_event, additional_data = {} } = req.body;

        // Verify case access
        const caseResult = await pool.query(`
            SELECT * FROM cases WHERE id = $1 AND centre_id = $2
        `, [case_id, req.user.centre_id]);

        if (caseResult.rows.length === 0) {
            return res.status(404).json({ error: 'Case not found' });
        }

        const scheduledAppointments = await processSchedulingTrigger(
            case_id, 
            trigger_event, 
            additional_data,
            req.user.centre_id
        );

        res.json({ 
            message: 'Scheduling trigger processed',
            scheduled_appointments: scheduledAppointments.length,
            appointments: scheduledAppointments
        });
    } catch (error) {
        console.error('Error processing scheduling trigger:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get scheduling analytics
router.get('/analytics', authenticateToken, requireRole(['manager']), async (req, res) => {
    try {
        const { start_date, end_date } = req.query;
        const startDate = start_date || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        const endDate = end_date || new Date().toISOString();

        const analytics = await Promise.all([
            // Auto-scheduled appointments by status
            pool.query(`
                SELECT status, COUNT(*) as count
                FROM auto_scheduled_appointments asa
                JOIN cases c ON asa.case_id = c.id
                WHERE c.centre_id = $1 AND asa.created_at BETWEEN $2 AND $3
                GROUP BY status
            `, [req.user.centre_id, startDate, endDate]),

            // Scheduling rules effectiveness
            pool.query(`
                SELECT sr.rule_type, sr.trigger_event,
                       COUNT(asa.id) as triggered_count,
                       COUNT(CASE WHEN asa.status = 'approved' THEN 1 END) as approved_count,
                       COUNT(CASE WHEN asa.status = 'rejected' THEN 1 END) as rejected_count
                FROM scheduling_rules sr
                LEFT JOIN auto_scheduled_appointments asa ON sr.id = asa.rule_id
                    AND asa.created_at BETWEEN $2 AND $3
                WHERE sr.centre_id = $1 AND sr.is_active = true
                GROUP BY sr.id, sr.rule_type, sr.trigger_event
            `, [req.user.centre_id, startDate, endDate]),

            // Appointment completion rates
            pool.query(`
                SELECT a.appointment_type,
                       COUNT(*) as total_appointments,
                       COUNT(CASE WHEN a.status = 'completed' THEN 1 END) as completed_count,
                       COUNT(CASE WHEN a.status = 'no_show' THEN 1 END) as no_show_count
                FROM appointments a
                JOIN cases c ON a.client_id = (SELECT client_id FROM cases WHERE id = c.id LIMIT 1)
                WHERE c.centre_id = $1 AND a.scheduled_for BETWEEN $2 AND $3
                GROUP BY a.appointment_type
            `, [req.user.centre_id, startDate, endDate])
        ]);

        res.json({
            status_distribution: analytics[0].rows,
            rule_effectiveness: analytics[1].rows,
            completion_rates: analytics[2].rows
        });
    } catch (error) {
        console.error('Error fetching scheduling analytics:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Helper functions
async function processSchedulingTrigger(caseId, triggerEvent, additionalData, centreId) {
    const client = await pool.connect();
    const scheduledAppointments = [];
    
    try {
        await client.query('BEGIN');

        // Get applicable scheduling rules
        const rulesResult = await client.query(`
            SELECT * FROM scheduling_rules 
            WHERE centre_id = $1 AND trigger_event = $2 AND is_active = true
            ORDER BY priority DESC
        `, [centreId, triggerEvent]);

        for (const rule of rulesResult.rows) {
            // Check if conditions are met
            if (await evaluateRuleConditions(rule, caseId, additionalData)) {
                const scheduledFor = new Date();
                scheduledFor.setDate(scheduledFor.getDate() + rule.schedule_offset_days);
                scheduledFor.setHours(scheduledFor.getHours() + rule.schedule_offset_hours);

                // Find available advisor if auto-assign is enabled
                let assignedTo = null;
                if (rule.auto_assign) {
                    assignedTo = await findAvailableAdvisor(centreId, scheduledFor, rule.appointment_type);
                }

                // Create auto-scheduled appointment
                const autoApptResult = await client.query(`
                    INSERT INTO auto_scheduled_appointments (
                        case_id, rule_id, appointment_type, scheduled_for,
                        assigned_to, trigger_data, status
                    )
                    VALUES ($1, $2, $3, $4, $5, $6, 'pending')
                    RETURNING *
                `, [
                    caseId, rule.id, rule.appointment_type, scheduledFor,
                    assignedTo, JSON.stringify(additionalData)
                ]);

                scheduledAppointments.push(autoApptResult.rows[0]);
            }
        }

        await client.query('COMMIT');
        return scheduledAppointments;
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

async function evaluateRuleConditions(rule, caseId, additionalData) {
    // Simplified condition evaluation
    // In production, implement more sophisticated rule engine
    const conditions = rule.conditions || {};
    
    if (Object.keys(conditions).length === 0) {
        return true; // No conditions means always apply
    }

    // Example condition checks
    if (conditions.case_status) {
        const caseResult = await pool.query('SELECT status FROM cases WHERE id = $1', [caseId]);
        if (caseResult.rows[0]?.status !== conditions.case_status) {
            return false;
        }
    }

    if (conditions.days_since_last_appointment) {
        const lastApptResult = await pool.query(`
            SELECT MAX(scheduled_for) as last_appointment
            FROM appointments a
            JOIN cases c ON a.client_id = c.client_id
            WHERE c.id = $1
        `, [caseId]);
        
        const lastAppt = lastApptResult.rows[0]?.last_appointment;
        if (lastAppt) {
            const daysSince = Math.floor((Date.now() - new Date(lastAppt)) / (1000 * 60 * 60 * 24));
            if (daysSince < conditions.days_since_last_appointment) {
                return false;
            }
        }
    }

    return true;
}

async function findAvailableAdvisor(centreId, scheduledFor, appointmentType) {
    // Simplified advisor assignment
    // In production, implement proper availability checking
    const advisorResult = await pool.query(`
        SELECT id FROM users 
        WHERE centre_id = $1 AND role = 'advisor' AND is_active = true
        ORDER BY RANDOM()
        LIMIT 1
    `, [centreId]);

    return advisorResult.rows[0]?.id || null;
}

async function scheduleAppointmentReminders(appointment) {
    const reminderHours = SCHEDULING_RULES.reminder_schedules.appointment;
    
    for (const hours of reminderHours) {
        const reminderTime = new Date(appointment.scheduled_for);
        reminderTime.setHours(reminderTime.getHours() - hours);

        if (reminderTime > new Date()) {
            await pool.query(`
                INSERT INTO scheduled_notifications (
                    notification_type, client_id, scheduled_for, template_data
                )
                VALUES ('appointment_reminder', $1, $2, $3)
            `, [
                appointment.client_id,
                reminderTime,
                JSON.stringify({
                    appointment_id: appointment.id,
                    appointment_time: appointment.scheduled_for,
                    advisor_name: 'Your advisor' // Would get actual advisor name
                })
            ]);
        }
    }
}

// Disabled cron job that was causing server hanging issues
// TODO: Re-enable after fixing database schema issues
/*
cron.schedule('* * * * *', async () => {
    try {
        const now = new Date();
        
        // Get pending notifications that are due
        const pendingNotifications = await pool.query(`
            SELECT sn.*, c.case_number, cl.first_name || ' ' || cl.last_name as client_name,
                   u.email as user_email, u.first_name || ' ' || u.last_name as user_name
            FROM scheduled_notifications sn
            JOIN cases c ON sn.case_id = c.id
            JOIN clients cl ON c.client_id = cl.id
            JOIN users u ON sn.user_id = u.id
            WHERE sn.status = 'pending' 
            AND sn.scheduled_date <= $1
            ORDER BY sn.scheduled_date ASC
            LIMIT 50
        `, [now]);

        for (const notification of pendingNotifications.rows) {
            try {
                // Send notification based on type
                let success = false;
                
                if (notification.notification_type === 'email') {
                    // Send email notification
                    success = await sendEmailNotification(notification);
                } else if (notification.notification_type === 'sms') {
                    // Send SMS notification
                    success = await sendSMSNotification(notification);
                } else if (notification.notification_type === 'in_app') {
                    // Create in-app notification
                    success = await createInAppNotification(notification);
                }

                // Update notification status
                if (success) {
                    await pool.query(
                        'UPDATE scheduled_notifications SET status = $1, sent_date = $2 WHERE id = $3',
                        ['sent', now, notification.id]
                    );
                } else {
                    await pool.query(
                        'UPDATE scheduled_notifications SET status = $1 WHERE id = $2',
                        ['failed', notification.id]
                    );
                }
            } catch (notificationError) {
                console.error(`Error processing notification ${notification.id}:`, notificationError);
                await pool.query(
                    'UPDATE scheduled_notifications SET status = $1 WHERE id = $2',
                    ['failed', notification.id]
                );
            }
        }
    } catch (error) {
        console.error('Error in notification cron job:', error);
    }
});
*/

module.exports = router;
