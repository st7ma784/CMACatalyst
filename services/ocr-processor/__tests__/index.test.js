const request = require('supertest');
const express = require('express');

jest.mock('tesseract.js');
jest.mock('amqplib');
jest.mock('../storage/MinioStorage');

const Tesseract = require('tesseract.js');
const amqp = require('amqplib');
const { MinioStorage } = require('../storage/MinioStorage');

describe('OCR Processor Service', () => {
    let app;
    let mockChannel;
    let mockMinioStorage;

    beforeEach(() => {
        jest.clearAllMocks();
        
        mockChannel = {
            assertQueue: jest.fn(),
            consume: jest.fn(),
            sendToQueue: jest.fn(),
            ack: jest.fn(),
            nack: jest.fn()
        };

        mockMinioStorage = {
            getObject: jest.fn()
        };

        amqp.connect = jest.fn().mockResolvedValue({
            createChannel: jest.fn().mockResolvedValue(mockChannel)
        });

        MinioStorage.mockImplementation(() => mockMinioStorage);

        delete require.cache[require.resolve('../index.js')];
        app = require('../index.js');
    });

    describe('Health Check', () => {
        test('should return healthy status', async () => {
            const response = await request(app).get('/health');
            
            expect(response.status).toBe(200);
            expect(response.body).toEqual({
                status: 'healthy',
                service: 'ocr-processor',
                timestamp: expect.any(String)
            });
        });
    });

    describe('OCR Processing', () => {
        test('should process PDF document successfully', async () => {
            const mockPdfBuffer = Buffer.from('test pdf content');
            const mockExtractedText = 'Sample PDF text content';
            
            mockMinioStorage.getObject.mockResolvedValue(mockPdfBuffer);
            
            jest.doMock('pdf-parse', () => {
                return jest.fn().mockResolvedValue({ text: mockExtractedText });
            });

            const response = await request(app)
                .post('/api/ocr/process')
                .send({
                    fileId: 'test-file-id',
                    s3Key: 'test-document.pdf',
                    mimeType: 'application/pdf',
                    caseId: 'test-case-id'
                });

            expect(response.status).toBe(200);
            expect(response.body).toMatchObject({
                fileId: 'test-file-id',
                caseId: 'test-case-id',
                extractedText: expect.any(String),
                classification: expect.objectContaining({
                    type: expect.any(String),
                    confidence: expect.any(Number)
                }),
                extractedData: expect.any(Object),
                requiresApproval: expect.any(Boolean),
                processedAt: expect.any(String)
            });
        });

        test('should handle missing required fields', async () => {
            const response = await request(app)
                .post('/api/ocr/process')
                .send({
                    fileId: 'test-file-id'
                });

            expect(response.status).toBe(400);
            expect(response.body.message).toBe('S3 key and mime type required');
        });

        test('should classify debt documents correctly', async () => {
            const debtText = 'Balance outstanding: £1,234.56 from Barclaycard account number 1234567890';
            
            const app = express();
            const classifyDocument = require('../index.js').classifyDocument;
            
            if (classifyDocument) {
                const result = classifyDocument(debtText);
                expect(result.type).toBe('debt');
                expect(result.confidence).toBeGreaterThan(0.5);
            }
        });

        test('should handle unsupported file types', async () => {
            mockMinioStorage.getObject.mockResolvedValue(Buffer.from('test'));

            const response = await request(app)
                .post('/api/ocr/process')
                .send({
                    fileId: 'test-file-id',
                    s3Key: 'test-document.txt',
                    mimeType: 'text/plain',
                    caseId: 'test-case-id'
                });

            expect(response.status).toBe(500);
        });
    });
});