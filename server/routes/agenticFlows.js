const express = require('express');
const router = express.Router();
const axios = require('axios');
const pool = require('../config/database');
const { authenticateToken, requireRole } = require('../middleware/auth');

// MCP Tools for Centre Management
class CentreManagementMCP {
    
    // Get comprehensive centre statistics
    async getCentreStatistics(centreId) {
        try {
            const client = await pool.connect();
            
            const stats = await client.query(`
                SELECT 
                    (SELECT COUNT(*) FROM cases WHERE centre_id = $1 AND status = 'active') as active_cases,
                    (SELECT COUNT(*) FROM cases WHERE centre_id = $1 AND created_at >= CURRENT_DATE - INTERVAL '30 days') as new_cases_30d,
                    (SELECT COUNT(*) FROM users WHERE centre_id = $1 AND is_active = true) as active_staff,
                    (SELECT COUNT(*) FROM appointments WHERE case_id IN (SELECT id FROM cases WHERE centre_id = $1) AND appointment_date >= CURRENT_DATE) as upcoming_appointments,
                    (SELECT AVG(CASE WHEN status = 'closed' THEN EXTRACT(EPOCH FROM (closed_at - created_at))/86400 ELSE NULL END) FROM cases WHERE centre_id = $1) as avg_case_duration_days,
                    (SELECT COALESCE(SUM(total_debt), 0) FROM cases WHERE centre_id = $1 AND status = 'active') as total_debt_managed,
                    (SELECT COUNT(*) FROM notes WHERE case_id IN (SELECT id FROM cases WHERE centre_id = $1) AND created_at >= CURRENT_DATE - INTERVAL '7 days') as notes_this_week
            `, [centreId]);
            
            client.release();
            return stats.rows[0];
            
        } catch (error) {
            console.error('Error getting centre statistics:', error);
            throw error;
        }
    }

    // Analyze staff performance and workloads
    async analyzeStaffPerformance(centreId) {
        try {
            const client = await pool.connect();
            
            const staffData = await client.query(`
                SELECT 
                    u.id, u.first_name, u.last_name, u.role,
                    (SELECT COUNT(*) FROM cases WHERE assigned_advisor_id = u.id AND status = 'active') as active_cases,
                    (SELECT COUNT(*) FROM cases WHERE assigned_advisor_id = u.id AND status = 'closed' AND closed_at >= CURRENT_DATE - INTERVAL '30 days') as closed_cases_30d,
                    (SELECT COUNT(*) FROM notes WHERE user_id = u.id AND created_at >= CURRENT_DATE - INTERVAL '7 days') as notes_this_week,
                    (SELECT COUNT(*) FROM appointments WHERE advisor_id = u.id AND appointment_date >= CURRENT_DATE) as upcoming_appointments,
                    (SELECT AVG(EXTRACT(EPOCH FROM (closed_at - created_at))/86400) FROM cases WHERE assigned_advisor_id = u.id AND status = 'closed' AND closed_at >= CURRENT_DATE - INTERVAL '90 days') as avg_case_duration
                FROM users u
                WHERE u.centre_id = $1 AND u.is_active = true AND u.role = 'advisor'
                ORDER BY active_cases DESC
            `, [centreId]);
            
            client.release();
            
            // Calculate workload scores and recommendations
            const analysis = staffData.rows.map(staff => {
                const workloadScore = (staff.active_cases * 1.5) + (staff.upcoming_appointments * 0.5);
                const productivityScore = (staff.closed_cases_30d * 2) + (staff.notes_this_week * 0.5);
                
                let recommendation = 'Balanced workload';
                if (workloadScore > 20) recommendation = 'Consider redistributing cases';
                if (workloadScore < 5) recommendation = 'Can take additional cases';
                if (productivityScore < 5) recommendation = 'May need additional support';
                
                return {
                    ...staff,
                    workload_score: Math.round(workloadScore),
                    productivity_score: Math.round(productivityScore),
                    recommendation
                };
            });
            
            return {
                staff_analysis: analysis,
                recommendations: this.generateWorkloadRecommendations(analysis),
                total_staff: analysis.length,
                avg_workload: Math.round(analysis.reduce((sum, s) => sum + s.workload_score, 0) / analysis.length)
            };
            
        } catch (error) {
            console.error('Error analyzing staff performance:', error);
            throw error;
        }
    }

