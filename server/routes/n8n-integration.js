/**
 * n8n Integration Routes
 * Provides endpoints for n8n workflow integration with centre management
 * Designed for centre managers to create and manage automated workflows
 */

const express = require('express');
const router = express.Router();
const axios = require('axios');
const pool = require('../config/database');
const { authenticateToken, requireRole } = require('../middleware/auth');
const ClientFilesMCP = require('../mcp/client-files-mcp');
const CentreStatisticsMCP = require('../mcp/centre-statistics-mcp');

// n8n Configuration
const N8N_BASE_URL = process.env.N8N_BASE_URL || 'http://localhost:5678';
const N8N_API_KEY = process.env.N8N_API_KEY;

class N8NIntegrationService {
    constructor() {
        this.baseURL = N8N_BASE_URL;
        this.apiKey = N8N_API_KEY;
    }

    // Get n8n headers with authentication
    getHeaders() {
        const headers = {
            'Content-Type': 'application/json'
        };
        
        if (this.apiKey) {
            headers['X-N8N-API-KEY'] = this.apiKey;
        }
        
        return headers;
    }

    // Test n8n connection
    async testConnection() {
        try {
            const response = await axios.get(`${this.baseURL}/rest/active`, {
                headers: this.getHeaders(),
                timeout: 5000
            });
            return { connected: true, status: 'ok', workflows: response.data };
        } catch (error) {
            console.error('n8n connection test failed:', error.message);
            return { 
                connected: false, 
                status: 'error', 
                message: error.message,
                suggestion: 'Check n8n is running and N8N_BASE_URL is correct'
            };
        }
    }

    // Get available workflow templates
    getWorkflowTemplates() {
        return [
            {
                id: 'daily-case-review',
                name: 'Daily Case Review',
                description: 'Automatically review and prioritize cases each morning',
                category: 'Case Management',
                frequency: 'Daily at 9:00 AM',
                complexity: 'Simple',
                benefits: [
                    'Identifies priority cases automatically',
                    'Sends daily summary to managers',
                    'Flags cases needing urgent attention'
                ],
                inputs: ['centre_id'],
                outputs: ['priority_case_list', 'daily_summary_email'],
                workflow_template: this.getDailyCaseReviewTemplate()
            },
            {
                id: 'weekly-performance-report',
                name: 'Weekly Performance Report',
                description: 'Generate comprehensive weekly centre performance reports',
                category: 'Analytics',
                frequency: 'Weekly on Friday at 5:00 PM',
                complexity: 'Simple',
                benefits: [
                    'Automated performance tracking',
                    'Staff workload analysis',
                    'Key metrics visualization'
                ],
                inputs: ['centre_id', 'report_recipients'],
                outputs: ['performance_report', 'metrics_dashboard'],
                workflow_template: this.getWeeklyReportTemplate()
            },
            {
                id: 'client-document-processor',
                name: 'Client Document Processor',
                description: 'Automatically organize and categorize uploaded client documents',
                category: 'Document Management',
                frequency: 'Triggered on file upload',
                complexity: 'Medium',
                benefits: [
                    'Automatic file organization',
                    'Document classification',
                    'Duplicate detection'
                ],
                inputs: ['file_upload_event'],
                outputs: ['organized_files', 'classification_report'],
                workflow_template: this.getDocumentProcessorTemplate()
            },
            {
                id: 'appointment-reminder-system',
                name: 'Appointment Reminder System',
                description: 'Send automated reminders to clients and staff for upcoming appointments',
                category: 'Communication',
                frequency: 'Daily check for appointments',
                complexity: 'Medium',
                benefits: [
                    'Reduces no-show rates',
                    'Automated SMS/email reminders',
                    'Staff preparation notifications'
                ],
                inputs: ['centre_id', 'reminder_preferences'],
                outputs: ['client_reminders', 'staff_notifications'],
                workflow_template: this.getAppointmentReminderTemplate()
            },
            {
                id: 'compliance-monitor',
                name: 'FCA Compliance Monitor',
                description: 'Monitor cases for FCA compliance and flag issues automatically',
                category: 'Compliance',
                frequency: 'Daily at 6:00 AM',
                complexity: 'Advanced',
                benefits: [
                    'Proactive compliance monitoring',
                    'Automated issue detection',
                    'Compliance reporting'
                ],
                inputs: ['centre_id', 'compliance_rules'],
                outputs: ['compliance_report', 'issue_alerts'],
                workflow_template: this.getComplianceMonitorTemplate()
            },
            {
                id: 'staff-workload-balancer',
                name: 'Staff Workload Balancer',
                description: 'Automatically redistribute cases when staff workloads become unbalanced',
                category: 'Workforce Management',
                frequency: 'Daily at 8:00 AM',
                complexity: 'Advanced',
                benefits: [
                    'Prevents advisor burnout',
                    'Optimizes case distribution',
                    'Improves team efficiency'
                ],
                inputs: ['centre_id', 'workload_thresholds'],
                outputs: ['workload_report', 'case_reassignments'],
                workflow_template: this.getWorkloadBalancerTemplate()
            }
        ];
    }

