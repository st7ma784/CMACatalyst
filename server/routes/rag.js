const express = require('express');
const router = express.Router();
const axios = require('axios');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configuration
const RAG_INGESTION_URL = process.env.RAG_INGESTION_URL || 'http://rag-ingestion:8004';
const CHATBOT_URL = process.env.CHATBOT_URL || 'http://chatbot:8001';

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads/training-manuals');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const filename = `${timestamp}-${file.originalname}`;
    cb(null, filename);
  }
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.pdf', '.txt', '.docx', '.doc'];
    const fileExt = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(fileExt)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, TXT, DOCX, and DOC files are allowed.'));
    }
  },
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit
  }
});

/**
 * @swagger
 * /api/rag/search:
 *   post:
 *     summary: Search training manuals using RAG
 *     tags: [RAG]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               query:
 *                 type: string
 *                 description: Search query
 *               manual_type:
 *                 type: string
 *                 description: Type of manual to search
 *               top_k:
 *                 type: integer
 *                 default: 5
 *                 description: Number of results to return
 *               score_threshold:
 *                 type: number
 *                 default: 0.7
 *                 description: Minimum relevance score
 *     responses:
 *       200:
 *         description: Search results
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 results:
 *                   type: array
 *                   items:
 *                     type: object
 *                 query:
 *                   type: string
 *                 total_results:
 *                   type: integer
 */
router.post('/search', async (req, res) => {
  try {
    const { query, manual_type, top_k = 5, score_threshold = 0.7 } = req.body;

    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    const response = await axios.post(`${RAG_INGESTION_URL}/search`, {
      query,
      manual_type,
      top_k,
      score_threshold
    }, {
      timeout: 10000
    });

    res.json(response.data);
  } catch (error) {
    console.error('RAG search error:', error.message);
    if (error.response) {
      res.status(error.response.status).json({ error: error.response.data });
    } else {
      res.status(500).json({ error: 'RAG search service unavailable' });
    }
  }
});

/**
 * @swagger
 * /api/rag/chat:
 *   post:
 *     summary: Enhanced chat with RAG context
 *     tags: [RAG]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               message:
 *                 type: string
 *                 description: User message
 *               client_id:
 *                 type: string
 *                 description: Client ID for context
 *               session_id:
 *                 type: string
 *                 description: Chat session ID
 *               use_rag:
 *                 type: boolean
 *                 default: true
 *                 description: Whether to use RAG enhancement
 *               manual_type:
 *                 type: string
 *                 description: Specific manual type to search
 *     responses:
 *       200:
 *         description: Chat response with RAG context
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 response:
 *                   type: string
 *                 sources:
 *                   type: array
 *                   items:
 *                     type: object
 *                 confidence:
 *                   type: number
 *                 session_id:
 *                   type: string
 *                 rag_used:
 *                   type: boolean
 */
router.post('/chat', async (req, res) => {
  try {
    const { message, client_id, session_id, use_rag = true, manual_type } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const response = await axios.post(`${CHATBOT_URL}/chat`, {
      message,
      client_id,
      session_id,
      use_rag,
      manual_type
    }, {
      timeout: 30000
    });

    res.json(response.data);
  } catch (error) {
    console.error('RAG chat error:', error.message);
    if (error.response) {
      res.status(error.response.status).json({ error: error.response.data });
    } else {
      res.status(500).json({ error: 'RAG-enhanced chatbot service unavailable' });
    }
  }
});

/**
 * @swagger
 * /api/rag/ingest/upload:
 *   post:
 *     summary: Upload and ingest training manual
 *     tags: [RAG]
 *     consumes:
 *       - multipart/form-data
 *     parameters:
 *       - in: formData
 *         name: file
 *         type: file
 *         required: true
 *         description: Training manual file (PDF, TXT, DOCX, DOC)
 *       - in: formData
 *         name: manual_type
 *         type: string
 *         default: general
 *         description: Type of training manual
 *       - in: formData
 *         name: force_reprocess
 *         type: boolean
 *         default: false
 *         description: Force reprocessing if already exists
 *     responses:
 *       200:
 *         description: Ingestion started successfully
 *       400:
 *         description: Invalid file or parameters
 */
router.post('/ingest/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { manual_type = 'general', force_reprocess = false } = req.body;

    // Move file to S3/MinIO bucket (in production)
    // For now, we'll reference the local file path
    const relativePath = `training-manuals/${req.file.filename}`;

    const response = await axios.post(`${RAG_INGESTION_URL}/ingest/manual`, {
      file_path: relativePath,
      manual_type,
      force_reprocess: force_reprocess === 'true'
    }, {
      timeout: 60000
    });

    res.json({
      message: 'Training manual upload and ingestion started',
      file_info: {
        original_name: req.file.originalname,
        filename: req.file.filename,
        size: req.file.size,
        manual_type
      },
      ingestion_result: response.data
    });
  } catch (error) {
    console.error('Upload ingestion error:', error.message);
    if (error.response) {
      res.status(error.response.status).json({ error: error.response.data });
    } else {
      res.status(500).json({ error: 'Failed to process uploaded file' });
    }
  }
});

