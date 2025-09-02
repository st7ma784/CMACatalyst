const request = require('supertest');
const express = require('express');
const authRoutes = require('../routes/auth');

const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);

describe('Auth Routes', () => {
    describe('POST /api/auth/login', () => {
        it('should return 400 if email is missing', async () => {
            const response = await request(app)
                .post('/api/auth/login')
                .send({ password: 'password123' });
            
            expect(response.status).toBe(400);
        });

        it('should return 400 if password is missing', async () => {
            const response = await request(app)
                .post('/api/auth/login')
                .send({ email: 'test@example.com' });
            
            expect(response.status).toBe(400);
        });
    });

    describe('POST /api/auth/register', () => {
        it('should return 400 if required fields are missing', async () => {
            const response = await request(app)
                .post('/api/auth/register')
                .send({ email: 'test@example.com' });
            
            expect(response.status).toBe(400);
        });
    });
});
