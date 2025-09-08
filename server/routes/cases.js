const express = require('express');
const pool = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const ExcelJS = require('exceljs');

const router = express.Router();

// Test endpoint
router.get('/test', authenticateToken, async (req, res) => {
    try {
        console.log('Test API called - user:', req.user);
        const simpleResult = await pool.query('SELECT COUNT(*) FROM cases WHERE centre_id = $1', [req.user.centre_id]);
        res.json({ 
            user_id: req.user.id, 
            centre_id: req.user.centre_id,
            cases_count: simpleResult.rows[0].count 
        });
    } catch (error) {
        console.error('Test error:', error);
        res.status(500).json({ message: 'Test failed', error: error.message });
    }
});

// Get all cases for centre
router.get('/', authenticateToken, async (req, res) => {
    try {
        console.log('Cases API called by user:', req.user?.id, 'centre_id:', req.user?.centre_id);
        const { status, advisor_id, search, page = 1, limit = 20 } = req.query;
        const offset = (page - 1) * limit;

        let query = `
            SELECT c.*, 
                   cl.first_name || ' ' || cl.last_name as client_name,
                   u.first_name || ' ' || u.last_name as advisor_name,
                   0 as compliance_total_items,
                   0 as compliance_completed_items,
                   0 as compliance_completion_percentage
            FROM cases c
            JOIN clients cl ON c.client_id = cl.id
            LEFT JOIN users u ON c.assigned_advisor_id = u.id
            WHERE c.centre_id = $1
        `;
        const params = [req.user.centre_id];

        if (status) {
            query += ` AND c.status = $${params.length + 1}`;
            params.push(status);
        }
        if (advisor_id) {
            query += ` AND c.assigned_advisor_id = $${params.length + 1}`;
            params.push(advisor_id);
        }
        if (search) {
            query += ` AND (
                cl.first_name ILIKE $${params.length + 1} OR 
                cl.last_name ILIKE $${params.length + 1} OR 
                c.case_number ILIKE $${params.length + 1} OR
                cl.phone ILIKE $${params.length + 1} OR
                cl.email ILIKE $${params.length + 1} OR
                cl.national_insurance_number ILIKE $${params.length + 1} OR
                c.debt_stage ILIKE $${params.length + 1} OR
                c.status ILIKE $${params.length + 1}
            )`;
            params.push(`%${search}%`);
        }

        query += ` ORDER BY c.updated_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        params.push(limit, offset);

        console.log('Executing query:', query);
        console.log('With params:', params);
        const result = await pool.query(query, params);
        console.log('Query result:', result.rows.length, 'cases found');
        res.json(result.rows);
    } catch (error) {
        console.error('Get cases error:', error);
        console.error('Query was:', query);
        console.error('Params were:', params);
        res.status(500).json({ message: 'Error fetching cases' });
    }
});

// Get case by ID with full details
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const caseId = req.params.id;

        // Get case with client and advisor details
        const caseResult = await pool.query(`
            SELECT c.*, 
                   cl.first_name || ' ' || cl.last_name as client_name,
                   cl.first_name, cl.last_name, cl.date_of_birth, cl.phone, cl.email, cl.address,
                   cl.national_insurance_number, cl.relationship_status, cl.dependents, cl.employment_status,
                   u.first_name || ' ' || u.last_name as advisor_name
            FROM cases c
            JOIN clients cl ON c.client_id = cl.id
            LEFT JOIN users u ON c.assigned_advisor_id = u.id
            WHERE c.id = $1 AND c.centre_id = $2
        `, [caseId, req.user.centre_id]);

        if (caseResult.rows.length === 0) {
            return res.status(404).json({ message: 'Case not found' });
        }

        // Get assets
        const assetsResult = await pool.query(
            'SELECT * FROM assets WHERE case_id = $1 ORDER BY created_at',
            [caseId]
        );

        // Get debts
        const debtsResult = await pool.query(
            'SELECT * FROM debts WHERE case_id = $1 ORDER BY is_priority DESC, current_balance DESC',
            [caseId]
        );

        const caseData = {
            ...caseResult.rows[0],
            assets: assetsResult.rows,
            debts: debtsResult.rows
        };

        res.json(caseData);
    } catch (error) {
        console.error('Get case error:', error);
        res.status(500).json({ message: 'Error fetching case' });
    }
});

// Create new case
router.post('/', authenticateToken, async (req, res) => {
    try {
        const {
            client_id,
            debt_stage,
            priority = 'medium',
            status = 'first_enquiry',
            total_debt,
            monthly_income,
            monthly_expenses
        } = req.body;

        if (!client_id) {
            return res.status(400).json({ message: 'Client ID is required' });
        }

        // Generate case number
        const caseNumber = `CMA-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;

        // Calculate disposable income
        const disposableIncome = (monthly_income || 0) - (monthly_expenses || 0);

        const result = await pool.query(`
            INSERT INTO cases (
                client_id, centre_id, assigned_advisor_id, case_number, debt_stage, 
                priority, status, total_debt, monthly_income, monthly_expenses, disposable_income
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            RETURNING *
        `, [
            client_id, req.user.centre_id, req.user.id, caseNumber, debt_stage,
            priority, status, total_debt, monthly_income, monthly_expenses, disposableIncome
        ]);

        res.status(201).json({
            message: 'Case created successfully',
            case: result.rows[0]
        });
    } catch (error) {
        console.error('Create case error:', error);
        res.status(500).json({ message: 'Error creating case' });
    }
});

