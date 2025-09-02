/**
 * Pre-defined workflow templates for common CMA advice scenarios
 * These implement n8n-style workflow automation for client journey planning
 */

const WORKFLOW_TEMPLATES = {
    
    /**
     * Comprehensive Case Review Workflow
     * Reviews case notes, identifies risks, and generates advice letter
     */
    COMPREHENSIVE_CASE_REVIEW: {
        name: 'Comprehensive Case Review',
        description: 'Complete analysis of case with critical questions and advice letter generation',
        steps: [
            {
                id: 'load_case_data',
                name: 'Load Case Data',
                tool: 'loadCaseData',
                parameters: {
                    caseId: '{{caseId}}'
                }
            },
            {
                id: 'analyze_notes',
                name: 'Analyze Case Notes',
                tool: 'analyzeNotes',
                parameters: {
                    caseId: '{{caseId}}'
                }
            },
            {
                id: 'validate_budget',
                name: 'Validate Budget',
                tool: 'validateBudget',
                parameters: {
                    income: '{{caseData.income}}',
                    expenses: '{{caseData.expenses}}'
                }
            },
            {
                id: 'calculate_debt_ratio',
                name: 'Calculate Debt-to-Income Ratio',
                tool: 'calculateDebtToIncomeRatio',
                parameters: {
                    totalDebt: '{{caseData.totalDebt}}',
                    monthlyIncome: '{{caseData.monthlyIncome}}'
                }
            },
            {
                id: 'suggest_solutions',
                name: 'Suggest Debt Solutions',
                tool: 'suggestDebtSolutions',
                parameters: {
                    totalDebt: '{{caseData.totalDebt}}',
                    monthlyIncome: '{{caseData.monthlyIncome}}',
                    assetValue: '{{caseData.assetValue}}',
                    circumstances: '{{caseData.circumstances}}'
                }
            },
            {
                id: 'identify_risks',
                name: 'Identify Risks',
                tool: 'identifyRisks',
                parameters: {
                    caseData: '{{caseData}}',
                    notesAnalysis: '{{analyze_notes}}'
                }
            },
            {
                id: 'generate_questions',
                name: 'Generate Critical Questions',
                tool: 'generateCriticalQuestions',
                parameters: {
                    caseData: '{{caseData}}',
                    risks: '{{identify_risks.identifiedRisks}}',
                    notesAnalysis: '{{analyze_notes}}'
                }
            },
            {
                id: 'generate_advice_letter',
                name: 'Generate Confirmation of Advice Letter',
                tool: 'generateAdviceLetter',
                parameters: {
                    caseId: '{{caseId}}',
                    clientData: '{{caseData.client}}',
                    recommendations: '{{suggest_solutions}}',
                    risks: '{{identify_risks.identifiedRisks}}'
                }
            }
        ]
    },

    /**
     * New Client Onboarding Workflow
     * Guides through initial assessment and setup
     */
    NEW_CLIENT_ONBOARDING: {
        name: 'New Client Onboarding',
        description: 'Complete onboarding process for new clients with risk assessment',
        steps: [
            {
                id: 'collect_basic_info',
                name: 'Collect Basic Information',
                tool: 'waitForInput',
                parameters: {
                    fields: ['firstName', 'lastName', 'email', 'phone', 'address'],
                    message: 'Please provide basic client information'
                }
            },
            {
                id: 'collect_financial_info',
                name: 'Collect Financial Information',
                tool: 'waitForInput',
                parameters: {
                    fields: ['monthlyIncome', 'monthlyExpenses', 'debts', 'assets'],
                    message: 'Please provide detailed financial information'
                }
            },
            {
                id: 'validate_initial_budget',
                name: 'Validate Initial Budget',
                tool: 'validateBudget',
                parameters: {
                    income: '{{collect_financial_info.income}}',
                    expenses: '{{collect_financial_info.expenses}}'
                }
            },
            {
                id: 'initial_risk_assessment',
                name: 'Initial Risk Assessment',
                tool: 'identifyRisks',
                parameters: {
                    caseData: '{{collect_financial_info}}',
                    notesAnalysis: { urgencyIndicators: { hasUrgentItems: false } }
                }
            },
            {
                id: 'priority_check',
                name: 'Check Priority Level',
                tool: 'conditionalBranch',
                parameters: {
                    condition: '{{initial_risk_assessment.identifiedRisks.length}} > 0',
                    trueStep: 'urgent_pathway',
                    falseStep: 'standard_pathway'
                }
            },
            {
                id: 'create_action_plan',
                name: 'Create Initial Action Plan',
                tool: 'createActionPlan',
                parameters: {
                    clientData: '{{collect_basic_info}}',
                    financialData: '{{collect_financial_info}}',
                    risks: '{{initial_risk_assessment.identifiedRisks}}'
                },
                branch: 'standard_pathway'
            },
            {
                id: 'urgent_notification',
                name: 'Send Urgent Case Notification',
                tool: 'sendNotification',
                parameters: {
                    type: 'urgent_case',
                    recipient: 'supervisor',
                    message: 'New client requires immediate attention due to identified risks'
                },
                branch: 'urgent_pathway'
            }
        ]
    },

    /**
     * Debt Solution Comparison Workflow
     * Compares different debt solutions and provides recommendations
     */
    DEBT_SOLUTION_COMPARISON: {
        name: 'Debt Solution Comparison',
        description: 'Comprehensive comparison of available debt solutions',
        steps: [
            {
                id: 'load_case_data',
                name: 'Load Case Data',
                tool: 'loadCaseData',
                parameters: {
                    caseId: '{{caseId}}'
                }
            },
            {
                id: 'calculate_affordability_dmp',
                name: 'Calculate DMP Affordability',
                tool: 'calculateAffordability',
                parameters: {
                    monthlyIncome: '{{caseData.monthlyIncome}}',
                    monthlyExpenses: '{{caseData.monthlyExpenses}}',
                    proposedPayment: '{{caseData.totalDebt / 60}}' // 5-year plan
                }
            },
            {
                id: 'calculate_affordability_iva',
                name: 'Calculate IVA Affordability',
                tool: 'calculateAffordability',
                parameters: {
                    monthlyIncome: '{{caseData.monthlyIncome}}',
                    monthlyExpenses: '{{caseData.monthlyExpenses}}',
                    proposedPayment: '{{(caseData.totalDebt * 0.25) / 60}}' // 25% over 5 years
                }
            },
            {
                id: 'suggest_all_solutions',
                name: 'Generate All Solution Options',
                tool: 'suggestDebtSolutions',
                parameters: {
                    totalDebt: '{{caseData.totalDebt}}',
                    monthlyIncome: '{{caseData.monthlyIncome}}',
                    assetValue: '{{caseData.assetValue}}',
                    circumstances: '{{caseData.circumstances}}'
                }
            },
            {
                id: 'compare_solutions',
                name: 'Compare Solution Outcomes',
                tool: 'compareSolutions',
                parameters: {
                    solutions: '{{suggest_all_solutions.recommendedSolutions}}',
                    dmpAffordability: '{{calculate_affordability_dmp}}',
                    ivaAffordability: '{{calculate_affordability_iva}}',
                    clientPreferences: '{{caseData.preferences}}'
                }
            },
            {
                id: 'generate_comparison_report',
                name: 'Generate Solution Comparison Report',
                tool: 'generateComparisonReport',
                parameters: {
                    caseId: '{{caseId}}',
                    solutions: '{{compare_solutions.rankedSolutions}}',
                    clientData: '{{caseData.client}}'
                }
            }
        ]
    },

    /**
     * Monthly Review Workflow
     * Regular review of existing cases for progress monitoring
     */
    MONTHLY_REVIEW: {
        name: 'Monthly Case Review',
        description: 'Regular review workflow for ongoing case monitoring',
        steps: [
            {
                id: 'load_case_data',
                name: 'Load Current Case Data',
                tool: 'loadCaseData',
                parameters: {
                    caseId: '{{caseId}}'
                }
            },
            {
                id: 'analyze_recent_notes',
                name: 'Analyze Recent Notes',
                tool: 'analyzeNotes',
                parameters: {
                    caseId: '{{caseId}}',
                    dateRange: 'last_30_days'
                }
            },
            {
                id: 'check_payment_progress',
                name: 'Check Payment Progress',
                tool: 'checkPaymentProgress',
                parameters: {
                    caseId: '{{caseId}}',
                    expectedPayments: '{{caseData.expectedPayments}}'
                }
            },
            {
                id: 'identify_new_risks',
                name: 'Identify New Risks',
                tool: 'identifyRisks',
                parameters: {
                    caseData: '{{caseData}}',
                    notesAnalysis: '{{analyze_recent_notes}}'
                }
            },
            {
                id: 'progress_assessment',
                name: 'Assess Overall Progress',
                tool: 'assessProgress',
                parameters: {
                    caseData: '{{caseData}}',
                    paymentProgress: '{{check_payment_progress}}',
                    newRisks: '{{identify_new_risks.identifiedRisks}}'
                }
            },
            {
                id: 'generate_review_report',
                name: 'Generate Monthly Review Report',
                tool: 'generateReviewReport',
                parameters: {
                    caseId: '{{caseId}}',
                    progress: '{{progress_assessment}}',
                    recommendations: '{{progress_assessment.recommendations}}'
                }
            },
            {
                id: 'schedule_follow_up',
                name: 'Schedule Follow-up Actions',
                tool: 'scheduleFollowUp',
                parameters: {
                    caseId: '{{caseId}}',
                    priority: '{{progress_assessment.priority}}',
                    actions: '{{progress_assessment.requiredActions}}'
                }
            }
        ]
    },

    /**
     * Urgent Case Triage Workflow
     * Fast-track workflow for urgent cases requiring immediate attention
     */
    URGENT_CASE_TRIAGE: {
        name: 'Urgent Case Triage',
        description: 'Fast-track workflow for cases requiring immediate attention',
        steps: [
            {
                id: 'load_case_data',
                name: 'Load Case Data',
                tool: 'loadCaseData',
                parameters: {
                    caseId: '{{caseId}}'
                }
            },
            {
                id: 'identify_urgent_risks',
                name: 'Identify Urgent Risks',
                tool: 'identifyRisks',
                parameters: {
                    caseData: '{{caseData}}',
                    urgentOnly: true
                }
            },
            {
                id: 'categorize_urgency',
                name: 'Categorize Urgency Level',
                tool: 'categorizeUrgency',
                parameters: {
                    risks: '{{identify_urgent_risks.identifiedRisks}}',
                    timeline: '{{caseData.timeline}}'
                }
            },
            {
                id: 'immediate_actions',
                name: 'Determine Immediate Actions',
                tool: 'determineImmediateActions',
                parameters: {
                    urgencyLevel: '{{categorize_urgency.level}}',
                    risks: '{{identify_urgent_risks.identifiedRisks}}',
                    caseData: '{{caseData}}'
                }
            },
            {
                id: 'notify_supervisor',
                name: 'Notify Supervisor',
                tool: 'sendNotification',
                parameters: {
                    type: 'urgent_case_alert',
                    recipient: 'supervisor',
                    urgencyLevel: '{{categorize_urgency.level}}',
                    caseId: '{{caseId}}',
                    immediateActions: '{{immediate_actions.actions}}'
                }
            },
            {
                id: 'generate_urgent_summary',
                name: 'Generate Urgent Case Summary',
                tool: 'generateUrgentSummary',
                parameters: {
                    caseId: '{{caseId}}',
                    urgencyLevel: '{{categorize_urgency.level}}',
                    risks: '{{identify_urgent_risks.identifiedRisks}}',
                    actions: '{{immediate_actions.actions}}'
                }
            }
        ]
    }
};

module.exports = WORKFLOW_TEMPLATES;
