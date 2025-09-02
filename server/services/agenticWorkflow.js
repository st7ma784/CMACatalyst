const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');
const moment = require('moment');
const axios = require('axios');

/**
 * Agentic Workflow Engine for CMA Advice Support
 * Implements n8n-style workflow automation with AI-powered tools
 */
class AgenticWorkflowEngine {
    constructor() {
        this.workflows = new Map();
        this.activeExecutions = new Map();
        this.tools = this.initializeTools();
    }

    /**
     * Initialize available tools for workflow execution
     */
    initializeTools() {
        return {
            // Financial calculation tools
            calculateAffordability: this.calculateAffordability.bind(this),
            validateBudget: this.validateBudget.bind(this),
            calculateDebtToIncomeRatio: this.calculateDebtToIncomeRatio.bind(this),
            suggestDebtSolutions: this.suggestDebtSolutions.bind(this),
            
            // Data analysis tools
            analyzeNotes: this.analyzeNotes.bind(this),
            identifyRisks: this.identifyRisks.bind(this),
            generateCriticalQuestions: this.generateCriticalQuestions.bind(this),
            
            // Document generation tools
            generateAdviceLetter: this.generateAdviceLetter.bind(this),
            // createActionPlan: this.createActionPlan.bind(this), // TODO: Implement this method
            
            // Workflow control tools
            // conditionalBranch: this.conditionalBranch.bind(this), // TODO: Implement this method
            // waitForInput: this.waitForInput.bind(this), // TODO: Implement this method
            // sendNotification: this.sendNotification.bind(this) // TODO: Implement this method
        };
    }

    /**
     * Register a new workflow template
     */
    registerWorkflow(name, definition) {
        this.workflows.set(name, {
            id: uuidv4(),
            name,
            definition,
            created: new Date(),
            version: '1.0.0'
        });
    }

    /**
     * Execute a workflow for a specific case
     */
    async executeWorkflow(workflowName, caseId, initialData = {}) {
        const workflow = this.workflows.get(workflowName);
        if (!workflow) {
            throw new Error(`Workflow '${workflowName}' not found`);
        }

        const executionId = uuidv4();
        const startTime = Date.now();
        const execution = {
            id: executionId,
            workflowId: workflow.id,
            caseId,
            status: 'running',
            data: initialData,
            results: {},
            currentStep: 0,
            started: new Date(),
            logs: []
        };

        this.activeExecutions.set(executionId, execution);

        try {
            const result = await this.runWorkflowSteps(workflow.definition, execution);
            execution.status = 'completed';
            execution.completed = new Date();
            execution.finalResult = result;
            
            // Save execution to database
            await this.saveExecution(execution);
            
            return result;
        } catch (error) {
            execution.status = 'failed';
            execution.error = error.message;
            execution.completed = new Date();
            
            await this.saveExecution(execution);
            throw error;
        }
    }

    /**
     * Run workflow steps sequentially
     */
    async runWorkflowSteps(steps, execution) {
        let currentData = execution.data;
        
        for (let i = 0; i < steps.length; i++) {
            const step = steps[i];
            execution.currentStep = i;
            
            this.log(execution, `Executing step ${i + 1}: ${step.name}`);
            
            try {
                const result = await this.executeStep(step, currentData, execution);
                execution.results[step.id] = result;
                
                // Update current data with step results
                if (result && typeof result === 'object') {
                    currentData = { ...currentData, ...result };
                }
                
                this.log(execution, `Step ${i + 1} completed successfully`);
                
                // Handle conditional branching
                if (step.type === 'conditional' && result.nextStep) {
                    const branchSteps = steps.filter(s => s.branch === result.nextStep);
                    if (branchSteps.length > 0) {
                        const branchResult = await this.runWorkflowSteps(branchSteps, execution);
                        currentData = { ...currentData, ...branchResult };
                    }
                }
                
            } catch (error) {
                this.log(execution, `Step ${i + 1} failed: ${error.message}`, 'error');
                throw error;
            }
        }
        
        return currentData;
    }

    /**
     * Execute a single workflow step
     */
    async executeStep(step, data, execution) {
        const tool = this.tools[step.tool];
        if (!tool) {
            throw new Error(`Tool '${step.tool}' not found`);
        }

        // Prepare parameters by resolving data references
        const params = this.resolveParameters(step.parameters, data);
        
        return await tool(params, execution);
    }

