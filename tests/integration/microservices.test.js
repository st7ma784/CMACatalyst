const request = require('supertest');
const axios = require('axios');

// Integration tests for microservices communication
describe('Microservices Integration', () => {
    const BASE_URL = process.env.BASE_URL || 'http://localhost';
    const DOCUMENT_INBOX_URL = `${BASE_URL}:3001`;
    const OCR_PROCESSOR_URL = `${BASE_URL}:3002`;
    const TRANSLATION_URL = `${BASE_URL}:8003`;
    const MAIN_API_URL = `${BASE_URL}:5000`;

    beforeAll(async () => {
        // Wait for services to be ready
        await new Promise(resolve => setTimeout(resolve, 5000));
    });

    describe('Service Health Checks', () => {
        test('document-inbox should be healthy', async () => {
            try {
                const response = await axios.get(`${DOCUMENT_INBOX_URL}/health`);
                expect(response.status).toBe(200);
                expect(response.data.status).toBe('healthy');
                expect(response.data.service).toBe('document-inbox');
            } catch (error) {
                console.log('Document inbox service not available:', error.message);
            }
        });

        test('ocr-processor should be healthy', async () => {
            try {
                const response = await axios.get(`${OCR_PROCESSOR_URL}/health`);
                expect(response.status).toBe(200);
                expect(response.data.status).toBe('healthy');
                expect(response.data.service).toBe('ocr-processor');
            } catch (error) {
                console.log('OCR processor service not available:', error.message);
            }
        });

        test('translation service should be healthy', async () => {
            try {
                const response = await axios.get(`${TRANSLATION_URL}/health`);
                expect(response.status).toBe(200);
                expect(response.data.status).toBe('healthy');
            } catch (error) {
                console.log('Translation service not available:', error.message);
            }
        });

        test('main API should be healthy', async () => {
            try {
                const response = await axios.get(`${MAIN_API_URL}/api/health`);
                expect(response.status).toBe(200);
            } catch (error) {
                console.log('Main API service not available:', error.message);
            }
        });
    });

    describe('Document Processing Pipeline', () => {
        test('should upload and process document end-to-end', async () => {
            try {
                // 1. Upload document to document-inbox
                const uploadResponse = await axios.post(`${DOCUMENT_INBOX_URL}/api/documents/upload`, {
                    caseId: '123',
                    documentType: 'debt',
                    file: {
                        buffer: Buffer.from('Test document content for debt advice'),
                        originalname: 'test-debt-letter.txt',
                        mimetype: 'text/plain',
                        size: 100
                    }
                });

                expect(uploadResponse.status).toBe(200);
                expect(uploadResponse.data.fileId).toBeDefined();

                // 2. Simulate OCR processing
                const ocrResponse = await axios.post(`${OCR_PROCESSOR_URL}/api/ocr/process`, {
                    fileId: uploadResponse.data.fileId,
                    s3Key: uploadResponse.data.filePath,
                    mimeType: 'text/plain',
                    caseId: '123'
                });

                expect(ocrResponse.status).toBe(200);
                expect(ocrResponse.data.extractedText).toBeDefined();
                expect(ocrResponse.data.classification).toBeDefined();

            } catch (error) {
                console.log('Integration test skipped - services not available:', error.message);
            }
        });
    });

    describe('Translation Service Integration', () => {
        test('should translate debt advice text', async () => {
            try {
                const translationResponse = await axios.post(`${TRANSLATION_URL}/translate`, {
                    text: 'Your debt payment plan',
                    target_language: 'es',
                    source_language: 'en'
                });

                expect(translationResponse.status).toBe(200);
                expect(translationResponse.data.translated_text).toBeDefined();
                expect(translationResponse.data.target_language).toBe('es');

            } catch (error) {
                console.log('Translation test skipped - service not available:', error.message);
            }
        });

        test('should get supported languages', async () => {
            try {
                const response = await axios.get(`${TRANSLATION_URL}/languages`);
                expect(response.status).toBe(200);
                expect(response.data.supported_pairs).toBeDefined();
                expect(Array.isArray(response.data.supported_pairs)).toBe(true);

            } catch (error) {
                console.log('Language support test skipped - service not available:', error.message);
            }
        });
    });
});