// Update case
router.put('/:id', authenticateToken, async (req, res) => {
    try {
        const caseId = req.params.id;
        const {
            assigned_advisor_id,
            debt_stage,
            priority,
            status,
            total_debt,
            monthly_income,
            monthly_expenses
        } = req.body;

        // Calculate disposable income if income/expenses provided
        let disposableIncome;
        if (monthly_income !== undefined && monthly_expenses !== undefined) {
            disposableIncome = monthly_income - monthly_expenses;
        }

        const result = await pool.query(`
            UPDATE cases SET 
                assigned_advisor_id = COALESCE($1, assigned_advisor_id),
                debt_stage = COALESCE($2, debt_stage),
                priority = COALESCE($3, priority),
                status = COALESCE($4, status),
                total_debt = COALESCE($5, total_debt),
                monthly_income = COALESCE($6, monthly_income),
                monthly_expenses = COALESCE($7, monthly_expenses),
                disposable_income = COALESCE($8, disposable_income),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $9 AND centre_id = $10
            RETURNING *
        `, [
            assigned_advisor_id, debt_stage, priority, status, total_debt,
            monthly_income, monthly_expenses, disposableIncome, caseId, req.user.centre_id
        ]);

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Case not found' });
        }

        res.json({
            message: 'Case updated successfully',
            case: result.rows[0]
        });
    } catch (error) {
        console.error('Update case error:', error);
        res.status(500).json({ message: 'Error updating case' });
    }
});

// Add asset to case
router.post('/:id/assets', authenticateToken, async (req, res) => {
    try {
        const caseId = req.params.id;
        const { asset_type, description, estimated_value, is_secured } = req.body;

        const result = await pool.query(`
            INSERT INTO assets (case_id, asset_type, description, estimated_value, is_secured)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *
        `, [caseId, asset_type, description, estimated_value, is_secured]);

        res.status(201).json({
            message: 'Asset added successfully',
            asset: result.rows[0]
        });
    } catch (error) {
        console.error('Add asset error:', error);
        res.status(500).json({ message: 'Error adding asset' });
    }
});

// Add debt to case
router.post('/:id/debts', authenticateToken, async (req, res) => {
    try {
        const caseId = req.params.id;
        const {
            creditor_name,
            debt_type,
            original_amount,
            current_balance,
            minimum_payment,
            interest_rate,
            is_priority,
            status
        } = req.body;

        const result = await pool.query(`
            INSERT INTO debts (
                case_id, creditor_name, debt_type, original_amount, current_balance,
                minimum_payment, interest_rate, is_priority, status
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING *
        `, [
            caseId, creditor_name, debt_type, original_amount, current_balance,
            minimum_payment, interest_rate, is_priority, status
        ]);

        res.status(201).json({
            message: 'Debt added successfully',
            debt: result.rows[0]
        });
    } catch (error) {
        console.error('Add debt error:', error);
        res.status(500).json({ message: 'Error adding debt' });
    }
});

