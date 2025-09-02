const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticateToken, requireRole } = require('../middleware/auth');
const nodemailer = require('nodemailer');
const twilio = require('twilio');

// Email and SMS configuration
const emailTransporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: process.env.SMTP_PORT || 587,
    secure: false,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
});

// Initialize Twilio client (only if credentials are provided)
let twilioClient = null;
if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && 
    process.env.TWILIO_ACCOUNT_SID.startsWith('AC')) {
    twilioClient = require('twilio')(
        process.env.TWILIO_ACCOUNT_SID,
        process.env.TWILIO_AUTH_TOKEN
    );
}

// Notification types and templates
const NOTIFICATION_TYPES = {
    appointment_reminder: {
        title: 'Appointment Reminder',
        email_template: 'appointment-reminder',
        sms_template: 'Your appointment with {advisor_name} is scheduled for {appointment_time}. Please call {centre_phone} if you need to reschedule.',
        advance_hours: [24, 2] // Send 24 hours and 2 hours before
    },
    payment_due: {
        title: 'Payment Due Reminder',
        email_template: 'payment-due',
        sms_template: 'Payment of £{amount} is due on {due_date}. Please contact us if you need assistance.',
        advance_hours: [72, 24] // Send 3 days and 1 day before
    },
    compliance_review: {
        title: 'Compliance Review Due',
        email_template: 'compliance-review',
        sms_template: 'Your case compliance review is due. Please contact your advisor to schedule.',
        advance_hours: [168, 24] // Send 1 week and 1 day before
    },
    follow_up_due: {
        title: 'Follow-up Action Due',
        email_template: 'follow-up-due',
        sms_template: 'A follow-up action is due for your case. Please contact your advisor.',
        advance_hours: [24, 2] // Send 1 day and 2 hours before
    },
    document_expiry: {
        title: 'Document Expiring Soon',
        email_template: 'document-expiry',
        sms_template: 'Your {document_type} expires on {expiry_date}. Please provide updated documentation.',
        advance_hours: [336, 168, 24] // Send 2 weeks, 1 week, and 1 day before
    }
};

