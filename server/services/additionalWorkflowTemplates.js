/**
 * Additional Workflow Templates for Common Advisor Tasks
 * Extends the existing workflow system with more specialized templates
 */

const additionalWorkflowTemplates = {
    BENEFIT_MAXIMIZATION_REVIEW: {
        id: 'benefit_maximization_review',
        name: 'Benefit Maximization Review',
        description: 'Comprehensive review to identify unclaimed benefits and maximize client income',
        category: 'assessment',
        steps: [
            {
                id: 'gather_client_info',
                name: 'Gather Client Information',
                type: 'data_collection',
                tools: ['getClientData', 'getHouseholdComposition'],
                conditions: {}
            },
            {
                id: 'check_benefit_eligibility',
                name: 'Check Benefit Eligibility',
                type: 'analysis',
                tools: ['checkBenefitEligibility', 'calculatePotentialBenefits'],
                conditions: {}
            },
            {
                id: 'identify_unclaimed_benefits',
                name: 'Identify Unclaimed Benefits',
                type: 'analysis',
                tools: ['identifyUnclaimedBenefits', 'calculateAdditionalIncome'],
                conditions: {}
            },
            {
                id: 'generate_benefit_action_plan',
                name: 'Generate Benefit Action Plan',
                type: 'document_generation',
                tools: ['generateBenefitActionPlan', 'createApplicationGuidance'],
                conditions: {}
            }
        ]
    },

    PRIORITY_DEBT_STRATEGY: {
        id: 'priority_debt_strategy',
        name: 'Priority Debt Strategy',
        description: 'Identifies high-priority debts and creates strategic payment plans',
        category: 'assessment',
        steps: [
            {
                id: 'analyze_debt_portfolio',
                name: 'Analyze Debt Portfolio',
                type: 'analysis',
                tools: ['getDebtData', 'classifyDebtPriority'],
                conditions: {}
            },
            {
                id: 'assess_enforcement_risk',
                name: 'Assess Enforcement Risk',
                type: 'risk_assessment',
                tools: ['assessEnforcementRisk', 'identifyUrgentActions'],
                conditions: {}
            },
            {
                id: 'create_payment_hierarchy',
                name: 'Create Payment Hierarchy',
                type: 'strategy',
                tools: ['createPaymentHierarchy', 'calculateOptimalPayments'],
                conditions: {}
            },
            {
                id: 'generate_negotiation_strategy',
                name: 'Generate Negotiation Strategy',
                type: 'strategy',
                tools: ['generateNegotiationStrategy', 'createCreditorLetters'],
                conditions: {}
            }
        ]
    },

    VULNERABILITY_ASSESSMENT: {
        id: 'vulnerability_assessment',
        name: 'Comprehensive Vulnerability Assessment',
        description: 'Systematic screening for vulnerabilities and support needs',
        category: 'assessment',
        steps: [
            {
                id: 'conduct_vulnerability_screening',
                name: 'Conduct Vulnerability Screening',
                type: 'assessment',
                tools: ['conductVulnerabilityScreening', 'assessMentalHealthNeeds'],
                conditions: {}
            },
            {
                id: 'identify_support_services',
                name: 'Identify Support Services',
                type: 'analysis',
                tools: ['identifySupportServices', 'checkServiceAvailability'],
                conditions: {}
            },
            {
                id: 'create_support_plan',
                name: 'Create Support Plan',
                type: 'planning',
                tools: ['createSupportPlan', 'generateReferralLetters'],
                conditions: {}
            },
            {
                id: 'setup_monitoring',
                name: 'Setup Monitoring',
                type: 'automation',
                tools: ['setupVulnerabilityMonitoring', 'createFollowUpSchedule'],
                conditions: {}
            }
        ]
    },

    COURT_DEADLINE_TRACKER: {
        id: 'court_deadline_tracker',
        name: 'Court Deadline Management',
        description: 'Monitors court deadlines and prepares necessary documentation',
        category: 'compliance',
        steps: [
            {
                id: 'identify_court_cases',
                name: 'Identify Active Court Cases',
                type: 'data_collection',
                tools: ['identifyCourtCases', 'extractCourtDeadlines'],
                conditions: {}
            },
            {
                id: 'assess_deadline_urgency',
                name: 'Assess Deadline Urgency',
                type: 'analysis',
                tools: ['assessDeadlineUrgency', 'calculatePreparationTime'],
                conditions: {}
            },
            {
                id: 'prepare_court_documents',
                name: 'Prepare Court Documents',
                type: 'document_generation',
                tools: ['prepareCourtDocuments', 'generateWitnessStatements'],
                conditions: {
                    urgency_level: 'high'
                }
            },
            {
                id: 'setup_deadline_alerts',
                name: 'Setup Deadline Alerts',
                type: 'automation',
                tools: ['setupDeadlineAlerts', 'createReminderSchedule'],
                conditions: {}
            }
        ]
    },

    ANNUAL_CASE_REVIEW: {
        id: 'annual_case_review',
        name: 'Annual Case Review',
        description: 'Comprehensive yearly assessment of case progress and outcomes',
        category: 'review',
        steps: [
            {
                id: 'collect_annual_data',
                name: 'Collect Annual Data',
                type: 'data_collection',
                tools: ['collectAnnualFinancialData', 'gatherProgressMetrics'],
                conditions: {}
            },
            {
                id: 'analyze_case_progress',
                name: 'Analyze Case Progress',
                type: 'analysis',
                tools: ['analyzeCaseProgress', 'measureOutcomes'],
                conditions: {}
            },
            {
                id: 'identify_new_opportunities',
                name: 'Identify New Opportunities',
                type: 'analysis',
                tools: ['identifyNewOpportunities', 'assessChangedCircumstances'],
                conditions: {}
            },
            {
                id: 'create_future_plan',
                name: 'Create Future Plan',
                type: 'planning',
                tools: ['createFuturePlan', 'generateAnnualReport'],
                conditions: {}
            }
        ]
    },

    INCOME_MAXIMIZATION: {
        id: 'income_maximization',
        name: 'Income Maximization Strategy',
        description: 'Identifies opportunities to increase client income through various means',
        category: 'assessment',
        steps: [
            {
                id: 'assess_current_income',
                name: 'Assess Current Income',
                type: 'analysis',
                tools: ['assessCurrentIncome', 'identifyIncomeGaps'],
                conditions: {}
            },
            {
                id: 'explore_employment_options',
                name: 'Explore Employment Options',
                type: 'analysis',
                tools: ['exploreEmploymentOptions', 'assessSkillsTraining'],
                conditions: {}
            },
            {
                id: 'check_additional_benefits',
                name: 'Check Additional Benefits',
                type: 'analysis',
                tools: ['checkAdditionalBenefits', 'calculateBenefitUplift'],
                conditions: {}
            },
            {
                id: 'create_income_plan',
                name: 'Create Income Enhancement Plan',
                type: 'planning',
                tools: ['createIncomeEnhancementPlan', 'generateActionSteps'],
                conditions: {}
            }
        ]
    },

    DEBT_CONSOLIDATION_ANALYSIS: {
        id: 'debt_consolidation_analysis',
        name: 'Debt Consolidation Analysis',
        description: 'Analyzes whether debt consolidation would benefit the client',
        category: 'assessment',
        steps: [
            {
                id: 'analyze_current_debts',
                name: 'Analyze Current Debt Structure',
                type: 'analysis',
                tools: ['analyzeCurrentDebts', 'calculateTotalInterest'],
                conditions: {}
            },
            {
                id: 'explore_consolidation_options',
                name: 'Explore Consolidation Options',
                type: 'analysis',
                tools: ['exploreConsolidationOptions', 'assessEligibility'],
                conditions: {}
            },
            {
                id: 'compare_scenarios',
                name: 'Compare Financial Scenarios',
                type: 'analysis',
                tools: ['compareConsolidationScenarios', 'calculateSavings'],
                conditions: {}
            },
            {
                id: 'generate_recommendation',
                name: 'Generate Consolidation Recommendation',
                type: 'document_generation',
                tools: ['generateConsolidationRecommendation', 'createApplicationGuidance'],
                conditions: {}
            }
        ]
    }
};

