const express = require('express');
const router = express.Router();
const { authenticateToken, requireRole } = require('../middleware/auth');

// Demo data and simulation for agentic workflows
class AgenticFlowDemoService {
    
    constructor() {
        this.demoData = {
            sampleCentreStats: {
                active_cases: 47,
                new_cases_30d: 12,
                active_staff: 8,
                upcoming_appointments: 23,
                avg_case_duration_days: 45,
                total_debt_managed: 285000,
                notes_this_week: 34
            },
            sampleStaffData: [
                { id: 1, first_name: 'Sarah', last_name: 'Johnson', active_cases: 12, workload_score: 18, recommendation: 'Balanced workload' },
                { id: 2, first_name: 'Mike', last_name: 'Chen', active_cases: 8, workload_score: 12, recommendation: 'Can take additional cases' },
                { id: 3, first_name: 'Lisa', last_name: 'Williams', active_cases: 15, workload_score: 23, recommendation: 'Consider redistributing cases' },
                { id: 4, first_name: 'David', last_name: 'Brown', active_cases: 10, workload_score: 15, recommendation: 'Balanced workload' },
                { id: 5, first_name: 'Emma', last_name: 'Davis', active_cases: 6, workload_score: 9, recommendation: 'Can take additional cases' }
            ],
            samplePriorityCases: [
                { case_number: 'CMA-2024-0156', client_name: 'Demo Client A', priority_score: 75, risk_level: 'Critical', days_since_activity: 45 },
                { case_number: 'CMA-2024-0234', client_name: 'Demo Client B', priority_score: 65, risk_level: 'High', days_since_activity: 28 },
                { case_number: 'CMA-2024-0298', client_name: 'Demo Client C', priority_score: 55, risk_level: 'High', days_since_activity: 21 },
                { case_number: 'CMA-2024-0187', client_name: 'Demo Client D', priority_score: 45, risk_level: 'Medium', days_since_activity: 14 }
            ]
        };
    }

    async simulateMonthlyReportDemo() {
        const steps = [
            {
                step: 1,
                title: 'Gathering Centre Statistics',
                description: 'Analyzing 47 active cases and 12 new cases this month...',
                duration: 2000,
                progress: 25,
                details: 'AI is querying your local database for case metrics, staff performance, and client outcomes.'
            },
            {
                step: 2,
                title: 'Calculating Performance Metrics',
                description: 'Reviewing performance data for 8 staff members...',
                duration: 3000,
                progress: 50,
                details: 'Local AI models are analyzing workload distribution, case completion rates, and advisor productivity.'
            },
            {
                step: 3,
                title: 'Running Compliance Checks',
                description: 'Validating FCA requirements across all active cases...',
                duration: 2500,
                progress: 75,
                details: 'AI is checking for required documentation, advice confirmations, and regulatory compliance.'
            },
            {
                step: 4,
                title: 'Generating AI Insights',
                description: 'Creating trends analysis and recommendations...',
                duration: 2000,
                progress: 90,
                details: 'Local LLM is generating insights, identifying patterns, and creating actionable recommendations.'
            },
            {
                step: 5,
                title: 'Creating Final Report',
                description: 'Formatting report with your centre branding...',
                duration: 1500,
                progress: 100,
                details: 'Report is being formatted with your letterhead and prepared for download.'
            }
        ];

        const mockReport = `
MONTHLY CENTRE PERFORMANCE REPORT
${new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}

EXECUTIVE SUMMARY
This month your centre handled ${this.demoData.sampleCentreStats.active_cases} active cases with excellent performance across key metrics. 
Staff productivity remains strong with balanced workloads across the team.

KEY PERFORMANCE INDICATORS
✓ Case Resolution Rate: 89% (Target: 85%)
✓ Average Case Duration: ${this.demoData.sampleCentreStats.avg_case_duration_days} days (Target: 50 days)
✓ Client Satisfaction: 94% (Based on feedback forms)
✓ Compliance Score: 96% (No critical issues identified)

STAFF PERFORMANCE ANALYSIS
Total Active Staff: ${this.demoData.sampleCentreStats.active_staff}
- 2 advisors can take additional cases
- 1 advisor may need workload redistribution
- 5 advisors have balanced workloads

RECOMMENDATIONS FOR NEXT MONTH
1. Consider redistributing 2-3 cases from Lisa Williams to Mike Chen or Emma Davis
2. Implement weekly check-ins for cases older than 30 days
3. Continue current practices - overall performance exceeds targets

COMPLIANCE STATUS
All critical compliance requirements met. Minor recommendations:
- Ensure all cases have recent activity notes
- Complete documentation reviews for 3 long-running cases

Generated using local AI models | No data shared externally
        `;

        return {
            steps,
            finalResult: {
                reportContent: mockReport,
                statistics: this.demoData.sampleCentreStats,
                staffAnalysis: {
                    total_staff: this.demoData.sampleStaffData.length,
                    staff_analysis: this.demoData.sampleStaffData,
                    recommendations: [
                        {
                            type: 'workload_redistribution',
                            message: '1 advisor is slightly overloaded',
                            affected_staff: ['Lisa Williams']
                        }
                    ]
                },
                generatedAt: new Date().toISOString()
            }
        };
    }

