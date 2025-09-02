const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const Tesseract = require('tesseract.js');
const pdfParse = require('pdf-parse');
const sharp = require('sharp');
const mammoth = require('mammoth');
const winston = require('winston');
const AWS = require('aws-sdk');
const amqp = require('amqplib');
const natural = require('natural');
const nlp = require('compromise');
const moment = require('moment');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3002;

// Configure AWS
AWS.config.update({
  region: process.env.AWS_REGION || 'us-east-1',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
});

const s3 = new AWS.S3();
const textract = new AWS.Textract();

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

// Document classification patterns
const CLASSIFICATION_PATTERNS = {
  debt: {
    keywords: ['debt', 'balance', 'payment', 'creditor', 'outstanding', 'arrears', 'default', 'collection', 'owed', 'liability'],
    companies: ['barclaycard', 'capital one', 'mbna', 'santander', 'halifax', 'lloyds', 'natwest', 'hsbc', 'tesco bank', 'virgin money'],
    patterns: [
      /balance.*£?\d+/i,
      /outstanding.*£?\d+/i,
      /payment.*due/i,
      /account.*number/i,
      /reference.*number/i
    ]
  },
  bank_statement: {
    keywords: ['statement', 'account', 'balance', 'transaction', 'deposit', 'withdrawal', 'transfer', 'direct debit'],
    banks: ['barclays', 'lloyds', 'hsbc', 'natwest', 'santander', 'halifax', 'nationwide', 'tesco bank', 'metro bank'],
    patterns: [
      /statement.*period/i,
      /account.*number.*\d{8}/i,
      /sort.*code.*\d{2}-\d{2}-\d{2}/i,
      /opening.*balance/i,
      /closing.*balance/i
    ]
  },
  internal: {
    keywords: ['advice', 'assessment', 'budget', 'income', 'expenditure', 'recommendation', 'action plan'],
    patterns: [
      /community.*money.*advice/i,
      /debt.*advice/i,
      /financial.*assessment/i,
      /budget.*planner/i
    ]
  }
};

// RabbitMQ connection
let channel;
const connectRabbitMQ = async () => {
  try {
    const connection = await amqp.connect(process.env.RABBITMQ_URL || 'amqp://localhost');
    channel = await connection.createChannel();
    
    await channel.assertQueue('document-processing', { durable: true });
    await channel.assertQueue('ocr-results', { durable: true });
    
    // Start consuming messages
    channel.consume('document-processing', processDocument, { noAck: false });
    
    logger.info('Connected to RabbitMQ and started consuming');
  } catch (error) {
    logger.error('RabbitMQ connection failed:', error);
  }
};

// Extract text from different file types
const extractText = async (fileBuffer, mimeType) => {
  try {
    switch (mimeType) {
      case 'application/pdf':
        const pdfData = await pdfParse(fileBuffer);
        return pdfData.text;
        
      case 'application/msword':
      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        const docResult = await mammoth.extractRawText({ buffer: fileBuffer });
        return docResult.value;
        
      case 'image/jpeg':
      case 'image/png':
      case 'image/gif':
      case 'image/bmp':
        // Use AWS Textract for better accuracy on financial documents
        if (process.env.USE_AWS_TEXTRACT === 'true') {
          return await extractWithTextract(fileBuffer);
        } else {
          return await extractWithTesseract(fileBuffer);
        }
        
      default:
        throw new Error(`Unsupported file type: ${mimeType}`);
    }
  } catch (error) {
    logger.error('Text extraction error:', error);
    throw error;
  }
};

// Extract text using AWS Textract
const extractWithTextract = async (fileBuffer) => {
  try {
    const params = {
      Document: {
        Bytes: fileBuffer
      }
    };
    
    const result = await textract.detectDocumentText(params).promise();
    return result.Blocks
      .filter(block => block.BlockType === 'LINE')
      .map(block => block.Text)
      .join('\n');
  } catch (error) {
    logger.warn('Textract failed, falling back to Tesseract:', error.message);
    return await extractWithTesseract(fileBuffer);
  }
};

// Extract text using Tesseract
const extractWithTesseract = async (fileBuffer) => {
  try {
    // Preprocess image for better OCR
    const processedImage = await sharp(fileBuffer)
      .greyscale()
      .normalize()
      .sharpen()
      .toBuffer();
    
    const { data: { text } } = await Tesseract.recognize(processedImage, 'eng', {
      logger: m => logger.debug('Tesseract:', m)
    });
    
    return text;
  } catch (error) {
    logger.error('Tesseract OCR error:', error);
    throw error;
  }
};

// Classify document based on extracted text
const classifyDocument = (text) => {
  const lowerText = text.toLowerCase();
  const scores = {};
  
  // Calculate scores for each document type
  Object.keys(CLASSIFICATION_PATTERNS).forEach(type => {
    const pattern = CLASSIFICATION_PATTERNS[type];
    let score = 0;
    
    // Keyword matching
    pattern.keywords.forEach(keyword => {
      const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
      const matches = (text.match(regex) || []).length;
      score += matches * 2;
    });
    
    // Company/bank matching
    if (pattern.companies) {
      pattern.companies.forEach(company => {
        if (lowerText.includes(company.toLowerCase())) {
          score += 5;
        }
      });
    }
    
    if (pattern.banks) {
      pattern.banks.forEach(bank => {
        if (lowerText.includes(bank.toLowerCase())) {
          score += 5;
        }
      });
    }
    
    // Pattern matching
    pattern.patterns.forEach(regex => {
      if (regex.test(text)) {
        score += 3;
      }
    });
    
    scores[type] = score;
  });
  
  // Find the highest scoring classification
  const maxScore = Math.max(...Object.values(scores));
  const classification = Object.keys(scores).find(key => scores[key] === maxScore);
  const confidence = maxScore > 0 ? Math.min(maxScore / 10, 1) : 0;
  
  return {
    type: classification || 'unknown',
    confidence,
    scores
  };
};