// Get notification preferences for user
router.get('/preferences', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT * FROM notification_preferences 
            WHERE user_id = $1
        `, [req.user.id]);

        if (result.rows.length === 0) {
            // Create default preferences
            const defaultPrefs = await pool.query(`
                INSERT INTO notification_preferences (
                    user_id, email_enabled, sms_enabled, push_enabled,
                    appointment_reminders, payment_reminders, compliance_reminders,
                    follow_up_reminders, document_reminders
                )
                VALUES ($1, true, false, true, true, true, true, true, true)
                RETURNING *
            `, [req.user.id]);
            
            return res.json(defaultPrefs.rows[0]);
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error fetching notification preferences:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update notification preferences
router.put('/preferences', authenticateToken, async (req, res) => {
    try {
        const {
            email_enabled, sms_enabled, push_enabled,
            appointment_reminders, payment_reminders, compliance_reminders,
            follow_up_reminders, document_reminders
        } = req.body;

        const result = await pool.query(`
            UPDATE notification_preferences SET
                email_enabled = $2, sms_enabled = $3, push_enabled = $4,
                appointment_reminders = $5, payment_reminders = $6, 
                compliance_reminders = $7, follow_up_reminders = $8,
                document_reminders = $9, updated_at = CURRENT_TIMESTAMP
            WHERE user_id = $1
            RETURNING *
        `, [
            req.user.id, email_enabled, sms_enabled, push_enabled,
            appointment_reminders, payment_reminders, compliance_reminders,
            follow_up_reminders, document_reminders
        ]);

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error updating notification preferences:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get scheduled notifications
router.get('/scheduled', authenticateToken, async (req, res) => {
    try {
        const { status = 'pending', limit = 50 } = req.query;

        const result = await pool.query(`
            SELECT sn.*, cl.first_name, cl.last_name, c.id as case_id
            FROM scheduled_notifications sn
            LEFT JOIN clients cl ON sn.client_id = cl.id
            LEFT JOIN cases c ON cl.id = c.client_id
            WHERE (c.centre_id = $1 OR sn.user_id = $2) 
            AND sn.status = $3
            ORDER BY sn.scheduled_for ASC
            LIMIT $4
        `, [req.user.centre_id, req.user.id, status, limit]);

        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching scheduled notifications:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Schedule a notification
router.post('/schedule', authenticateToken, async (req, res) => {
    try {
        const {
            notification_type,
            client_id,
            user_id,
            scheduled_for,
            template_data = {},
            priority = 'normal'
        } = req.body;

        // Validate notification type
        if (!NOTIFICATION_TYPES[notification_type]) {
            return res.status(400).json({ error: 'Invalid notification type' });
        }

        // Verify access to client if specified
        if (client_id) {
            const clientCheck = await pool.query(`
                SELECT c.id FROM clients cl
                JOIN cases c ON cl.id = c.client_id
                WHERE cl.id = $1 AND c.centre_id = $2
            `, [client_id, req.user.centre_id]);

            if (clientCheck.rows.length === 0) {
                return res.status(404).json({ error: 'Client not found' });
            }
        }

        const result = await pool.query(`
            INSERT INTO scheduled_notifications (
                notification_type, client_id, user_id, scheduled_for,
                template_data, priority, created_by
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *
        `, [
            notification_type, client_id, user_id || req.user.id,
            scheduled_for, JSON.stringify(template_data), priority, req.user.id
        ]);

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error scheduling notification:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Cancel a scheduled notification
router.delete('/scheduled/:notificationId', authenticateToken, async (req, res) => {
    try {
        const { notificationId } = req.params;

        // Verify access to notification
        const notificationCheck = await pool.query(`
            SELECT sn.id FROM scheduled_notifications sn
            LEFT JOIN clients cl ON sn.client_id = cl.id
            LEFT JOIN cases c ON cl.id = c.client_id
            WHERE sn.id = $1 AND (c.centre_id = $2 OR sn.user_id = $3)
        `, [notificationId, req.user.centre_id, req.user.id]);

        if (notificationCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Notification not found' });
        }

        await pool.query(`
            UPDATE scheduled_notifications 
            SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
            WHERE id = $1
        `, [notificationId]);

        res.json({ message: 'Notification cancelled successfully' });
    } catch (error) {
        console.error('Error cancelling notification:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get notification history
router.get('/history', authenticateToken, async (req, res) => {
    try {
        const { client_id, limit = 50, offset = 0 } = req.query;

        let query = `
            SELECT nh.*, cl.first_name, cl.last_name, u.first_name as sent_by_first_name, u.last_name as sent_by_last_name
            FROM notification_history nh
            LEFT JOIN clients cl ON nh.client_id = cl.id
            LEFT JOIN users u ON nh.sent_by = u.id
            LEFT JOIN cases c ON cl.id = c.client_id
            WHERE c.centre_id = $1
        `;
        const params = [req.user.centre_id];

        if (client_id) {
            query += ' AND nh.client_id = $2';
            params.push(client_id);
        }

        query += ' ORDER BY nh.sent_at DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
        params.push(limit, offset);

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching notification history:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Send immediate notification
router.post('/send', authenticateToken, async (req, res) => {
    try {
        const {
            notification_type,
            client_id,
            user_id,
            template_data = {},
            channels = ['email'] // email, sms, push
        } = req.body;

        // Validate notification type
        if (!NOTIFICATION_TYPES[notification_type]) {
            return res.status(400).json({ error: 'Invalid notification type' });
        }

        // Get recipient details
        let recipient;
        if (client_id) {
            const clientResult = await pool.query(`
                SELECT cl.*, c.id as case_id FROM clients cl
                JOIN cases c ON cl.id = c.client_id
                WHERE cl.id = $1 AND c.centre_id = $2
            `, [client_id, req.user.centre_id]);

            if (clientResult.rows.length === 0) {
                return res.status(404).json({ error: 'Client not found' });
            }
            recipient = clientResult.rows[0];
        } else if (user_id) {
            const userResult = await pool.query(`
                SELECT * FROM users WHERE id = $1 AND centre_id = $2
            `, [user_id, req.user.centre_id]);

            if (userResult.rows.length === 0) {
                return res.status(404).json({ error: 'User not found' });
            }
            recipient = userResult.rows[0];
        } else {
            return res.status(400).json({ error: 'Either client_id or user_id must be provided' });
        }

        // Send notifications
        const results = [];
        for (const channel of channels) {
            try {
                let result;
                switch (channel) {
                case 'email':
                    result = await sendEmailNotification(notification_type, recipient, template_data);
                    break;
                case 'sms':
                    result = await sendSMSNotification(notification_type, recipient, template_data);
                    break;
                case 'push':
                    result = await sendPushNotification(notification_type, recipient, template_data);
                    break;
                default:
                    result = { success: false, error: 'Invalid channel' };
                }
                results.push({ channel, ...result });
            } catch (error) {
                results.push({ channel, success: false, error: error.message });
            }
        }

        // Log notification history
        await pool.query(`
            INSERT INTO notification_history (
                notification_type, client_id, user_id, channels, 
                template_data, status, sent_by
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [
            notification_type, client_id, user_id, JSON.stringify(channels),
            JSON.stringify(template_data), 
            results.every(r => r.success) ? 'sent' : 'failed',
            req.user.id
        ]);

        res.json({ results });
    } catch (error) {
        console.error('Error sending notification:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Bulk schedule notifications (for automated systems)
router.post('/bulk-schedule', authenticateToken, requireRole(['manager']), async (req, res) => {
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');

        const { notifications } = req.body;

        if (!Array.isArray(notifications)) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Notifications must be an array' });
        }

        const results = [];
        for (const notification of notifications) {
            const result = await client.query(`
                INSERT INTO scheduled_notifications (
                    notification_type, client_id, user_id, scheduled_for,
                    template_data, priority, created_by
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                RETURNING id
            `, [
                notification.notification_type,
                notification.client_id,
                notification.user_id || req.user.id,
                notification.scheduled_for,
                JSON.stringify(notification.template_data || {}),
                notification.priority || 'normal',
                req.user.id
            ]);

            results.push({ id: result.rows[0].id, ...notification });
        }

        await client.query('COMMIT');
        res.status(201).json({ scheduled: results.length, notifications: results });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error bulk scheduling notifications:', error);
        res.status(500).json({ error: 'Internal server error' });
    } finally {
        client.release();
    }
});

// Helper functions for sending notifications
async function sendEmailNotification(type, recipient, templateData) {
    if (!emailTransporter) {
        return { success: false, error: 'Email not configured' };
    }

    const notificationConfig = NOTIFICATION_TYPES[type];
    const subject = notificationConfig.title;
    
    // Generate email content (simplified - in production, use proper templates)
    const html = generateEmailTemplate(type, recipient, templateData);

    try {
        await emailTransporter.sendMail({
            from: process.env.FROM_EMAIL || 'noreply@cma-system.com',
            to: recipient.email,
            subject: subject,
            html: html
        });

        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

async function sendSMSNotification(type, recipient, templateData) {
    if (!twilioClient || !recipient.phone) {
        return { success: false, error: 'SMS not configured or no phone number' };
    }

    const notificationConfig = NOTIFICATION_TYPES[type];
    let message = notificationConfig.sms_template;

    // Replace template variables
    Object.keys(templateData).forEach(key => {
        message = message.replace(new RegExp(`{${key}}`, 'g'), templateData[key]);
    });

    try {
        await twilioClient.messages.create({
            body: message,
            from: process.env.TWILIO_PHONE_NUMBER,
            to: recipient.phone
        });

        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

async function sendPushNotification(type, recipient, templateData) {
    // Placeholder for push notification implementation
    // Would integrate with service like Firebase Cloud Messaging
    return { success: false, error: 'Push notifications not implemented' };
}

function generateEmailTemplate(type, recipient, templateData) {
    // Simplified email template generation
    // In production, use proper templating engine like Handlebars
    const notificationConfig = NOTIFICATION_TYPES[type];
    
    return `
        <html>
        <body>
            <h2>${notificationConfig.title}</h2>
            <p>Dear ${recipient.first_name} ${recipient.last_name},</p>
            <p>This is a notification regarding your case.</p>
            <p>Template data: ${JSON.stringify(templateData)}</p>
            <p>Best regards,<br>CMA Team</p>
        </body>
        </html>
    `;
}

module.exports = router;