    async simulateStaffOptimizerDemo() {
        const steps = [
            {
                step: 1,
                title: 'Analyzing Current Workloads',
                description: 'Reviewing case assignments for all 8 advisors...',
                duration: 2000,
                progress: 30,
                details: 'AI is analyzing case counts, complexity scores, and advisor capacity.'
            },
            {
                step: 2,
                title: 'Scoring Case Complexity',
                description: 'AI assessment of case difficulty and time requirements...',
                duration: 3000,
                progress: 60,
                details: 'Each case receives complexity score based on debt amount, number of creditors, and client circumstances.'
            },
            {
                step: 3,
                title: 'Optimizing Distribution',
                description: 'Calculating optimal case assignments...',
                duration: 2500,
                progress: 85,
                details: 'AI is matching advisor skills with case requirements and balancing workloads.'
            },
            {
                step: 4,
                title: 'Generating Recommendations',
                description: 'Creating workload rebalancing plan...',
                duration: 1500,
                progress: 100,
                details: 'Final optimization plan with specific case reassignment recommendations.'
            }
        ];

        return {
            steps,
            finalResult: {
                currentWorkloads: this.demoData.sampleStaffData,
                recommendations: [
                    {
                        type: 'case_reassignment',
                        from_advisor: 'Lisa Williams',
                        to_advisor: 'Mike Chen',
                        cases_to_move: 2,
                        reason: 'Balance workload and utilize capacity'
                    },
                    {
                        type: 'case_reassignment', 
                        from_advisor: 'Lisa Williams',
                        to_advisor: 'Emma Davis',
                        cases_to_move: 1,
                        reason: 'Utilize available capacity'
                    }
                ],
                projectedImpact: {
                    workload_variance_reduction: '35%',
                    estimated_efficiency_gain: '18%',
                    advisor_satisfaction_improvement: 'High'
                }
            }
        };
    }

    async simulatePriorityTriageDemo() {
        const steps = [
            {
                step: 1,
                title: 'Scanning All Cases',
                description: 'Reviewing 47 active cases for risk indicators...',
                duration: 1500,
                progress: 40,
                details: 'AI is checking for vulnerability flags, debt priorities, and case activity levels.'
            },
            {
                step: 2,
                title: 'AI Risk Assessment',
                description: 'Analyzing vulnerability factors and debt situations...',
                duration: 2500,
                progress: 75,
                details: 'Each case receives risk score based on priority debts, client vulnerabilities, and case history.'
            },
            {
                step: 3,
                title: 'Priority Scoring',
                description: 'Calculating urgency scores for each case...',
                duration: 1500,
                progress: 90,
                details: 'Cases are ranked by priority with specific action recommendations.'
            },
            {
                step: 4,
                title: 'Creating Action Plan',
                description: 'Generating immediate action recommendations...',
                duration: 1000,
                progress: 100,
                details: 'Priority list created with specific next steps for each high-risk case.'
            }
        ];

        return {
            steps,
            finalResult: {
                priorityCases: this.demoData.samplePriorityCases,
                totalCasesReviewed: 47,
                criticalCases: 1,
                highRiskCases: 2,
                immediateActions: [
                    {
                        case: 'CMA-2024-0156',
                        action: 'Contact client within 24 hours - no activity for 45 days',
                        priority: 'Critical'
                    },
                    {
                        case: 'CMA-2024-0234', 
                        action: 'Review priority debt status and update payment arrangements',
                        priority: 'High'
                    }
                ]
            }
        };
    }
}

const demoService = new AgenticFlowDemoService();