    // Create workflow in n8n
    async createWorkflow(workflowTemplate, centreId, userId) {
        try {
            // Customize template for specific centre
            const customizedWorkflow = {
                ...workflowTemplate,
                name: `${workflowTemplate.name} - Centre ${centreId}`,
                settings: {
                    ...workflowTemplate.settings,
                    executionOrder: 'v1'
                },
                // Add centre-specific parameters
                nodes: workflowTemplate.nodes.map(node => {
                    if (node.type === 'n8n-nodes-base.httpRequest' && node.name === 'MCP-Request') {
                        return {
                            ...node,
                            parameters: {
                                ...node.parameters,
                                options: {
                                    ...node.parameters.options,
                                    body: JSON.stringify({
                                        ...JSON.parse(node.parameters.options.body || '{}'),
                                        centre_id: centreId
                                    })
                                }
                            }
                        };
                    }
                    return node;
                })
            };

            const response = await axios.post(`${this.baseURL}/rest/workflows`, customizedWorkflow, {
                headers: this.getHeaders()
            });

            // Log workflow creation
            await this.logWorkflowCreation(response.data.id, workflowTemplate.id, centreId, userId);

            return {
                success: true,
                workflow_id: response.data.id,
                n8n_url: `${this.baseURL}/workflow/${response.data.id}`,
                workflow: response.data
            };

        } catch (error) {
            console.error('Error creating n8n workflow:', error);
            throw new Error(`Failed to create workflow: ${error.message}`);
        }
    }

    // Get workflow status
    async getWorkflowStatus(workflowId) {
        try {
            const response = await axios.get(`${this.baseURL}/rest/workflows/${workflowId}`, {
                headers: this.getHeaders()
            });

            const executions = await axios.get(`${this.baseURL}/rest/executions?filter={"workflowId":"${workflowId}"}&limit=5`, {
                headers: this.getHeaders()
            });

            return {
                workflow: response.data,
                recent_executions: executions.data.data,
                status: response.data.active ? 'Active' : 'Inactive',
                last_execution: executions.data.data[0] || null
            };

        } catch (error) {
            console.error('Error getting workflow status:', error);
            throw new Error(`Failed to get workflow status: ${error.message}`);
        }
    }

    // Log workflow creation for audit
    async logWorkflowCreation(workflowId, templateId, centreId, userId) {
        try {
            const client = await pool.connect();
            await client.query(`
                INSERT INTO n8n_workflows (n8n_workflow_id, template_id, centre_id, created_by, status, created_at)
                VALUES ($1, $2, $3, $4, 'active', CURRENT_TIMESTAMP)
            `, [workflowId, templateId, centreId, userId]);
            client.release();
        } catch (error) {
            console.error('Error logging workflow creation:', error);
        }
    }