    generateWorkloadRecommendations(staffAnalysis) {
        const recommendations = [];
        
        const overloaded = staffAnalysis.filter(s => s.workload_score > 20);
        const underloaded = staffAnalysis.filter(s => s.workload_score < 5);
        const lowProductivity = staffAnalysis.filter(s => s.productivity_score < 5);
        
        if (overloaded.length > 0) {
            recommendations.push({
                type: 'workload_redistribution',
                priority: 'high',
                message: `${overloaded.length} advisor(s) are overloaded. Consider redistributing cases.`,
                affected_staff: overloaded.map(s => `${s.first_name} ${s.last_name}`)
            });
        }
        
        if (underloaded.length > 0 && overloaded.length > 0) {
            recommendations.push({
                type: 'case_reassignment',
                priority: 'medium',
                message: `${underloaded.length} advisor(s) can take additional cases.`,
                affected_staff: underloaded.map(s => `${s.first_name} ${s.last_name}`)
            });
        }
        
        if (lowProductivity.length > 0) {
            recommendations.push({
                type: 'support_needed',
                priority: 'medium',
                message: `${lowProductivity.length} advisor(s) may benefit from additional support or training.`,
                affected_staff: lowProductivity.map(s => `${s.first_name} ${s.last_name}`)
            });
        }
        
        return recommendations;
    }

    // Identify high-priority cases across the centre
    async priorityCaseTriage(centreId) {
        try {
            const client = await pool.connect();
            
            // Get cases with risk factors
            const riskyCases = await client.query(`
                SELECT 
                    c.id, c.case_number, c.status, c.total_debt, c.created_at,
                    cl.first_name, cl.last_name, cl.date_of_birth,
                    (SELECT COUNT(*) FROM creditors WHERE case_id = c.id AND priority_type = 'priority') as priority_debts,
                    (SELECT COUNT(*) FROM notes WHERE case_id = c.id AND note_category = 'vulnerability') as vulnerability_notes,
                    (SELECT MAX(created_at) FROM notes WHERE case_id = c.id) as last_activity,
                    (SELECT COUNT(*) FROM appointments WHERE case_id = c.id AND status = 'missed') as missed_appointments
                FROM cases c
                JOIN clients cl ON c.client_id = cl.id
                WHERE c.centre_id = $1 AND c.status = 'active'
                ORDER BY c.created_at DESC
            `, [centreId]);
            
            client.release();
            
            // Calculate priority scores
            const scoredCases = riskyCases.rows.map(caseItem => {
                let priorityScore = 0;
                const now = new Date();
                const lastActivity = new Date(caseItem.last_activity);
                const daysSinceActivity = (now - lastActivity) / (1000 * 60 * 60 * 24);
                
                // Scoring factors
                if (caseItem.priority_debts > 0) priorityScore += 30;
                if (caseItem.vulnerability_notes > 0) priorityScore += 25;
                if (caseItem.missed_appointments > 1) priorityScore += 20;
                if (daysSinceActivity > 14) priorityScore += 15;
                if (caseItem.total_debt > 10000) priorityScore += 10;
                if (daysSinceActivity > 30) priorityScore += 20;
                
                let riskLevel = 'Low';
                if (priorityScore >= 60) riskLevel = 'Critical';
                else if (priorityScore >= 40) riskLevel = 'High';
                else if (priorityScore >= 20) riskLevel = 'Medium';
                
                return {
                    ...caseItem,
                    priority_score: priorityScore,
                    risk_level: riskLevel,
                    days_since_activity: Math.round(daysSinceActivity),
                    client_name: `${caseItem.first_name} ${caseItem.last_name}`
                };
            });
            
            // Sort by priority score and return top cases
            const priorityCases = scoredCases
                .sort((a, b) => b.priority_score - a.priority_score)
                .slice(0, 20);
                
            return {
                priority_cases: priorityCases,
                total_cases_reviewed: scoredCases.length,
                critical_cases: priorityCases.filter(c => c.risk_level === 'Critical').length,
                high_risk_cases: priorityCases.filter(c => c.risk_level === 'High').length,
                recommendations: this.generateTriageRecommendations(priorityCases)
            };
            
        } catch (error) {
            console.error('Error in priority case triage:', error);
            throw error;
        }
    }

