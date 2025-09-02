const AWS = require('aws-sdk');
const path = require('path');
const fs = require('fs').promises;
const { v4: uuidv4 } = require('uuid');

class FileStorageService {
  constructor(config = {}) {
    this.config = {
      provider: config.provider || 'minio', // 'minio', 's3', 'local'
      bucket: config.bucket || 'mordecai-documents',
      endpoint: config.endpoint,
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
      region: config.region || 'us-east-1',
      localPath: config.localPath || './storage',
      ...config
    };

    this.initializeProvider();
  }

  initializeProvider() {
    if (this.config.provider === 'local') {
      this.ensureLocalDirectory();
    } else {
      // Configure AWS SDK for S3 or Minio
      const awsConfig = {
        accessKeyId: this.config.accessKeyId,
        secretAccessKey: this.config.secretAccessKey,
        region: this.config.region,
        s3ForcePathStyle: true, // Required for Minio
        signatureVersion: 'v4'
      };

      if (this.config.endpoint) {
        awsConfig.endpoint = this.config.endpoint;
      }

      AWS.config.update(awsConfig);
      this.s3 = new AWS.S3();
    }
  }

  async ensureLocalDirectory() {
    try {
      await fs.mkdir(this.config.localPath, { recursive: true });
    } catch (error) {
      console.error('Error creating local storage directory:', error);
    }
  }

  /**
   * Generate organized file path based on case and document type
   */
  generateFilePath(caseId, documentType, fileName, source = 'upload') {
    const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const fileId = uuidv4();
    const ext = path.extname(fileName);
    const baseName = path.basename(fileName, ext);
    const sanitizedName = this.sanitizeFileName(baseName);
    
    // Create intuitive nested structure
    const pathParts = [
      'cases',
      `case-${caseId}`,
      this.getDocumentFolder(documentType),
      timestamp,
      `${fileId}-${sanitizedName}${ext}`
    ];

    if (source === 'email') {
      pathParts.splice(2, 0, 'email-attachments');
    }

    return pathParts.join('/');
  }

  /**
   * Get appropriate folder based on document type
   */
  getDocumentFolder(documentType) {
    const folderMap = {
      'debt': 'debts',
      'bank_statement': 'bank-statements',
      'internal': 'internal-documents',
      'correspondence': 'correspondence',
      'legal': 'legal-documents',
      'income': 'income-documents',
      'expenses': 'expense-documents',
      'assets': 'asset-documents',
      'unknown': 'unclassified'
    };

    return folderMap[documentType] || 'general';
  }

  /**
   * Sanitize file name for safe storage
   */
  sanitizeFileName(fileName) {
    return fileName
      .replace(/[^a-zA-Z0-9.-]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '')
      .toLowerCase();
  }

  /**
   * Upload file to storage
   */
  async uploadFile(fileBuffer, filePath, metadata = {}) {
    if (this.config.provider === 'local') {
      return await this.uploadToLocal(fileBuffer, filePath, metadata);
    } else {
      return await this.uploadToS3(fileBuffer, filePath, metadata);
    }
  }