    // Workflow Templates
    getDailyCaseReviewTemplate() {
        return {
            name: "Daily Case Review",
            active: false,
            nodes: [
                {
                    parameters: {
                        rule: {
                            interval: [{ field: "hours", hoursInterval: 24 }]
                        }
                    },
                    name: "Schedule",
                    type: "n8n-nodes-base.scheduleTrigger",
                    typeVersion: 1,
                    position: [240, 300]
                },
                {
                    parameters: {
                        url: "{{$env.API_BASE_URL}}/api/n8n/mcp/priority-case-triage",
                        method: "POST",
                        options: {
                            headers: {
                                "Authorization": "Bearer {{$env.API_TOKEN}}",
                                "Content-Type": "application/json"
                            },
                            body: JSON.stringify({
                                centre_id: "{{$env.CENTRE_ID}}"
                            })
                        }
                    },
                    name: "Get Priority Cases",
                    type: "n8n-nodes-base.httpRequest",
                    typeVersion: 2,
                    position: [460, 300]
                },
                {
                    parameters: {
                        conditions: {
                            boolean: [{
                                value1: "={{$json.priority_cases.length}}",
                                operation: "larger",
                                value2: 0
                            }]
                        }
                    },
                    name: "Has Priority Cases?",
                    type: "n8n-nodes-base.if",
                    typeVersion: 1,
                    position: [680, 300]
                },
                {
                    parameters: {
                        subject: "Daily Priority Cases Report - Centre {{$env.CENTRE_ID}}",
                        message: `
                            <h2>Daily Case Review</h2>
                            <p>Found {{$json.total_cases_reviewed}} cases reviewed.</p>
                            <p><strong>Critical Cases:</strong> {{$json.critical_cases}}</p>
                            <p><strong>High Risk Cases:</strong> {{$json.high_risk_cases}}</p>
                            
                            <h3>Top Priority Cases:</h3>
                            <ul>
                            {{#each priority_cases}}
                            <li>{{case_number}} - {{client_name}} (Risk: {{risk_level}})</li>
                            {{/each}}
                            </ul>
                        `,
                        options: {
                            allowUnauthorizedCerts: true
                        }
                    },
                    name: "Send Priority Email",
                    type: "n8n-nodes-base.emailSend",
                    typeVersion: 1,
                    position: [900, 200]
                }
            ],
            connections: {
                "Schedule": {
                    main: [
                        [{ node: "Get Priority Cases", type: "main", index: 0 }]
                    ]
                },
                "Get Priority Cases": {
                    main: [
                        [{ node: "Has Priority Cases?", type: "main", index: 0 }]
                    ]
                },
                "Has Priority Cases?": {
                    main: [
                        [{ node: "Send Priority Email", type: "main", index: 0 }],
                        []
                    ]
                }
            }
        };
    }

    getWeeklyReportTemplate() {
        return {
            name: "Weekly Performance Report",
            active: false,
            nodes: [
                {
                    parameters: {
                        rule: {
                            interval: [{
                                field: "weeks",
                                weeksInterval: 1
                            }]
                        }
                    },
                    name: "Weekly Schedule",
                    type: "n8n-nodes-base.scheduleTrigger",
                    typeVersion: 1,
                    position: [240, 300]
                },
                {
                    parameters: {
                        url: "{{$env.API_BASE_URL}}/api/n8n/mcp/centre-dashboard-metrics",
                        method: "POST",
                        options: {
                            headers: {
                                "Authorization": "Bearer {{$env.API_TOKEN}}"
                            },
                            body: JSON.stringify({
                                centre_id: "{{$env.CENTRE_ID}}",
                                timeframe: "week"
                            })
                        }
                    },
                    name: "Get Metrics",
                    type: "n8n-nodes-base.httpRequest",
                    typeVersion: 2,
                    position: [460, 300]
                }
            ],
            connections: {
                "Weekly Schedule": {
                    main: [
                        [{ node: "Get Metrics", type: "main", index: 0 }]
                    ]
                }
            }
        };
    }

    getDocumentProcessorTemplate() {
        return {
            name: "Document Processor",
            active: false,
            nodes: [
                {
                    parameters: {
                        path: "file-upload",
                        method: "POST"
                    },
                    name: "File Upload Webhook",
                    type: "n8n-nodes-base.webhook",
                    typeVersion: 1,
                    position: [240, 300]
                },
                {
                    parameters: {
                        url: "{{$env.API_BASE_URL}}/api/n8n/mcp/auto-organize-files",
                        method: "POST",
                        options: {
                            headers: {
                                "Authorization": "Bearer {{$env.API_TOKEN}}"
                            },
                            body: JSON.stringify({
                                case_id: "={{$json.case_id}}"
                            })
                        }
                    },
                    name: "Organize Files",
                    type: "n8n-nodes-base.httpRequest",
                    typeVersion: 2,
                    position: [460, 300]
                }
            ],
            connections: {
                "File Upload Webhook": {
                    main: [
                        [{ node: "Organize Files", type: "main", index: 0 }]
                    ]
                }
            }
        };
    }

