const request = require('supertest');
const express = require('express');
const dashboardRouter = require('../routes/dashboard');

jest.mock('../config/database');
const pool = require('../config/database');

describe('Dashboard Routes', () => {
    let app;
    let mockClient;

    beforeEach(() => {
        app = express();
        app.use(express.json());
        app.use('/api/dashboard', dashboardRouter);

        mockClient = {
            query: jest.fn(),
            release: jest.fn()
        };
        
        pool.connect.mockResolvedValue(mockClient);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('GET /api/dashboard/stats', () => {
        test('should return dashboard statistics', async () => {
            const mockStats = {
                total_cases: 150,
                active_cases: 75,
                pending_cases: 25,
                closed_cases: 50,
                total_clients: 120,
                total_debt_amount: 1500000.50
            };

            // Mock multiple queries for different stats
            mockClient.query
                .mockResolvedValueOnce({ rows: [{ count: mockStats.total_cases }] })
                .mockResolvedValueOnce({ rows: [{ count: mockStats.active_cases }] })
                .mockResolvedValueOnce({ rows: [{ count: mockStats.pending_cases }] })
                .mockResolvedValueOnce({ rows: [{ count: mockStats.closed_cases }] })
                .mockResolvedValueOnce({ rows: [{ count: mockStats.total_clients }] })
                .mockResolvedValueOnce({ rows: [{ total: mockStats.total_debt_amount }] });

            const response = await request(app).get('/api/dashboard/stats');

            expect(response.status).toBe(200);
            expect(response.body).toMatchObject({
                totalCases: expect.any(Number),
                activeCases: expect.any(Number),
                pendingCases: expect.any(Number),
                closedCases: expect.any(Number),
                totalClients: expect.any(Number)
            });
        });

        test('should handle database errors gracefully', async () => {
            mockClient.query.mockRejectedValue(new Error('Database connection failed'));

            const response = await request(app).get('/api/dashboard/stats');

            expect(response.status).toBe(500);
            expect(response.body.message).toContain('error');
        });
    });

    describe('GET /api/dashboard/recent-activity', () => {
        test('should return recent case activities', async () => {
            const mockActivities = [
                {
                    id: 1,
                    case_id: 123,
                    client_name: 'John Doe',
                    action: 'case_created',
                    created_at: new Date().toISOString()
                },
                {
                    id: 2,
                    case_id: 456,
                    client_name: 'Jane Smith',
                    action: 'document_uploaded',
                    created_at: new Date().toISOString()
                }
            ];

            mockClient.query.mockResolvedValue({ rows: mockActivities });

            const response = await request(app).get('/api/dashboard/recent-activity');

            expect(response.status).toBe(200);
            expect(response.body).toEqual(mockActivities);
        });
    });

    describe('GET /api/dashboard/case-summary', () => {
        test('should return case status summary', async () => {
            const mockSummary = [
                { status: 'active', count: 45 },
                { status: 'pending', count: 20 },
                { status: 'closed', count: 85 }
            ];

            mockClient.query.mockResolvedValue({ rows: mockSummary });

            const response = await request(app).get('/api/dashboard/case-summary');

            expect(response.status).toBe(200);
            expect(response.body).toEqual(mockSummary);
        });
    });
});