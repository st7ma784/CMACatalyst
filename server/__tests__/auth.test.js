const request = require('supertest');
const express = require('express');
const authRoutes = require('../routes/auth');

// Create test app
const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);

describe('Auth Routes', () => {
    beforeEach(() => {
        // Reset mocks before each test
        jest.clearAllMocks();
    });

    describe('POST /api/auth/login', () => {
        it('should return 400 if username is missing', async () => {
            const response = await request(app)
                .post('/api/auth/login')
                .send({ password: 'password123' });
            
            expect(response.status).toBe(400);
            expect(response.body.message).toBe('Username and password required');
        });

        it('should return 400 if password is missing', async () => {
            const response = await request(app)
                .post('/api/auth/login')
                .send({ username: 'testuser' });
            
            expect(response.status).toBe(400);
            expect(response.body.message).toBe('Username and password required');
        });

        it('should return 401 for invalid credentials', async () => {
            global.mockPool.query.mockResolvedValueOnce({ rows: [] });

            const response = await request(app)
                .post('/api/auth/login')
                .send({ username: 'testuser', password: 'wrongpassword' });
            
            expect(response.status).toBe(401);
            expect(response.body.message).toBe('Invalid credentials');
        });

        it('should return 200 with token for valid credentials', async () => {
            const mockUser = {
                id: 1,
                username: 'testuser',
                password_hash: '$2a$10$abcdefghijklmnopqrstuvwxyz', // Mock hash
                centre_id: 1,
                role: 'advisor',
                centre_name: 'Test Centre'
            };

            global.mockPool.query.mockResolvedValueOnce({ rows: [mockUser] });
            
            // Mock bcrypt.compare to return true
            const bcrypt = require('bcryptjs');
            jest.spyOn(bcrypt, 'compare').mockResolvedValueOnce(true);

            const response = await request(app)
                .post('/api/auth/login')
                .send({ username: 'testuser', password: 'correctpassword' });
            
            expect(response.status).toBe(200);
            expect(response.body.message).toBe('Login successful');
            expect(response.body.token).toBeDefined();
            expect(response.body.user).toBeDefined();
            expect(response.body.user.password_hash).toBeUndefined();
        });
    });

    describe('GET /api/auth/profile', () => {
        it('should return 401 without token', async () => {
            const response = await request(app)
                .get('/api/auth/profile');
            
            expect(response.status).toBe(401);
        });
    });

    describe('PUT /api/auth/change-password', () => {
        it('should return 401 without token', async () => {
            const response = await request(app)
                .put('/api/auth/change-password')
                .send({ currentPassword: 'old', newPassword: 'new' });
            
            expect(response.status).toBe(401);
        });

        it('should return 400 if required fields are missing', async () => {
            // Mock JWT verification
            const jwt = require('jsonwebtoken');
            jest.spyOn(jwt, 'verify').mockImplementation(() => ({ 
                userId: 1, 
                centreId: 1, 
                role: 'advisor' 
            }));

            // Mock user lookup for middleware
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
                .put('/api/auth/change-password')
                .set('Authorization', 'Bearer valid-token')
                .send({ currentPassword: 'old' });
            
            expect(response.status).toBe(400);
            expect(response.body.message).toBe('Current and new password required');
        });
    });
});