    generateTriageRecommendations(priorityCases) {
        const recommendations = [];
        
        const criticalCases = priorityCases.filter(c => c.risk_level === 'Critical');
        const staleCases = priorityCases.filter(c => c.days_since_activity > 30);
        const vulnerableCases = priorityCases.filter(c => c.vulnerability_notes > 0);
        
        if (criticalCases.length > 0) {
            recommendations.push({
                type: 'immediate_action',
                priority: 'critical',
                message: `${criticalCases.length} cases require immediate attention`,
                action: 'Review and contact clients within 24 hours',
                case_numbers: criticalCases.map(c => c.case_number)
            });
        }
        
        if (staleCases.length > 0) {
            recommendations.push({
                type: 'follow_up_needed',
                priority: 'high',
                message: `${staleCases.length} cases have no activity for 30+ days`,
                action: 'Schedule welfare calls and update case notes',
                case_numbers: staleCases.map(c => c.case_number)
            });
        }
        
        if (vulnerableCases.length > 0) {
            recommendations.push({
                type: 'vulnerability_support',
                priority: 'high',
                message: `${vulnerableCases.length} cases have vulnerability indicators`,
                action: 'Ensure appropriate support services are offered',
                case_numbers: vulnerableCases.map(c => c.case_number)
            });
        }
        
        return recommendations;
    }

    // Generate monthly centre report using local LLM
    async generateMonthlyReport(centreId) {
        try {
            const stats = await this.getCentreStatistics(centreId);
            const staffAnalysis = await this.analyzeStaffPerformance(centreId);
            const triage = await this.priorityCaseTriage(centreId);
            
            // Use local chatbot for AI insights
            const reportPrompt = `
Generate a professional monthly centre report for debt advice centre ${centreId}.

Key Statistics:
- Active Cases: ${stats.active_cases}
- New Cases (30 days): ${stats.new_cases_30d}
- Active Staff: ${stats.active_staff}
- Average Case Duration: ${Math.round(stats.avg_case_duration_days || 0)} days
- Total Debt Managed: £${stats.total_debt_managed}

Staff Performance:
- Total Advisors: ${staffAnalysis.total_staff}
- Average Workload Score: ${staffAnalysis.avg_workload}
- Staff needing support: ${staffAnalysis.recommendations.length}

Risk Assessment:
- Critical Cases: ${triage.critical_cases}
- High Risk Cases: ${triage.high_risk_cases}
- Cases Reviewed: ${triage.total_cases_reviewed}

Create a comprehensive monthly report including:
1. Executive Summary
2. Key Performance Indicators
3. Staff Performance Analysis
4. Risk Assessment
5. Recommendations for next month
6. Compliance status

Use professional language suitable for centre management and regulatory review.
            `;

            const aiResponse = await axios.post(
                `${process.env.CHATBOT_URL || 'http://localhost:8001'}/chat`,
                {
                    message: reportPrompt,
                    case_id: null,
                    user_id: null
                }
            );

            return {
                report: aiResponse.data.response,
                statistics: stats,
                staff_analysis: staffAnalysis,
                risk_assessment: triage,
                generated_at: new Date().toISOString(),
                centre_id: centreId
            };
            
        } catch (error) {
            console.error('Error generating monthly report:', error);
            throw error;
        }
    }

    // Batch generate Confirmation of Advice letters
    async batchGenerateCoA(centreId, caseIds) {
        try {
            const results = [];
            
            for (const caseId of caseIds) {
                try {
                    const coaResponse = await axios.post(
                        `${process.env.CHATBOT_URL || 'http://localhost:8001'}/mcp/tools/generate_confirmation_of_advice`,
                        { case_id: caseId }
                    );
                    
                    results.push({
                        case_id: caseId,
                        status: 'success',
                        confirmation_of_advice: coaResponse.data.result.confirmation_of_advice,
                        generated_at: new Date().toISOString()
                    });
                    
                } catch (error) {
                    results.push({
                        case_id: caseId,
                        status: 'failed',
                        error: error.message
                    });
                }
            }
            
            return {
                batch_id: `batch_${Date.now()}`,
                total_cases: caseIds.length,
                successful: results.filter(r => r.status === 'success').length,
                failed: results.filter(r => r.status === 'failed').length,
                results
            };
            
        } catch (error) {
            console.error('Error in batch CoA generation:', error);
            throw error;
        }
    }

