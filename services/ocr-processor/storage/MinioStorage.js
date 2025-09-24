const Minio = require('minio');
const path = require('path');

class MinioStorage {
  constructor(config) {
    this.client = new Minio.Client({
      endPoint: config.endPoint,
      port: config.port,
      useSSL: config.useSSL,
      accessKey: config.accessKey,
      secretKey: config.secretKey
    });
    
    this.bucket = config.bucket || 'mordecai-documents';
    this.initializeBucket();
  }

  async initializeBucket() {
    try {
      const exists = await this.client.bucketExists(this.bucket);
      if (!exists) {
        await this.client.makeBucket(this.bucket, 'us-east-1');
        console.log(`Bucket ${this.bucket} created successfully`);
      }
    } catch (error) {
      console.error('Error initializing bucket:', error);
    }
  }

  async getObject(key) {
    try {
      const stream = await this.client.getObject(this.bucket, key);
      const chunks = [];
      
      return new Promise((resolve, reject) => {
        stream.on('data', chunk => chunks.push(chunk));
        stream.on('end', () => resolve(Buffer.concat(chunks)));
        stream.on('error', reject);
      });
    } catch (error) {
      throw new Error(`Failed to get object ${key}: ${error.message}`);
    }
  }

  async putObject(key, data, metadata = {}) {
    try {
      const metaData = {
        'Content-Type': metadata.contentType || 'application/octet-stream',
        'X-Original-Name': metadata.originalName || '',
        'X-Case-ID': metadata.caseId || '',
        'X-File-ID': metadata.fileId || '',
        'X-Uploaded-At': metadata.uploadedAt || new Date().toISOString()
      };

      await this.client.putObject(this.bucket, key, data, undefined, metaData);
      
      return {
        key: key,
        bucket: this.bucket,
        url: `http://${this.client.host}:${this.client.port}/${this.bucket}/${key}`
      };
    } catch (error) {
      throw new Error(`Failed to put object ${key}: ${error.message}`);
    }
  }

  async deleteObject(key) {
    try {
      await this.client.removeObject(this.bucket, key);
      return true;
    } catch (error) {
      console.error(`Failed to delete object ${key}:`, error);
      return false;
    }
  }

  generateKey(caseId, documentType, fileName) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const safeName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
    return `cases/${caseId}/${documentType}/${timestamp}_${safeName}`;
  }
}

module.exports = { MinioStorage };