    /**
     * Resolve parameter references in step configuration
     */
    resolveParameters(parameters, data) {
        const resolved = {};
        
        for (const [key, value] of Object.entries(parameters)) {
            if (typeof value === 'string' && value.startsWith('{{') && value.endsWith('}}')) {
                // Extract data reference
                const reference = value.slice(2, -2).trim();
                resolved[key] = this.getNestedValue(data, reference);
            } else {
                resolved[key] = value;
            }
        }
        
        return resolved;
    }

    /**
     * Get nested value from object using dot notation
     */
    getNestedValue(obj, path) {
        return path.split('.').reduce((current, key) => current?.[key], obj);
    }

    /**
     * Log execution events
     */
    log(execution, message, level = 'info') {
        const logEntry = {
            timestamp: new Date(),
            level,
            message,
            step: execution.currentStep
        };
        
        execution.logs.push(logEntry);
        console.log(`[${execution.id}] ${level.toUpperCase()}: ${message}`);
    }

    // FINANCIAL CALCULATION TOOLS

    async calculateAffordability({ monthlyIncome, monthlyExpenses, proposedPayment }, execution) {
        const disposableIncome = monthlyIncome - monthlyExpenses;
        const affordabilityRatio = proposedPayment / disposableIncome;
        
        return {
            disposableIncome,
            proposedPayment,
            affordabilityRatio,
            isAffordable: affordabilityRatio <= 0.3, // 30% rule
            recommendation: affordabilityRatio <= 0.3 ? 
                'Payment is affordable' : 
                `Payment exceeds 30% of disposable income. Consider reducing to £${Math.floor(disposableIncome * 0.3)}`
        };
    }

    async validateBudget({ income, expenses }, execution) {
        const totalIncome = Object.values(income).reduce((sum, val) => sum + val, 0);
        const totalExpenses = Object.values(expenses).reduce((sum, val) => sum + val, 0);
        const surplus = totalIncome - totalExpenses;
        
        // Identify unusual expenses
        const warnings = [];
        if (expenses.food > totalIncome * 0.2) {
            warnings.push('Food expenses seem high (>20% of income)');
        }
        if (expenses.housing > totalIncome * 0.4) {
            warnings.push('Housing costs exceed recommended 40% of income');
        }
        
        return {
            totalIncome,
            totalExpenses,
            surplus,
            isBalanced: surplus >= 0,
            warnings,
            budgetHealth: surplus >= 0 ? 'healthy' : 'deficit'
        };
    }

    async calculateDebtToIncomeRatio({ totalDebt, monthlyIncome }, execution) {
        const ratio = totalDebt / (monthlyIncome * 12);
        
        let riskLevel;
        if (ratio < 2) riskLevel = 'low';
        else if (ratio < 4) riskLevel = 'moderate';
        else riskLevel = 'high';
        
        return {
            debtToIncomeRatio: ratio,
            riskLevel,
            recommendation: this.getDebtRiskRecommendation(riskLevel)
        };
    }

    getDebtRiskRecommendation(riskLevel) {
        const recommendations = {
            low: 'Debt levels are manageable. Focus on building emergency fund.',
            moderate: 'Consider debt consolidation or payment plan to reduce burden.',
            high: 'Urgent action needed. Explore debt management plan or IVA options.'
        };
        return recommendations[riskLevel];
    }

    async suggestDebtSolutions({ totalDebt, monthlyIncome, assetValue, circumstances }, execution) {
        const solutions = [];
        
        // Debt Management Plan
        if (totalDebt < monthlyIncome * 60) {
            solutions.push({
                type: 'DMP',
                suitability: 'high',
                description: 'Debt Management Plan - informal arrangement with creditors',
                estimatedDuration: Math.ceil(totalDebt / (monthlyIncome * 0.1)) + ' months'
            });
        }
        
        // IVA consideration
        if (totalDebt > 6000 && monthlyIncome > 1000) {
            solutions.push({
                type: 'IVA',
                suitability: 'medium',
                description: 'Individual Voluntary Arrangement - formal insolvency procedure',
                estimatedDuration: '60 months'
            });
        }
        
        // Bankruptcy consideration
        if (totalDebt > monthlyIncome * 100 || circumstances.includes('unable_to_pay')) {
            solutions.push({
                type: 'Bankruptcy',
                suitability: 'low',
                description: 'Last resort option for unmanageable debt',
                estimatedDuration: '12 months'
            });
        }
        
        return { recommendedSolutions: solutions };
    }

