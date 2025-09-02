const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

/**
 * Auto Actions System
 * Automatically performs tasks based on adviser activity
 * Similar to AdvicePro's Auto Actions feature
 */

/**
 * GET /api/auto-actions/rules
 * Get all auto action rules for centre
 */
router.get('/', authenticateToken, async (req, res) => {
    try {
        const query = `
            SELECT * FROM auto_action_rules 
            WHERE centre_id = $1 AND is_active = true
            ORDER BY priority DESC, created_at
        `;
        
        const result = await db.query(query, [req.user.centre_id]);
        res.json({ rules: result.rows });
        
    } catch (error) {
        console.error('Error fetching auto action rules:', error);
        res.status(500).json({ error: 'Failed to fetch auto action rules' });
    }
});

/**
 * POST /api/auto-actions/rules
 * Create new auto action rule
 */
router.post('/', authenticateToken, async (req, res) => {
    try {
        const {
            name,
            description,
            trigger_event,
            trigger_conditions,
            actions,
            priority
        } = req.body;

        const query = `
            INSERT INTO auto_action_rules (
                centre_id, name, description, trigger_event, 
                trigger_conditions, actions, priority, created_by
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *
        `;

        const result = await db.query(query, [
            req.user.centre_id,
            name,
            description,
            trigger_event,
            JSON.stringify(trigger_conditions),
            JSON.stringify(actions),
            priority || 1,
            req.user.id
        ]);

        res.json({ 
            success: true, 
            rule: result.rows[0],
            message: 'Auto action rule created successfully'
        });

    } catch (error) {
        console.error('Error creating auto action rule:', error);
        res.status(500).json({ error: 'Failed to create auto action rule' });
    }
});

/**
 * POST /api/auto-actions/trigger
 * Trigger auto actions for a specific event
 */
router.post('/trigger', authenticateToken, async (req, res) => {
    try {
        const { event, caseId, clientId, data } = req.body;

        // Get matching auto action rules
        const rulesQuery = `
            SELECT * FROM auto_action_rules 
            WHERE centre_id = $1 AND trigger_event = $2 AND is_active = true
            ORDER BY priority DESC
        `;

        const rulesResult = await db.query(rulesQuery, [req.user.centre_id, event]);
        const rules = rulesResult.rows;

        const executedActions = [];

        for (const rule of rules) {
            try {
                // Check if conditions are met
                const conditionsMet = await evaluateConditions(
                    rule.trigger_conditions, 
                    { caseId, clientId, data, userId: req.user.id }
                );

                if (conditionsMet) {
                    // Execute actions
                    const actionResults = await executeActions(
                        rule.actions, 
                        { caseId, clientId, data, userId: req.user.id, centreId: req.user.centre_id }
                    );

                    executedActions.push({
                        ruleId: rule.id,
                        ruleName: rule.name,
                        actions: actionResults
                    });

                    // Log execution
                    await logAutoActionExecution(rule.id, caseId, actionResults, req.user.id);
                }
            } catch (error) {
                console.error(`Error executing auto action rule ${rule.id}:`, error);
            }
        }

        res.json({ 
            success: true, 
            executedActions,
            message: `Executed ${executedActions.length} auto action rules`
        });

    } catch (error) {
        console.error('Error triggering auto actions:', error);
        res.status(500).json({ error: 'Failed to trigger auto actions' });
    }
});

/**
 * Evaluate if conditions are met for auto action
 */
async function evaluateConditions(conditions, context) {
    if (!conditions || typeof conditions !== 'object') return true;

    for (const [field, condition] of Object.entries(conditions)) {
        const { operator, value } = condition;
        let fieldValue;

        // Get field value based on context
        switch (field) {
            case 'case_status':
                if (context.caseId) {
                    const result = await db.query('SELECT status FROM cases WHERE id = $1', [context.caseId]);
                    fieldValue = result.rows[0]?.status;
                }
                break;
            case 'client_vulnerability':
                if (context.clientId) {
                    const result = await db.query('SELECT vulnerabilities FROM clients WHERE id = $1', [context.clientId]);
                    fieldValue = result.rows[0]?.vulnerabilities || [];
                }
                break;
            case 'total_debt':
                if (context.caseId) {
                    const result = await db.query('SELECT total_debt FROM cases WHERE id = $1', [context.caseId]);
                    fieldValue = result.rows[0]?.total_debt;
                }
                break;
            default:
                fieldValue = context.data?.[field];
        }

        // Evaluate condition
        if (!evaluateCondition(fieldValue, operator, value)) {
            return false;
        }
    }

    return true;
}

