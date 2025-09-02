const request = require('supertest');
const app = require('../index');
const db = require('../config/database');

describe('Agentic Workflow System', () => {
    let authToken;
    let testCaseId;

    beforeAll(async () => {
        // Login to get auth token
        const loginResponse = await request(app)
            .post('/api/auth/login')
            .send({
                email: 'manager@test.com',
                password: 'password123'
            });

        authToken = loginResponse.body.token;

        // Create a test case
        const caseResponse = await request(app)
            .post('/api/cases')
            .set('Authorization', `Bearer ${authToken}`)
            .send({
                client_id: 1,
                problem_description: 'Test debt problem for workflow',
                total_debt: 15000,
                monthly_income: 2500
            });

        testCaseId = caseResponse.body.case.id;
    });

    describe('Workflow Templates', () => {
        test('should fetch available workflow templates', async () => {
            const response = await request(app)
                .get('/api/agentic-workflow/templates')
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            expect(response.body.templates).toBeDefined();
            expect(Array.isArray(response.body.templates)).toBe(true);
            expect(response.body.templates.length).toBeGreaterThan(0);

            // Check for expected workflow templates
            const templateNames = response.body.templates.map(t => t.name);
            expect(templateNames).toContain('COMPREHENSIVE_CASE_REVIEW');
            expect(templateNames).toContain('DEBT_SOLUTION_COMPARISON');
        });
    });

    describe('Workflow Execution', () => {
        test('should execute comprehensive case review workflow', async () => {
            const response = await request(app)
                .post('/api/agentic-workflow/comprehensive-review')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    caseId: testCaseId,
                    includeRiskAssessment: true,
                    generateLetter: true
                });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.executionId).toBeDefined();
            expect(response.body.results).toBeDefined();
            expect(response.body.results.financial_analysis).toBeDefined();
            expect(response.body.results.risk_assessment).toBeDefined();
        });

        test('should execute debt solution comparison workflow', async () => {
            const response = await request(app)
                .post('/api/agentic-workflow/debt-comparison')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    caseId: testCaseId,
                    monthlyIncome: 2500,
                    monthlyExpenses: 2000,
                    totalDebt: 15000
                });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.results).toBeDefined();
            expect(response.body.results.affordability_analysis).toBeDefined();
            expect(response.body.results.recommended_solutions).toBeDefined();
            expect(Array.isArray(response.body.results.recommended_solutions)).toBe(true);
        });

        test('should handle workflow execution with invalid case ID', async () => {
            const response = await request(app)
                .post('/api/agentic-workflow/comprehensive-review')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    caseId: 99999,
                    includeRiskAssessment: true
                });

            expect(response.status).toBe(404);
            expect(response.body.error).toContain('Case not found');
        });
    });

    describe('Workflow Status Tracking', () => {
        test('should track workflow execution status', async () => {
            // Execute a workflow first
            const executeResponse = await request(app)
                .post('/api/agentic-workflow/comprehensive-review')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    caseId: testCaseId,
                    includeRiskAssessment: true
                });

            const executionId = executeResponse.body.executionId;

            // Check status
            const statusResponse = await request(app)
                .get(`/api/agentic-workflow/status/${executionId}`)
                .set('Authorization', `Bearer ${authToken}`);

            expect(statusResponse.status).toBe(200);
            expect(statusResponse.body.execution).toBeDefined();
            expect(statusResponse.body.execution.status).toBe('completed');
            expect(statusResponse.body.execution.executionId).toBe(executionId);
        });
    });

    describe('Workflow Integration', () => {
        test('should generate documents during workflow execution', async () => {
            const response = await request(app)
                .post('/api/agentic-workflow/comprehensive-review')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    caseId: testCaseId,
                    generateLetter: true
                });

            expect(response.status).toBe(200);
            expect(response.body.results.generated_documents).toBeDefined();
            expect(Array.isArray(response.body.results.generated_documents)).toBe(true);
            
            if (response.body.results.generated_documents.length > 0) {
                const document = response.body.results.generated_documents[0];
                expect(document.type).toBeDefined();
                expect(document.content).toBeDefined();
            }
        });

        test('should perform financial calculations correctly', async () => {
            const response = await request(app)
                .post('/api/agentic-workflow/debt-comparison')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    caseId: testCaseId,
                    monthlyIncome: 3000,
                    monthlyExpenses: 2200,
                    totalDebt: 18000
                });

            expect(response.status).toBe(200);
            
            const affordability = response.body.results.affordability_analysis;
            expect(affordability).toBeDefined();
            expect(affordability.surplus).toBe(800); // 3000 - 2200
            expect(affordability.debt_to_income_ratio).toBe(6); // 18000 / 3000
            expect(affordability.affordable_payment).toBe(240); // 800 * 0.3
        });
    });

    describe('Error Handling', () => {
        test('should handle missing required parameters', async () => {
            const response = await request(app)
                .post('/api/agentic-workflow/comprehensive-review')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    // Missing caseId
                    includeRiskAssessment: true
                });

            expect(response.status).toBe(400);
            expect(response.body.error).toContain('Case ID is required');
        });

        test('should handle unauthorized access', async () => {
            const response = await request(app)
                .post('/api/agentic-workflow/comprehensive-review')
                .send({
                    caseId: testCaseId,
                    includeRiskAssessment: true
                });

            expect(response.status).toBe(401);
        });
    });

    afterAll(async () => {
        // Clean up test data
        if (testCaseId) {
            await db.query('DELETE FROM cases WHERE id = $1', [testCaseId]);
        }
        
        // Clean up workflow executions
        await db.query('DELETE FROM workflow_executions WHERE case_id = $1', [testCaseId]);
    });
});
