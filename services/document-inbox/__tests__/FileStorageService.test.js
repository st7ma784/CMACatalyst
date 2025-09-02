const FileStorageService = require('../storage/FileStorageService');
const fs = require('fs').promises;
const path = require('path');
const AWS = require('aws-sdk');

// Mock AWS SDK
jest.mock('aws-sdk');

describe('FileStorageService', () => {
  let storageService;
  let mockS3;
  const testStoragePath = './test-storage';

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Mock S3 instance
    mockS3 = {
      upload: jest.fn(),
      getObject: jest.fn(),
      listObjectsV2: jest.fn(),
      deleteObject: jest.fn()
    };
    
    AWS.S3.mockImplementation(() => mockS3);
  });

  afterEach(async () => {
    // Clean up test storage directory
    try {
      await fs.rmdir(testStoragePath, { recursive: true });
    } catch (error) {
      // Directory doesn't exist, ignore
    }
  });

  describe('Local Storage Provider', () => {
    beforeEach(() => {
      storageService = new FileStorageService({
        provider: 'local',
        localPath: testStoragePath
      });
    });

    describe('File Path Generation', () => {
      test('should generate organized file path for debt document', () => {
        const filePath = storageService.generateFilePath(123, 'debt', 'credit_card_statement.pdf');
        
        expect(filePath).toMatch(/^cases\/case-123\/debts\/\d{4}-\d{2}-\d{2}\/[a-f0-9-]+-credit_card_statement\.pdf$/);
      });

      test('should generate organized file path for bank statement', () => {
        const filePath = storageService.generateFilePath(456, 'bank_statement', 'Barclays Statement.pdf');
        
        expect(filePath).toMatch(/^cases\/case-456\/bank-statements\/\d{4}-\d{2}-\d{2}\/[a-f0-9-]+-barclays_statement\.pdf$/);
      });

      test('should generate organized file path for email attachment', () => {
        const filePath = storageService.generateFilePath(789, 'correspondence', 'letter.pdf', 'email');
        
        expect(filePath).toMatch(/^cases\/case-789\/email-attachments\/correspondence\/\d{4}-\d{2}-\d{2}\/[a-f0-9-]+-letter\.pdf$/);
      });

      test('should sanitize file names properly', () => {
        const sanitized = storageService.sanitizeFileName('My File (Copy) #1.pdf');
        expect(sanitized).toBe('my_file_copy_1.pdf');
      });
    });

    describe('File Upload', () => {
      test('should upload file to local storage', async () => {
        const fileBuffer = Buffer.from('test file content');
        const filePath = 'test/file.txt';
        const metadata = { contentType: 'text/plain', caseId: '123' };

        const result = await storageService.uploadFile(fileBuffer, filePath, metadata);

        expect(result.provider).toBe('local');
        expect(result.key).toBe(filePath);
        expect(result.url).toContain('file://');

        // Verify file was created
        const fullPath = path.join(testStoragePath, filePath);
        const fileExists = await fs.access(fullPath).then(() => true).catch(() => false);
        expect(fileExists).toBe(true);

        // Verify metadata file was created
        const metadataPath = `${fullPath}.meta.json`;
        const metadataExists = await fs.access(metadataPath).then(() => true).catch(() => false);
        expect(metadataExists).toBe(true);
      });

      test('should create nested directories automatically', async () => {
        const fileBuffer = Buffer.from('test content');
        const filePath = 'deep/nested/directory/file.txt';

        await storageService.uploadFile(fileBuffer, filePath, {});

        const fullPath = path.join(testStoragePath, filePath);
        const fileExists = await fs.access(fullPath).then(() => true).catch(() => false);
        expect(fileExists).toBe(true);
      });
    });

    describe('File Download', () => {
      test('should download file from local storage', async () => {
        const fileBuffer = Buffer.from('test file content');
        const filePath = 'test/download.txt';
        const metadata = { contentType: 'text/plain' };

        // Upload file first
        await storageService.uploadFile(fileBuffer, filePath, metadata);

        // Download file
        const result = await storageService.downloadFile(filePath);

        expect(result.buffer).toEqual(fileBuffer);
        expect(result.metadata.contentType).toBe('text/plain');
      });

      test('should handle missing metadata file gracefully', async () => {
        const fileBuffer = Buffer.from('test content');
        const filePath = 'test/no-metadata.txt';

        // Create file without metadata
        const fullPath = path.join(testStoragePath, filePath);
        await fs.mkdir(path.dirname(fullPath), { recursive: true });
        await fs.writeFile(fullPath, fileBuffer);

        const result = await storageService.downloadFile(filePath);

        expect(result.buffer).toEqual(fileBuffer);
        expect(result.metadata).toEqual({});
      });
    });

    describe('File Listing', () => {
      test('should list files in directory', async () => {
        // Create test files
        const files = [
          { path: 'test/file1.txt', content: 'content1' },
          { path: 'test/file2.pdf', content: 'content2' },
          { path: 'test/subdir/file3.doc', content: 'content3' }
        ];

        for (const file of files) {
          await storageService.uploadFile(Buffer.from(file.content), file.path, {});
        }

        const result = await storageService.listFiles('test/');

        expect(result).toHaveLength(3); // 2 files + 1 directory
        expect(result.some(f => f.key === 'test/file1.txt')).toBe(true);
        expect(result.some(f => f.key === 'test/file2.pdf')).toBe(true);
        expect(result.some(f => f.key === 'test/subdir/' && f.isDirectory)).toBe(true);
      });
    });

    describe('File Tree Building', () => {
      test('should build hierarchical file tree', async () => {
        const files = [
          { key: 'cases/case-123/debts/2024-01-01/file1.pdf', isDirectory: false, size: 1000 },
          { key: 'cases/case-123/debts/2024-01-02/file2.pdf', isDirectory: false, size: 2000 },
          { key: 'cases/case-123/bank-statements/2024-01-01/statement.pdf', isDirectory: false, size: 3000 }
        ];

        const tree = storageService.buildFileTree(files, 'cases/case-123/');

        expect(tree.children.debts).toBeDefined();
        expect(tree.children['bank-statements']).toBeDefined();
        expect(tree.children.debts.children['2024-01-01'].files).toHaveLength(1);
        expect(tree.children.debts.children['2024-01-02'].files).toHaveLength(1);
      });
    });

    describe('File Deletion', () => {
      test('should delete file from local storage', async () => {
        const fileBuffer = Buffer.from('test content');
        const filePath = 'test/delete-me.txt';

        // Upload file first
        await storageService.uploadFile(fileBuffer, filePath, {});

        // Delete file
        const result = await storageService.deleteFile(filePath);

        expect(result).toBe(true);

        // Verify file was deleted
        const fullPath = path.join(testStoragePath, filePath);
        const fileExists = await fs.access(fullPath).then(() => true).catch(() => false);
        expect(fileExists).toBe(false);
      });

      test('should handle deletion of non-existent file', async () => {
        const result = await storageService.deleteFile('non-existent/file.txt');
        expect(result).toBe(false);
      });
    });
  });

  describe('S3/Minio Storage Provider', () => {
    beforeEach(() => {
      storageService = new FileStorageService({
        provider: 'minio',
        bucket: 'test-bucket',
        endpoint: 'http://localhost:9000',
        accessKeyId: 'testkey',
        secretAccessKey: 'testsecret'
      });
    });

    describe('File Upload', () => {
      test('should upload file to S3/Minio', async () => {
        const fileBuffer = Buffer.from('test file content');
        const filePath = 'test/file.txt';
        const metadata = { contentType: 'text/plain' };

        mockS3.upload.mockReturnValue({
          promise: () => Promise.resolve({
            Location: 'http://localhost:9000/test-bucket/test/file.txt',
            Key: filePath,
            ETag: '"abc123"'
          })
        });

        const result = await storageService.uploadFile(fileBuffer, filePath, metadata);

        expect(mockS3.upload).toHaveBeenCalledWith({
          Bucket: 'test-bucket',
          Key: filePath,
          Body: fileBuffer,
          ContentType: 'text/plain',
          Metadata: expect.objectContaining({
            contentType: 'text/plain',
            uploadedAt: expect.any(String)
          })
        });

        expect(result.provider).toBe('minio');
        expect(result.key).toBe(filePath);
        expect(result.location).toContain('test-bucket');
      });
    });

    describe('File Download', () => {
      test('should download file from S3/Minio', async () => {
        const fileBuffer = Buffer.from('test file content');
        const filePath = 'test/file.txt';

        mockS3.getObject.mockReturnValue({
          promise: () => Promise.resolve({
            Body: fileBuffer,
            Metadata: { contentType: 'text/plain' }
          })
        });

        const result = await storageService.downloadFile(filePath);

        expect(mockS3.getObject).toHaveBeenCalledWith({
          Bucket: 'test-bucket',
          Key: filePath
        });

        expect(result.buffer).toEqual(fileBuffer);
        expect(result.metadata.contentType).toBe('text/plain');
      });
    });

    describe('File Listing', () => {
      test('should list files from S3/Minio', async () => {
        mockS3.listObjectsV2.mockReturnValue({
          promise: () => Promise.resolve({
            Contents: [
              {
                Key: 'test/file1.txt',
                Size: 1000,
                LastModified: new Date('2024-01-01'),
                ETag: '"abc123"'
              },
              {
                Key: 'test/file2.pdf',
                Size: 2000,
                LastModified: new Date('2024-01-02'),
                ETag: '"def456"'
              }
            ],
            CommonPrefixes: [
              { Prefix: 'test/subdir/' }
            ]
          })
        });

        const result = await storageService.listFiles('test/');

        expect(mockS3.listObjectsV2).toHaveBeenCalledWith({
          Bucket: 'test-bucket',
          Prefix: 'test/',
          Delimiter: '/'
        });

        expect(result).toHaveLength(3); // 2 files + 1 directory
        expect(result.some(f => f.key === 'test/file1.txt' && !f.isDirectory)).toBe(true);
        expect(result.some(f => f.key === 'test/subdir/' && f.isDirectory)).toBe(true);
      });
    });

    describe('File Deletion', () => {
      test('should delete file from S3/Minio', async () => {
        const filePath = 'test/delete-me.txt';

        mockS3.deleteObject.mockReturnValue({
          promise: () => Promise.resolve({})
        });

        const result = await storageService.deleteFile(filePath);

        expect(mockS3.deleteObject).toHaveBeenCalledWith({
          Bucket: 'test-bucket',
          Key: filePath
        });

        expect(result).toBe(true);
      });
    });
  });

  describe('Document Type Folder Mapping', () => {
    beforeEach(() => {
      storageService = new FileStorageService();
    });

    test('should map document types to appropriate folders', () => {
      expect(storageService.getDocumentFolder('debt')).toBe('debts');
      expect(storageService.getDocumentFolder('bank_statement')).toBe('bank-statements');
      expect(storageService.getDocumentFolder('internal')).toBe('internal-documents');
      expect(storageService.getDocumentFolder('correspondence')).toBe('correspondence');
      expect(storageService.getDocumentFolder('legal')).toBe('legal-documents');
      expect(storageService.getDocumentFolder('income')).toBe('income-documents');
      expect(storageService.getDocumentFolder('expenses')).toBe('expense-documents');
      expect(storageService.getDocumentFolder('assets')).toBe('asset-documents');
      expect(storageService.getDocumentFolder('unknown')).toBe('unclassified');
      expect(storageService.getDocumentFolder('random')).toBe('general');
    });
  });

  describe('Case File Tree', () => {
    beforeEach(() => {
      storageService = new FileStorageService({
        provider: 'local',
        localPath: testStoragePath
      });
    });

    test('should generate case file tree', async () => {
      // Create test files for a case using the storage service's path generation
      const caseId = 123;
      
      // Upload files using the proper document types
      await storageService.uploadFile(Buffer.from('test1'), 
        storageService.generateFilePath(caseId, 'debt', 'credit-card.pdf'), {});
      await storageService.uploadFile(Buffer.from('test2'), 
        storageService.generateFilePath(caseId, 'debt', 'loan-statement.pdf'), {});
      await storageService.uploadFile(Buffer.from('test3'), 
        storageService.generateFilePath(caseId, 'bank_statement', 'current-account.pdf'), {});
      await storageService.uploadFile(Buffer.from('test4'), 
        storageService.generateFilePath(caseId, 'correspondence', 'letter.pdf'), {});

      const tree = await storageService.getCaseFileTree(caseId);

      expect(tree.children.debts).toBeDefined();
      expect(tree.children['bank-statements']).toBeDefined();
      expect(tree.children.correspondence).toBeDefined();
      
      // Check that the tree structure is created correctly
      expect(tree.type).toBe('directory');
      expect(tree.name).toBe('root');
      
      // Verify folders exist
      expect(tree.children.debts).toBeDefined();
      expect(tree.children['bank-statements']).toBeDefined();
      expect(tree.children.correspondence).toBeDefined();
    });
  });
});