/**
 * Evaluate individual condition
 */
function evaluateCondition(fieldValue, operator, expectedValue) {
    switch (operator) {
        case 'equals':
            return fieldValue === expectedValue;
        case 'not_equals':
            return fieldValue !== expectedValue;
        case 'greater_than':
            return parseFloat(fieldValue) > parseFloat(expectedValue);
        case 'less_than':
            return parseFloat(fieldValue) < parseFloat(expectedValue);
        case 'contains':
            return Array.isArray(fieldValue) ? 
                fieldValue.includes(expectedValue) : 
                String(fieldValue).includes(expectedValue);
        case 'not_contains':
            return Array.isArray(fieldValue) ? 
                !fieldValue.includes(expectedValue) : 
                !String(fieldValue).includes(expectedValue);
        default:
            return true;
    }
}

/**
 * Execute auto actions
 */
async function executeActions(actions, context) {
    const results = [];

    for (const action of actions) {
        try {
            let result;

            switch (action.type) {
                case 'send_sms':
                    result = await sendSMSAction(action, context);
                    break;
                case 'send_email':
                    result = await sendEmailAction(action, context);
                    break;
                case 'create_note':
                    result = await createNoteAction(action, context);
                    break;
                case 'create_task':
                    result = await createTaskAction(action, context);
                    break;
                case 'update_case_status':
                    result = await updateCaseStatusAction(action, context);
                    break;
                case 'notify_supervisor':
                    result = await notifySupervisorAction(action, context);
                    break;
                case 'schedule_appointment':
                    result = await scheduleAppointmentAction(action, context);
                    break;
                default:
                    result = { success: false, error: 'Unknown action type' };
            }

            results.push({
                type: action.type,
                ...result
            });

        } catch (error) {
            results.push({
                type: action.type,
                success: false,
                error: error.message
            });
        }
    }

    return results;
}

/**
 * Send SMS action
 */
async function sendSMSAction(action, context) {
    // Get client phone number
    const clientQuery = await db.query('SELECT phone FROM clients WHERE id = $1', [context.clientId]);
    const phone = clientQuery.rows[0]?.phone;

    if (!phone) {
        return { success: false, error: 'No phone number available' };
    }

    // Replace template variables in message
    const message = replaceTemplateVariables(action.message, context);

    // Here you would integrate with SMS service (Twilio, etc.)
    // For now, just log the action
    console.log(`SMS would be sent to ${phone}: ${message}`);

    return { success: true, message: 'SMS queued for sending' };
}

/**
 * Send email action
 */
async function sendEmailAction(action, context) {
    // Get client email
    const clientQuery = await db.query('SELECT email FROM clients WHERE id = $1', [context.clientId]);
    const email = clientQuery.rows[0]?.email;

    if (!email) {
        return { success: false, error: 'No email address available' };
    }

    const subject = replaceTemplateVariables(action.subject, context);
    const message = replaceTemplateVariables(action.message, context);

    // Here you would integrate with email service
    console.log(`Email would be sent to ${email}: ${subject} - ${message}`);

    return { success: true, message: 'Email queued for sending' };
}

/**
 * Create note action
 */
async function createNoteAction(action, context) {
    const content = replaceTemplateVariables(action.content, context);

    const query = `
        INSERT INTO notes (case_id, content, note_category, created_by, is_auto_generated)
        VALUES ($1, $2, $3, $4, true)
        RETURNING id
    `;

    const result = await db.query(query, [
        context.caseId,
        content,
        action.category || 'system',
        context.userId
    ]);

    return { success: true, noteId: result.rows[0].id };
}

/**
 * Create task action
 */
