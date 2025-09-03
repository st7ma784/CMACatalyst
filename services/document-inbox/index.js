const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { v4: uuidv4 } = require('uuid');
const winston = require('winston');
const amqp = require('amqplib');
const FileStorageService = require('./storage/FileStorageService');
const nodemailer = require('nodemailer');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize storage service for local MinIO
const storageConfig = {
  provider: 'minio',
  bucket: process.env.MINIO_BUCKET || 'mordecai-documents',
  accessKeyId: process.env.MINIO_ROOT_USER || 'minioadmin',
  secretAccessKey: process.env.MINIO_ROOT_PASSWORD || 'minioadmin',
  endpoint: process.env.MINIO_ENDPOINT || 'http://localhost:9000',
  localPath: process.env.LOCAL_STORAGE_PATH || './storage'
};

const storageService = new FileStorageService(storageConfig);

// Configure nodemailer for local email handling
const emailTransporter = nodemailer.createTransporter({
  host: process.env.SMTP_HOST || 'localhost',
  port: process.env.SMTP_PORT || 587,
  secure: process.env.SMTP_SECURE === 'true',
  auth: process.env.SMTP_USER ? {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD
  } : undefined
});

// Configure logging
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/bmp',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'), false);
    }
  }
});

// RabbitMQ connection
let channel;
const connectRabbitMQ = async () => {
  try {
    const connection = await amqp.connect(process.env.RABBITMQ_URL || 'amqp://localhost');
    channel = await connection.createChannel();
    
    // Declare queues
    await channel.assertQueue('document-processing', { durable: true });
    await channel.assertQueue('ocr-processing', { durable: true });
    
    logger.info('Connected to RabbitMQ');
  } catch (error) {
    logger.error('RabbitMQ connection failed:', error);
  }
};

// File upload endpoint
app.post('/api/documents/upload', upload.single('file'), async (req, res) => {
  try {
    const { caseId, documentType = 'unknown' } = req.body;
    const file = req.file;
    
    if (!file || !caseId) {
      return res.status(400).json({ message: 'File and case ID required' });
    }

    const fileId = uuidv4();
    const filePath = storageService.generateFilePath(caseId, documentType, file.originalname);

    // Upload using storage service
    const uploadResult = await storageService.uploadFile(
      file.buffer,
      filePath,
      {
        contentType: file.mimetype,
        originalName: file.originalname,
        caseId: caseId,
        fileId: fileId,
        uploadedAt: new Date().toISOString()
      }
    );
    
    // Store file metadata
    const fileMetadata = {
      fileId,
      caseId,
      originalName: file.originalname,
      fileName: file.originalname,
      filePath: uploadResult.key,
      fileUrl: uploadResult.url,
      mimeType: file.mimetype,
      size: file.size,
      uploadedAt: new Date().toISOString(),
      status: 'uploaded',
      documentType: documentType
    };

    // Queue for processing
    if (channel) {
      await channel.sendToQueue('document-processing', Buffer.from(JSON.stringify(fileMetadata)), {
        persistent: true
      });
    }

    logger.info(`File uploaded: ${file.originalname} for case ${caseId} at ${uploadResult.key}`);
    
    res.json({
      fileId,
      fileName: file.originalname,
      filePath: uploadResult.key,
      fileUrl: uploadResult.url,
      message: 'File uploaded successfully'
    });

  } catch (error) {
    logger.error('Upload error:', error);
    res.status(500).json({ message: 'Upload failed', error: error.message });
  }
});

// Get case file tree endpoint
app.get('/api/cases/:caseId/files', async (req, res) => {
  try {
    const { caseId } = req.params;
    const tree = await storageService.getCaseFileTree(caseId);
    
    res.json(tree);
  } catch (error) {
    logger.error('File tree error:', error);
    res.status(500).json({ message: 'Failed to get file tree', error: error.message });
  }
});

