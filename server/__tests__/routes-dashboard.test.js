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

describe('Dashboard Routes', () => {
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

    describe('GET /api/dashboard/stats', () => {
        it('should return dashboard statistics', async () => {
            const mockStats = {
                totalCases: 150,
                activeCases: 85,
                completedCases: 65,
                totalClients: 120,
                pendingAppointments: 12,
                overdueActions: 8
            };

            pool.query
                .mockResolvedValueOnce({ rows: [{ count: 150 }] }) // total cases
                .mockResolvedValueOnce({ rows: [{ count: 85 }] })  // active cases
                .mockResolvedValueOnce({ rows: [{ count: 65 }] })  // completed cases
                .mockResolvedValueOnce({ rows: [{ count: 120 }] }) // total clients
                .mockResolvedValueOnce({ rows: [{ count: 12 }] })  // pending appointments
                .mockResolvedValueOnce({ rows: [{ count: 8 }] });  // overdue actions

            const response = await request(app)
                .get('/api/dashboard/stats')
                .set('Authorization', 'Bearer valid-token');

            expect(response.status).toBe(200);
            expect(response.body).toMatchObject(mockStats);
        });

        it('should handle database errors gracefully', async () => {
            pool.query.mockRejectedValueOnce(new Error('Database error'));

            const response = await request(app)
                .get('/api/dashboard/stats')
                .set('Authorization', 'Bearer valid-token');

            expect(response.status).toBe(500);
            expect(response.body.message).toContain('Error fetching dashboard statistics');
        });
    });

    describe('GET /api/dashboard/recent-activity', () => {
        it('should return recent activity', async () => {
            const mockActivity = [
                {
                    id: 1,
                    activity_type: 'case_created',
                    description: 'New case created for client John Doe',
                    created_at: new Date().toISOString(),
                    user_name: 'Test User'
                },
                {
                    id: 2,
                    activity_type: 'appointment_scheduled',
                    description: 'Appointment scheduled with Jane Smith',
                    created_at: new Date().toISOString(),
                    user_name: 'Test User'
                }
            ];

            pool.query.mockResolvedValueOnce({ rows: mockActivity });

            const response = await request(app)
                .get('/api/dashboard/recent-activity')
                .set('Authorization', 'Bearer valid-token');

            expect(response.status).toBe(200);
            expect(response.body).toEqual(mockActivity);
            expect(response.body).toHaveLength(2);
        });
    });

    describe('GET /api/dashboard/performance-metrics', () => {
        it('should return performance metrics', async () => {
            const mockMetrics = {
                casesThisMonth: 25,
                casesLastMonth: 20,
                averageCaseResolutionTime: 14.5,
                clientSatisfactionScore: 4.2,
                appointmentsThisWeek: 8
            };

            pool.query
                .mockResolvedValueOnce({ rows: [{ count: 25 }] })
                .mockResolvedValueOnce({ rows: [{ count: 20 }] })
                .mockResolvedValueOnce({ rows: [{ avg: 14.5 }] })
                .mockResolvedValueOnce({ rows: [{ avg: 4.2 }] })
                .mockResolvedValueOnce({ rows: [{ count: 8 }] });

            const response = await request(app)
                .get('/api/dashboard/performance-metrics')
                .set('Authorization', 'Bearer valid-token');

            expect(response.status).toBe(200);
            expect(response.body).toMatchObject(mockMetrics);
        });
    });

    describe('GET /api/dashboard/upcoming-appointments', () => {
        it('should return upcoming appointments', async () => {
            const mockAppointments = [
                {
                    id: 1,
                    client_name: 'John Doe',
                    appointment_date: '2024-01-15T10:00:00Z',
                    appointment_type: 'Initial Consultation',
                    status: 'scheduled'
                },
                {
                    id: 2,
                    client_name: 'Jane Smith',
                    appointment_date: '2024-01-15T14:30:00Z',
                    appointment_type: 'Follow-up',
                    status: 'scheduled'
                }
            ];

            pool.query.mockResolvedValueOnce({ rows: mockAppointments });

            const response = await request(app)
                .get('/api/dashboard/upcoming-appointments')
                .set('Authorization', 'Bearer valid-token');

            expect(response.status).toBe(200);
            expect(response.body).toEqual(mockAppointments);
        });
    });

    describe('GET /api/dashboard/alerts', () => {
        it('should return system alerts', async () => {
            const mockAlerts = [
                {
                    id: 1,
                    type: 'warning',
                    title: 'Overdue Follow-ups',
                    message: 'You have 3 overdue follow-ups',
                    created_at: new Date().toISOString()
                },
                {
                    id: 2,
                    type: 'info',
                    title: 'System Maintenance',
                    message: 'Scheduled maintenance tonight at 2 AM',
                    created_at: new Date().toISOString()
                }
            ];

            pool.query.mockResolvedValueOnce({ rows: mockAlerts });

            const response = await request(app)
                .get('/api/dashboard/alerts')
                .set('Authorization', 'Bearer valid-token');

            expect(response.status).toBe(200);
            expect(response.body).toEqual(mockAlerts);
        });
    });

    describe('POST /api/dashboard/dismiss-alert/:id', () => {
        it('should dismiss an alert', async () => {
            pool.query.mockResolvedValueOnce({ rows: [] });

            const response = await request(app)
                .post('/api/dashboard/dismiss-alert/1')
                .set('Authorization', 'Bearer valid-token');

            expect(response.status).toBe(200);
            expect(response.body.message).toContain('Alert dismissed');
        });

        it('should handle invalid alert ID', async () => {
            const response = await request(app)
                .post('/api/dashboard/dismiss-alert/invalid')
                .set('Authorization', 'Bearer valid-token');

            expect(response.status).toBe(400);
            expect(response.body.message).toContain('Invalid alert ID');
        });
    });
});