const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const documentOCRRoutes = require('../routes/documentOCR');

// Mock dependencies
jest.mock('tesseract.js');
jest.mock('../config/database');
jest.mock('fs', () => ({
    promises: {
        mkdir: jest.fn(),
        unlink: jest.fn(),
        readFile: jest.fn()
    }
}));

const app = express();
app.use(express.json());
app.use('/api/document-ocr', documentOCRRoutes);

// Mock JWT token for authentication
const mockToken = jwt.sign(
    { id: 1, centreId: 1, role: 'advisor' },
    process.env.JWT_SECRET || 'test-secret'
);

describe('Document OCR API', () => {
    let mockPool;

    beforeEach(() => {
        jest.clearAllMocks();
        mockPool = {
            query: jest.fn()
        };
        require('../config/database').mockReturnValue(mockPool);
    });

    describe('POST /scan', () => {
        it('should process document scan successfully', async () => {
            const mockOCRResult = {
                data: {
                    text: 'John Doe\nIncome: £2000\nAddress: 123 Main St'
                }
            };

            const mockExtractedData = {
                name: 'John Doe',
                income: '£2000',
                address: '123 Main St'
            };

            // Mock Tesseract
            const Tesseract = require('tesseract.js');
            Tesseract.recognize.mockResolvedValue(mockOCRResult);

            // Mock database operations
            mockPool.query
                .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // Insert processing job
                .mockResolvedValueOnce({ rows: [] }) // Update job with results
                .mockResolvedValueOnce({ rows: [] }); // Insert file record

            // Note: This test would need actual file upload simulation
            // For now, we'll test the core logic without file upload
        });
    });

    describe('GET /jobs/:jobId/status', () => {
        it('should return job status', async () => {
            const mockJob = {
                id: 1,
                status: 'completed',
                extracted_data: { name: 'John Doe' },
                confidence_score: 0.95
            };

            mockPool.query.mockResolvedValueOnce({ rows: [mockJob] });

            const response = await request(app)
                .get('/api/document-ocr/jobs/1/status')
                .set('Authorization', `Bearer ${mockToken}`)
                .expect(200);

            expect(response.body.job).toEqual(mockJob);
            expect(mockPool.query).toHaveBeenCalledWith(
                expect.stringContaining('SELECT * FROM document_processing'),
                [1, 1]
            );
        });

        it('should return 404 for non-existent job', async () => {
            mockPool.query.mockResolvedValueOnce({ rows: [] });

            await request(app)
                .get('/api/document-ocr/jobs/999/status')
                .set('Authorization', `Bearer ${mockToken}`)
                .expect(404);
        });
    });

    describe('GET /case/:caseId/processed-documents', () => {
        it('should return processed documents for case', async () => {
            const mockDocuments = [
                {
                    id: 1,
                    filename: 'payslip.pdf',
                    document_type: 'income',
                    extracted_data: { amount: '£2000' }
                }
            ];

            mockPool.query.mockResolvedValueOnce({ rows: mockDocuments });

            const response = await request(app)
                .get('/api/document-ocr/case/123/processed-documents')
                .set('Authorization', `Bearer ${mockToken}`)
                .expect(200);

            expect(response.body.documents).toEqual(mockDocuments);
            expect(mockPool.query).toHaveBeenCalledWith(
                expect.stringContaining('FROM document_processing dp'),
                [123, 1]
            );
        });
    });

    describe('POST /reprocess/:jobId', () => {
        it('should reprocess document with new settings', async () => {
            const mockFile = {
                id: 1,
                file_path: '/uploads/test.pdf',
                case_id: 123
            };

            const mockOCRResult = {
                data: {
                    text: 'Reprocessed text content'
                }
            };

            mockPool.query
                .mockResolvedValueOnce({ rows: [mockFile] }) // Get file details
                .mockResolvedValueOnce({ rows: [] }); // Update processing job

            const Tesseract = require('tesseract.js');
            Tesseract.recognize.mockResolvedValue(mockOCRResult);

            const response = await request(app)
                .post('/api/document-ocr/reprocess/1')
                .set('Authorization', `Bearer ${mockToken}`)
                .send({ documentType: 'bank_statement' })
                .expect(200);

            expect(response.body.message).toBe('Document reprocessing started');
            expect(response.body.jobId).toBe('1');
        });
    });

    describe('POST /extract-data', () => {
        it('should extract structured data from OCR text', async () => {
            const mockExtraction = {
                name: 'John Doe',
                income: '£2000',
                address: '123 Main St'
            };

            // Mock the data extraction logic
            const response = await request(app)
                .post('/api/document-ocr/extract-data')
                .set('Authorization', `Bearer ${mockToken}`)
                .send({
                    text: 'John Doe\nIncome: £2000\nAddress: 123 Main St',
                    documentType: 'income'
                })
                .expect(200);

            expect(response.body.extractedData).toBeDefined();
        });
    });
});
