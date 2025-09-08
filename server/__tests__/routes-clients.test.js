const request = require('supertest');
const app = require('../app');

// Mock database
jest.mock('../config/database');
const pool = require('../config/database');

// Mock authentication middleware
jest.mock('../middleware/auth', () => (req, res, next) => {
    req.user = { id: 1, role: 'advisor', centre_id: 1 };
    next();
});

describe('Clients Routes', () => {
    let mockClient;

    beforeEach(() => {
        jest.clearAllMocks();
        mockClient = {
            query: jest.fn(),
            release: jest.fn()
        };
        pool.connect = jest.fn().mockResolvedValue(mockClient);
        pool.query = jest.fn();
    });

    describe('GET /api/clients', () => {
        it('should return list of clients', async () => {
            const mockClients = [
                {
                    id: 1,
                    first_name: 'John',
                    last_name: 'Doe',
                    email: 'john.doe@example.com',
                    phone: '+1234567890',
                    date_of_birth: '1990-01-01',
                    created_at: new Date().toISOString()
                },
                {
                    id: 2,
                    first_name: 'Jane',
                    last_name: 'Smith',
                    email: 'jane.smith@example.com',
                    phone: '+0987654321',
                    date_of_birth: '1985-06-15',
                    created_at: new Date().toISOString()
                }
            ];

            pool.query.mockResolvedValueOnce({ rows: mockClients });

            const response = await request(app)
                .get('/api/clients')
                .set('Authorization', 'Bearer valid-token');

            expect(response.status).toBe(200);
            expect(response.body).toEqual(mockClients);
            expect(pool.query).toHaveBeenCalledWith(
                expect.stringContaining('SELECT'),
                expect.any(Array)
            );
        });

        it('should filter clients by search query', async () => {
            const mockClients = [
                {
                    id: 1,
                    first_name: 'John',
                    last_name: 'Doe',
                    email: 'john.doe@example.com'
                }
            ];

            pool.query.mockResolvedValueOnce({ rows: mockClients });

            const response = await request(app)
                .get('/api/clients?search=john')
                .set('Authorization', 'Bearer valid-token');

            expect(response.status).toBe(200);
            expect(response.body).toEqual(mockClients);
            expect(pool.query).toHaveBeenCalledWith(
                expect.stringContaining('ILIKE'),
                expect.arrayContaining(['%john%'])
            );
        });

        it('should handle database errors', async () => {
            pool.query.mockRejectedValueOnce(new Error('Database error'));

            const response = await request(app)
                .get('/api/clients')
                .set('Authorization', 'Bearer valid-token');

            expect(response.status).toBe(500);
            expect(response.body.message).toContain('Error fetching clients');
        });
    });

    describe('GET /api/clients/:id', () => {
        it('should return specific client', async () => {
            const mockClient = {
                id: 1,
                first_name: 'John',
                last_name: 'Doe',
                email: 'john.doe@example.com',
                phone: '+1234567890',
                address: '123 Main St',
                city: 'Anytown',
                postcode: 'ABC123'
            };

            pool.query.mockResolvedValueOnce({ rows: [mockClient] });

            const response = await request(app)
                .get('/api/clients/1')
                .set('Authorization', 'Bearer valid-token');

            expect(response.status).toBe(200);
            expect(response.body).toEqual(mockClient);
            expect(pool.query).toHaveBeenCalledWith(
                expect.stringContaining('WHERE id = $1'),
                [1]
            );
        });

        it('should return 404 for non-existent client', async () => {
            pool.query.mockResolvedValueOnce({ rows: [] });

            const response = await request(app)
                .get('/api/clients/999')
                .set('Authorization', 'Bearer valid-token');

            expect(response.status).toBe(404);
            expect(response.body.message).toContain('Client not found');
        });

        it('should handle invalid client ID', async () => {
            const response = await request(app)
                .get('/api/clients/invalid')
                .set('Authorization', 'Bearer valid-token');

            expect(response.status).toBe(400);
            expect(response.body.message).toContain('Invalid client ID');
        });
    });

    describe('POST /api/clients', () => {
        it('should create new client', async () => {
            const newClient = {
                first_name: 'John',
                last_name: 'Doe',
                email: 'john.doe@example.com',
                phone: '+1234567890',
                date_of_birth: '1990-01-01',
                address: '123 Main St',
                city: 'Anytown',
                postcode: 'ABC123'
            };

            const mockCreatedClient = { id: 1, ...newClient };
            pool.query.mockResolvedValueOnce({ rows: [mockCreatedClient] });

            const response = await request(app)
                .post('/api/clients')
                .set('Authorization', 'Bearer valid-token')
                .send(newClient);

            expect(response.status).toBe(201);
            expect(response.body).toEqual(mockCreatedClient);
            expect(pool.query).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO'),
                expect.arrayContaining([
                    newClient.first_name,
                    newClient.last_name,
                    newClient.email
                ])
            );
        });

        it('should validate required fields', async () => {
            const incompleteClient = {
                first_name: 'John',
                // Missing required fields
            };

            const response = await request(app)
                .post('/api/clients')
                .set('Authorization', 'Bearer valid-token')
                .send(incompleteClient);

            expect(response.status).toBe(400);
            expect(response.body.message).toContain('required');
        });

        it('should handle duplicate email', async () => {
            pool.query.mockRejectedValueOnce({
                code: '23505', // PostgreSQL unique constraint violation
                constraint: 'clients_email_key'
            });

            const response = await request(app)
                .post('/api/clients')
                .set('Authorization', 'Bearer valid-token')
                .send({
                    first_name: 'John',
                    last_name: 'Doe',
                    email: 'existing@example.com',
                    phone: '+1234567890'
                });

            expect(response.status).toBe(400);
            expect(response.body.message).toContain('Email already exists');
        });
    });

    describe('PUT /api/clients/:id', () => {
        it('should update existing client', async () => {
            const updates = {
                first_name: 'John Updated',
                last_name: 'Doe Updated',
                email: 'updated@example.com'
            };

            const mockUpdatedClient = { id: 1, ...updates };
            pool.query.mockResolvedValueOnce({ rows: [mockUpdatedClient] });

            const response = await request(app)
                .put('/api/clients/1')
                .set('Authorization', 'Bearer valid-token')
                .send(updates);

            expect(response.status).toBe(200);
            expect(response.body).toEqual(mockUpdatedClient);
            expect(pool.query).toHaveBeenCalledWith(
                expect.stringContaining('UPDATE'),
                expect.arrayContaining([updates.first_name, updates.last_name, updates.email])
            );
        });

        it('should return 404 for non-existent client', async () => {
            pool.query.mockResolvedValueOnce({ rows: [] });

            const response = await request(app)
                .put('/api/clients/999')
                .set('Authorization', 'Bearer valid-token')
                .send({ first_name: 'Updated' });

            expect(response.status).toBe(404);
            expect(response.body.message).toContain('Client not found');
        });
    });

    describe('DELETE /api/clients/:id', () => {
        it('should soft delete client', async () => {
            pool.query.mockResolvedValueOnce({ rowCount: 1 });

            const response = await request(app)
                .delete('/api/clients/1')
                .set('Authorization', 'Bearer valid-token');

            expect(response.status).toBe(200);
            expect(response.body.message).toContain('deleted successfully');
            expect(pool.query).toHaveBeenCalledWith(
                expect.stringContaining('UPDATE'),
                expect.arrayContaining([1])
            );
        });

        it('should return 404 for non-existent client', async () => {
            pool.query.mockResolvedValueOnce({ rowCount: 0 });

            const response = await request(app)
                .delete('/api/clients/999')
                .set('Authorization', 'Bearer valid-token');

            expect(response.status).toBe(404);
            expect(response.body.message).toContain('Client not found');
        });

        it('should require admin role for permanent deletion', async () => {
            // Override auth mock for this test
            const app = require('../app');
            const authMock = require('../middleware/auth');
            authMock.mockImplementationOnce((req, res, next) => {
                req.user = { id: 1, role: 'advisor' }; // Not admin
                next();
            });

            const response = await request(app)
                .delete('/api/clients/1?permanent=true')
                .set('Authorization', 'Bearer valid-token');

            expect(response.status).toBe(403);
            expect(response.body.message).toContain('Admin access required');
        });
    });

    describe('GET /api/clients/:id/cases', () => {
        it('should return client cases', async () => {
            const mockCases = [
                {
                    id: 1,
                    client_id: 1,
                    case_type: 'debt_advice',
                    status: 'active',
                    created_at: new Date().toISOString()
                },
                {
                    id: 2,
                    client_id: 1,
                    case_type: 'budget_planning',
                    status: 'completed',
                    created_at: new Date().toISOString()
                }
            ];

            pool.query.mockResolvedValueOnce({ rows: mockCases });

            const response = await request(app)
                .get('/api/clients/1/cases')
                .set('Authorization', 'Bearer valid-token');

            expect(response.status).toBe(200);
            expect(response.body).toEqual(mockCases);
            expect(pool.query).toHaveBeenCalledWith(
                expect.stringContaining('WHERE client_id = $1'),
                [1]
            );
        });
    });

    describe('GET /api/clients/:id/appointments', () => {
        it('should return client appointments', async () => {
            const mockAppointments = [
                {
                    id: 1,
                    client_id: 1,
                    appointment_date: '2024-01-15T10:00:00Z',
                    appointment_type: 'consultation',
                    status: 'scheduled'
                }
            ];

            pool.query.mockResolvedValueOnce({ rows: mockAppointments });

            const response = await request(app)
                .get('/api/clients/1/appointments')
                .set('Authorization', 'Bearer valid-token');

            expect(response.status).toBe(200);
            expect(response.body).toEqual(mockAppointments);
        });
    });

    describe('POST /api/clients/:id/notes', () => {
        it('should add note to client', async () => {
            const noteData = {
                content: 'Client called to discuss payment options',
                note_type: 'general'
            };

            const mockNote = {
                id: 1,
                client_id: 1,
                ...noteData,
                created_at: new Date().toISOString(),
                created_by: 1
            };

            pool.query.mockResolvedValueOnce({ rows: [mockNote] });

            const response = await request(app)
                .post('/api/clients/1/notes')
                .set('Authorization', 'Bearer valid-token')
                .send(noteData);

            expect(response.status).toBe(201);
            expect(response.body).toEqual(mockNote);
            expect(pool.query).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO'),
                expect.arrayContaining([1, noteData.content, noteData.note_type, 1])
            );
        });

        it('should validate note content', async () => {
            const response = await request(app)
                .post('/api/clients/1/notes')
                .set('Authorization', 'Bearer valid-token')
                .send({ note_type: 'general' }); // Missing content

            expect(response.status).toBe(400);
            expect(response.body.message).toContain('content is required');
        });
    });
});