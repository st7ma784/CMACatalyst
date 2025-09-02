const caseFilestoreService = require('../services/caseFilestore');
const pool = require('../config/database');
const crypto = require('crypto');
const fs = require('fs').promises;

// Mock dependencies
jest.mock('../config/database');
jest.mock('fs', () => ({
    promises: {
        readFile: jest.fn()
    }
}));
jest.mock('crypto');

describe('CaseFilestoreService', () => {
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

    describe('initializeCaseFolders', () => {
        it('should create default folder structure', async () => {
            mockClient.query
                .mockResolvedValueOnce({ rows: [] }) // Check existing folders
                .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // Insert root
                .mockResolvedValueOnce({ rows: [{ id: 2 }] }) // Insert incoming
                .mockResolvedValueOnce({ rows: [{ id: 3 }] }) // Insert processed
                .mockResolvedValueOnce({ rows: [{ id: 4 }] }) // Insert correspondence
                .mockResolvedValueOnce({ rows: [{ id: 5 }] }) // Insert income
                .mockResolvedValueOnce({ rows: [{ id: 6 }] }) // Insert expenditure
                .mockResolvedValueOnce({ rows: [{ id: 7 }] }) // Insert assets
                .mockResolvedValueOnce({ rows: [{ id: 8 }] }) // Insert debts
                .mockResolvedValueOnce({ rows: [{ id: 9 }] }) // Insert legal
                .mockResolvedValueOnce({ rows: [{ id: 10 }] }); // Insert generated

            const result = await caseFilestoreService.initializeCaseFolders(123, 1);

            expect(result).toBeInstanceOf(Map);
            expect(result.size).toBe(10);
            expect(result.get('/')).toBe(1);
            expect(result.get('/incoming')).toBe(2);
            expect(mockClient.query).toHaveBeenCalledTimes(10);
        });

        it('should return existing folders if already initialized', async () => {
            const existingFolders = [
                { id: 1, folder_path: '/' },
                { id: 2, folder_path: '/incoming' }
            ];
            mockClient.query.mockResolvedValueOnce({ rows: existingFolders });

            const result = await caseFilestoreService.initializeCaseFolders(123, 1);

            expect(result.size).toBe(2);
            expect(mockClient.query).toHaveBeenCalledTimes(1);
        });
    });

    describe('createFolder', () => {
        it('should create a new folder', async () => {
            const mockFolder = {
                id: 5,
                case_id: 123,
                folder_name: 'test-folder',
                folder_path: '/test-folder'
            };

            mockClient.query.mockResolvedValueOnce({ rows: [mockFolder] });

            const result = await caseFilestoreService.createFolder(123, 'test-folder', '/', 1);

            expect(result).toEqual(mockFolder);
            expect(mockClient.query).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO case_folders'),
                [123, 'test-folder', '/test-folder', null, 1]
            );
        });
    });

    describe('calculateFileHash', () => {
        it('should calculate SHA-256 hash of file', async () => {
            const mockFileContent = Buffer.from('test file content');
            const mockHash = 'abc123def456';

            fs.readFile.mockResolvedValue(mockFileContent);
            
            const mockHashInstance = {
                update: jest.fn().mockReturnThis(),
                digest: jest.fn().mockReturnValue(mockHash)
            };
            crypto.createHash.mockReturnValue(mockHashInstance);

            const result = await caseFilestoreService.calculateFileHash('/path/to/file.pdf');

            expect(result).toBe(mockHash);
            expect(crypto.createHash).toHaveBeenCalledWith('sha256');
            expect(mockHashInstance.update).toHaveBeenCalledWith(mockFileContent);
            expect(mockHashInstance.digest).toHaveBeenCalledWith('hex');
        });
    });

    describe('autoOrganizeFile', () => {
        it('should organize file to appropriate folder', async () => {
            const mockFolders = [
                { id: 5, folder_path: '/processed/income' }
            ];
            mockClient.query
                .mockResolvedValueOnce({ rows: mockFolders }) // Find target folder
                .mockResolvedValueOnce({ rows: [] }); // Update file

            const result = await caseFilestoreService.autoOrganizeFile(
                123, 'income', 'payslip', 456, 1
            );

            expect(result).toBe(5);
            expect(mockClient.query).toHaveBeenCalledWith(
                expect.stringContaining('SELECT id FROM case_folders'),
                [456, '/processed/income']
            );
        });

        it('should return null if target folder not found', async () => {
            mockClient.query.mockResolvedValueOnce({ rows: [] });

            const result = await caseFilestoreService.autoOrganizeFile(
                123, 'unknown', 'type', 456, 1
            );

            expect(result).toBeNull();
        });
    });

    describe('searchCaseFiles', () => {
        it('should search files with text query', async () => {
            const mockFiles = [
                { id: 1, filename: 'test.pdf', document_category: 'income' }
            ];
            mockClient.query.mockResolvedValueOnce({ rows: mockFiles });

            const result = await caseFilestoreService.searchCaseFiles(123, 'test', {});

            expect(result).toEqual(mockFiles);
            expect(mockClient.query).toHaveBeenCalledWith(
                expect.stringContaining('filename ILIKE'),
                expect.arrayContaining([123, '%test%'])
            );
        });

        it('should search files with category filter', async () => {
            const mockFiles = [
                { id: 1, filename: 'payslip.pdf', document_category: 'income' }
            ];
            mockClient.query.mockResolvedValueOnce({ rows: mockFiles });

            const result = await caseFilestoreService.searchCaseFiles(123, '', {
                category: 'income'
            });

            expect(result).toEqual(mockFiles);
            expect(mockClient.query).toHaveBeenCalledWith(
                expect.stringContaining('document_category = $2'),
                [123, 'income']
            );
        });
    });

    describe('addFileTag', () => {
        it('should create new tag and associate with file', async () => {
            mockClient.query
                .mockResolvedValueOnce({ rows: [] }) // Check existing tag
                .mockResolvedValueOnce({ rows: [{ id: 5 }] }) // Create tag
                .mockResolvedValueOnce({ rows: [] }); // Associate with file

            const result = await caseFilestoreService.addFileTag(123, 'urgent', 1);

            expect(result).toBe(5);
            expect(mockClient.query).toHaveBeenCalledTimes(3);
        });

        it('should use existing tag if found', async () => {
            mockClient.query
                .mockResolvedValueOnce({ rows: [{ id: 3 }] }) // Existing tag
                .mockResolvedValueOnce({ rows: [] }); // Associate with file

            const result = await caseFilestoreService.addFileTag(123, 'urgent', 1);

            expect(result).toBe(3);
            expect(mockClient.query).toHaveBeenCalledTimes(2);
        });
    });

    describe('getFileAuditHistory', () => {
        it('should retrieve audit log for file', async () => {
            const mockAuditLog = [
                {
                    id: 1,
                    action: 'upload',
                    timestamp: '2023-01-01T00:00:00Z',
                    user_name: 'John Doe'
                }
            ];
            mockClient.query.mockResolvedValueOnce({ rows: mockAuditLog });

            const result = await caseFilestoreService.getFileAuditHistory(123);

            expect(result).toEqual(mockAuditLog);
            expect(mockClient.query).toHaveBeenCalledWith(
                expect.stringContaining('FROM document_audit_log dal'),
                [123]
            );
        });
    });

    describe('moveFileToFolder', () => {
        it('should update file folder and log action', async () => {
            mockClient.query
                .mockResolvedValueOnce({ rows: [] }) // Update file
                .mockResolvedValueOnce({ rows: [] }); // Log action

            await caseFilestoreService.moveFileToFolder(123, 456, 1);

            expect(mockClient.query).toHaveBeenCalledWith(
                expect.stringContaining('UPDATE files SET folder_id'),
                [456, 123]
            );
            expect(mockClient.query).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO document_audit_log'),
                expect.arrayContaining([123, 'move', 1])
            );
        });
    });

    describe('createFileVersion', () => {
        it('should create new file version', async () => {
            const mockVersion = {
                id: 2,
                file_id: 123,
                version_number: 2,
                file_path: '/new/path.pdf'
            };
            
            mockClient.query
                .mockResolvedValueOnce({ rows: [{ max: 1 }] }) // Get current version
                .mockResolvedValueOnce({ rows: [mockVersion] }) // Create version
                .mockResolvedValueOnce({ rows: [] }); // Log action

            const result = await caseFilestoreService.createFileVersion(
                123, '/new/path.pdf', 'Updated document', 1
            );

            expect(result).toEqual(mockVersion);
            expect(mockClient.query).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO file_versions'),
                [123, 2, '/new/path.pdf', 'Updated document', 1]
            );
        });
    });
});