    getAppointmentReminderTemplate() {
        return {
            name: "Appointment Reminders",
            active: false,
            nodes: [
                {
                    parameters: {
                        rule: {
                            interval: [{
                                field: "hours",
                                hoursInterval: 12
                            }]
                        }
                    },
                    name: "Check Appointments",
                    type: "n8n-nodes-base.scheduleTrigger",
                    typeVersion: 1,
                    position: [240, 300]
                },
                {
                    parameters: {
                        url: "{{$env.API_BASE_URL}}/api/n8n/mcp/upcoming-appointments",
                        method: "POST",
                        options: {
                            headers: {
                                "Authorization": "Bearer {{$env.API_TOKEN}}"
                            },
                            body: JSON.stringify({
                                centre_id: "{{$env.CENTRE_ID}}",
                                days_ahead: 1
                            })
                        }
                    },
                    name: "Get Appointments",
                    type: "n8n-nodes-base.httpRequest",
                    typeVersion: 2,
                    position: [460, 300]
                }
            ],
            connections: {
                "Check Appointments": {
                    main: [
                        [{ node: "Get Appointments", type: "main", index: 0 }]
                    ]
                }
            }
        };
    }

    getComplianceMonitorTemplate() {
        return {
            name: "Compliance Monitor",
            active: false,
            nodes: [
                {
                    parameters: {
                        rule: {
                            interval: [{
                                field: "hours",
                                hoursInterval: 24
                            }]
                        }
                    },
                    name: "Daily Check",
                    type: "n8n-nodes-base.scheduleTrigger",
                    typeVersion: 1,
                    position: [240, 300]
                },
                {
                    parameters: {
                        url: "{{$env.API_BASE_URL}}/api/n8n/mcp/compliance-audit",
                        method: "POST",
                        options: {
                            headers: {
                                "Authorization": "Bearer {{$env.API_TOKEN}}"
                            },
                            body: JSON.stringify({
                                centre_id: "{{$env.CENTRE_ID}}"
                            })
                        }
                    },
                    name: "Run Compliance Check",
                    type: "n8n-nodes-base.httpRequest",
                    typeVersion: 2,
                    position: [460, 300]
                }
            ],
            connections: {
                "Daily Check": {
                    main: [
                        [{ node: "Run Compliance Check", type: "main", index: 0 }]
                    ]
                }
            }
        };
    }

    getWorkloadBalancerTemplate() {
        return {
            name: "Workload Balancer",
            active: false,
            nodes: [
                {
                    parameters: {
                        rule: {
                            interval: [{
                                field: "hours",
                                hoursInterval: 24
                            }]
                        }
                    },
                    name: "Daily Balance Check",
                    type: "n8n-nodes-base.scheduleTrigger",
                    typeVersion: 1,
                    position: [240, 300]
                },
                {
                    parameters: {
                        url: "{{$env.API_BASE_URL}}/api/n8n/mcp/staff-performance-analysis",
                        method: "POST",
                        options: {
                            headers: {
                                "Authorization": "Bearer {{$env.API_TOKEN}}"
                            },
                            body: JSON.stringify({
                                centre_id: "{{$env.CENTRE_ID}}"
                            })
                        }
                    },
                    name: "Analyze Workloads",
                    type: "n8n-nodes-base.httpRequest",
                    typeVersion: 2,
                    position: [460, 300]
                }
            ],
            connections: {
                "Daily Balance Check": {
                    main: [
                        [{ node: "Analyze Workloads", type: "main", index: 0 }]
                    ]
                }
            }
        };
    }
}

const n8nService = new N8NIntegrationService();

// Test n8n connection
router.get('/status', authenticateToken, requireRole(['manager']), async (req, res) => {
    try {
        const status = await n8nService.testConnection();
        res.json(status);
    } catch (error) {
        res.status(500).json({ 
            connected: false, 
            error: error.message,
            suggestion: 'Check n8n server configuration'
        });
    }
});