/**
 * @swagger
 * /api/rag/ingest/s3:
 *   post:
 *     summary: Ingest training manuals from S3 bucket
 *     tags: [RAG]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               bucket_path:
 *                 type: string
 *                 description: S3 bucket path (optional, processes entire bucket if not provided)
 *               file_path:
 *                 type: string
 *                 description: Specific file path in bucket
 *               manual_type:
 *                 type: string
 *                 default: general
 *                 description: Type of training manual
 *               force_reprocess:
 *                 type: boolean
 *                 default: false
 *                 description: Force reprocessing if already exists
 *     responses:
 *       200:
 *         description: Ingestion started successfully
 */
router.post('/ingest/s3', async (req, res) => {
  try {
    const { bucket_path, file_path, manual_type = 'general', force_reprocess = false } = req.body;

    const response = await axios.post(`${RAG_INGESTION_URL}/ingest/manual`, {
      bucket_path,
      file_path,
      manual_type,
      force_reprocess
    }, {
      timeout: 60000
    });

    res.json(response.data);
  } catch (error) {
    console.error('S3 ingestion error:', error.message);
    if (error.response) {
      res.status(error.response.status).json({ error: error.response.data });
    } else {
      res.status(500).json({ error: 'Failed to process S3 ingestion request' });
    }
  }
});

/**
 * @swagger
 * /api/rag/stats:
 *   get:
 *     summary: Get RAG collection statistics
 *     tags: [RAG]
 *     responses:
 *       200:
 *         description: Collection statistics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 total_chunks:
 *                   type: integer
 *                 manual_types:
 *                   type: array
 *                   items:
 *                     type: string
 *                 collection_name:
 *                   type: string
 */
router.get('/stats', async (req, res) => {
  try {
    const response = await axios.get(`${RAG_INGESTION_URL}/collections/stats`, {
      timeout: 10000
    });

    res.json(response.data);
  } catch (error) {
    console.error('RAG stats error:', error.message);
    if (error.response) {
      res.status(error.response.status).json({ error: error.response.data });
    } else {
      res.status(500).json({ error: 'Unable to fetch RAG statistics' });
    }
  }
});

/**
 * @swagger
 * /api/rag/health:
 *   get:
 *     summary: Check RAG services health
 *     tags: [RAG]
 *     responses:
 *       200:
 *         description: Health status of RAG services
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 rag_ingestion:
 *                   type: object
 *                 chatbot:
 *                   type: object
 *                 overall_status:
 *                   type: string
 */
router.get('/health', async (req, res) => {
  try {
    const [ragResponse, chatbotResponse] = await Promise.allSettled([
      axios.get(`${RAG_INGESTION_URL}/health`, { timeout: 5000 }),
      axios.get(`${CHATBOT_URL}/health`, { timeout: 5000 })
    ]);

    const healthStatus = {
      rag_ingestion: {
        status: ragResponse.status === 'fulfilled' ? 'healthy' : 'unhealthy',
        details: ragResponse.status === 'fulfilled' ? ragResponse.value.data : ragResponse.reason.message
      },
      chatbot: {
        status: chatbotResponse.status === 'fulfilled' ? 'healthy' : 'unhealthy',
        details: chatbotResponse.status === 'fulfilled' ? chatbotResponse.value.data : chatbotResponse.reason.message
      }
    };

    healthStatus.overall_status =
      healthStatus.rag_ingestion.status === 'healthy' && healthStatus.chatbot.status === 'healthy'
        ? 'healthy' : 'degraded';

    res.json(healthStatus);
  } catch (error) {
    console.error('Health check error:', error.message);
    res.status(500).json({
      overall_status: 'unhealthy',
      error: 'Health check failed'
    });
  }
});

/**
 * @swagger
 * /api/rag/collections/reset:
 *   delete:
 *     summary: Reset RAG collection (development only)
 *     tags: [RAG]
 *     responses:
 *       200:
 *         description: Collection reset successfully
 *       403:
 *         description: Not allowed in production
 */
router.delete('/collections/reset', async (req, res) => {
  try {
    // Only allow in development
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({ error: 'Collection reset not allowed in production' });
    }

    const response = await axios.delete(`${RAG_INGESTION_URL}/collections/reset`, {
      timeout: 10000
    });

    res.json(response.data);
  } catch (error) {
    console.error('Collection reset error:', error.message);
    if (error.response) {
      res.status(error.response.status).json({ error: error.response.data });
    } else {
      res.status(500).json({ error: 'Failed to reset collection' });
    }
  }
});

module.exports = router;