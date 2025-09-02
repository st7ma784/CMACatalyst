const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');
const agenticWorkflowRoutes = require('../routes/agenticWorkflow');
const AgenticWorkflowEngine = require('../services/agenticWorkflow');

// Mock dependencies
jest.mock('../services/agenticWorkflow');
jest.mock('../config/database');

const app = express();
app.use(express.json());
app.use('/api/agentic-workflow', agenticWorkflowRoutes);

// Mock JWT token for authentication
const mockToken = jwt.sign(
    { id: 1, centreId: 1, role: 'advisor' },
    process.env.JWT_SECRET || 'test-secret'
);

describe('Agentic Workflow API', () => {
    let mockPool;
    let mockWorkflowEngine;

    beforeEach(() => {
        jest.clearAllMocks();
        mockPool = {
            query: jest.fn()
        };
        require('../config/database').mockReturnValue(mockPool);
        
        mockWorkflowEngine = {
            executeWorkflow: jest.fn(),
            getWorkflowStatus: jest.fn(),
            getWorkflowTemplates: jest.fn(),
            tools: {
                calculateAffordability: jest.fn(),
                validateBudget: jest.fn(),
                calculateDebtToIncomeRatio: jest.fn(),
                suggestDebtSolutions: jest.fn()
            }
        };
        AgenticWorkflowEngine.mockImplementation(() => mockWorkflowEngine);
    });

    describe('POST /execute', () => {
        it('should execute workflow successfully', async () => {
            const mockExecution = {
                id: 'exec-123',
                status: 'running',
                steps: []
            };

            mockWorkflowEngine.executeWorkflow.mockResolvedValue(mockExecution);

            const response = await request(app)
                .post('/api/agentic-workflow/execute')
                .set('Authorization', `Bearer ${mockToken}`)
                .send({
                    templateId: 'COMPREHENSIVE_CASE_REVIEW',
                    caseId: 123,
                    parameters: { urgency: 'high' }
                })
                .expect(200);

            expect(response.body.execution).toEqual(mockExecution);
            expect(mockWorkflowEngine.executeWorkflow).toHaveBeenCalledWith(
                'COMPREHENSIVE_CASE_REVIEW',
                { caseId: 123, urgency: 'high', userId: 1 }
            );
        });

        it('should validate required parameters', async () => {
            await request(app)
                .post('/api/agentic-workflow/execute')
                .set('Authorization', `Bearer ${mockToken}`)
                .send({})
                .expect(400);
        });
    });

    describe('GET /execution/:executionId/status', () => {
        it('should return execution status', async () => {
            const mockStatus = {
                id: 'exec-123',
                status: 'completed',
                currentStep: 5,
                totalSteps: 5,
                results: { advice: 'Recommend DMP' }
            };

            mockWorkflowEngine.getWorkflowStatus.mockResolvedValue(mockStatus);

            const response = await request(app)
                .get('/api/agentic-workflow/execution/exec-123/status')
                .set('Authorization', `Bearer ${mockToken}`)
                .expect(200);

            expect(response.body.status).toEqual(mockStatus);
        });
    });

    describe('GET /templates', () => {
        it('should return available workflow templates', async () => {
            const mockTemplates = [
                {
                    id: 'COMPREHENSIVE_CASE_REVIEW',
                    name: 'Comprehensive Case Review',
                    description: 'Complete case analysis'
                }
            ];

            mockWorkflowEngine.getWorkflowTemplates.mockReturnValue(mockTemplates);

            const response = await request(app)
                .get('/api/agentic-workflow/templates')
                .set('Authorization', `Bearer ${mockToken}`)
                .expect(200);

            expect(response.body.templates).toEqual(mockTemplates);
        });
    });

    describe('Workflow Tools', () => {
        describe('POST /tools/affordability', () => {
            it('should calculate affordability', async () => {
                mockWorkflowEngine.tools.calculateAffordability.mockReturnValue({
                    isAffordable: true,
                    maxAffordable: 600,
                    thirtyPercentRule: 500
                });

                const response = await request(app)
                    .post('/api/agentic-workflow/tools/affordability')
                    .set('Authorization', `Bearer ${mockToken}`)
                    .send({
                        monthlyIncome: 2000,
                        monthlyExpenses: 1200,
                        proposedPayment: 400
                    })
                    .expect(200);

                expect(response.body.isAffordable).toBe(true);
                expect(response.body.maxAffordable).toBe(600);
            });
        });

        describe('POST /tools/budget-validation', () => {
            it('should validate budget', async () => {
                mockWorkflowEngine.tools.validateBudget.mockReturnValue({
                    isValid: true,
                    surplus: 300,
                    warnings: []
                });

                const response = await request(app)
                    .post('/api/agentic-workflow/tools/budget-validation')
                    .set('Authorization', `Bearer ${mockToken}`)
                    .send({
                        income: { salary: 2000 },
                        expenses: { rent: 800, food: 300 }
                    })
                    .expect(200);

                expect(response.body.isValid).toBe(true);
                expect(response.body.surplus).toBe(300);
            });
        });

        describe('POST /tools/debt-to-income-ratio', () => {
            it('should calculate debt-to-income ratio', async () => {
                mockWorkflowEngine.tools.calculateDebtToIncomeRatio.mockReturnValue({
                    ratio: 0.45,
                    riskLevel: 'medium',
                    recommendation: 'Consider debt consolidation'
                });

                const response = await request(app)
                    .post('/api/agentic-workflow/tools/debt-to-income-ratio')
                    .set('Authorization', `Bearer ${mockToken}`)
                    .send({
                        monthlyIncome: 2000,
                        monthlyDebtPayments: 900
                    })
                    .expect(200);

                expect(response.body.ratio).toBe(0.45);
                expect(response.body.riskLevel).toBe('medium');
            });
        });

        describe('POST /tools/debt-solutions', () => {
            it('should suggest debt solutions', async () => {
                mockWorkflowEngine.tools.suggestDebtSolutions.mockReturnValue({
                    recommendedSolution: 'DMP',
                    solutions: [
                        { type: 'DMP', suitability: 0.9, pros: ['Lower payments'] },
                        { type: 'IVA', suitability: 0.6, pros: ['Debt write-off'] }
                    ]
                });

                const response = await request(app)
                    .post('/api/agentic-workflow/tools/debt-solutions')
                    .set('Authorization', `Bearer ${mockToken}`)
                    .send({
                        totalDebt: 25000,
                        monthlyIncome: 2000,
                        assets: { property: false }
                    })
                    .expect(200);

                expect(response.body.recommendedSolution).toBe('DMP');
                expect(response.body.solutions).toHaveLength(2);
            });
        });
    });

    describe('GET /case/:caseId/executions', () => {
        it('should return workflow executions for case', async () => {
            const mockExecutions = [
                {
                    id: 'exec-123',
                    template_id: 'COMPREHENSIVE_CASE_REVIEW',
                    status: 'completed',
                    created_at: '2023-01-01T00:00:00Z'
                }
            ];

            mockPool.query.mockResolvedValueOnce({ rows: mockExecutions });

            const response = await request(app)
                .get('/api/agentic-workflow/case/123/executions')
                .set('Authorization', `Bearer ${mockToken}`)
                .expect(200);

            expect(response.body.executions).toEqual(mockExecutions);
            expect(mockPool.query).toHaveBeenCalledWith(
                expect.stringContaining('FROM workflow_executions'),
                [123, 1]
            );
        });
    });
});
