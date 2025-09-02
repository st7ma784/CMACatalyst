const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticateToken, requireRole } = require('../middleware/auth');

// Get all compliance frameworks
router.get('/frameworks', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT * FROM compliance_frameworks 
            WHERE is_active = true 
            ORDER BY effective_date DESC
        `);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching compliance frameworks:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get compliance checklists for a framework
router.get('/frameworks/:frameworkId/checklists', authenticateToken, async (req, res) => {
    try {
        const { frameworkId } = req.params;
        const { applies_to } = req.query;

        let query = `
            SELECT * FROM compliance_checklists 
            WHERE framework_id = $1
        `;
        const params = [frameworkId];

        if (applies_to) {
            query += ' AND (applies_to = $2 OR applies_to = \'all_cases\')';
            params.push(applies_to);
        }

        query += ' ORDER BY name ASC';

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching compliance checklists:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get case compliance status
router.get('/case/:caseId', authenticateToken, async (req, res) => {
    try {
        const { caseId } = req.params;

        // Verify user has access to this case
        const caseCheck = await pool.query(
            'SELECT id, case_type FROM cases WHERE id = $1 AND centre_id = $2',
            [caseId, req.user.centre_id]
        );
        
        if (caseCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Case not found' });
        }

        const caseData = caseCheck.rows[0];

        // Get applicable checklists
        const checklistsResult = await pool.query(`
            SELECT cl.*, cf.name as framework_name, cf.version as framework_version
            FROM compliance_checklists cl
            JOIN compliance_frameworks cf ON cl.framework_id = cf.id
            WHERE cf.is_active = true 
            AND (cl.applies_to = $1 OR cl.applies_to = 'all_cases')
            ORDER BY cf.effective_date DESC, cl.name ASC
        `, [caseData.case_type || 'debt_management']);

        // Get existing compliance records
        const complianceResult = await pool.query(`
            SELECT cc.*, u.first_name, u.last_name
            FROM case_compliance cc
            LEFT JOIN users u ON cc.reviewed_by = u.id
            WHERE cc.case_id = $1
        `, [caseId]);

        const complianceMap = {};
        complianceResult.rows.forEach(comp => {
            complianceMap[comp.checklist_id] = comp;
        });

        // Combine checklists with compliance status
        const checklistsWithStatus = checklistsResult.rows.map(checklist => ({
            ...checklist,
            compliance: complianceMap[checklist.id] || {
                case_id: caseId,
                checklist_id: checklist.id,
                completed_items: [],
                completion_percentage: 0,
                compliance_status: 'pending'
            }
        }));

        res.json(checklistsWithStatus);
    } catch (error) {
        console.error('Error fetching case compliance:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update case compliance
router.put('/case/:caseId/checklist/:checklistId', authenticateToken, async (req, res) => {
    try {
        const { caseId, checklistId } = req.params;
        const { completed_items, notes } = req.body;

        // Verify user has access to this case
        const caseCheck = await pool.query(
            'SELECT id FROM cases WHERE id = $1 AND centre_id = $2',
            [caseId, req.user.centre_id]
        );
        
        if (caseCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Case not found' });
        }

        // Get checklist to calculate completion percentage
        const checklistResult = await pool.query(
            'SELECT checklist_items FROM compliance_checklists WHERE id = $1',
            [checklistId]
        );

        if (checklistResult.rows.length === 0) {
            return res.status(404).json({ error: 'Checklist not found' });
        }

        const checklistItems = checklistResult.rows[0].checklist_items;
        const totalItems = Array.isArray(checklistItems) ? checklistItems.length : 0;
        const completedCount = completed_items.length;
        const completionPercentage = totalItems > 0 ? (completedCount / totalItems) * 100 : 0;

        // Determine compliance status
        let complianceStatus = 'pending';
        if (completionPercentage === 100) {
            complianceStatus = 'compliant';
        } else if (completionPercentage > 0) {
            complianceStatus = 'in_progress';
        }

        // Upsert compliance record
        const result = await pool.query(`
            INSERT INTO case_compliance (
                case_id, checklist_id, completed_items, completion_percentage, 
                compliance_status, notes, last_reviewed_at, reviewed_by
            )
            VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, $7)
            ON CONFLICT (case_id, checklist_id) 
            DO UPDATE SET
                completed_items = EXCLUDED.completed_items,
                completion_percentage = EXCLUDED.completion_percentage,
                compliance_status = EXCLUDED.compliance_status,
                notes = EXCLUDED.notes,
                last_reviewed_at = EXCLUDED.last_reviewed_at,
                reviewed_by = EXCLUDED.reviewed_by,
                updated_at = CURRENT_TIMESTAMP
            RETURNING *
        `, [caseId, checklistId, JSON.stringify(completed_items), completionPercentage, complianceStatus, notes, req.user.id]);

        // Log compliance audit trail
        await pool.query(`
            INSERT INTO compliance_audit_log (
                case_id, user_id, action, checklist_item, new_value, ip_address, user_agent
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [
            caseId, 
            req.user.id, 
            'checklist_updated', 
            `Checklist ${checklistId}`,
            JSON.stringify({ completed_items, completion_percentage: completionPercentage }),
            req.ip,
            req.get('User-Agent')
        ]);

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error updating case compliance:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get compliance dashboard data
router.get('/dashboard', authenticateToken, async (req, res) => {
    try {
        const { period = '30' } = req.query; // days

        // Overall compliance statistics
        const overallStats = await pool.query(`
            SELECT 
                COUNT(DISTINCT cc.case_id) as total_cases_reviewed,
                AVG(cc.completion_percentage) as avg_completion_percentage,
                COUNT(CASE WHEN cc.compliance_status = 'compliant' THEN 1 END) as compliant_cases,
                COUNT(CASE WHEN cc.compliance_status = 'non_compliant' THEN 1 END) as non_compliant_cases,
                COUNT(CASE WHEN cc.compliance_status = 'requires_review' THEN 1 END) as requires_review_cases
            FROM case_compliance cc
            JOIN cases c ON cc.case_id = c.id
            WHERE c.centre_id = $1 
            AND cc.last_reviewed_at >= CURRENT_DATE - INTERVAL '${period} days'
        `, [req.user.centre_id]);

        // Compliance by checklist
        const checklistStats = await pool.query(`
            SELECT 
                cl.name as checklist_name,
                cf.name as framework_name,
                COUNT(cc.id) as total_reviews,
                AVG(cc.completion_percentage) as avg_completion,
                COUNT(CASE WHEN cc.compliance_status = 'compliant' THEN 1 END) as compliant_count
            FROM compliance_checklists cl
            JOIN compliance_frameworks cf ON cl.framework_id = cf.id
            LEFT JOIN case_compliance cc ON cl.id = cc.checklist_id
            LEFT JOIN cases c ON cc.case_id = c.id
            WHERE c.centre_id = $1 OR c.centre_id IS NULL
            AND (cc.last_reviewed_at >= CURRENT_DATE - INTERVAL '${period} days' OR cc.last_reviewed_at IS NULL)
            GROUP BY cl.id, cl.name, cf.name
            ORDER BY avg_completion DESC
        `, [req.user.centre_id]);

        // Cases requiring attention
        const attentionCases = await pool.query(`
            SELECT 
                c.id as case_id,
                cl.first_name || ' ' || cl.last_name as client_name,
                cc.compliance_status,
                cc.completion_percentage,
                cc.last_reviewed_at,
                COUNT(cc.id) as total_checklists,
                COUNT(CASE WHEN cc.compliance_status = 'compliant' THEN 1 END) as compliant_checklists
            FROM cases c
            JOIN clients cl ON c.client_id = cl.id
            LEFT JOIN case_compliance cc ON c.id = cc.case_id
            WHERE c.centre_id = $1
            AND (cc.compliance_status IN ('non_compliant', 'requires_review') OR cc.compliance_status IS NULL)
            GROUP BY c.id, cl.first_name, cl.last_name, cc.compliance_status, cc.completion_percentage, cc.last_reviewed_at
            ORDER BY cc.last_reviewed_at ASC NULLS FIRST
            LIMIT 20
        `, [req.user.centre_id]);

        // Compliance trends (last 12 months)
        const trends = await pool.query(`
            SELECT 
                DATE_TRUNC('month', cc.last_reviewed_at) as month,
                AVG(cc.completion_percentage) as avg_completion,
                COUNT(CASE WHEN cc.compliance_status = 'compliant' THEN 1 END) as compliant_count,
                COUNT(cc.id) as total_reviews
            FROM case_compliance cc
            JOIN cases c ON cc.case_id = c.id
            WHERE c.centre_id = $1 
            AND cc.last_reviewed_at >= CURRENT_DATE - INTERVAL '12 months'
            GROUP BY DATE_TRUNC('month', cc.last_reviewed_at)
            ORDER BY month ASC
        `, [req.user.centre_id]);

        res.json({
            overall: overallStats.rows[0],
            by_checklist: checklistStats.rows,
            attention_required: attentionCases.rows,
            trends: trends.rows
        });
    } catch (error) {
        console.error('Error fetching compliance dashboard:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Schedule compliance review
router.post('/case/:caseId/schedule-review', authenticateToken, async (req, res) => {
    try {
        const { caseId } = req.params;
        const { due_date, review_type = 'periodic_review', notes } = req.body;

        // Verify user has access to this case
        const caseCheck = await pool.query(
            'SELECT id FROM cases WHERE id = $1 AND centre_id = $2',
            [caseId, req.user.centre_id]
        );
        
        if (caseCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Case not found' });
        }

        // Create scheduled review (this would integrate with the notification system)
        const result = await pool.query(`
            INSERT INTO scheduled_notifications (
                template_id, recipient_type, recipient_id, scheduled_for, 
                channel, template_data
            )
            VALUES (
                (SELECT id FROM notification_templates WHERE name = 'compliance_review_reminder' LIMIT 1),
                'user', $1, $2, 'email',
                $3
            )
            RETURNING *
        `, [
            req.user.id,
            due_date,
            JSON.stringify({
                case_id: caseId,
                review_type,
                notes,
                scheduled_by: req.user.id
            })
        ]);

        // Log the scheduling
        await pool.query(`
            INSERT INTO compliance_audit_log (
                case_id, user_id, action, new_value, ip_address, user_agent
            )
            VALUES ($1, $2, $3, $4, $5, $6)
        `, [
            caseId,
            req.user.id,
            'review_scheduled',
            JSON.stringify({ due_date, review_type, notes }),
            req.ip,
            req.get('User-Agent')
        ]);

        res.status(201).json({ 
            message: 'Compliance review scheduled successfully',
            scheduled_notification: result.rows[0]
        });
    } catch (error) {
        console.error('Error scheduling compliance review:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get compliance audit trail for a case
router.get('/case/:caseId/audit-trail', authenticateToken, async (req, res) => {
    try {
        const { caseId } = req.params;
        const { page = 1, limit = 50 } = req.query;

        // Verify user has access to this case
        const caseCheck = await pool.query(
            'SELECT id FROM cases WHERE id = $1 AND centre_id = $2',
            [caseId, req.user.centre_id]
        );
        
        if (caseCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Case not found' });
        }

        const result = await pool.query(`
            SELECT cal.*, u.first_name, u.last_name, u.email
            FROM compliance_audit_log cal
            JOIN users u ON cal.user_id = u.id
            WHERE cal.case_id = $1
            ORDER BY cal.timestamp DESC
            LIMIT $2 OFFSET $3
        `, [caseId, limit, (page - 1) * limit]);

        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching compliance audit trail:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Create/Update compliance framework (managers only)
router.post('/frameworks', authenticateToken, requireRole(['manager']), async (req, res) => {
    try {
        const { name, version, effective_date, description } = req.body;

        const result = await pool.query(`
            INSERT INTO compliance_frameworks (name, version, effective_date, description)
            VALUES ($1, $2, $3, $4)
            RETURNING *
        `, [name, version, effective_date, description]);

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error creating compliance framework:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Create/Update compliance checklist (managers only)
router.post('/checklists', authenticateToken, requireRole(['manager']), async (req, res) => {
    try {
        const { framework_id, name, description, checklist_items, applies_to, is_mandatory } = req.body;

        const result = await pool.query(`
            INSERT INTO compliance_checklists (
                framework_id, name, description, checklist_items, applies_to, is_mandatory
            )
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
        `, [framework_id, name, description, JSON.stringify(checklist_items), applies_to, is_mandatory]);

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error creating compliance checklist:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// FCA Compliance Checklist Routes

// Get FCA compliance checklist for a case
router.get('/fca/case/:caseId', authenticateToken, async (req, res) => {
    try {
        const { caseId } = req.params;

        // Verify user has access to this case
        const caseCheck = await pool.query(
            'SELECT id, status FROM cases WHERE id = $1 AND centre_id = $2',
            [caseId, req.user.centre_id]
        );
        
        if (caseCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Case not found' });
        }

        const caseData = caseCheck.rows[0];

        // Get FCA compliance items applicable to current case status
        const itemsResult = await pool.query(`
            SELECT fci.*, 
                   ccl.is_completed, ccl.completed_by, ccl.completed_at, 
                   ccl.notes, ccl.evidence_file_id,
                   u.first_name || ' ' || u.last_name as completed_by_name,
                   f.original_filename as evidence_filename
            FROM fca_compliance_items fci
            LEFT JOIN case_compliance_checklist ccl ON fci.id = ccl.compliance_item_id AND ccl.case_id = $1
            LEFT JOIN users u ON ccl.completed_by = u.id
            LEFT JOIN files f ON ccl.evidence_file_id = f.id
            WHERE fci.is_active = true
            AND (fci.applies_to_status IS NULL OR $2 = ANY(fci.applies_to_status))
            ORDER BY fci.category, fci.sort_order
        `, [caseId, caseData.status]);

        // Group by category
        const itemsByCategory = {};
        itemsResult.rows.forEach(item => {
            if (!itemsByCategory[item.category]) {
                itemsByCategory[item.category] = [];
            }
            itemsByCategory[item.category].push(item);
        });

        // Calculate completion statistics
        const totalItems = itemsResult.rows.length;
        const completedItems = itemsResult.rows.filter(item => item.is_completed).length;
        const mandatoryItems = itemsResult.rows.filter(item => item.is_mandatory).length;
        const completedMandatoryItems = itemsResult.rows.filter(item => item.is_mandatory && item.is_completed).length;

        res.json({
            case_id: caseId,
            case_status: caseData.status,
            items_by_category: itemsByCategory,
            statistics: {
                total_items: totalItems,
                completed_items: completedItems,
                completion_percentage: totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0,
                mandatory_items: mandatoryItems,
                completed_mandatory_items: completedMandatoryItems,
                mandatory_completion_percentage: mandatoryItems > 0 ? Math.round((completedMandatoryItems / mandatoryItems) * 100) : 0
            }
        });
    } catch (error) {
        console.error('Error fetching FCA compliance checklist:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update FCA compliance checklist item
router.put('/fca/case/:caseId/item/:itemId', authenticateToken, async (req, res) => {
    try {
        const { caseId, itemId } = req.params;
        const { is_completed, notes, evidence_file_id } = req.body;

        // Verify user has access to this case
        const caseCheck = await pool.query(
            'SELECT id FROM cases WHERE id = $1 AND centre_id = $2',
            [caseId, req.user.centre_id]
        );
        
        if (caseCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Case not found' });
        }

        // Verify compliance item exists
        const itemCheck = await pool.query(
            'SELECT id FROM fca_compliance_items WHERE id = $1 AND is_active = true',
            [itemId]
        );
        
        if (itemCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Compliance item not found' });
        }

        // Upsert compliance checklist record
        const result = await pool.query(`
            INSERT INTO case_compliance_checklist (
                case_id, compliance_item_id, is_completed, completed_by, 
                completed_at, notes, evidence_file_id, updated_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
            ON CONFLICT (case_id, compliance_item_id) 
            DO UPDATE SET
                is_completed = EXCLUDED.is_completed,
                completed_by = CASE WHEN EXCLUDED.is_completed THEN EXCLUDED.completed_by ELSE NULL END,
                completed_at = CASE WHEN EXCLUDED.is_completed THEN EXCLUDED.completed_at ELSE NULL END,
                notes = EXCLUDED.notes,
                evidence_file_id = EXCLUDED.evidence_file_id,
                updated_at = EXCLUDED.updated_at
            RETURNING *
        `, [
            caseId, 
            itemId, 
            is_completed, 
            is_completed ? req.user.id : null,
            is_completed ? new Date() : null,
            notes,
            evidence_file_id
        ]);

        res.json({
            message: 'Compliance item updated successfully',
            item: result.rows[0]
        });
    } catch (error) {
        console.error('Error updating FCA compliance item:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get FCA compliance items (for admin)
router.get('/fca/items', authenticateToken, requireRole(['manager']), async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT * FROM fca_compliance_items 
            ORDER BY category, sort_order
        `);
        
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching FCA compliance items:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Create/Update FCA compliance item (managers only)
router.post('/fca/items', authenticateToken, requireRole(['manager']), async (req, res) => {
    try {
        const { 
            item_code, category, title, description, is_mandatory, 
            applies_to_status, sort_order 
        } = req.body;

        const result = await pool.query(`
            INSERT INTO fca_compliance_items (
                item_code, category, title, description, is_mandatory, 
                applies_to_status, sort_order
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *
        `, [item_code, category, title, description, is_mandatory, applies_to_status, sort_order]);

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error creating FCA compliance item:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get FCA compliance dashboard
router.get('/fca/dashboard', authenticateToken, async (req, res) => {
    try {
        // Overall FCA compliance statistics for the centre
        const overallStats = await pool.query(`
            SELECT 
                COUNT(DISTINCT c.id) as total_cases,
                COUNT(DISTINCT ccl.case_id) as cases_with_checklist,
                AVG(CASE WHEN ccl.is_completed THEN 100.0 ELSE 0.0 END) as avg_completion_percentage,
                COUNT(CASE WHEN ccl.is_completed THEN 1 END) as total_completed_items,
                COUNT(ccl.id) as total_checklist_items
            FROM cases c
            LEFT JOIN case_compliance_checklist ccl ON c.id = ccl.case_id
            WHERE c.centre_id = $1
        `, [req.user.centre_id]);

        // Compliance by category
        const categoryStats = await pool.query(`
            SELECT 
                fci.category,
                COUNT(ccl.id) as total_items,
                COUNT(CASE WHEN ccl.is_completed THEN 1 END) as completed_items,
                ROUND(AVG(CASE WHEN ccl.is_completed THEN 100.0 ELSE 0.0 END), 2) as completion_percentage
            FROM fca_compliance_items fci
            LEFT JOIN case_compliance_checklist ccl ON fci.id = ccl.compliance_item_id
            LEFT JOIN cases c ON ccl.case_id = c.id
            WHERE c.centre_id = $1 OR c.centre_id IS NULL
            GROUP BY fci.category
            ORDER BY completion_percentage DESC
        `, [req.user.centre_id]);

        // Cases requiring attention (incomplete mandatory items)
        const attentionCases = await pool.query(`
            SELECT 
                c.id as case_id,
                c.case_number,
                cl.first_name || ' ' || cl.last_name as client_name,
                c.status as case_status,
                COUNT(fci.id) FILTER (WHERE fci.is_mandatory) as mandatory_items,
                COUNT(ccl.id) FILTER (WHERE fci.is_mandatory AND ccl.is_completed) as completed_mandatory_items
            FROM cases c
            JOIN clients cl ON c.client_id = cl.id
            LEFT JOIN case_compliance_checklist ccl ON c.id = ccl.case_id
            LEFT JOIN fca_compliance_items fci ON ccl.compliance_item_id = fci.id
            WHERE c.centre_id = $1
            AND c.status NOT IN ('closed', 'cancelled')
            GROUP BY c.id, c.case_number, cl.first_name, cl.last_name, c.status
            HAVING COUNT(fci.id) FILTER (WHERE fci.is_mandatory) > COUNT(ccl.id) FILTER (WHERE fci.is_mandatory AND ccl.is_completed)
            ORDER BY c.updated_at DESC
            LIMIT 20
        `, [req.user.centre_id]);

        res.json({
            overall: overallStats.rows[0],
            by_category: categoryStats.rows,
            attention_required: attentionCases.rows
        });
    } catch (error) {
        console.error('Error fetching FCA compliance dashboard:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