// Get available workflow templates
router.get('/templates', authenticateToken, requireRole(['manager']), async (req, res) => {
    try {
        const templates = n8nService.getWorkflowTemplates();
        res.json({ 
            templates,
            total: templates.length,
            categories: [...new Set(templates.map(t => t.category))]
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Create workflow from template
router.post('/workflows/create', authenticateToken, requireRole(['manager']), async (req, res) => {
    try {
        const { template_id, workflow_name, configuration = {} } = req.body;
        const centreId = req.user.centre_id;
        const userId = req.user.id;

        if (!template_id) {
            return res.status(400).json({ error: 'Template ID is required' });
        }

        const templates = n8nService.getWorkflowTemplates();
        const template = templates.find(t => t.id === template_id);
        
        if (!template) {
            return res.status(404).json({ error: 'Template not found' });
        }

        // Customize workflow name if provided
        if (workflow_name) {
            template.name = workflow_name;
        }

        const result = await n8nService.createWorkflow(template.workflow_template, centreId, userId);
        
        res.json({
            success: true,
            message: 'Workflow created successfully',
            template_used: template.name,
            ...result
        });

    } catch (error) {
        console.error('Error creating workflow:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// Get workflows for centre
router.get('/workflows', authenticateToken, requireRole(['manager']), async (req, res) => {
    try {
        const centreId = req.user.centre_id;
        
        const client = await pool.connect();
        const workflows = await client.query(`
            SELECT 
                nw.*,
                u.first_name,
                u.last_name
            FROM n8n_workflows nw
            LEFT JOIN users u ON nw.created_by = u.id
            WHERE nw.centre_id = $1
            ORDER BY nw.created_at DESC
        `, [centreId]);
        client.release();

        // Get status from n8n for each workflow
        const workflowsWithStatus = await Promise.all(
            workflows.rows.map(async (workflow) => {
                try {
                    const status = await n8nService.getWorkflowStatus(workflow.n8n_workflow_id);
                    return {
                        ...workflow,
                        n8n_status: status.status,
                        last_execution: status.last_execution,
                        execution_count: status.recent_executions.length
                    };
                } catch (error) {
                    return {
                        ...workflow,
                        n8n_status: 'Error',
                        error: error.message
                    };
                }
            })
        );

        res.json({ 
            workflows: workflowsWithStatus,
            total: workflowsWithStatus.length
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// MCP endpoint proxies for n8n workflows
router.post('/mcp/:tool_name', authenticateToken, async (req, res) => {
    try {
        const { tool_name } = req.params;
        const parameters = req.body;
        
        let result;

        // Route to appropriate MCP plugin
        switch (tool_name) {
            case 'get-case-file-structure':
                result = await ClientFilesMCP.getCaseFileStructure(parameters.case_id, req.user.id);
                break;
            case 'search-case-files':
                result = await ClientFilesMCP.searchCaseFiles(parameters.case_id, parameters, req.user.id);
                break;
            case 'auto-organize-files':
                result = await ClientFilesMCP.autoOrganizeFiles(parameters.case_id, req.user.id);
                break;
            case 'generate-file-summary-report':
                result = await ClientFilesMCP.generateFileSummaryReport(parameters.case_id, req.user.id);
                break;
            case 'centre-dashboard-metrics':
                result = await CentreStatisticsMCP.getCentreDashboardMetrics(parameters.centre_id, parameters.timeframe);
                break;
            case 'calendar-analytics':
                result = await CentreStatisticsMCP.getCalendarAnalytics(parameters.centre_id, parameters.timeframe);
                break;
            case 'centre-risk-assessment':
                result = await CentreStatisticsMCP.getCentreRiskAssessment(parameters.centre_id);
                break;
            case 'operational-insights':
                result = await CentreStatisticsMCP.generateOperationalInsights(parameters.centre_id);
                break;
            default:
                return res.status(404).json({ error: 'MCP tool not found' });
        }

        res.json({
            tool: tool_name,
            result,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error(`Error executing MCP tool ${req.params.tool_name}:`, error);
        res.status(500).json({ 
            error: error.message,
            tool: req.params.tool_name
        });
    }
});

// Get MCP tool definitions for n8n
router.get('/mcp/tools', authenticateToken, requireRole(['manager']), async (req, res) => {
    try {
        const clientFilesTools = ClientFilesMCP.getToolDefinitions();
        const centreStatsTools = CentreStatisticsMCP.getToolDefinitions();

        res.json({
            categories: {
                'Client Files': clientFilesTools,
                'Centre Analytics': centreStatsTools
            },
            total_tools: clientFilesTools.length + centreStatsTools.length,
            base_url: `${req.protocol}://${req.get('host')}/api/n8n/mcp`
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;