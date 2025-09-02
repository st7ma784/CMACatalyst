const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');
const fs = require('fs').promises;
const path = require('path');
const caseFilestoreRoutes = require('../routes/caseFilestore');
const caseFilestoreService = require('../services/caseFilestore');

// Mock dependencies
jest.mock('../services/caseFilestore');
jest.mock('fs', () => ({
    promises: {
        mkdir: jest.fn(),
        unlink: jest.fn()
    }
}));

const app = express();
app.use(express.json());
app.use('/api/case-filestore', caseFilestoreRoutes);

// Mock JWT token for authentication
const mockToken = jwt.sign(
    { id: 1, centreId: 1, role: 'advisor' },
    process.env.JWT_SECRET || 'test-secret'
);

describe('Case Filestore API', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('POST /:caseId/initialize', () => {
        it('should initialize case folder structure', async () => {
            const mockFolderMap = new Map([
                ['/root', 1],
                ['/root/incoming', 2],
                ['/root/processed', 3]
            ]);
            
            caseFilestoreService.initializeCaseFolders.mockResolvedValue(mockFolderMap);

            const response = await request(app)
                .post('/api/case-filestore/123/initialize')
                .set('Authorization', `Bearer ${mockToken}`)
                .expect(200);

            expect(response.body.message).toBe('Case folder structure initialized successfully');
            expect(response.body.folders).toHaveLength(3);
            expect(caseFilestoreService.initializeCaseFolders).toHaveBeenCalledWith('123', 1);
        });

        it('should handle initialization errors', async () => {
            caseFilestoreService.initializeCaseFolders.mockRejectedValue(new Error('Database error'));

            await request(app)
                .post('/api/case-filestore/123/initialize')
                .set('Authorization', `Bearer ${mockToken}`)
                .expect(500);
        });
    });

    describe('GET /:caseId/folders', () => {
        it('should retrieve folder structure', async () => {
            const mockFolders = [
                { id: 1, name: 'root', path: '/', parent_id: null },
                { id: 2, name: 'incoming', path: '/incoming', parent_id: 1 }
            ];
            
            caseFilestoreService.getCaseFolderStructure.mockResolvedValue(mockFolders);

            const response = await request(app)
                .get('/api/case-filestore/123/folders')
                .set('Authorization', `Bearer ${mockToken}`)
                .expect(200);

            expect(response.body.folders).toEqual(mockFolders);
            expect(caseFilestoreService.getCaseFolderStructure).toHaveBeenCalledWith('123');
        });
    });

    describe('POST /:caseId/folders', () => {
        it('should create a new folder', async () => {
            const mockFolder = {
                id: 4,
                name: 'test-folder',
                path: '/test-folder',
                case_id: 123
            };
            
            caseFilestoreService.createFolder.mockResolvedValue(mockFolder);

            const response = await request(app)
                .post('/api/case-filestore/123/folders')
                .set('Authorization', `Bearer ${mockToken}`)
                .send({
                    folderName: 'test-folder',
                    parentPath: '/'
                })
                .expect(200);

            expect(response.body.folder).toEqual(mockFolder);
            expect(caseFilestoreService.createFolder).toHaveBeenCalledWith(
                '123', 'test-folder', '/', 1
            );
        });

        it('should validate folder name', async () => {
            await request(app)
                .post('/api/case-filestore/123/folders')
                .set('Authorization', `Bearer ${mockToken}`)
                .send({})
                .expect(400);
        });
    });

    describe('GET /:caseId/search', () => {
        it('should search files with filters', async () => {
            const mockFiles = [
                { id: 1, filename: 'test.pdf', document_category: 'income' },
                { id: 2, filename: 'bank.pdf', document_category: 'bank' }
            ];
            
            caseFilestoreService.searchCaseFiles.mockResolvedValue(mockFiles);

            const response = await request(app)
                .get('/api/case-filestore/123/search?q=test&category=income')
                .set('Authorization', `Bearer ${mockToken}`)
                .expect(200);

            expect(response.body.files).toEqual(mockFiles);
            expect(caseFilestoreService.searchCaseFiles).toHaveBeenCalledWith(
                '123', 
                'test', 
                { category: 'income', folderId: undefined, dateFrom: undefined, dateTo: undefined }
            );
        });
    });

    describe('GET /files/:fileId/audit', () => {
        it('should retrieve file audit history', async () => {
            const mockAuditHistory = [
                { id: 1, action: 'upload', timestamp: '2023-01-01T00:00:00Z' },
                { id: 2, action: 'move', timestamp: '2023-01-02T00:00:00Z' }
            ];
            
            caseFilestoreService.getFileAuditHistory.mockResolvedValue(mockAuditHistory);

            const response = await request(app)
                .get('/api/case-filestore/files/123/audit')
                .set('Authorization', `Bearer ${mockToken}`)
                .expect(200);

            expect(response.body.auditHistory).toEqual(mockAuditHistory);
            expect(caseFilestoreService.getFileAuditHistory).toHaveBeenCalledWith('123');
        });
    });

    describe('POST /files/:fileId/tags', () => {
        it('should add tag to file', async () => {
            caseFilestoreService.addFileTag.mockResolvedValue(5);

            const response = await request(app)
                .post('/api/case-filestore/files/123/tags')
                .set('Authorization', `Bearer ${mockToken}`)
                .send({ tagName: 'urgent' })
                .expect(200);

            expect(response.body.message).toBe('Tag added successfully');
            expect(response.body.tagId).toBe(5);
            expect(caseFilestoreService.addFileTag).toHaveBeenCalledWith('123', 'urgent', 1);
        });

        it('should validate tag name', async () => {
            await request(app)
                .post('/api/case-filestore/files/123/tags')
                .set('Authorization', `Bearer ${mockToken}`)
                .send({})
                .expect(400);
        });
    });

    describe('PUT /files/:fileId/move', () => {
        it('should move file to different folder', async () => {
            caseFilestoreService.moveFileToFolder.mockResolvedValue();

            await request(app)
                .put('/api/case-filestore/files/123/move')
                .set('Authorization', `Bearer ${mockToken}`)
                .send({ folderId: 456 })
                .expect(200);

            expect(caseFilestoreService.moveFileToFolder).toHaveBeenCalledWith('123', 456, 1);
        });

        it('should validate folder ID', async () => {
            await request(app)
                .put('/api/case-filestore/files/123/move')
                .set('Authorization', `Bearer ${mockToken}`)
                .send({})
                .expect(400);
        });
    });

    describe('PUT /files/:fileId/auto-organize', () => {
        it('should auto-organize file', async () => {
            caseFilestoreService.autoOrganizeFile.mockResolvedValue(789);

            const response = await request(app)
                .put('/api/case-filestore/files/123/auto-organize')
                .set('Authorization', `Bearer ${mockToken}`)
                .send({
                    documentType: 'income',
                    documentSubcategory: 'payslip',
                    caseId: 456
                })
                .expect(200);

            expect(response.body.message).toBe('File auto-organized successfully');
            expect(response.body.folderId).toBe(789);
            expect(caseFilestoreService.autoOrganizeFile).toHaveBeenCalledWith(
                '123', 'income', 'payslip', 456, 1
            );
        });
    });

    describe('GET /:caseId/stats', () => {
        it('should retrieve case storage statistics', async () => {
            // This test would require mocking the database pool
            // For now, we'll skip it as it requires more complex setup
        });
    });
});
