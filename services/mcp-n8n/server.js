import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import express from 'express';
import axios from 'axios';
import cron from 'node-cron';
import { v4 as uuidv4 } from 'uuid';
import winston from 'winston';
import dotenv from 'dotenv';
import QRCode from 'qrcode';
import Redis from 'redis';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';

dotenv.config();

// Logger configuration
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ],
});

// Redis client for caching and session management
const redis = Redis.createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6380'
});

await redis.connect();

class CMAWorkflowMCPServer {
  constructor() {
    this.server = new Server(
      {
        name: 'cma-n8n-mcp-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
          resources: {},
        },
      }
    );

    this.baseConfig = {
      n8nUrl: process.env.N8N_URL || 'http://localhost:5678',
      ollamaUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
      cmaApiUrl: process.env.CMA_API_BASE_URL || 'http://localhost:5000',
      cmaApiKey: process.env.CMA_API_KEY,
      chromaDbUrl: process.env.CHROMADB_URL || 'http://localhost:8001',
    };

    this.setupToolHandlers();
    this.setupCronJobs();
    this.initializeWorkflows();

    logger.info('CMA Workflow MCP Server initialized');
  }

  setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'trigger_document_audit',
          description: 'Trigger comprehensive document audit workflow with AI analysis',
          inputSchema: {
            type: 'object',
            properties: {
              documentId: { type: 'string', description: 'Document ID to audit' },
              caseId: { type: 'string', description: 'Associated case ID' },
              analysisType: { 
                type: 'string', 
                enum: ['basic', 'full', 'compliance', 'financial'],
                default: 'full',
                description: 'Type of analysis to perform'
              },
              priority: {
                type: 'string',
                enum: ['low', 'medium', 'high', 'urgent'],
                default: 'medium'
              }
            },
            required: ['documentId', 'caseId'],
          },
        },
        {
          name: 'generate_qr_sfs',
          description: 'Generate QR code for client self-service financial statement',
          inputSchema: {
            type: 'object',
            properties: {
              clientId: { type: 'string', description: 'Client ID' },
              advisorId: { type: 'string', description: 'Advisor ID' },
              caseId: { type: 'string', description: 'Case ID' },
              expiryHours: { type: 'number', default: 24, description: 'QR code expiry in hours' },
              customPrompts: { 
                type: 'object', 
                description: 'Custom prompts for specific SFS sections',
                additionalProperties: { type: 'string' }
              }
            },
            required: ['clientId', 'advisorId'],
          },
        },
        {
          name: 'generate_dashboard_analytics',
          description: 'Generate custom analytics and insights for dashboard',
          inputSchema: {
            type: 'object',
            properties: {
              centreId: { type: 'number', description: 'Centre ID for analytics' },
              timeframe: { 
                type: 'string', 
                enum: ['7d', '30d', '90d', '1y'],
                default: '30d',
                description: 'Analytics timeframe'
              },
              metrics: { 
                type: 'array', 
                items: { type: 'string' },
                description: 'Specific metrics to analyze'
              },
              comparisonPeriod: { type: 'boolean', default: true },
              includeAIInsights: { type: 'boolean', default: true }
            },
            required: ['centreId'],
          },
        },
        {
          name: 'process_advice_generation',
          description: 'Generate AI-powered debt advice and recommendations',
          inputSchema: {
            type: 'object',
            properties: {
              caseId: { type: 'string', description: 'Case ID for advice generation' },
              clientProfile: { type: 'object', description: 'Client profile data' },
              financialData: { type: 'object', description: 'Financial situation data' },
              advisorNotes: { type: 'string', description: 'Additional advisor notes' },
              focusAreas: {
                type: 'array',
                items: { type: 'string' },
                description: 'Specific focus areas for advice'
              }
            },
            required: ['caseId'],
          },
        },
        {
          name: 'trigger_compliance_check',
          description: 'Trigger automated FCA compliance verification',
          inputSchema: {
            type: 'object',
            properties: {
              caseId: { type: 'string', description: 'Case ID to check' },
              checkType: {
                type: 'string',
                enum: ['affordability', 'vulnerability', 'advice_quality', 'documentation', 'full'],
                default: 'full'
              },
              generateReport: { type: 'boolean', default: true }
            },
            required: ['caseId'],
          },
        },
        {
          name: 'get_workflow_status',
          description: 'Get status and results of a workflow execution',
          inputSchema: {
            type: 'object',
            properties: {
              executionId: { type: 'string', description: 'Workflow execution ID' },
              workflowType: { type: 'string', description: 'Type of workflow' }
            },
            required: ['executionId'],
          },
        }
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        switch (request.params.name) {
          case 'trigger_document_audit':
            return await this.triggerDocumentAudit(request.params.arguments);
          
          case 'generate_qr_sfs':
            return await this.generateQRSFS(request.params.arguments);
            
          case 'generate_dashboard_analytics':
            return await this.generateDashboardAnalytics(request.params.arguments);
            
          case 'process_advice_generation':
            return await this.processAdviceGeneration(request.params.arguments);
            
          case 'trigger_compliance_check':
            return await this.triggerComplianceCheck(request.params.arguments);
            
          case 'get_workflow_status':
            return await this.getWorkflowStatus(request.params.arguments);
            
          default:
            throw new McpError(
              ErrorCode.MethodNotFound,
              `Unknown tool: ${request.params.name}`
            );
        }
      } catch (error) {
        logger.error('Tool execution error:', error);
        throw new McpError(
          ErrorCode.InternalError,
          error.message
        );
      }
    });
  }

  async triggerDocumentAudit({ documentId, caseId, analysisType = 'full', priority = 'medium' }) {
    const executionId = uuidv4();
    
    try {
      logger.info(`Triggering document audit for ${documentId}`);
      
      // Store execution metadata
      await redis.setEx(`execution:${executionId}`, 3600, JSON.stringify({
        type: 'document_audit',
        documentId,
        caseId,
        analysisType,
        priority,
        status: 'initiated',
        startTime: new Date().toISOString()
      }));

      const workflowData = {
        documentId,
        caseId,
        analysisType,
        priority,
        executionId,
        timestamp: new Date().toISOString()
      };

      // Trigger N8N workflow
      const response = await axios.post(
        `${this.baseConfig.n8nUrl}/webhook/document-audit`,
        workflowData,
        {
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: 10000
        }
      );

      await this.updateExecutionStatus(executionId, 'running', {
        n8nResponse: response.data
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              executionId,
              message: `Document audit workflow initiated for document ${documentId}`,
              analysisType,
              priority,
              estimatedCompletion: this.getEstimatedCompletion(analysisType)
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error('Document audit trigger failed:', error);
      await this.updateExecutionStatus(executionId, 'failed', { error: error.message });
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              executionId,
              error: `Failed to trigger document audit: ${error.message}`
            }, null, 2),
          },
        ],
        isError: true,
      };
    }
  }

  async generateQRSFS({ clientId, advisorId, caseId, expiryHours = 24, customPrompts = {} }) {
    const sessionId = uuidv4();
    const executionId = uuidv4();
    
    try {
      logger.info(`Generating QR SFS for client ${clientId}`);

      // Create SFS session
      const sfsSession = {
        sessionId,
        clientId,
        advisorId,
        caseId,
        status: 'initialized',
        expiresAt: new Date(Date.now() + expiryHours * 60 * 60 * 1000).toISOString(),
        customPrompts,
        createdAt: new Date().toISOString(),
        currentStep: 'welcome',
        completedSections: [],
        data: {}
      };

      // Store session in Redis
      await redis.setEx(
        `sfs_session:${sessionId}`, 
        expiryHours * 3600, 
        JSON.stringify(sfsSession)
      );

      // Generate QR code
      const sfsUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/sfs/${sessionId}`;
      const qrCodeDataUrl = await QRCode.toDataURL(sfsUrl, {
        width: 300,
        margin: 2,
        color: {
          dark: '#2c3e50',
          light: '#ffffff'
        }
      });

      // Trigger N8N workflow for SFS initialization
      const workflowData = {
        sessionId,
        clientId,
        advisorId,
        caseId,
        qrCodeUrl: qrCodeDataUrl,
        sfsUrl,
        executionId
      };

      await axios.post(
        `${this.baseConfig.n8nUrl}/webhook/qr-sfs-init`,
        workflowData,
        { headers: { 'Content-Type': 'application/json' } }
      );

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              sessionId,
              executionId,
              qrCodeDataUrl,
              sfsUrl,
              expiresAt: sfsSession.expiresAt,
              message: 'QR code generated successfully for SFS completion'
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error('QR SFS generation failed:', error);
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: `Failed to generate QR SFS: ${error.message}`
            }, null, 2),
          },
        ],
        isError: true,
      };
    }
  }

  async generateDashboardAnalytics({ 
    centreId, 
    timeframe = '30d', 
    metrics = [], 
    comparisonPeriod = true, 
    includeAIInsights = true 
  }) {
    const executionId = uuidv4();
    
    try {
      logger.info(`Generating dashboard analytics for centre ${centreId}`);

      const workflowData = {
        centreId,
        timeframe,
        metrics,
        comparisonPeriod,
        includeAIInsights,
        executionId,
        requestTimestamp: new Date().toISOString()
      };

      // Store execution metadata
      await redis.setEx(`execution:${executionId}`, 3600, JSON.stringify({
        type: 'dashboard_analytics',
        centreId,
        timeframe,
        status: 'initiated',
        startTime: new Date().toISOString()
      }));

      // Trigger N8N analytics workflow
      const response = await axios.post(
        `${this.baseConfig.n8nUrl}/webhook/dashboard-analytics`,
        workflowData,
        { headers: { 'Content-Type': 'application/json' } }
      );

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              executionId,
              message: `Dashboard analytics generation started for centre ${centreId}`,
              timeframe,
              estimatedCompletion: '2-5 minutes',
              includesAIInsights: includeAIInsights
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error('Dashboard analytics generation failed:', error);
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: `Failed to generate dashboard analytics: ${error.message}`
            }, null, 2),
          },
        ],
        isError: true,
      };
    }
  }

  async processAdviceGeneration({ caseId, clientProfile, financialData, advisorNotes, focusAreas = [] }) {
    const executionId = uuidv4();
    
    try {
      logger.info(`Processing advice generation for case ${caseId}`);

      const workflowData = {
        caseId,
        clientProfile,
        financialData,
        advisorNotes,
        focusAreas,
        executionId,
        timestamp: new Date().toISOString()
      };

      // Store execution metadata
      await redis.setEx(`execution:${executionId}`, 3600, JSON.stringify({
        type: 'advice_generation',
        caseId,
        status: 'initiated',
        startTime: new Date().toISOString()
      }));

      // Trigger advice generation workflow
      const response = await axios.post(
        `${this.baseConfig.n8nUrl}/webhook/advice-generation`,
        workflowData,
        { headers: { 'Content-Type': 'application/json' } }
      );

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              executionId,
              message: `AI advice generation initiated for case ${caseId}`,
              focusAreas,
              estimatedCompletion: '1-3 minutes'
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error('Advice generation failed:', error);
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: `Failed to process advice generation: ${error.message}`
            }, null, 2),
          },
        ],
        isError: true,
      };
    }
  }

  async triggerComplianceCheck({ caseId, checkType = 'full', generateReport = true }) {
    const executionId = uuidv4();
    
    try {
      logger.info(`Triggering compliance check for case ${caseId}`);

      const workflowData = {
        caseId,
        checkType,
        generateReport,
        executionId,
        timestamp: new Date().toISOString()
      };

      await redis.setEx(`execution:${executionId}`, 3600, JSON.stringify({
        type: 'compliance_check',
        caseId,
        checkType,
        status: 'initiated',
        startTime: new Date().toISOString()
      }));

      const response = await axios.post(
        `${this.baseConfig.n8nUrl}/webhook/compliance-check`,
        workflowData,
        { headers: { 'Content-Type': 'application/json' } }
      );

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              executionId,
              message: `FCA compliance check initiated for case ${caseId}`,
              checkType,
              generateReport,
              estimatedCompletion: '30 seconds - 2 minutes'
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error('Compliance check failed:', error);
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: `Failed to trigger compliance check: ${error.message}`
            }, null, 2),
          },
        ],
        isError: true,
      };
    }
  }

  async getWorkflowStatus({ executionId, workflowType }) {
    try {
      const executionData = await redis.get(`execution:${executionId}`);
      
      if (!executionData) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: false,
                error: 'Execution not found or expired'
              }, null, 2),
            },
          ],
          isError: true,
        };
      }

      const execution = JSON.parse(executionData);
      
      // Try to get additional status from N8N if available
      let n8nStatus = null;
      try {
        const n8nResponse = await axios.get(
          `${this.baseConfig.n8nUrl}/rest/executions/${executionId}`,
          { timeout: 5000 }
        );
        n8nStatus = n8nResponse.data;
      } catch (n8nError) {
        logger.warn('Could not fetch N8N execution status:', n8nError.message);
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              executionId,
              status: execution.status,
              type: execution.type,
              startTime: execution.startTime,
              lastUpdate: execution.lastUpdate,
              n8nStatus: n8nStatus ? {
                finished: n8nStatus.finished,
                mode: n8nStatus.mode,
                startedAt: n8nStatus.startedAt,
                stoppedAt: n8nStatus.stoppedAt
              } : null,
              additionalData: execution.additionalData || {}
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error('Get workflow status failed:', error);
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: `Failed to get workflow status: ${error.message}`
            }, null, 2),
          },
        ],
        isError: true,
      };
    }
  }

  async updateExecutionStatus(executionId, status, additionalData = {}) {
    try {
      const existingData = await redis.get(`execution:${executionId}`);
      if (existingData) {
        const execution = JSON.parse(existingData);
        execution.status = status;
        execution.lastUpdate = new Date().toISOString();
        execution.additionalData = { ...execution.additionalData, ...additionalData };
        
        await redis.setEx(`execution:${executionId}`, 3600, JSON.stringify(execution));
      }
    } catch (error) {
      logger.error('Failed to update execution status:', error);
    }
  }

  getEstimatedCompletion(analysisType) {
    const estimates = {
      'basic': '30 seconds',
      'full': '2-3 minutes',
      'compliance': '1-2 minutes',
      'financial': '1-2 minutes'
    };
    return estimates[analysisType] || '1-3 minutes';
  }

  async initializeWorkflows() {
    // Initialize any default workflows or configurations
    logger.info('Initializing workflows...');
    
    // Set up default workflow configurations
    const defaultConfigs = {
      documentAudit: {
        timeout: 300000, // 5 minutes
        retries: 2,
        confidenceThreshold: 0.7
      },
      adviceGeneration: {
        timeout: 180000, // 3 minutes
        retries: 1,
        modelTemperature: 0.3
      },
      complianceCheck: {
        timeout: 120000, // 2 minutes
        retries: 2,
        strictMode: true
      }
    };

    await redis.setEx('workflow_configs', 86400, JSON.stringify(defaultConfigs));
    logger.info('Workflow configurations initialized');
  }

  setupCronJobs() {
    // Clean up expired executions every hour
    cron.schedule('0 * * * *', async () => {
      logger.info('Running cleanup of expired executions');
      try {
        const keys = await redis.keys('execution:*');
        let cleaned = 0;
        
        for (const key of keys) {
          const data = await redis.get(key);
          if (data) {
            const execution = JSON.parse(data);
            const age = Date.now() - new Date(execution.startTime).getTime();
            if (age > 24 * 60 * 60 * 1000) { // 24 hours
              await redis.del(key);
              cleaned++;
            }
          }
        }
        
        logger.info(`Cleaned up ${cleaned} expired executions`);
      } catch (error) {
        logger.error('Cleanup job failed:', error);
      }
    });

    // Health check for connected services every 5 minutes
    cron.schedule('*/5 * * * *', async () => {
      try {
        await this.performHealthCheck();
      } catch (error) {
        logger.error('Health check failed:', error);
      }
    });
  }

  async performHealthCheck() {
    const services = {
      n8n: this.baseConfig.n8nUrl,
      ollama: this.baseConfig.ollamaUrl,
      chromadb: this.baseConfig.chromaDbUrl
    };

    for (const [service, url] of Object.entries(services)) {
      try {
        await axios.get(`${url}/health`, { timeout: 5000 });
        logger.debug(`${service} health check: OK`);
      } catch (error) {
        logger.warn(`${service} health check failed:`, error.message);
      }
    }
  }
}

// Start the MCP server
const mcpServer = new CMAWorkflowMCPServer();

// Also start an HTTP server for webhook callbacks and status endpoints
const app = express();
app.use(express.json());

app.post('/webhook/execution-update', async (req, res) => {
  try {
    const { executionId, status, data } = req.body;
    await mcpServer.updateExecutionStatus(executionId, status, data);
    res.json({ success: true });
  } catch (error) {
    logger.error('Webhook execution update failed:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    services: {
      redis: redis.isOpen,
      mcp: true
    }
  });
});

const port = process.env.MCP_SERVER_PORT || 8080;
app.listen(port, () => {
  logger.info(`MCP HTTP server listening on port ${port}`);
});

// Start MCP server
const transport = new StdioServerTransport();
await mcpServer.server.connect(transport);
logger.info('MCP Server started and connected');

// Graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Shutting down gracefully...');
  await redis.quit();
  process.exit(0);
});
