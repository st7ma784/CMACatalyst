const express = require('express');
const router = express.Router();
const AgenticWorkflowEngine = require('../services/agenticWorkflow');
const WORKFLOW_TEMPLATES = require('../services/workflowTemplates');
const { authenticateToken } = require('../middleware/auth');

// Initialize workflow engine
const workflowEngine = new AgenticWorkflowEngine();

// Register all workflow templates
Object.entries(WORKFLOW_TEMPLATES).forEach(([key, template]) => {
    workflowEngine.registerWorkflow(key, template);
});

/**
 * GET /api/agentic-workflow/templates
 * Get all available workflow templates
 */
router.get('/templates', authenticateToken, (req, res) => {
    try {
        const templates = Array.from(workflowEngine.workflows.values()).map(workflow => ({
            id: workflow.id,
            name: workflow.name,
            description: workflow.definition.description,
            stepCount: workflow.definition.steps.length,
            created: workflow.created
        }));

        res.json({ templates });
    } catch (error) {
        console.error('Error fetching workflow templates:', error);
        res.status(500).json({ error: 'Failed to fetch workflow templates' });
    }
});

/**
 * POST /api/agentic-workflow/execute
 * Execute a workflow for a specific case
 */
router.post('/execute', authenticateToken, async (req, res) => {
    try {
        const { workflowName, caseId, initialData = {} } = req.body;

        if (!workflowName || !caseId) {
            return res.status(400).json({ error: 'Workflow name and case ID are required' });
        }

        // Add user context to initial data
        const enrichedData = {
            ...initialData,
            advisorId: req.user.id,
            advisorName: `${req.user.first_name} ${req.user.last_name}`,
            centreId: req.user.centre_id
        };

        const result = await workflowEngine.executeWorkflow(workflowName, caseId, enrichedData);

        res.json({
            success: true,
            executionId: result.executionId,
            result: result.finalResult,
            completedSteps: result.completedSteps
        });

    } catch (error) {
        console.error('Error executing workflow:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/agentic-workflow/execution/:executionId
 * Get workflow execution status and results
 */
router.get('/executions/:executionId', authenticateToken, async (req, res) => {
    try {
        const { executionId } = req.params;
        const execution = workflowEngine.activeExecutions.get(executionId);

        if (!execution) {
            return res.status(404).json({ error: 'Execution not found' });
        }

        res.json({
            id: execution.id,
            status: execution.status,
            currentStep: execution.currentStep,
            results: execution.results,
            logs: execution.logs,
            started: execution.started,
            completed: execution.completed,
            error: execution.error
        });

    } catch (error) {
        console.error('Error fetching execution status:', error);
        res.status(500).json({ error: 'Failed to fetch execution status' });
    }
});

/**
 * POST /api/agentic-workflow/case/:caseId/comprehensive-review
 * Run comprehensive case review workflow
 */
router.post('/case/:caseId/comprehensive-review', authenticateToken, async (req, res) => {
    try {
        const { caseId } = req.params;
        const { includeLetterGeneration = true } = req.body;

        const initialData = {
            advisorId: req.user.id,
            advisorName: `${req.user.first_name} ${req.user.last_name}`,
            includeLetterGeneration
        };

        const result = await workflowEngine.executeWorkflow(
            'COMPREHENSIVE_CASE_REVIEW', 
            caseId, 
            initialData
        );

        res.json({
            success: true,
            caseId,
            analysis: {
                notesAnalysis: result.analyze_notes,
                budgetValidation: result.validate_budget,
                debtRatio: result.calculate_debt_ratio,
                recommendedSolutions: result.suggest_solutions,
                identifiedRisks: result.identify_risks,
                criticalQuestions: result.generate_questions
            },
            generatedDocuments: result.generate_advice_letter ? {
                confirmationLetter: result.generate_advice_letter.generatedLetter
            } : null
        });

    } catch (error) {
        console.error('Error running comprehensive review:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/agentic-workflow/case/:caseId/debt-comparison
 * Run debt solution comparison workflow
 */
router.post('/case/:caseId/debt-comparison', authenticateToken, async (req, res) => {
    try {
        const { caseId } = req.params;
        const { clientPreferences = {} } = req.body;

        const initialData = {
            advisorId: req.user.id,
            clientPreferences
        };

        const result = await workflowEngine.executeWorkflow(
            'DEBT_SOLUTION_COMPARISON', 
            caseId, 
            initialData
        );

        res.json({
            success: true,
            caseId,
            comparison: {
                solutions: result.suggest_all_solutions,
                affordabilityAnalysis: {
                    dmp: result.calculate_affordability_dmp,
                    iva: result.calculate_affordability_iva
                },
                rankedSolutions: result.compare_solutions,
                comparisonReport: result.generate_comparison_report
            }
        });

    } catch (error) {
        console.error('Error running debt comparison:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/agentic-workflow/case/:caseId/monthly-review
 * Run monthly case review workflow
 */
router.post('/case/:caseId/monthly-review', authenticateToken, async (req, res) => {
    try {
        const { caseId } = req.params;

        const initialData = {
            advisorId: req.user.id,
            reviewDate: new Date()
        };

        const result = await workflowEngine.executeWorkflow(
            'MONTHLY_REVIEW', 
            caseId, 
            initialData
        );

        res.json({
            success: true,
            caseId,
            review: {
                recentActivity: result.analyze_recent_notes,
                paymentProgress: result.check_payment_progress,
                newRisks: result.identify_new_risks,
                overallAssessment: result.progress_assessment,
                reviewReport: result.generate_review_report,
                scheduledActions: result.schedule_follow_up
            }
        });

    } catch (error) {
        console.error('Error running monthly review:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/agentic-workflow/case/:caseId/urgent-triage
 * Run urgent case triage workflow
 */
router.post('/case/:caseId/urgent-triage', authenticateToken, async (req, res) => {
    try {
        const { caseId } = req.params;

        const initialData = {
            advisorId: req.user.id,
            triageTime: new Date()
        };

        const result = await workflowEngine.executeWorkflow(
            'URGENT_CASE_TRIAGE', 
            caseId, 
            initialData
        );

        res.json({
            success: true,
            caseId,
            triage: {
                urgencyLevel: result.categorize_urgency,
                identifiedRisks: result.identify_urgent_risks,
                immediateActions: result.immediate_actions,
                supervisorNotified: result.notify_supervisor,
                urgentSummary: result.generate_urgent_summary
            }
        });

    } catch (error) {
        console.error('Error running urgent triage:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/agentic-workflow/case/:caseId/executions
 * Get all workflow executions for a case
 */
router.get('/case/:caseId/executions', authenticateToken, async (req, res) => {
    try {
        const { caseId } = req.params;
        
        // In a real implementation, this would query the database
        const executions = Array.from(workflowEngine.activeExecutions.values())
            .filter(exec => exec.caseId === parseInt(caseId))
            .map(exec => ({
                id: exec.id,
                workflowId: exec.workflowId,
                status: exec.status,
                started: exec.started,
                completed: exec.completed,
                currentStep: exec.currentStep
            }));

        res.json({ executions });

    } catch (error) {
        console.error('Error fetching case executions:', error);
        res.status(500).json({ error: 'Failed to fetch case executions' });
    }
});

/**
 * POST /api/agentic-workflow/tools/calculate-affordability
 * Direct tool access for affordability calculations
 */
router.post('/tools/calculate-affordability', authenticateToken, async (req, res) => {
    try {
        const { monthlyIncome, monthlyExpenses, proposedPayment } = req.body;

        if (!monthlyIncome || !monthlyExpenses || !proposedPayment) {
            return res.status(400).json({ error: 'All financial parameters are required' });
        }

        const result = await workflowEngine.tools.calculateAffordability({
            monthlyIncome,
            monthlyExpenses,
            proposedPayment
        });

        res.json(result);

    } catch (error) {
        console.error('Error calculating affordability:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/agentic-workflow/tools/validate-budget
 * Direct tool access for budget validation
 */
router.post('/tools/validate-budget', authenticateToken, async (req, res) => {
    try {
        const { income, expenses } = req.body;

        if (!income || !expenses) {
            return res.status(400).json({ error: 'Income and expenses data required' });
        }

        const result = await workflowEngine.tools.validateBudget({ income, expenses });

        res.json(result);

    } catch (error) {
        console.error('Error validating budget:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/agentic-workflow/tools/suggest-solutions
 * Direct tool access for debt solution suggestions
 */
router.post('/tools/debt-to-income-ratio', authenticateToken, async (req, res) => {
    try {
        const { totalDebt, monthlyIncome, assetValue, circumstances } = req.body;

        if (!totalDebt || !monthlyIncome) {
            return res.status(400).json({ error: 'Total debt and monthly income are required' });
        }

        const result = await workflowEngine.tools.calculateDebtToIncomeRatio({
            totalDebt,
            monthlyIncome
        });

        res.json(result);

    } catch (error) {
        console.error('Error suggesting solutions:', error);
        res.status(500).json({ error: error.message });
    }
});

router.post('/tools/suggest-debt-solutions', authenticateToken, async (req, res) => {
    try {
        const { totalDebt, monthlyIncome, assetValue, circumstances } = req.body;

        if (!totalDebt || !monthlyIncome) {
            return res.status(400).json({ error: 'Total debt and monthly income are required' });
        }

        const result = await workflowEngine.tools.suggestDebtSolutions({
            totalDebt,
            monthlyIncome,
            assetValue: assetValue || 0,
            circumstances: circumstances || []
        });

        res.json(result);
    } catch (error) {
        console.error('Error suggesting debt solutions:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