    // DATA ANALYSIS TOOLS

    async analyzeNotes({ caseId }, execution) {
        const query = `
            SELECT content, note_category, created_at, created_by
            FROM notes 
            WHERE case_id = $1 
            ORDER BY created_at DESC
        `;
        
        const result = await db.query(query, [caseId]);
        const notes = result.rows;
        
        // Analyze note patterns
        const analysis = {
            totalNotes: notes.length,
            categories: {},
            recentActivity: notes.slice(0, 5),
            keyThemes: this.extractKeyThemes(notes),
            urgencyIndicators: this.findUrgencyIndicators(notes)
        };
        
        // Count categories
        notes.forEach(note => {
            analysis.categories[note.note_category] = 
                (analysis.categories[note.note_category] || 0) + 1;
        });
        
        return analysis;
    }

    extractKeyThemes(notes) {
        const themes = {};
        const keywords = [
            'urgent', 'priority', 'bailiff', 'court', 'eviction', 
            'payment', 'arrangement', 'hardship', 'vulnerable'
        ];
        
        notes.forEach(note => {
            keywords.forEach(keyword => {
                if (note.content.toLowerCase().includes(keyword)) {
                    themes[keyword] = (themes[keyword] || 0) + 1;
                }
            });
        });
        
        return Object.entries(themes)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 5)
            .map(([theme, count]) => ({ theme, count }));
    }

    findUrgencyIndicators(notes) {
        const urgentKeywords = ['bailiff', 'court', 'eviction', 'urgent', 'immediate'];
        const urgentNotes = notes.filter(note => 
            urgentKeywords.some(keyword => 
                note.content.toLowerCase().includes(keyword)
            )
        );
        
        return {
            hasUrgentItems: urgentNotes.length > 0,
            urgentCount: urgentNotes.length,
            mostRecentUrgent: urgentNotes[0] || null
        };
    }

    async identifyRisks({ caseData, notesAnalysis }, execution) {
        const risks = [];
        
        // Financial risks
        if (caseData.monthlyIncome < caseData.monthlyExpenses) {
            risks.push({
                type: 'financial',
                severity: 'high',
                description: 'Monthly expenses exceed income',
                recommendation: 'Urgent budget review required'
            });
        }
        
        // Legal risks
        if (notesAnalysis.urgencyIndicators.hasUrgentItems) {
            risks.push({
                type: 'legal',
                severity: 'high',
                description: 'Court action or bailiff involvement detected',
                recommendation: 'Immediate legal advice required'
            });
        }
        
        // Vulnerability risks
        if (caseData.vulnerabilities && caseData.vulnerabilities.length > 0) {
            risks.push({
                type: 'vulnerability',
                severity: 'medium',
                description: 'Client has identified vulnerabilities',
                recommendation: 'Extra care and support measures needed'
            });
        }
        
        return { identifiedRisks: risks };
    }

    async generateCriticalQuestions({ caseData, notesAnalysis, risks }, execution) {
        const questions = [];
        
        // Financial completeness questions
        if (!caseData.monthlyIncome || caseData.monthlyIncome === 0) {
            questions.push({
                category: 'financial',
                priority: 'high',
                question: 'What is the client\'s total monthly income from all sources?'
            });
        }
        
        // Debt verification questions
        if (!caseData.totalDebt || caseData.totalDebt === 0) {
            questions.push({
                category: 'debt',
                priority: 'high',
                question: 'Have all debts been identified and verified with creditors?'
            });
        }
        
        // Risk-based questions
        if (risks.some(r => r.type === 'legal')) {
            questions.push({
                category: 'legal',
                priority: 'urgent',
                question: 'What is the timeline for any pending court actions?'
            });
        }
        
        // Use AI to generate contextual questions
        try {
            const aiQuestions = await this.generateAIQuestions(caseData, notesAnalysis);
            questions.push(...aiQuestions);
        } catch (error) {
            console.log('AI question generation unavailable, using fallback questions');
            // Add fallback questions
            questions.push({
                category: 'general',
                priority: 'medium',
                question: 'Are there any changes in circumstances since the last review?'
            });
        }
        
        return questions.slice(0, 10); // Limit to top 10 questions
    }

    // DOCUMENT GENERATION TOOLS

    async generateAdviceLetter({ caseId, clientData, recommendations, risks }, execution) {
        const template = await this.loadLetterTemplate('confirmation_of_advice');
        
        const letterData = {
            date: new Date().toLocaleDateString('en-GB'),
            clientName: `${clientData.firstName} ${clientData.lastName}`,
            clientAddress: clientData.address,
            caseReference: `CMA-${caseId}`,
            advisorName: execution.data.advisorName || 'CMA Advisor',
            
            // Financial summary
            totalDebt: recommendations.totalDebt,
            monthlyIncome: clientData.monthlyIncome,
            monthlyExpenses: clientData.monthlyExpenses,
            disposableIncome: clientData.monthlyIncome - clientData.monthlyExpenses,
            
            // Recommendations
            recommendedSolution: recommendations.recommendedSolutions[0],
            alternativeOptions: recommendations.recommendedSolutions.slice(1),
            
            // Risk warnings
            identifiedRisks: risks.filter(r => r.severity === 'high'),
            
            // Next steps
            nextSteps: this.generateNextSteps(recommendations, risks)
        };
        
        const letter = this.populateTemplate(template, letterData);
        
        // Save letter to database
        await this.saveGeneratedDocument(caseId, 'confirmation_of_advice', letter);
        
        return { generatedLetter: letter, letterData };
    }

    generateNextSteps(recommendations, risks) {
        const steps = [];
        
        if (risks.some(r => r.type === 'legal' && r.severity === 'high')) {
            steps.push('Contact creditors immediately to discuss payment arrangements');
            steps.push('Seek urgent legal advice if court proceedings are imminent');
        }
        
        steps.push('Implement the recommended debt solution');
        steps.push('Review and adjust budget monthly');
        steps.push('Contact CMA for ongoing support and guidance');
        
        return steps;
    }

    async loadLetterTemplate(templateName) {
        // In a real implementation, this would load from database or file system
        return `
Dear {{clientName}},

Reference: {{caseReference}}
Date: {{date}}

CONFIRMATION OF DEBT ADVICE

Following our recent consultation, I am writing to confirm the advice provided regarding your financial situation.

FINANCIAL SUMMARY
Total Debt: £{{totalDebt}}
Monthly Income: £{{monthlyIncome}}
Monthly Expenses: £{{monthlyExpenses}}
Available for Debt Payments: £{{disposableIncome}}

RECOMMENDED SOLUTION
Based on your circumstances, I recommend: {{recommendedSolution.description}}

{{#if identifiedRisks}}
IMPORTANT WARNINGS
{{#each identifiedRisks}}
- {{description}}: {{recommendation}}
{{/each}}
{{/if}}

NEXT STEPS
{{#each nextSteps}}
{{@index}}. {{this}}
{{/each}}

This advice is based on the information you provided. Please contact us immediately if your circumstances change.

Yours sincerely,

{{advisorName}}
Community Money Advice
        `;
    }

    populateTemplate(template, data) {
        // Simple template engine - in production, use Handlebars or similar
        let result = template;
        
        Object.entries(data).forEach(([key, value]) => {
            const regex = new RegExp(`{{${key}}}`, 'g');
            result = result.replace(regex, value);
        });
        
        return result;
    }

    async saveGeneratedDocument(caseId, type, content) {
        const query = `
            INSERT INTO generated_documents (case_id, document_type, content, generated_at)
            VALUES ($1, $2, $3, NOW())
            RETURNING id
        `;
        
        return await db.query(query, [caseId, type, content]);
    }

    async saveExecution(execution) {
        const query = `
            INSERT INTO workflow_executions (
                id, workflow_id, case_id, status, data, results, 
                started_at, completed_at, error_message, logs
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            ON CONFLICT (id) DO UPDATE SET
                status = $4, results = $6, completed_at = $8, 
                error_message = $9, logs = $10
        `;
        
        await db.query(query, [
            execution.id,
            execution.workflowId,
            execution.caseId,
            execution.status,
            JSON.stringify(execution.data),
            JSON.stringify(execution.results),
            execution.started,
            execution.completed,
            execution.error,
            JSON.stringify(execution.logs)
        ]);
    }
}

module.exports = AgenticWorkflowEngine;
