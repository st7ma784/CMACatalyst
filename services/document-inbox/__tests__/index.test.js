const request = require('supertest');
const express = require('express');

jest.mock('amqplib');
jest.mock('../storage/FileStorageService');
jest.mock('nodemailer');

const amqp = require('amqplib');
const FileStorageService = require('../storage/FileStorageService');
const nodemailer = require('nodemailer');

describe('Document Inbox Service', () => {
    let app;
    let mockChannel;
    let mockStorageService;

    beforeEach(() => {
        jest.clearAllMocks();
        
        mockChannel = {
            assertQueue: jest.fn(),
            sendToQueue: jest.fn()
        };

        mockStorageService = {
            generateFilePath: jest.fn(),
            uploadFile: jest.fn(),
            downloadFile: jest.fn(),
            deleteFile: jest.fn(),
            getCaseFileTree: jest.fn()
        };

        amqp.connect = jest.fn().mockResolvedValue({
            createChannel: jest.fn().mockResolvedValue(mockChannel)
        });

        nodemailer.createTransport = jest.fn().mockReturnValue({
            sendMail: jest.fn().mockResolvedValue({ messageId: 'test-id' })
        });

        FileStorageService.mockImplementation(() => mockStorageService);

        delete require.cache[require.resolve('../index.js')];
        app = require('../index.js');
    });

    describe('Health Check', () => {
        test('should return healthy status', async () => {
            const response = await request(app).get('/health');
            
            expect(response.status).toBe(200);
            expect(response.body).toEqual({
                status: 'healthy',
                service: 'document-inbox',
                timestamp: expect.any(String)
            });
        });
    });

    describe('File Upload', () => {
        test('should upload file successfully', async () => {
            const mockFilePath = 'cases/123/documents/test.pdf';
            const mockUploadResult = {
                key: mockFilePath,
                url: `http://localhost:9000/${mockFilePath}`
            };

            mockStorageService.generateFilePath.mockReturnValue(mockFilePath);
            mockStorageService.uploadFile.mockResolvedValue(mockUploadResult);

            const response = await request(app)
                .post('/api/documents/upload')
                .field('caseId', '123')
                .field('documentType', 'debt')
                .attach('file', Buffer.from('test pdf content'), 'test.pdf');

            expect(response.status).toBe(200);
            expect(response.body).toMatchObject({
                fileId: expect.any(String),
                fileName: 'test.pdf',
                filePath: mockFilePath,
                fileUrl: mockUploadResult.url,
                message: 'File uploaded successfully'
            });

            expect(mockStorageService.uploadFile).toHaveBeenCalledWith(
                expect.any(Buffer),
                mockFilePath,
                expect.objectContaining({
                    contentType: 'application/pdf',
                    originalName: 'test.pdf',
                    caseId: '123'
                })
            );

            expect(mockChannel.sendToQueue).toHaveBeenCalledWith(
                'document-processing',
                expect.any(Buffer),
                { persistent: true }
            );
        });

        test('should reject upload without file', async () => {
            const response = await request(app)
                .post('/api/documents/upload')
                .field('caseId', '123');

            expect(response.status).toBe(400);
            expect(response.body.message).toBe('File and case ID required');
        });

        test('should reject upload without case ID', async () => {
            const response = await request(app)
                .post('/api/documents/upload')
                .attach('file', Buffer.from('test content'), 'test.pdf');

            expect(response.status).toBe(400);
            expect(response.body.message).toBe('File and case ID required');
        });
    });

    describe('File Management', () => {
        test('should get case file tree', async () => {
            const mockFileTree = [
                { name: 'debt-documents', type: 'folder', children: [] },
                { name: 'test.pdf', type: 'file', size: 1024 }
            ];

            mockStorageService.getCaseFileTree.mockResolvedValue(mockFileTree);

            const response = await request(app).get('/api/cases/123/files');

            expect(response.status).toBe(200);
            expect(response.body).toEqual(mockFileTree);
            expect(mockStorageService.getCaseFileTree).toHaveBeenCalledWith('123');
        });

        test('should download file', async () => {
            const mockFile = {
                buffer: Buffer.from('test file content'),
                metadata: {
                    contentType: 'application/pdf',
                    originalName: 'test.pdf'
                }
            };

            mockStorageService.downloadFile.mockResolvedValue(mockFile);

            const response = await request(app).get('/api/files/cases/123/test.pdf');

            expect(response.status).toBe(200);
            expect(response.headers['content-type']).toBe('application/pdf');
            expect(response.headers['content-disposition']).toContain('attachment; filename="test.pdf"');
        });

        test('should handle file not found', async () => {
            mockStorageService.downloadFile.mockRejectedValue(new Error('File not found'));

            const response = await request(app).get('/api/files/cases/123/nonexistent.pdf');

            expect(response.status).toBe(404);
            expect(response.body.message).toBe('File not found');
        });

        test('should delete file', async () => {
            mockStorageService.deleteFile.mockResolvedValue(true);

            const response = await request(app).delete('/api/files/cases/123/test.pdf');

            expect(response.status).toBe(200);
            expect(response.body.message).toBe('File deleted successfully');
            expect(mockStorageService.deleteFile).toHaveBeenCalledWith('cases/123/test.pdf');
        });
    });

    describe('Email Processing', () => {
        test('should generate case email address', async () => {
            const response = await request(app).post('/api/cases/123/email');

            expect(response.status).toBe(200);
            expect(response.body).toMatchObject({
                caseId: '123',
                emailAddress: expect.stringMatching(/case-123@.+/),
                message: 'Case email address generated'
            });
        });

        test('should process email webhook', async () => {
            const mockUploadResult = {
                key: 'cases/123/email-attachments/test.pdf',
                url: 'http://localhost:9000/test.pdf'
            };

            mockStorageService.uploadFile.mockResolvedValue(mockUploadResult);

            const emailData = {
                to: 'case-123@mordecai.local',
                from: 'client@example.com',
                subject: 'Document submission',
                attachments: [{
                    filename: 'debt-statement.pdf',
                    contentType: 'application/pdf',
                    content: Buffer.from('test content').toString('base64')
                }]
            };

            const response = await request(app)
                .post('/api/email/webhook')
                .send(emailData);

            expect(response.status).toBe(200);
            expect(response.body.message).toBe('Email processed successfully');
            
            expect(mockStorageService.uploadFile).toHaveBeenCalled();
            expect(mockChannel.sendToQueue).toHaveBeenCalledWith(
                'document-processing',
                expect.any(Buffer),
                { persistent: true }
            );
        });

        test('should reject invalid case email format', async () => {
            const response = await request(app)
                .post('/api/email/webhook')
                .send({
                    to: 'invalid@mordecai.local',
                    from: 'test@example.com',
                    subject: 'Test'
                });

            expect(response.status).toBe(400);
            expect(response.body.message).toBe('Invalid case email format');
        });
    });
});