async function createTaskAction(action, context) {
    const description = replaceTemplateVariables(action.description, context);
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + (action.dueDays || 7));

    const query = `
        INSERT INTO note_follow_ups (
            note_id, assigned_to, action_required, due_date, status
        ) VALUES (
            (SELECT id FROM notes WHERE case_id = $1 ORDER BY created_at DESC LIMIT 1),
            $2, $3, $4, 'pending'
        )
        RETURNING id
    `;

    const result = await db.query(query, [
        context.caseId,
        action.assignedTo || context.userId,
        description,
        dueDate
    ]);

    return { success: true, taskId: result.rows[0].id };
}

/**
 * Update case status action
 */
async function updateCaseStatusAction(action, context) {
    const query = `
        UPDATE cases 
        SET status = $1, updated_at = NOW()
        WHERE id = $2
    `;

    await db.query(query, [action.newStatus, context.caseId]);

    return { success: true, newStatus: action.newStatus };
}

/**
 * Notify supervisor action
 */
async function notifySupervisorAction(action, context) {
    const message = replaceTemplateVariables(action.message, context);

    // Get centre manager
    const managerQuery = await db.query(
        'SELECT email FROM users WHERE centre_id = $1 AND role = $2',
        [context.centreId, 'manager']
    );

    if (managerQuery.rows.length > 0) {
        const managerEmail = managerQuery.rows[0].email;
        // Send notification email to manager
        console.log(`Supervisor notification would be sent to ${managerEmail}: ${message}`);
        return { success: true, message: 'Supervisor notified' };
    }

    return { success: false, error: 'No supervisor found' };
}

/**
 * Schedule appointment action
 */
async function scheduleAppointmentAction(action, context) {
    const appointmentDate = new Date();
    appointmentDate.setDate(appointmentDate.getDate() + (action.daysFromNow || 7));

    const query = `
        INSERT INTO appointments (
            case_id, appointment_date, appointment_type, notes, created_by
        ) VALUES ($1, $2, $3, $4, $5)
        RETURNING id
    `;

    const result = await db.query(query, [
        context.caseId,
        appointmentDate,
        action.appointmentType || 'follow_up',
        action.notes || 'Auto-scheduled appointment',
        context.userId
    ]);

    return { success: true, appointmentId: result.rows[0].id };
}

/**
 * Replace template variables in text
 */
function replaceTemplateVariables(text, context) {
    if (!text) return '';

    return text
        .replace(/\{caseId\}/g, context.caseId || '')
        .replace(/\{clientId\}/g, context.clientId || '')
        .replace(/\{userId\}/g, context.userId || '')
        .replace(/\{date\}/g, new Date().toLocaleDateString())
        .replace(/\{time\}/g, new Date().toLocaleTimeString());
}

/**
 * Log auto action execution
 */
async function logAutoActionExecution(ruleId, caseId, results, userId) {
    const query = `
        INSERT INTO auto_action_logs (
            rule_id, case_id, execution_results, executed_by, executed_at
        ) VALUES ($1, $2, $3, $4, NOW())
    `;

    await db.query(query, [ruleId, caseId, JSON.stringify(results), userId]);
}

/**
 * GET /api/auto-actions/logs
 * Get auto action execution logs
 */
router.get('/logs', authenticateToken, async (req, res) => {
    try {
        const { page = 1, limit = 20 } = req.query;
        const offset = (page - 1) * limit;

        const query = `
            SELECT 
                aal.*, aar.name as rule_name,
                c.id as case_number,
                CONCAT(cl.first_name, ' ', cl.last_name) as client_name
            FROM auto_action_logs aal
            JOIN auto_action_rules aar ON aal.rule_id = aar.id
            LEFT JOIN cases c ON aal.case_id = c.id
            LEFT JOIN clients cl ON c.client_id = cl.id
            WHERE aar.centre_id = $1
            ORDER BY aal.executed_at DESC
            LIMIT $2 OFFSET $3
        `;

        const result = await db.query(query, [req.user.centre_id, limit, offset]);

        res.json({ logs: result.rows });

    } catch (error) {
        console.error('Error fetching auto action logs:', error);
        res.status(500).json({ error: 'Failed to fetch auto action logs' });
    }
});

module.exports = router;