  /**
   * Upload to local file system
   */
  async uploadToLocal(fileBuffer, filePath, metadata) {
    const fullPath = path.join(this.config.localPath, filePath);
    const directory = path.dirname(fullPath);

    // Ensure directory exists
    await fs.mkdir(directory, { recursive: true });

    // Write file
    await fs.writeFile(fullPath, fileBuffer);

    // Write metadata file
    const metadataPath = `${fullPath}.meta.json`;
    await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));

    return {
      location: fullPath,
      url: `file://${fullPath}`,
      key: filePath,
      provider: 'local'
    };
  }

  /**
   * Upload to S3/Minio
   */
  async uploadToS3(fileBuffer, filePath, metadata) {
    const params = {
      Bucket: this.config.bucket,
      Key: filePath,
      Body: fileBuffer,
      ContentType: metadata.contentType || 'application/octet-stream',
      Metadata: {
        ...metadata,
        uploadedAt: new Date().toISOString()
      }
    };

    const result = await this.s3.upload(params).promise();

    return {
      location: result.Location,
      url: result.Location,
      key: result.Key,
      etag: result.ETag,
      provider: this.config.provider
    };
  }

  /**
   * Download file from storage
   */
  async downloadFile(filePath) {
    if (this.config.provider === 'local') {
      return await this.downloadFromLocal(filePath);
    } else {
      return await this.downloadFromS3(filePath);
    }
  }

  /**
   * Download from local file system
   */
  async downloadFromLocal(filePath) {
    const fullPath = path.join(this.config.localPath, filePath);
    const buffer = await fs.readFile(fullPath);
    
    // Try to read metadata
    let metadata = {};
    try {
      const metadataPath = `${fullPath}.meta.json`;
      const metadataContent = await fs.readFile(metadataPath, 'utf8');
      metadata = JSON.parse(metadataContent);
    } catch (error) {
      // Metadata file doesn't exist or is invalid
    }

    return {
      buffer,
      metadata
    };
  }

  /**
   * Download from S3/Minio
   */
  async downloadFromS3(filePath) {
    const params = {
      Bucket: this.config.bucket,
      Key: filePath
    };

    const result = await this.s3.getObject(params).promise();

    return {
      buffer: result.Body,
      metadata: result.Metadata || {}
    };
  }

  /**
   * List files in a directory
   */
  async listFiles(prefix = '') {
    if (this.config.provider === 'local') {
      return await this.listLocalFiles(prefix);
    } else {
      return await this.listS3Files(prefix);
    }
  }

  /**
   * List local files
   */
  async listLocalFiles(prefix) {
    const fullPath = path.join(this.config.localPath, prefix);
    const files = [];

    try {
      const items = await fs.readdir(fullPath, { withFileTypes: true });
      
      for (const item of items) {
        if (item.isFile() && !item.name.endsWith('.meta.json')) {
          const filePath = path.join(prefix, item.name);
          const stats = await fs.stat(path.join(fullPath, item.name));
          
          files.push({
            key: filePath,
            size: stats.size,
            lastModified: stats.mtime,
            isDirectory: false
          });
        } else if (item.isDirectory()) {
          const dirPath = path.join(prefix, item.name);
          files.push({
            key: dirPath + '/',
            size: 0,
            lastModified: null,
            isDirectory: true
          });
        }
      }
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }

    return files;
  }

  /**
   * List S3/Minio files
   */
  async listS3Files(prefix) {
    const params = {
      Bucket: this.config.bucket,
      Prefix: prefix,
      Delimiter: '/'
    };

    const result = await this.s3.listObjectsV2(params).promise();
    const files = [];

    // Add directories (common prefixes)
    if (result.CommonPrefixes) {
      result.CommonPrefixes.forEach(prefix => {
        files.push({
          key: prefix.Prefix,
          size: 0,
          lastModified: null,
          isDirectory: true
        });
      });
    }

    // Add files
    if (result.Contents) {
      result.Contents.forEach(object => {
        if (object.Key !== prefix) { // Don't include the prefix itself
          files.push({
            key: object.Key,
            size: object.Size,
            lastModified: object.LastModified,
            isDirectory: false,
            etag: object.ETag
          });
        }
      });
    }

    return files;
  }

  /**
   * Delete file from storage
   */
  async deleteFile(filePath) {
    if (this.config.provider === 'local') {
      return await this.deleteFromLocal(filePath);
    } else {
      return await this.deleteFromS3(filePath);
    }
  }

  /**
   * Delete from local file system
   */
  async deleteFromLocal(filePath) {
    const fullPath = path.join(this.config.localPath, filePath);
    
    try {
      await fs.unlink(fullPath);
      
      // Also delete metadata file if it exists
      const metadataPath = `${fullPath}.meta.json`;
      try {
        await fs.unlink(metadataPath);
      } catch (error) {
        // Metadata file doesn't exist, ignore
      }
      
      return true;
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
      return false;
    }
  }

  /**
   * Delete from S3/Minio
   */
  async deleteFromS3(filePath) {
    const params = {
      Bucket: this.config.bucket,
      Key: filePath
    };

    await this.s3.deleteObject(params).promise();
    return true;
  }

  /**
   * Get file tree structure for a case
   */
  async getCaseFileTree(caseId) {
    const prefix = `cases/case-${caseId}/`;
    const files = await this.listFiles(prefix);
    
    return this.buildFileTree(files, prefix);
  }

  /**
   * Build hierarchical file tree from flat file list
   */
  buildFileTree(files, rootPrefix = '') {
    const tree = {
      name: 'root',
      type: 'directory',
      children: {},
      files: []
    };

    files.forEach(file => {
      const relativePath = file.key.replace(rootPrefix, '');
      const parts = relativePath.split('/').filter(part => part.length > 0);
      
      let current = tree;
      
      // Navigate/create directory structure
      for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
        if (!current.children[part]) {
          current.children[part] = {
            name: part,
            type: 'directory',
            children: {},
            files: []
          };
        }
        current = current.children[part];
      }
      
      // Add file to current directory
      if (parts.length > 0) {
        const fileName = parts[parts.length - 1];
        if (file.isDirectory) {
          if (!current.children[fileName]) {
            current.children[fileName] = {
              name: fileName,
              type: 'directory',
              children: {},
              files: []
            };
          }
        } else {
          current.files.push({
            name: fileName,
            type: 'file',
            size: file.size,
            lastModified: file.lastModified,
            key: file.key
          });
        }
      }
    });

    return tree;
  }

  /**
   * Get storage statistics
   */
  async getStorageStats() {
    if (this.config.provider === 'local') {
      return await this.getLocalStorageStats();
    } else {
      return await this.getS3StorageStats();
    }
  }

  async getLocalStorageStats() {
    // Implementation for local storage stats
    return {
      provider: 'local',
      totalFiles: 0,
      totalSize: 0,
      path: this.config.localPath
    };
  }

  async getS3StorageStats() {
    // Implementation for S3/Minio storage stats
    return {
      provider: this.config.provider,
      bucket: this.config.bucket,
      endpoint: this.config.endpoint
    };
  }
}

module.exports = FileStorageService;