    // Multi-language client outreach
    async generateMultilingualOutreach(centreId, messageTemplate, targetLanguages) {
        try {
            const translations = {};
            
            for (const lang of targetLanguages) {
                try {
                    const translationResponse = await axios.post(
                        `${process.env.TRANSLATION_SERVICE_URL || 'http://localhost:8003'}/translate`,
                        {
                            text: messageTemplate,
                            target_language: lang,
                            source_language: 'en'
                        }
                    );
                    
                    translations[lang] = translationResponse.data.translated_text;
                    
                } catch (error) {
                    translations[lang] = `Translation failed: ${error.message}`;
                }
            }
            
            // Get clients who might need translated communications
            const client = await pool.connect();
            const clientsNeedingTranslation = await client.query(`
                SELECT 
                    cl.id, cl.first_name, cl.last_name, cl.preferred_language,
                    c.id as case_id, c.case_number
                FROM clients cl
                JOIN cases c ON cl.id = c.client_id
                WHERE c.centre_id = $1 AND c.status = 'active'
                AND cl.preferred_language IS NOT NULL
                AND cl.preferred_language != 'en'
            `, [centreId]);
            
            client.release();
            
            return {
                translations,
                target_clients: clientsNeedingTranslation.rows,
                generated_at: new Date().toISOString(),
                centre_id: centreId
            };
            
        } catch (error) {
            console.error('Error generating multilingual outreach:', error);
            throw error;
        }
    }

    // FCA compliance checker
    async runComplianceAudit(centreId) {
        try {
            const client = await pool.connect();
            
            // Check various compliance requirements
            const complianceChecks = await client.query(`
                SELECT 
                    c.id, c.case_number, c.created_at, c.status,
                    cl.first_name, cl.last_name,
                    (SELECT COUNT(*) FROM notes WHERE case_id = c.id) as total_notes,
                    (SELECT COUNT(*) FROM notes WHERE case_id = c.id AND note_category = 'advice_given') as advice_notes,
                    (SELECT COUNT(*) FROM documents WHERE case_id = c.id AND document_type = 'income_expenditure') as ie_forms,
                    (SELECT COUNT(*) FROM documents WHERE case_id = c.id AND document_type = 'confirmation_of_advice') as coa_letters,
                    (SELECT COUNT(*) FROM creditors WHERE case_id = c.id) as creditors_listed,
                    (CASE WHEN c.created_at < CURRENT_DATE - INTERVAL '90 days' AND c.status = 'active' THEN true ELSE false END) as long_running
                FROM cases c
                JOIN clients cl ON c.client_id = cl.id
                WHERE c.centre_id = $1
                ORDER BY c.created_at DESC
            `, [centreId]);
            
            client.release();
            
            const complianceIssues = [];
            const cases = complianceChecks.rows;
            
            cases.forEach(caseItem => {
                const issues = [];
                
                if (caseItem.advice_notes === 0) {
                    issues.push('No advice notes recorded');
                }
                if (caseItem.ie_forms === 0 && caseItem.status === 'active') {
                    issues.push('No income/expenditure form on file');
                }
                if (caseItem.coa_letters === 0 && caseItem.total_notes > 3) {
                    issues.push('No confirmation of advice issued');
                }
                if (caseItem.creditors_listed === 0 && caseItem.status === 'active') {
                    issues.push('No creditors listed');
                }
                if (caseItem.long_running) {
                    issues.push('Case active for over 90 days');
                }
                
                if (issues.length > 0) {
                    complianceIssues.push({
                        case_id: caseItem.id,
                        case_number: caseItem.case_number,
                        client_name: `${caseItem.first_name} ${caseItem.last_name}`,
                        issues,
                        risk_level: issues.length > 2 ? 'High' : issues.length > 1 ? 'Medium' : 'Low'
                    });
                }
            });
            
            return {
                total_cases_reviewed: cases.length,
                cases_with_issues: complianceIssues.length,
                compliance_rate: ((cases.length - complianceIssues.length) / cases.length * 100).toFixed(1),
                issues_by_risk: {
                    high: complianceIssues.filter(i => i.risk_level === 'High').length,
                    medium: complianceIssues.filter(i => i.risk_level === 'Medium').length,
                    low: complianceIssues.filter(i => i.risk_level === 'Low').length
                },
                compliance_issues: complianceIssues.slice(0, 20), // Top 20 issues
                recommendations: this.generateComplianceRecommendations(complianceIssues)
            };
            
        } catch (error) {
            console.error('Error running compliance audit:', error);
            throw error;
        }
    }

