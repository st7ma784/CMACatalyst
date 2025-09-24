const request = require('supertest');
const express = require('express');
const casesRouter = require('../routes/cases');

// Mock the database pool
jest.mock('../config/database');
const pool = require('../config/database');

describe('Cases Routes', () => {
    let app;
    let mockClient;

    beforeEach(() => {
        app = express();
        app.use(express.json());
        app.use('/api/cases', casesRouter);

        mockClient = {
            query: jest.fn(),
            release: jest.fn()
        };
        
        pool.connect.mockResolvedValue(mockClient);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('GET /api/cases', () => {
        test('should return list of cases', async () => {
            const mockCases = [
                { id: 1, client_name: 'John Doe', status: 'active' },
                { id: 2, client_name: 'Jane Smith', status: 'pending' }
            ];

            mockClient.query.mockResolvedValue({ rows: mockCases });

            const response = await request(app).get('/api/cases');

            expect(response.status).toBe(200);
            expect(response.body).toEqual(mockCases);
            expect(mockClient.query).toHaveBeenCalledWith(
                expect.stringContaining('SELECT'),
                expect.any(Array)
            );
        });

        test('should handle database errors', async () => {
            mockClient.query.mockRejectedValue(new Error('Database error'));

            const response = await request(app).get('/api/cases');

            expect(response.status).toBe(500);
            expect(response.body.message).toContain('error');
        });
    });

    describe('POST /api/cases', () => {
        test('should create new case', async () => {
            const newCase = {
                client_name: 'New Client',
                status: 'active',
                adviser_id: 1
            };

            const mockResult = { 
                rows: [{ id: 3, ...newCase, created_at: new Date().toISOString() }] 
            };

            mockClient.query.mockResolvedValue(mockResult);

            const response = await request(app)
                .post('/api/cases')
                .send(newCase);

            expect(response.status).toBe(201);
            expect(response.body).toMatchObject(newCase);
            expect(mockClient.query).toHaveBeenCalledWith(
                expect.stringContaining('INSERT'),
                expect.arrayContaining([newCase.client_name, newCase.status])
            );
        });

        test('should validate required fields', async () => {
            const response = await request(app)
                .post('/api/cases')
                .send({});

            expect(response.status).toBe(400);
            expect(response.body.message).toContain('required');
        });
    });

    describe('GET /api/cases/:id', () => {
        test('should return specific case', async () => {
            const mockCase = { 
                id: 1, 
                client_name: 'John Doe', 
                status: 'active',
                created_at: new Date().toISOString()
            };

            mockClient.query.mockResolvedValue({ rows: [mockCase] });

            const response = await request(app).get('/api/cases/1');

            expect(response.status).toBe(200);
            expect(response.body).toEqual(mockCase);
        });

        test('should return 404 for non-existent case', async () => {
            mockClient.query.mockResolvedValue({ rows: [] });

            const response = await request(app).get('/api/cases/999');

            expect(response.status).toBe(404);
        });
    });

    describe('PUT /api/cases/:id', () => {
        test('should update case', async () => {
            const updatedCase = { status: 'closed', notes: 'Case resolved' };
            const mockResult = { 
                rows: [{ id: 1, ...updatedCase, updated_at: new Date().toISOString() }] 
            };

            mockClient.query.mockResolvedValue(mockResult);

            const response = await request(app)
                .put('/api/cases/1')
                .send(updatedCase);

            expect(response.status).toBe(200);
            expect(response.body).toMatchObject(updatedCase);
        });
    });

    describe('DELETE /api/cases/:id', () => {
        test('should delete case', async () => {
            mockClient.query.mockResolvedValue({ rowCount: 1 });

            const response = await request(app).delete('/api/cases/1');

            expect(response.status).toBe(200);
            expect(response.body.message).toContain('deleted');
        });

        test('should handle non-existent case deletion', async () => {
            mockClient.query.mockResolvedValue({ rowCount: 0 });

            const response = await request(app).delete('/api/cases/999');

            expect(response.status).toBe(404);
        });
    });
});