// Run workflow demo
router.post('/demo/:flowId', authenticateToken, requireRole(['manager']), async (req, res) => {
    try {
        const { flowId } = req.params;
        
        let demoResult;
        
        switch (flowId) {
            case 'monthly-centre-report':
                demoResult = await demoService.simulateMonthlyReportDemo();
                break;
                
            case 'staff-workload-optimizer':
                demoResult = await demoService.simulateStaffOptimizerDemo();
                break;
                
            case 'priority-case-triage':
                demoResult = await demoService.simulatePriorityTriageDemo();
                break;
                
            default:
                return res.status(400).json({ error: 'Demo not available for this flow' });
        }
        
        res.json({
            success: true,
            flowId,
            demoMode: true,
            steps: demoResult.steps,
            finalResult: demoResult.finalResult,
            disclaimer: 'This is demo data only. No real centre data was processed.'
        });
        
    } catch (error) {
        console.error('Demo execution error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get demo workflow steps for progressive display
router.get('/demo/:flowId/steps', authenticateToken, requireRole(['manager']), async (req, res) => {
    try {
        const { flowId } = req.params;
        
        let steps;
        
        switch (flowId) {
            case 'monthly-centre-report':
                steps = (await demoService.simulateMonthlyReportDemo()).steps;
                break;
                
            case 'staff-workload-optimizer':
                steps = (await demoService.simulateStaffOptimizerDemo()).steps;
                break;
                
            case 'priority-case-triage':
                steps = (await demoService.simulatePriorityTriageDemo()).steps;
                break;
                
            default:
                return res.status(400).json({ error: 'Demo not available for this flow' });
        }
        
        res.json({
            flowId,
            steps,
            totalSteps: steps.length
        });
        
    } catch (error) {
        console.error('Error getting demo steps:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get workflow templates with demo availability
router.get('/templates', authenticateToken, requireRole(['manager']), async (req, res) => {
    try {
        const templates = [
            {
                id: 'monthly-centre-report',
                name: 'Monthly Centre Report',
                description: 'AI-generated comprehensive monthly performance report with insights and recommendations.',
                category: 'Reporting',
                complexity: 'Simple',
                estimatedTime: '3-5 minutes',
                demoAvailable: true,
                mcpTools: ['centre_statistics', 'case_analytics', 'staff_performance', 'compliance_check'],
                benefits: [
                    'Saves 4-6 hours of manual reporting',
                    'Identifies trends automatically', 
                    'Ensures regulatory compliance',
                    'Provides AI-generated insights'
                ]
            },
            {
                id: 'staff-workload-optimizer',
                name: 'Staff Workload Optimizer', 
                description: 'Analyze and optimize case distribution across advisors based on capacity and expertise.',
                category: 'Operations',
                complexity: 'Medium',
                estimatedTime: '2-4 minutes',
                demoAvailable: true,
                mcpTools: ['staff_analysis', 'case_complexity_scoring', 'workload_calculator'],
                benefits: [
                    'Prevents advisor burnout',
                    'Optimizes case outcomes',
                    'Balances workloads automatically'
                ]
            },
            {
                id: 'priority-case-triage',
                name: 'Priority Case Triage',
                description: 'Automatically identify high-risk cases requiring immediate attention.',
                category: 'Risk Management', 
                complexity: 'Simple',
                estimatedTime: '1-2 minutes',
                demoAvailable: true,
                mcpTools: ['vulnerability_scanner', 'debt_risk_analyzer', 'priority_scoring'],
                benefits: [
                    'Prevents case escalation',
                    'Ensures vulnerable clients get priority',
                    'Automates risk assessment'
                ]
            },
            {
                id: 'batch-letter-generation',
                name: 'Batch Letter Generation',
                description: 'Generate multiple personalized confirmation letters using local AI.',
                category: 'Documentation',
                complexity: 'Medium', 
                estimatedTime: '5-10 minutes',
                demoAvailable: false,
                mcpTools: ['bulk_coa_generator', 'letter_templating', 'brand_application'],
                benefits: [
                    'Saves 2-3 hours per batch',
                    'Ensures consistency',
                    'Maintains professional standards'
                ]
            },
            {
                id: 'compliance-audit-runner',
                name: 'Compliance Audit Runner',
                description: 'Comprehensive FCA compliance check with remediation planning.',
                category: 'Compliance',
                complexity: 'Complex',
                estimatedTime: '10-15 minutes',
                demoAvailable: false,
                mcpTools: ['fca_compliance_checker', 'audit_trail_analyzer', 'remediation_planner'],
                benefits: [
                    'Ensures FCA compliance',
                    'Prevents regulatory issues',
                    'Automates audit preparation'
                ]
            },
            {
                id: 'multilingual-client-outreach',
                name: 'Multilingual Client Outreach',
                description: 'Generate personalized client communications in multiple languages.',
                category: 'Communication',
                complexity: 'Medium',
                estimatedTime: '5-8 minutes', 
                demoAvailable: true,
                mcpTools: ['client_segmentation', 'message_templating', 'local_translator'],
                benefits: [
                    'Reaches diverse communities',
                    'Maintains data privacy',
                    'Scales communication efforts'
                ]
            }
        ];
        
        res.json({ templates });
        
    } catch (error) {
        console.error('Error getting workflow templates:', error);
        res.status(500).json({ error: error.message });
    }
});

// Interactive demo execution with real-time updates
router.post('/interactive-demo/:flowId', authenticateToken, requireRole(['manager']), async (req, res) => {
    try {
        const { flowId } = req.params;
        
        // Set up Server-Sent Events for real-time demo updates
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*'
        });
        
        let demoResult;
        
        switch (flowId) {
            case 'monthly-centre-report':
                demoResult = await demoService.simulateMonthlyReportDemo();
                break;
            case 'staff-workload-optimizer':
                demoResult = await demoService.simulateStaffOptimizerDemo();
                break;
            case 'priority-case-triage':
                demoResult = await demoService.simulatePriorityTriageDemo();
                break;
            default:
                res.write(`data: ${JSON.stringify({ error: 'Demo not available' })}\n\n`);
                return res.end();
        }
        
        // Send initial demo info
        res.write(`data: ${JSON.stringify({
            type: 'demo_start',
            flowId,
            totalSteps: demoResult.steps.length
        })}\n\n`);
        
        // Simulate step-by-step execution
        for (let i = 0; i < demoResult.steps.length; i++) {
            const step = demoResult.steps[i];
            
            // Send step start
            res.write(`data: ${JSON.stringify({
                type: 'step_start',
                step: step.step,
                title: step.title,
                description: step.description,
                progress: step.progress,
                details: step.details
            })}\n\n`);
            
            // Wait for step duration
            await new Promise(resolve => setTimeout(resolve, step.duration));
            
            // Send step complete
            res.write(`data: ${JSON.stringify({
                type: 'step_complete',
                step: step.step,
                progress: step.progress
            })}\n\n`);
        }
        
        // Send final result
        res.write(`data: ${JSON.stringify({
            type: 'demo_complete',
            result: demoResult.finalResult
        })}\n\n`);
        
        res.end();
        
    } catch (error) {
        console.error('Interactive demo error:', error);
        res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
        res.end();
    }
});

// Get help content for specific workflow
router.get('/help/:flowId', authenticateToken, async (req, res) => {
    try {
        const { flowId } = req.params;
        
        const helpContent = {
            'monthly-centre-report': {
                overview: 'Generate a comprehensive monthly report automatically using AI analysis of your centre data.',
                whenToUse: 'Run this at the end of each month before submitting reports to management or regulators.',
                whatItDoes: [
                    'Analyzes all case data and staff performance metrics',
                    'Identifies trends and patterns in your centre operations',
                    'Generates professional report with AI insights', 
                    'Includes compliance status and recommendations'
                ],
                timesSaved: '4-6 hours per month',
                outputFormat: 'PDF report with centre branding',
                reviewRequired: 'Always review AI-generated insights before sharing externally'
            },
            'staff-workload-optimizer': {
                overview: 'Optimize case distribution across your advisors to prevent burnout and improve outcomes.',
                whenToUse: 'Weekly review or when you notice uneven workloads or advisor stress.',
                whatItDoes: [
                    'Analyzes current case assignments and advisor capacity',
                    'Scores each case for complexity and time requirements',
                    'Calculates optimal distribution based on skills and experience',
                    'Provides specific reassignment recommendations'
                ],
                timesSaved: '2-3 hours of manual workload analysis',
                outputFormat: 'Workload analysis report with specific recommendations',
                reviewRequired: 'Consider advisor preferences and client relationships before implementing changes'
            },
            'priority-case-triage': {
                overview: 'Automatically identify cases that need immediate attention to prevent escalation.',
                whenToUse: 'Daily or weekly to ensure no urgent cases are missed.',
                whatItDoes: [
                    'Scans all active cases for risk indicators',
                    'Calculates priority scores based on vulnerability and debt factors',
                    'Identifies cases with no recent activity',
                    'Generates immediate action recommendations'
                ],
                timesSaved: '1-2 hours of manual case review',
                outputFormat: 'Priority case list with action recommendations',
                reviewRequired: 'Verify AI risk assessments before contacting clients'
            }
        };
        
        res.json(helpContent[flowId] || { error: 'Help content not found' });
        
    } catch (error) {
        console.error('Error getting help content:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;