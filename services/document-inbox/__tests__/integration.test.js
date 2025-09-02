const request = require('supertest');
const express = require('express');
const FileStorageService = require('../storage/FileStorageService');
const fs = require('fs').promises;
const path = require('path');

// Mock dependencies
jest.mock('amqplib', () => ({
  connect: jest.fn()
}));
jest.mock('aws-sdk');

describe('Document Inbox Integration Tests', () => {
  let app;
  let storageService;
  const testStoragePath = './test-integration-storage';

  beforeAll(async () => {
    // Set up test app
    app = express();
    app.use(express.json());
    
    // Initialize storage service
    storageService = new FileStorageService({
      provider: 'local',
      localPath: testStoragePath
    });

    // Mock routes for testing
    const multer = require('multer');
    const upload = multer({ storage: multer.memoryStorage() });

    app.post('/api/documents/upload', upload.single('file'), async (req, res) => {
      try {
        const { caseId } = req.body;
        const file = req.file;
        
        if (!file || !caseId) {
          return res.status(400).json({ message: 'File and case ID required' });
        }

        const filePath = storageService.generateFilePath(
          caseId, 
          'unknown', 
          file.originalname
        );

        const result = await storageService.uploadFile(
          file.buffer, 
          filePath, 
          {
            contentType: file.mimetype,
            originalName: file.originalname,
            caseId: caseId
          }
        );

        res.json({
          fileId: path.basename(filePath, path.extname(filePath)),
          fileName: file.originalname,
          filePath: result.key,
          url: result.url
        });
      } catch (error) {
        res.status(500).json({ message: 'Upload failed', error: error.message });
      }
    });

    app.get('/api/cases/:caseId/files', async (req, res) => {
      try {
        const { caseId } = req.params;
        const tree = await storageService.getCaseFileTree(caseId);
        res.json(tree);
      } catch (error) {
        res.status(500).json({ message: 'Failed to get file tree', error: error.message });
      }
    });

    app.get('/api/files/:filePath(*)', async (req, res) => {
      try {
        const filePath = req.params.filePath;
        const result = await storageService.downloadFile(filePath);
        
        res.set({
          'Content-Type': result.metadata.contentType || 'application/octet-stream',
          'Content-Length': result.buffer.length
        });
        
        res.send(result.buffer);
      } catch (error) {
        res.status(404).json({ message: 'File not found', error: error.message });
      }
    });

    app.delete('/api/files/:filePath(*)', async (req, res) => {
      try {
        const filePath = req.params.filePath;
        const result = await storageService.deleteFile(filePath);
        
        if (result) {
          res.json({ message: 'File deleted successfully' });
        } else {
          res.status(404).json({ message: 'File not found' });
        }
      } catch (error) {
        res.status(500).json({ message: 'Delete failed', error: error.message });
      }
    });
  });

  afterAll(async () => {
    // Clean up test storage
    try {
      await fs.rmdir(testStoragePath, { recursive: true });
    } catch (error) {
      // Directory doesn't exist, ignore
    }
  });

  describe('File Upload Workflow', () => {
    test('should upload file and create organized structure', async () => {
      const testFile = Buffer.from('test file content');
      const caseId = '123';

      const response = await request(app)
        .post('/api/documents/upload')
        .field('caseId', caseId)
        .attach('file', testFile, 'test-document.pdf')
        .expect(200);

      expect(response.body.fileName).toBe('test-document.pdf');
      expect(response.body.filePath).toMatch(/^cases\/case-123\/unclassified\/\d{4}-\d{2}-\d{2}\//);

      // Verify file was actually stored
      const filePath = response.body.filePath;
      const fullPath = path.join(testStoragePath, filePath);
      const fileExists = await fs.access(fullPath).then(() => true).catch(() => false);
      expect(fileExists).toBe(true);
    });

    test('should handle multiple file uploads for same case', async () => {
      const caseId = '456';
      const files = [
        { name: 'debt-letter.pdf', content: 'debt content' },
        { name: 'bank-statement.pdf', content: 'bank content' },
        { name: 'income-proof.pdf', content: 'income content' }
      ];

      const uploadPromises = files.map(file => 
        request(app)
          .post('/api/documents/upload')
          .field('caseId', caseId)
          .attach('file', Buffer.from(file.content), file.name)
          .expect(200)
      );

      const responses = await Promise.all(uploadPromises);

      // All uploads should succeed
      responses.forEach((response, index) => {
        expect(response.body.fileName).toBe(files[index].name);
        expect(response.body.filePath).toContain(`case-${caseId}`);
      });
    });

    test('should reject upload without required fields', async () => {
      await request(app)
        .post('/api/documents/upload')
        .attach('file', Buffer.from('test'), 'test.pdf')
        .expect(400);

      await request(app)
        .post('/api/documents/upload')
        .field('caseId', '123')
        .expect(400);
    });
  });

  describe('File Tree Generation', () => {
    test('should generate hierarchical file tree for case', async () => {
      const caseId = '789';
      
      // Upload files to different categories
      const uploads = [
        { file: 'debt1.pdf', content: 'debt1' },
        { file: 'debt2.pdf', content: 'debt2' },
        { file: 'statement.pdf', content: 'statement' }
      ];

      for (const upload of uploads) {
        await request(app)
          .post('/api/documents/upload')
          .field('caseId', caseId)
          .attach('file', Buffer.from(upload.content), upload.file)
          .expect(200);
      }

      // Get file tree
      const response = await request(app)
        .get(`/api/cases/${caseId}/files`)
        .expect(200);

      const tree = response.body;
      expect(tree.type).toBe('directory');
      
      // Check if files were uploaded and organized
      const hasFiles = Object.keys(tree.children).length > 0;
      expect(hasFiles).toBe(true);
    });

    test('should handle empty case file tree', async () => {
      const response = await request(app)
        .get('/api/cases/999/files')
        .expect(200);

      const tree = response.body;
      expect(tree.type).toBe('directory');
      expect(Object.keys(tree.children)).toHaveLength(0);
      expect(tree.files).toHaveLength(0);
    });
  });

  describe('File Download', () => {
    test('should download uploaded file', async () => {
      const testContent = 'downloadable file content';
      const caseId = '101';

      // Upload file first
      const uploadResponse = await request(app)
        .post('/api/documents/upload')
        .field('caseId', caseId)
        .attach('file', Buffer.from(testContent), 'download-test.txt')
        .expect(200);

      const filePath = uploadResponse.body.filePath;

      // Download file
      const downloadResponse = await request(app)
        .get(`/api/files/${filePath}`)
        .expect(200);

      expect(downloadResponse.text).toBe(testContent);
    });

    test('should return 404 for non-existent file', async () => {
      await request(app)
        .get('/api/files/non-existent/file.txt')
        .expect(404);
    });
  });

  describe('File Deletion', () => {
    test('should delete uploaded file', async () => {
      const caseId = '202';
      const testContent = 'file to delete';

      // Upload file first
      const uploadResponse = await request(app)
        .post('/api/documents/upload')
        .field('caseId', caseId)
        .attach('file', Buffer.from(testContent), 'delete-me.txt')
        .expect(200);

      const filePath = uploadResponse.body.filePath;

      // Delete file
      await request(app)
        .delete(`/api/files/${filePath}`)
        .expect(200);

      // Verify file is gone
      await request(app)
        .get(`/api/files/${filePath}`)
        .expect(404);
    });

    test('should return 404 when deleting non-existent file', async () => {
      await request(app)
        .delete('/api/files/non-existent/file.txt')
        .expect(404);
    });
  });

  describe('File Organization', () => {
    test('should organize files by document type when specified', async () => {
      // This would be extended when document classification is integrated
      const caseId = '303';
      
      const response = await request(app)
        .post('/api/documents/upload')
        .field('caseId', caseId)
        .attach('file', Buffer.from('test'), 'document.pdf')
        .expect(200);

      // File should be in unclassified folder for unknown type
      expect(response.body.filePath).toContain('/unclassified/');
    });
  });

  describe('Concurrent Operations', () => {
    test('should handle concurrent uploads to same case', async () => {
      const caseId = '404';
      const concurrentUploads = 5;
      
      const uploadPromises = Array.from({ length: concurrentUploads }, (_, i) =>
        request(app)
          .post('/api/documents/upload')
          .field('caseId', caseId)
          .attach('file', Buffer.from(`content ${i}`), `file-${i}.txt`)
      );

      const responses = await Promise.all(uploadPromises);

      // All uploads should succeed
      responses.forEach((response, i) => {
        expect(response.status).toBe(200);
        expect(response.body.fileName).toBe(`file-${i}.txt`);
      });

      // Verify all files are in the file tree
      const treeResponse = await request(app)
        .get(`/api/cases/${caseId}/files`)
        .expect(200);

      const tree = treeResponse.body;
      
      // Count total files across all folders and subfolders
      const countFiles = (node) => {
        let count = node.files ? node.files.length : 0;
        if (node.children) {
          Object.values(node.children).forEach(child => {
            count += countFiles(child);
          });
        }
        return count;
      };
      
      const totalFiles = countFiles(tree);
      expect(totalFiles).toBeGreaterThanOrEqual(concurrentUploads);
    });
  });

  describe('Error Handling', () => {
    test('should handle storage errors gracefully', async () => {
      // Mock storage service to throw error
      const originalUploadFile = storageService.uploadFile;
      storageService.uploadFile = jest.fn().mockRejectedValue(new Error('Storage error'));

      await request(app)
        .post('/api/documents/upload')
        .field('caseId', '500')
        .attach('file', Buffer.from('test'), 'error-test.txt')
        .expect(500);

      // Restore original method
      storageService.uploadFile = originalUploadFile;
    });
  });
});