    generateComplianceRecommendations(complianceIssues) {
        const recommendations = [];
        const issueTypes = {};
        
        complianceIssues.forEach(issue => {
            issue.issues.forEach(issueType => {
                issueTypes[issueType] = (issueTypes[issueType] || 0) + 1;
            });
        });
        
        Object.entries(issueTypes).forEach(([issueType, count]) => {
            if (count >= 5) {
                recommendations.push({
                    type: 'systematic_issue',
                    priority: 'high',
                    message: `${issueType} affects ${count} cases - consider systematic review`,
                    action: `Implement process improvement for: ${issueType}`
                });
            }
        });
        
        if (complianceIssues.filter(i => i.risk_level === 'High').length > 0) {
            recommendations.push({
                type: 'high_risk_cases',
                priority: 'critical',
                message: 'High-risk compliance issues identified',
                action: 'Schedule immediate case reviews for high-risk cases'
            });
        }
        
        return recommendations;
    }
}

const centreManagerMCP = new CentreManagementMCP();

// Execute agentic flow
router.post('/execute', authenticateToken, requireRole(['manager']), async (req, res) => {
    try {
        const { flowId, parameters = {} } = req.body;
        const centreId = req.user.centre_id;
        
        let result;
        
        switch (flowId) {
            case 'monthly-centre-report':
                result = await centreManagerMCP.generateMonthlyReport(centreId);
                break;
                
            case 'staff-workload-optimizer':
                result = await centreManagerMCP.analyzeStaffPerformance(centreId);
                break;
                
            case 'priority-case-triage':
                result = await centreManagerMCP.priorityCaseTriage(centreId);
                break;
                
            case 'batch-letter-generation':
                result = await centreManagerMCP.batchGenerateCoA(centreId, parameters.caseIds || []);
                break;
                
            case 'compliance-audit-runner':
                result = await centreManagerMCP.runComplianceAudit(centreId);
                break;
                
            case 'multilingual-client-outreach':
                result = await centreManagerMCP.generateMultilingualOutreach(
                    centreId, 
                    parameters.messageTemplate || 'Your debt advice appointment is scheduled.',
                    parameters.targetLanguages || ['es', 'fr', 'de']
                );
                break;
                
            default:
                return res.status(400).json({ error: 'Unknown flow ID' });
        }
        
        // Log execution
        const client = await pool.connect();
        await client.query(`
            INSERT INTO agentic_flow_executions (centre_id, flow_id, executed_by, result_summary, executed_at)
            VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
        `, [centreId, flowId, req.user.id, JSON.stringify({
            success: true,
            summary: `Executed ${flowId} successfully`,
            result_count: result.total_cases_reviewed || result.total_staff || result.successful || 1
        })]);
        client.release();
        
        res.json({
            success: true,
            flowId,
            executionId: `exec_${Date.now()}`,
            result,
            completedAt: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Agentic flow execution error:', error);
        res.status(500).json({ 
            success: false,
            error: error.message,
            flowId: req.body.flowId
        });
    }
});

// Get available MCP tools for centre managers
router.get('/mcp-tools', authenticateToken, requireRole(['manager']), async (req, res) => {
    res.json({
        tools: [
            {
                name: 'centre_statistics',
                description: 'Get comprehensive centre performance statistics',
                category: 'Analytics',
                inputSchema: {
                    type: 'object',
                    properties: {
                        centre_id: { type: 'integer' }
                    }
                }
            },
            {
                name: 'staff_performance_analysis', 
                description: 'Analyze staff workloads and performance metrics',
                category: 'Management',
                inputSchema: {
                    type: 'object',
                    properties: {
                        centre_id: { type: 'integer' }
                    }
                }
            },
            {
                name: 'priority_case_triage',
                description: 'Identify and prioritize high-risk cases',
                category: 'Risk Management',
                inputSchema: {
                    type: 'object',
                    properties: {
                        centre_id: { type: 'integer' }
                    }
                }
            },
            {
                name: 'batch_coa_generator',
                description: 'Generate multiple Confirmation of Advice letters',
                category: 'Documentation',
                inputSchema: {
                    type: 'object',
                    properties: {
                        case_ids: { type: 'array', items: { type: 'integer' } }
                    }
                }
            },
            {
                name: 'compliance_checker',
                description: 'Run FCA compliance audit across all cases',
                category: 'Compliance',
                inputSchema: {
                    type: 'object',
                    properties: {
                        centre_id: { type: 'integer' }
                    }
                }
            },
            {
                name: 'multilingual_message_generator',
                description: 'Generate client communications in multiple languages',
                category: 'Communication',
                inputSchema: {
                    type: 'object',
                    properties: {
                        message_template: { type: 'string' },
                        target_languages: { type: 'array', items: { type: 'string' } }
                    }
                }
            }
        ]
    });
});

// Call specific MCP tool
router.post('/mcp-tools/:toolName', authenticateToken, requireRole(['manager']), async (req, res) => {
    try {
        const { toolName } = req.params;
        const { parameters } = req.body;
        const centreId = req.user.centre_id;
        
        let result;
        
        switch (toolName) {
            case 'centre_statistics':
                result = await centreManagerMCP.getCentreStatistics(centreId);
                break;
                
            case 'staff_performance_analysis':
                result = await centreManagerMCP.analyzeStaffPerformance(centreId);
                break;
                
            case 'priority_case_triage':
                result = await centreManagerMCP.priorityCaseTriage(centreId);
                break;
                
            case 'batch_coa_generator':
                result = await centreManagerMCP.batchGenerateCoA(centreId, parameters.case_ids);
                break;
                
            case 'compliance_checker':
                result = await centreManagerMCP.runComplianceAudit(centreId);
                break;
                
            case 'multilingual_message_generator':
                result = await centreManagerMCP.generateMultilingualOutreach(
                    centreId,
                    parameters.message_template,
                    parameters.target_languages
                );
                break;
                
            default:
                return res.status(404).json({ error: 'Tool not found' });
        }
        
        res.json({
            tool: toolName,
            result,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error(`Error executing MCP tool ${req.params.toolName}:`, error);
        res.status(500).json({ error: error.message });
    }
});

// Get recent flow executions
router.get('/recent', authenticateToken, requireRole(['manager']), async (req, res) => {
    try {
        const client = await pool.connect();
        const executions = await client.query(`
            SELECT 
                flow_id as "flowName",
                executed_at as "completedAt", 
                result_summary as "summary",
                EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - executed_at)) as duration_seconds
            FROM agentic_flow_executions
            WHERE centre_id = $1
            ORDER BY executed_at DESC
            LIMIT 10
        `, [req.user.centre_id]);
        
        client.release();
        
        const formattedExecutions = executions.rows.map(exec => ({
            ...exec,
            duration: Math.round(exec.duration_seconds),
            tasksCompleted: JSON.parse(exec.summary || '{}').result_count || 1
        }));
        
        res.json({ executions: formattedExecutions });
        
    } catch (error) {
        console.error('Error getting recent executions:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get centre metrics for dashboard
router.get('/centre/:centreId/metrics', authenticateToken, requireRole(['manager']), async (req, res) => {
    try {
        const centreId = req.params.centreId;
        
        if (req.user.centre_id !== parseInt(centreId)) {
            return res.status(403).json({ error: 'Access denied to this centre' });
        }
        
        const stats = await centreManagerMCP.getCentreStatistics(centreId);
        
        // Calculate efficiency metrics
        const efficiencyGain = Math.min(85, Math.max(15, (stats.notes_this_week * 2) + (stats.active_cases * 0.5)));
        
        res.json({
            activeCases: stats.active_cases,
            activeStaff: stats.active_staff,
            aiTasksToday: Math.floor(stats.notes_this_week / 7), // Estimate daily AI tasks
            efficiencyGain: Math.round(efficiencyGain),
            upcomingAppointments: stats.upcoming_appointments,
            totalDebtManaged: stats.total_debt_managed,
            avgCaseDuration: Math.round(stats.avg_case_duration_days || 0)
        });
        
    } catch (error) {
        console.error('Error getting centre metrics:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;