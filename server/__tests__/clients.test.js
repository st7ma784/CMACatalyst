const request = require('supertest');
const express = require('express');
const clientsRouter = require('../routes/clients');

jest.mock('../config/database');
const pool = require('../config/database');

describe('Clients Routes', () => {
    let app;
    let mockClient;

    beforeEach(() => {
        app = express();
        app.use(express.json());
        app.use('/api/clients', clientsRouter);

        mockClient = {
            query: jest.fn(),
            release: jest.fn()
        };
        
        pool.connect.mockResolvedValue(mockClient);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('GET /api/clients', () => {
        test('should return list of clients', async () => {
            const mockClients = [
                { 
                    id: 1, 
                    name: 'John Doe', 
                    email: 'john@example.com',
                    phone: '01234567890',
                    status: 'active'
                }
            ];

            mockClient.query.mockResolvedValue({ rows: mockClients });

            const response = await request(app).get('/api/clients');

            expect(response.status).toBe(200);
            expect(response.body).toEqual(mockClients);
        });

        test('should filter clients by status', async () => {
            const activeClients = [
                { id: 1, name: 'John Doe', status: 'active' }
            ];

            mockClient.query.mockResolvedValue({ rows: activeClients });

            const response = await request(app).get('/api/clients?status=active');

            expect(response.status).toBe(200);
            expect(response.body).toEqual(activeClients);
            expect(mockClient.query).toHaveBeenCalledWith(
                expect.stringContaining('WHERE'),
                expect.arrayContaining(['active'])
            );
        });
    });

    describe('POST /api/clients', () => {
        test('should create new client', async () => {
            const newClient = {
                name: 'Jane Smith',
                email: 'jane@example.com',
                phone: '09876543210',
                address: '123 Main St'
            };

            const mockResult = { 
                rows: [{ id: 2, ...newClient, created_at: new Date().toISOString() }] 
            };

            mockClient.query.mockResolvedValue(mockResult);

            const response = await request(app)
                .post('/api/clients')
                .send(newClient);

            expect(response.status).toBe(201);
            expect(response.body).toMatchObject(newClient);
        });

        test('should validate email format', async () => {
            const invalidClient = {
                name: 'Test Client',
                email: 'invalid-email'
            };

            const response = await request(app)
                .post('/api/clients')
                .send(invalidClient);

            expect(response.status).toBe(400);
        });

        test('should handle duplicate email', async () => {
            mockClient.query.mockRejectedValue({ code: '23505' }); // Unique violation

            const response = await request(app)
                .post('/api/clients')
                .send({
                    name: 'Test Client',
                    email: 'existing@example.com'
                });

            expect(response.status).toBe(409);
            expect(response.body.message).toContain('already exists');
        });
    });

    describe('GET /api/clients/:id', () => {
        test('should return client with cases', async () => {
            const mockClient = { 
                id: 1, 
                name: 'John Doe',
                email: 'john@example.com'
            };
            const mockCases = [
                { id: 1, status: 'active', created_at: new Date() }
            ];

            mockClient.query
                .mockResolvedValueOnce({ rows: [mockClient] })
                .mockResolvedValueOnce({ rows: mockCases });

            const response = await request(app).get('/api/clients/1');

            expect(response.status).toBe(200);
            expect(response.body).toMatchObject({
                ...mockClient,
                cases: mockCases
            });
        });
    });
});