// Additional workflow tools for the new templates
const additionalWorkflowTools = {
    // Benefit Maximization Tools
    checkBenefitEligibility: async (data) => {
        const eligibilityRules = {
            'Universal Credit': {
                age: { min: 18, max: null },
                income: { max: 2500 },
                savings: { max: 16000 }
            },
            'Personal Independence Payment': {
                disability: true,
                age: { min: 16, max: 64 }
            },
            'Attendance Allowance': {
                age: { min: 65 },
                careNeeds: true
            }
        };

        const eligibleBenefits = [];
        for (const [benefit, rules] of Object.entries(eligibilityRules)) {
            if (await checkEligibility(data, rules)) {
                eligibleBenefits.push(benefit);
            }
        }

        return { eligible_benefits: eligibleBenefits };
    },

    calculatePotentialBenefits: async (data) => {
        const benefitRates = {
            'Universal Credit': 334.91, // Monthly standard allowance
            'Personal Independence Payment': 61.85, // Weekly standard rate
            'Attendance Allowance': 61.85 // Weekly lower rate
        };

        const potentialIncome = {};
        for (const benefit of data.eligible_benefits) {
            if (benefitRates[benefit]) {
                potentialIncome[benefit] = benefitRates[benefit];
            }
        }

        return { potential_monthly_income: potentialIncome };
    },

    // Priority Debt Tools
    classifyDebtPriority: async (data) => {
        const priorityClassification = {
            'Priority Debts': [],
            'Non-Priority Debts': [],
            'Secured Debts': []
        };

        for (const debt of data.debts) {
            if (['Mortgage', 'Secured Loan', 'Hire Purchase'].includes(debt.type)) {
                priorityClassification['Secured Debts'].push(debt);
            } else if (['Council Tax', 'Income Tax', 'Court Fines', 'Child Maintenance'].includes(debt.type)) {
                priorityClassification['Priority Debts'].push(debt);
            } else {
                priorityClassification['Non-Priority Debts'].push(debt);
            }
        }

        return priorityClassification;
    },

    assessEnforcementRisk: async (data) => {
        const riskFactors = [];
        let riskScore = 0;

        for (const debt of data.debts) {
            if (debt.has_ccj) {
                riskFactors.push(`CCJ exists for ${debt.creditor}`);
                riskScore += 30;
            }
            if (debt.missed_payments > 3) {
                riskFactors.push(`Multiple missed payments to ${debt.creditor}`);
                riskScore += 20;
            }
            if (debt.enforcement_notices) {
                riskFactors.push(`Enforcement notices from ${debt.creditor}`);
                riskScore += 40;
            }
        }

        return {
            risk_score: riskScore,
            risk_level: riskScore > 60 ? 'High' : riskScore > 30 ? 'Medium' : 'Low',
            risk_factors: riskFactors
        };
    },

    // Vulnerability Assessment Tools
    conductVulnerabilityScreening: async (data) => {
        const vulnerabilities = [];
        
        if (data.age >= 65) vulnerabilities.push('Elderly person');
        if (data.mental_health_conditions) vulnerabilities.push('Mental health conditions');
        if (data.physical_disabilities) vulnerabilities.push('Physical disabilities');
        if (data.learning_difficulties) vulnerabilities.push('Learning difficulties');
        if (data.language_barriers) vulnerabilities.push('Language barriers');
        if (data.domestic_violence) vulnerabilities.push('Domestic violence');
        if (data.substance_abuse) vulnerabilities.push('Substance abuse issues');

        return {
            identified_vulnerabilities: vulnerabilities,
            vulnerability_score: vulnerabilities.length * 10,
            requires_additional_support: vulnerabilities.length > 2
        };
    },

    identifySupportServices: async (data) => {
        const supportServices = [];
        
        for (const vulnerability of data.identified_vulnerabilities) {
            switch (vulnerability) {
                case 'Mental health conditions':
                    supportServices.push({
                        service: 'Mental Health Support',
                        provider: 'Local NHS Mental Health Services',
                        contact: '111 (NHS)'
                    });
                    break;
                case 'Domestic violence':
                    supportServices.push({
                        service: 'Domestic Violence Support',
                        provider: 'National Domestic Violence Helpline',
                        contact: '0808 2000 247'
                    });
                    break;
                case 'Substance abuse issues':
                    supportServices.push({
                        service: 'Addiction Support',
                        provider: 'Local Drug and Alcohol Services',
                        contact: 'Contact local council'
                    });
                    break;
            }
        }

        return { available_support_services: supportServices };
    },

    // Court Deadline Tools
    identifyCourtCases: async (data) => {
        const courtCases = [];
        
        for (const debt of data.debts || []) {
            if (debt.court_action) {
                courtCases.push({
                    creditor: debt.creditor,
                    case_number: debt.case_number,
                    court_name: debt.court_name,
                    next_hearing: debt.next_hearing,
                    amount: debt.amount
                });
            }
        }

        return { active_court_cases: courtCases };
    },

    assessDeadlineUrgency: async (data) => {
        const urgentDeadlines = [];
        const currentDate = new Date();

        for (const courtCase of data.active_court_cases) {
            const hearingDate = new Date(courtCase.next_hearing);
            const daysUntilHearing = Math.ceil((hearingDate - currentDate) / (1000 * 60 * 60 * 24));

            let urgencyLevel = 'Low';
            if (daysUntilHearing <= 7) urgencyLevel = 'Critical';
            else if (daysUntilHearing <= 14) urgencyLevel = 'High';
            else if (daysUntilHearing <= 30) urgencyLevel = 'Medium';

            urgentDeadlines.push({
                ...courtCase,
                days_until_hearing: daysUntilHearing,
                urgency_level: urgencyLevel
            });
        }

        return { deadline_urgency: urgentDeadlines };
    }
};

// Helper function for eligibility checking
async function checkEligibility(clientData, rules) {
    if (rules.age) {
        if (rules.age.min && clientData.age < rules.age.min) return false;
        if (rules.age.max && clientData.age > rules.age.max) return false;
    }
    
    if (rules.income && clientData.monthly_income > rules.income.max) return false;
    if (rules.savings && clientData.total_savings > rules.savings.max) return false;
    if (rules.disability && !clientData.has_disability) return false;
    if (rules.careNeeds && !clientData.has_care_needs) return false;

    return true;
}

module.exports = {
    additionalWorkflowTemplates,
    additionalWorkflowTools
};
