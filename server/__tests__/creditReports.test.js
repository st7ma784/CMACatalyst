const request = require('supertest');
const express = require('express');
const creditReportsRoutes = require('../routes/creditReports');

// Create test app
const app = express();
app.use(express.json());
app.use('/api/credit-reports', creditReportsRoutes);

describe('Credit Reports Routes', () => {
    beforeEach(() => {
        // Reset mocks before each test
        jest.clearAllMocks();
    });

    describe('POST /api/credit-reports/request', () => {
        it('should return 401 without authentication', async () => {
            const response = await request(app)
                .post('/api/credit-reports/request')
                .send({
                    case_id: 1,
                    client_id: 1,
                    bureau: 'experian',
                    request_type: 'full'
                });
            
            expect(response.status).toBe(401);
        });

        it('should create credit report request when authenticated', async () => {
            // Mock JWT verification and user lookup
            const jwt = require('jsonwebtoken');
            jest.spyOn(jwt, 'verify').mockImplementation(() => ({ 
                userId: 1, 
                centreId: 1, 
                role: 'advisor' 
            }));

            const mockUser = {
                id: 1,
                username: 'testuser',
                centre_id: 1,
                role: 'advisor',
                centre_name: 'Test Centre',
                is_active: true
            };

            const mockCaseCheck = { rows: [{ id: 1 }] };
            const mockClientCheck = { rows: [{ id: 1, first_name: 'John', last_name: 'Doe' }] };
            const mockRequest = { rows: [{ id: 123, status: 'submitted' }] };
            const mockUpdatedRequest = { rows: [{ id: 123, status: 'submitted', requested_at: new Date() }] };

            // Setup mocks for the transaction
            const mockClient = {
                query: jest.fn()
                    .mockResolvedValueOnce({ rows: [] }) // BEGIN
                    .mockResolvedValueOnce(mockRequest) // INSERT request
                    .mockResolvedValueOnce({ rows: [] }) // COMMIT
                    .mockResolvedValueOnce(mockUpdatedRequest), // SELECT updated request
                release: jest.fn()
            };

            global.mockPool.query
                .mockResolvedValueOnce({ rows: [mockUser] }) // User lookup for auth
                .mockResolvedValueOnce(mockCaseCheck) // Case access check
                .mockResolvedValueOnce(mockClientCheck); // Client lookup

            global.mockPool.connect.mockResolvedValueOnce(mockClient);

            const response = await request(app)
                .post('/api/credit-reports/request')
                .set('Authorization', 'Bearer valid-token')
                .send({
                    case_id: 1,
                    client_id: 1,
                    bureau: 'experian',
                    request_type: 'full',
                    consent_given: true,
                    client_details: {
                        first_name: 'John',
                        last_name: 'Doe',
                        date_of_birth: '1990-01-01'
                    }
                });
            
            expect(response.status).toBe(201);
            expect(response.body.id).toBe(123);
        });

        it('should return 400 for missing required fields', async () => {
            // Mock JWT and user lookup
            const jwt = require('jsonwebtoken');
            jest.spyOn(jwt, 'verify').mockImplementation(() => ({ 
                userId: 1, 
                centreId: 1, 
                role: 'advisor' 
            }));

            const mockUser = {
                id: 1,
                username: 'testuser',
                centre_id: 1,
                role: 'advisor',
                centre_name: 'Test Centre',
                is_active: true
            };

            global.mockPool.query.mockResolvedValueOnce({ rows: [mockUser] });

            const response = await request(app)
                .post('/api/credit-reports/request')
                .set('Authorization', 'Bearer valid-token')
                .send({
                    case_id: 1
                    // Missing required fields
                });
            
            expect(response.status).toBe(400);
            expect(response.body.error).toContain('required');
        });
    });

    describe('GET /api/credit-reports/case/:caseId', () => {
        it('should return 401 without authentication', async () => {
            const response = await request(app)
                .get('/api/credit-reports/case/1');
            
            expect(response.status).toBe(401);
        });

        it('should return credit reports for a case', async () => {
            // Mock JWT and user lookup
            const jwt = require('jsonwebtoken');
            jest.spyOn(jwt, 'verify').mockImplementation(() => ({ 
                userId: 1, 
                centreId: 1, 
                role: 'advisor' 
            }));

            const mockUser = {
                id: 1,
                username: 'testuser',
                centre_id: 1,
                role: 'advisor',
                centre_name: 'Test Centre',
                is_active: true
            };

            const mockCaseCheck = { rows: [{ id: 1 }] };
            const mockReports = { 
                rows: [
                    {
                        id: 1,
                        bureau: 'experian',
                        request_type: 'full',
                        status: 'completed',
                        credit_score: 650,
                        risk_grade: 'B',
                        requested_at: new Date(),
                        first_name: 'Test',
                        last_name: 'User'
                    }
                ]
            };

            global.mockPool.query
                .mockResolvedValueOnce({ rows: [mockUser] }) // User lookup
                .mockResolvedValueOnce(mockCaseCheck) // Case access check
                .mockResolvedValueOnce(mockReports); // Reports lookup

            const response = await request(app)
                .get('/api/credit-reports/case/1')
                .set('Authorization', 'Bearer valid-token');
            
            expect(response.status).toBe(200);
            expect(response.body).toHaveLength(1);
            expect(response.body[0].bureau).toBe('experian');
            expect(response.body[0].credit_score).toBe(650);
        });

        it('should return 404 for case not found', async () => {
            // Mock JWT and user lookup
            const jwt = require('jsonwebtoken');
            jest.spyOn(jwt, 'verify').mockImplementation(() => ({ 
                userId: 1, 
                centreId: 1, 
                role: 'advisor' 
            }));

            const mockUser = {
                id: 1,
                username: 'testuser',
                centre_id: 1,
                role: 'advisor',
                centre_name: 'Test Centre',
                is_active: true
            };

            global.mockPool.query
                .mockResolvedValueOnce({ rows: [mockUser] }) // User lookup
                .mockResolvedValueOnce({ rows: [] }); // Case not found

            const response = await request(app)
                .get('/api/credit-reports/case/999')
                .set('Authorization', 'Bearer valid-token');
            
            expect(response.status).toBe(404);
            expect(response.body.error).toBe('Case not found');
        });
    });

    describe('GET /api/credit-reports/report/:requestId', () => {
        it('should return 401 without authentication', async () => {
            const response = await request(app)
                .get('/api/credit-reports/report/1');
            
            expect(response.status).toBe(401);
        });

        it('should return credit report details', async () => {
            // Mock JWT and user lookup
            const jwt = require('jsonwebtoken');
            jest.spyOn(jwt, 'verify').mockImplementation(() => ({ 
                userId: 1, 
                centreId: 1, 
                role: 'advisor' 
            }));

            const mockUser = {
                id: 1,
                username: 'testuser',
                centre_id: 1,
                role: 'advisor',
                centre_name: 'Test Centre',
                is_active: true
            };

            const mockReport = {
                rows: [{
                    id: 1,
                    request_id: 123,
                    bureau: 'experian',
                    credit_score: 650,
                    risk_grade: 'B',
                    report_data: {
                        accounts: [
                            {
                                creditor: 'Test Bank',
                                account_type: 'Credit Card',
                                balance: 1500,
                                status: 'Active'
                            }
                        ],
                        searches: [],
                        public_records: []
                    },
                    case_id: 1
                }]
            };

            global.mockPool.query
                .mockResolvedValueOnce({ rows: [mockUser] }) // User lookup
                .mockResolvedValueOnce(mockReport); // Report lookup

            const response = await request(app)
                .get('/api/credit-reports/report/123')
                .set('Authorization', 'Bearer valid-token');
            
            expect(response.status).toBe(200);
            expect(response.body.credit_score).toBe(650);
            expect(response.body.accounts).toHaveLength(1);
            expect(response.body.accounts[0].creditor).toBe('Test Bank');
        });

        it('should return 404 for report not found', async () => {
            // Mock JWT and user lookup
            const jwt = require('jsonwebtoken');
            jest.spyOn(jwt, 'verify').mockImplementation(() => ({ 
                userId: 1, 
                centreId: 1, 
                role: 'advisor' 
            }));

            const mockUser = {
                id: 1,
                username: 'testuser',
                centre_id: 1,
                role: 'advisor',
                centre_name: 'Test Centre',
                is_active: true
            };

            global.mockPool.query
                .mockResolvedValueOnce({ rows: [mockUser] }) // User lookup
                .mockResolvedValueOnce({ rows: [] }); // Report not found

            const response = await request(app)
                .get('/api/credit-reports/report/999')
                .set('Authorization', 'Bearer valid-token');
            
            expect(response.status).toBe(404);
            expect(response.body.error).toBe('Credit report not found');
        });
    });

    describe('POST /api/credit-reports/report/:requestId/summary', () => {
        it('should generate credit report summary', async () => {
            // Mock JWT and user lookup
            const jwt = require('jsonwebtoken');
            jest.spyOn(jwt, 'verify').mockImplementation(() => ({ 
                userId: 1, 
                centreId: 1, 
                role: 'advisor' 
            }));

            const mockUser = {
                id: 1,
                username: 'testuser',
                centre_id: 1,
                role: 'advisor',
                centre_name: 'Test Centre',
                is_active: true
            };

            const mockReport = {
                rows: [{
                    request_id: 123,
                    credit_score: 650,
                    risk_grade: 'B',
                    report_date: new Date(),
                    first_name: 'John',
                    last_name: 'Doe',
                    report_data: {
                        credit_score: 650,
                        accounts: [
                            {
                                creditor: 'Test Bank',
                                balance: 1500,
                                status: 'Active'
                            }
                        ]
                    }
                }]
            };

            global.mockPool.query
                .mockResolvedValueOnce({ rows: [mockUser] }) // User lookup
                .mockResolvedValueOnce(mockReport); // Report lookup

            const response = await request(app)
                .post('/api/credit-reports/report/123/summary')
                .set('Authorization', 'Bearer valid-token');
            
            expect(response.status).toBe(200);
            expect(response.body.client_name).toBe('John Doe');
            expect(response.body.credit_score).toBe(650);
            expect(response.body.risk_grade).toBe('B');
            expect(response.body.recommendations).toBeDefined();
            expect(response.body.key_findings).toBeDefined();
        });
    });
});