// Download file endpoint
app.get('/api/files/:filePath(*)', async (req, res) => {
  try {
    const filePath = req.params.filePath;
    const result = await storageService.downloadFile(filePath);
    
    res.set({
      'Content-Type': result.metadata.contentType || 'application/octet-stream',
      'Content-Length': result.buffer.length,
      'Content-Disposition': `attachment; filename="${result.metadata.originalName || 'download'}"`
    });
    
    res.send(result.buffer);
  } catch (error) {
    logger.error('Download error:', error);
    res.status(404).json({ message: 'File not found', error: error.message });
  }
});

// Delete file endpoint
app.delete('/api/files/:filePath(*)', async (req, res) => {
  try {
    const filePath = req.params.filePath;
    const result = await storageService.deleteFile(filePath);
    
    if (result) {
      logger.info(`File deleted: ${filePath}`);
      res.json({ message: 'File deleted successfully' });
    } else {
      res.status(404).json({ message: 'File not found' });
    }
  } catch (error) {
    logger.error('Delete error:', error);
    res.status(500).json({ message: 'Delete failed', error: error.message });
  }
});

// Generate case email endpoint
app.post('/api/cases/:caseId/email', async (req, res) => {
  try {
    const { caseId } = req.params;
    const emailAddress = `case-${caseId}@${process.env.EMAIL_DOMAIN || 'mordecai.local'}`;
    
    // Store email mapping in database (would be implemented with your DB)
    // For now, we'll just return the email address
    
    res.json({
      caseId,
      emailAddress,
      message: 'Case email address generated'
    });
    
  } catch (error) {
    logger.error('Email generation error:', error);
    res.status(500).json({ message: 'Failed to generate email', error: error.message });
  }
});

// Email processing webhook (for incoming emails)
app.post('/api/email/webhook', async (req, res) => {
  try {
    const { to, from, subject, attachments } = req.body;
    
    // Extract case ID from email address
    const caseIdMatch = to.match(/case-(\d+)@/);
    if (!caseIdMatch) {
      return res.status(400).json({ message: 'Invalid case email format' });
    }
    
    const caseId = caseIdMatch[1];
    
    // Process attachments
    for (const attachment of attachments || []) {
      const fileId = uuidv4();
      const fileName = `${fileId}-${attachment.filename}`;
      const s3Key = `cases/${caseId}/email-attachments/${fileName}`;
      
      // Download attachment and upload to MinIO
      const fileBuffer = Buffer.from(attachment.content, 'base64');
      
      const uploadResult = await storageService.uploadFile(
        fileBuffer,
        s3Key,
        {
          contentType: attachment.contentType,
          originalName: attachment.filename,
          caseId: caseId,
          source: 'email',
          fromEmail: from,
          subject: subject,
          uploadedAt: new Date().toISOString()
        }
      );
      
      const fileMetadata = {
        fileId,
        caseId,
        originalName: attachment.filename,
        fileName,
        filePath: uploadResult.key,
        fileUrl: uploadResult.url,
        mimeType: attachment.contentType,
        size: fileBuffer.length,
        source: 'email',
        fromEmail: from,
        subject: subject,
        receivedAt: new Date().toISOString(),
        status: 'uploaded'
      };
      
      // Queue for processing
      if (channel) {
        await channel.sendToQueue('document-processing', Buffer.from(JSON.stringify(fileMetadata)), {
          persistent: true
        });
      }
      
      logger.info(`Email attachment processed: ${attachment.filename} for case ${caseId}`);
    }
    
    res.json({ message: 'Email processed successfully' });
    
  } catch (error) {
    logger.error('Email processing error:', error);
    res.status(500).json({ message: 'Email processing failed', error: error.message });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    service: 'document-inbox',
    timestamp: new Date().toISOString()
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  logger.error('Unhandled error:', error);
  
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ message: 'File too large' });
    }
  }
  
  res.status(500).json({ message: 'Internal server error' });
});

// Start server
const startServer = async () => {
  await connectRabbitMQ();
  
  app.listen(PORT, () => {
    logger.info(`Document Inbox Service running on port ${PORT}`);
  });
};

startServer().catch(error => {
  logger.error('Failed to start server:', error);
  process.exit(1);
});
