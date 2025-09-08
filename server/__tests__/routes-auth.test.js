const request = require('supertest');
const app = require('../app');
const bcrypt = require('bcryptjs');

// Mock database
jest.mock('../config/database');
const pool = require('../config/database');

// Mock JWT
jest.mock('jsonwebtoken', () => ({
    sign: jest.fn(() => 'mock-jwt-token'),
    verify: jest.fn(() => ({ userId: 1, role: 'advisor', centre_id: 1 }))
}));

describe('Auth Routes', () => {
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

    describe('POST /api/auth/login', () => {
        it('should login user with valid credentials', async () => {
            const mockUser = {
                id: 1,
                username: 'testuser',
                email: 'test@example.com',
                password_hash: await bcrypt.hash('password123', 10),
                role: 'advisor',
                centre_id: 1,
                is_active: true,
                centre_name: 'Test Centre'
            };

            pool.query.mockResolvedValueOnce({ rows: [mockUser] });

            const response = await request(app)
                .post('/api/auth/login')
                .send({
                    username: 'testuser',
                    password: 'password123'
                });

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('token');
            expect(response.body.user.username).toBe('testuser');
            expect(response.body.message).toBe('Login successful');
        });

        it('should reject invalid credentials', async () => {
            pool.query.mockResolvedValueOnce({ rows: [] });

            const response = await request(app)
                .post('/api/auth/login')
                .send({
                    username: 'wronguser',
                    password: 'wrongpassword'
                });

            expect(response.status).toBe(401);
            expect(response.body.message).toBe('Invalid credentials');
        });

        it('should reject users with wrong password', async () => {
            const mockUser = {
                id: 1,
                username: 'testuser',
                password_hash: await bcrypt.hash('correctpassword', 10),
                is_active: true
            };

            pool.query.mockResolvedValueOnce({ rows: [mockUser] });

            const response = await request(app)
                .post('/api/auth/login')
                .send({
                    username: 'testuser',
                    password: 'wrongpassword'
                });

            expect(response.status).toBe(401);
            expect(response.body.message).toBe('Invalid credentials');
        });

        it('should require username and password', async () => {
            const response = await request(app)
                .post('/api/auth/login')
                .send({
                    username: 'testuser'
                    // missing password
                });

            expect(response.status).toBe(400);
            expect(response.body.message).toBe('Username and password required');
        });
    });

    describe('GET /api/auth/profile', () => {
        it('should return user profile when authenticated', async () => {
            const mockUser = {
                id: 1,
                username: 'testuser',
                email: 'test@example.com',
                role: 'advisor',
                centre_id: 1,
                centre_name: 'Test Centre'
            };

            pool.query.mockResolvedValueOnce({ rows: [mockUser] });

            const response = await request(app)
                .get('/api/auth/profile')
                .set('Authorization', 'Bearer valid-jwt-token');

            expect(response.status).toBe(200);
            expect(response.body.username).toBe('testuser');
        });

        it('should return 404 for non-existent user', async () => {
            pool.query.mockResolvedValueOnce({ rows: [] });

            const response = await request(app)
                .get('/api/auth/profile')
                .set('Authorization', 'Bearer valid-jwt-token');

            expect(response.status).toBe(404);
            expect(response.body.message).toBe('User not found');
        });
    });

    describe('PUT /api/auth/change-password', () => {
        it('should change password with valid current password', async () => {
            const mockUser = {
                password_hash: await bcrypt.hash('oldpassword', 10)
            };

            pool.query
                .mockResolvedValueOnce({ rows: [mockUser] })
                .mockResolvedValueOnce({ rows: [] }); // Update password

            const response = await request(app)
                .put('/api/auth/change-password')
                .set('Authorization', 'Bearer valid-jwt-token')
                .send({
                    currentPassword: 'oldpassword',
                    newPassword: 'newpassword123'
                });

            expect(response.status).toBe(200);
            expect(response.body.message).toBe('Password changed successfully');
        });

        it('should reject invalid current password', async () => {
            const mockUser = {
                password_hash: await bcrypt.hash('oldpassword', 10)
            };

            pool.query.mockResolvedValueOnce({ rows: [mockUser] });

            const response = await request(app)
                .put('/api/auth/change-password')
                .set('Authorization', 'Bearer valid-jwt-token')
                .send({
                    currentPassword: 'wrongpassword',
                    newPassword: 'newpassword123'
                });

            expect(response.status).toBe(401);
            expect(response.body.message).toBe('Current password is incorrect');
        });

        it('should require both current and new password', async () => {
            const response = await request(app)
                .put('/api/auth/change-password')
                .set('Authorization', 'Bearer valid-jwt-token')
                .send({
                    currentPassword: 'oldpassword'
                    // missing newPassword
                });

            expect(response.status).toBe(400);
            expect(response.body.message).toBe('Current and new password required');
        });
    });

});