// Extract specific data based on document type
const extractSpecificData = (text, classificationType) => {
  const data = {};
  
  switch (classificationType) {
    case 'debt':
      // Extract debt-specific information
      const amountMatch = text.match(/(?:balance|outstanding|owed|debt).*?£?(\d+(?:,\d{3})*(?:\.\d{2})?)/i);
      if (amountMatch) data.amount = amountMatch[1];
      
      const creditorMatch = text.match(/(?:from|to|creditor|company)[\s:]+([A-Za-z\s&]+?)(?:\n|$|[,.])/i);
      if (creditorMatch) data.creditorName = creditorMatch[1].trim();
      
      const accountMatch = text.match(/(?:account|reference).*?(\d{6,})/i);
      if (accountMatch) data.accountNumber = accountMatch[1];
      
      // Determine if priority debt
      const priorityKeywords = ['council tax', 'mortgage', 'rent', 'utilities', 'hmrc', 'tax', 'magistrates'];
      data.priority = priorityKeywords.some(keyword => 
        text.toLowerCase().includes(keyword)
      ) ? 'priority' : 'non-priority';
      
      break;
      
    case 'bank_statement':
      const bankMatch = text.match(/([A-Za-z\s]+(?:bank|building society))/i);
      if (bankMatch) data.bankName = bankMatch[1].trim();
      
      const accountNumMatch = text.match(/account.*?(\d{8})/i);
      if (accountNumMatch) data.accountNumber = accountNumMatch[1];
      
      const sortCodeMatch = text.match(/sort.*?(\d{2}-\d{2}-\d{2})/i);
      if (sortCodeMatch) data.sortCode = sortCodeMatch[1];
      
      const periodMatch = text.match(/statement.*?period.*?(\d{1,2}\/\d{1,2}\/\d{2,4}).*?(\d{1,2}\/\d{1,2}\/\d{2,4})/i);
      if (periodMatch) data.period = `${periodMatch[1]} to ${periodMatch[2]}`;
      
      break;
      
    case 'internal':
      // Extract internal document metadata
      const dateMatch = text.match(/(\d{1,2}\/\d{1,2}\/\d{2,4})/);
      if (dateMatch) data.date = dateMatch[1];
      
      break;
  }
  
  return data;
};

// Process document message from queue
const processDocument = async (msg) => {
  if (!msg) return;
  
  try {
    const fileMetadata = JSON.parse(msg.content.toString());
    logger.info(`Processing document: ${fileMetadata.fileName}`);
    
    // Download file from S3
    const s3Params = {
      Bucket: process.env.S3_BUCKET || 'mordecai-documents',
      Key: fileMetadata.s3Key
    };
    
    const s3Object = await s3.getObject(s3Params).promise();
    const fileBuffer = s3Object.Body;
    
    // Extract text
    const extractedText = await extractText(fileBuffer, fileMetadata.mimeType);
    
    // Classify document
    const classification = classifyDocument(extractedText);
    
    // Extract specific data
    const extractedData = extractSpecificData(extractedText, classification.type);
    
    // Determine if approval is required
    const requiresApproval = classification.confidence < 0.8 || 
                           classification.type === 'debt' || 
                           classification.type === 'unknown';
    
    const result = {
      fileId: fileMetadata.fileId,
      caseId: fileMetadata.caseId,
      extractedText,
      classification,
      extractedData,
      requiresApproval,
      processedAt: new Date().toISOString()
    };
    
    // Send result to results queue
    if (channel) {
      await channel.sendToQueue('ocr-results', Buffer.from(JSON.stringify(result)), {
        persistent: true
      });
    }
    
    logger.info(`Document processed: ${fileMetadata.fileName}, type: ${classification.type}, confidence: ${classification.confidence}`);
    
    // Acknowledge message
    channel.ack(msg);
    
  } catch (error) {
    logger.error('Document processing error:', error);
    
    // Reject message and requeue
    channel.nack(msg, false, true);
  }
};

// Manual OCR processing endpoint
app.post('/api/ocr/process', async (req, res) => {
  try {
    const { fileId, s3Key, mimeType, caseId } = req.body;
    
    if (!s3Key || !mimeType) {
      return res.status(400).json({ message: 'S3 key and mime type required' });
    }
    
    // Download file from S3
    const s3Params = {
      Bucket: process.env.S3_BUCKET || 'mordecai-documents',
      Key: s3Key
    };
    
    const s3Object = await s3.getObject(s3Params).promise();
    const fileBuffer = s3Object.Body;
    
    // Process document
    const extractedText = await extractText(fileBuffer, mimeType);
    const classification = classifyDocument(extractedText);
    const extractedData = extractSpecificData(extractedText, classification.type);
    
    const requiresApproval = classification.confidence < 0.8 || 
                           classification.type === 'debt' || 
                           classification.type === 'unknown';
    
    res.json({
      fileId,
      caseId,
      extractedText,
      classification,
      extractedData,
      requiresApproval,
      processedAt: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Manual OCR processing error:', error);
    res.status(500).json({ message: 'OCR processing failed', error: error.message });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    service: 'ocr-processor',
    timestamp: new Date().toISOString()
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  logger.error('Unhandled error:', error);
  res.status(500).json({ message: 'Internal server error' });
});

// Start server
const startServer = async () => {
  await connectRabbitMQ();
  
  app.listen(PORT, () => {
    logger.info(`OCR Processor Service running on port ${PORT}`);
  });
};

startServer().catch(error => {
  logger.error('Failed to start server:', error);
  process.exit(1);
});