// Generate Standard Financial Statement (Excel)
router.get('/:id/financial-statement', authenticateToken, async (req, res) => {
    try {
        const caseId = req.params.id;

        // Get case data
        const caseData = await pool.query(`
            SELECT c.*, 
                   cl.first_name, cl.last_name, cl.date_of_birth, cl.address,
                   cl.relationship_status, cl.dependents, cl.employment_status
            FROM cases c
            JOIN clients cl ON c.client_id = cl.id
            WHERE c.id = $1 AND c.centre_id = $2
        `, [caseId, req.user.centre_id]);

        if (caseData.rows.length === 0) {
            return res.status(404).json({ message: 'Case not found' });
        }

        const case_info = caseData.rows[0];

        // Get assets and debts
        const assets = await pool.query('SELECT * FROM assets WHERE case_id = $1', [caseId]);
        const debts = await pool.query('SELECT * FROM debts WHERE case_id = $1', [caseId]);

        // Create Excel workbook
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Standard Financial Statement');

        // Header
        worksheet.addRow(['STANDARD FINANCIAL STATEMENT']);
        worksheet.addRow([]);
        worksheet.addRow(['Client Details']);
        worksheet.addRow(['Name:', `${case_info.first_name} ${case_info.last_name}`]);
        worksheet.addRow(['Date of Birth:', case_info.date_of_birth]);
        worksheet.addRow(['Address:', case_info.address]);
        worksheet.addRow(['Relationship Status:', case_info.relationship_status]);
        worksheet.addRow(['Dependents:', case_info.dependents]);
        worksheet.addRow(['Employment:', case_info.employment_status]);
        worksheet.addRow([]);

        // Income
        worksheet.addRow(['INCOME']);
        worksheet.addRow(['Monthly Income:', case_info.monthly_income || 0]);
        worksheet.addRow([]);

        // Expenses
        worksheet.addRow(['EXPENSES']);
        worksheet.addRow(['Monthly Expenses:', case_info.monthly_expenses || 0]);
        worksheet.addRow(['Disposable Income:', case_info.disposable_income || 0]);
        worksheet.addRow([]);

        // Assets
        worksheet.addRow(['ASSETS']);
        worksheet.addRow(['Type', 'Description', 'Value', 'Secured']);
        assets.rows.forEach(asset => {
            worksheet.addRow([
                asset.asset_type,
                asset.description,
                asset.estimated_value || 0,
                asset.is_secured ? 'Yes' : 'No'
            ]);
        });
        worksheet.addRow([]);

        // Debts
        worksheet.addRow(['DEBTS']);
        worksheet.addRow(['Creditor', 'Type', 'Balance', 'Min Payment', 'Priority']);
        debts.rows.forEach(debt => {
            worksheet.addRow([
                debt.creditor_name,
                debt.debt_type,
                debt.current_balance || 0,
                debt.minimum_payment || 0,
                debt.is_priority ? 'Yes' : 'No'
            ]);
        });

        // Set response headers
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="Financial_Statement_${case_info.case_number}.xlsx"`);

        // Write to response
        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        console.error('Generate financial statement error:', error);
        res.status(500).json({ message: 'Error generating financial statement' });
    }
});

// Get case status options
router.get('/status-options', authenticateToken, async (req, res) => {
    try {
        const statusOptions = [
            { value: 'first_enquiry', label: 'First Enquiry', description: 'Initial contact and basic information gathering' },
            { value: 'fact_finding', label: 'Fact Finding', description: 'Comprehensive information gathering and verification' },
            { value: 'assessment_complete', label: 'Assessment Complete', description: 'All information gathered and analyzed' },
            { value: 'debt_options_presented', label: 'Debt Options Presented', description: 'Available solutions presented to client' },
            { value: 'solution_agreed', label: 'Solution Agreed', description: 'Client has agreed to recommended solution' },
            { value: 'implementation', label: 'Implementation', description: 'Solution being implemented' },
            { value: 'monitoring', label: 'Monitoring', description: 'Ongoing monitoring and support' },
            { value: 'review_due', label: 'Review Due', description: 'Case requires review' },
            { value: 'closure_pending', label: 'Closure Pending', description: 'Case ready for closure' },
            { value: 'closed', label: 'Closed', description: 'Case successfully closed' },
            { value: 'referred_external', label: 'Referred External', description: 'Referred to external organization' },
            { value: 'on_hold', label: 'On Hold', description: 'Case temporarily suspended' },
            { value: 'cancelled', label: 'Cancelled', description: 'Case cancelled by client or advisor' }
        ];
        
        res.json(statusOptions);
    } catch (error) {
        console.error('Get status options error:', error);
        res.status(500).json({ message: 'Error fetching status options' });
    }
});

// Update case status with compliance checklist auto-creation
router.put('/:id/status', authenticateToken, async (req, res) => {
    try {
        const caseId = req.params.id;
        const { status, notes } = req.body;

        if (!status) {
            return res.status(400).json({ message: 'Status is required' });
        }

        // Verify case exists and user has access
        const caseCheck = await pool.query(
            'SELECT id, status as current_status FROM cases WHERE id = $1 AND centre_id = $2',
            [caseId, req.user.centre_id]
        );
        
        if (caseCheck.rows.length === 0) {
            return res.status(404).json({ message: 'Case not found' });
        }

        const currentStatus = caseCheck.rows[0].current_status;

        // Update case status
        const result = await pool.query(`
            UPDATE cases SET 
                status = $1,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $2 AND centre_id = $3
            RETURNING *
        `, [status, caseId, req.user.centre_id]);

        // Add note about status change if notes provided
        if (notes) {
            await pool.query(`
                INSERT INTO notes (case_id, user_id, title, content, note_type)
                VALUES ($1, $2, $3, $4, $5)
            `, [
                caseId,
                req.user.id,
                `Status changed from ${currentStatus} to ${status}`,
                notes,
                'status_change'
            ]);
        }

        res.json({
            message: 'Case status updated successfully',
            case: result.rows[0],
            previous_status: currentStatus
        });
    } catch (error) {
        console.error('Update case status error:', error);
        res.status(500).json({ message: 'Error updating case status' });
    }
});

module.exports = router;
