const axios = require('axios');

/**
 * Chatbot Integration Service
 * Integrates agentic workflows with the self-hosted chatbot
 */
class ChatbotIntegrationService {
    constructor() {
        this.chatbotUrl = process.env.CHATBOT_URL || 'http://localhost:8000';
    }

    /**
     * Send workflow results to chatbot for context-aware responses
     */
    async sendWorkflowContext(caseId, workflowResults) {
        try {
            const contextData = {
                case_id: caseId,
                workflow_type: workflowResults.workflow_name,
                results: workflowResults.results,
                recommendations: workflowResults.recommendations,
                generated_documents: workflowResults.generated_documents
            };

            await axios.post(`${this.chatbotUrl}/api/context/workflow`, contextData);
            
            return { success: true };
        } catch (error) {
            console.error('Error sending workflow context to chatbot:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Request chatbot to generate advice based on workflow results
     */
    async generateAdviceFromWorkflow(caseId, workflowResults) {
        try {
            const prompt = this.buildAdvicePrompt(workflowResults);
            
            const response = await axios.post(`${this.chatbotUrl}/api/generate`, {
                case_id: caseId,
                prompt: prompt,
                context_type: 'workflow_advice'
            });

            return {
                success: true,
                advice: response.data.response,
                confidence: response.data.confidence || 0.8
            };
        } catch (error) {
            console.error('Error generating advice from chatbot:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Build advice prompt from workflow results
     */
    buildAdvicePrompt(workflowResults) {
        const { workflow_name, results, recommendations } = workflowResults;

        let prompt = `Based on the ${workflow_name} workflow analysis:\n\n`;

        if (results.financial_analysis) {
            prompt += `Financial Analysis:\n`;
            prompt += `- Total Debt: £${results.financial_analysis.total_debt}\n`;
            prompt += `- Monthly Income: £${results.financial_analysis.monthly_income}\n`;
            prompt += `- Affordability: ${results.financial_analysis.affordability_status}\n\n`;
        }

        if (results.risk_assessment) {
            prompt += `Risk Assessment:\n`;
            prompt += `- Overall Risk Level: ${results.risk_assessment.overall_risk}\n`;
            prompt += `- Key Risks: ${results.risk_assessment.identified_risks.join(', ')}\n\n`;
        }

        if (recommendations && recommendations.length > 0) {
            prompt += `Recommendations:\n`;
            recommendations.forEach((rec, index) => {
                prompt += `${index + 1}. ${rec}\n`;
            });
            prompt += '\n';
        }

        prompt += `Please provide personalized advice for this client based on the above analysis. `;
        prompt += `Focus on practical next steps and consider any vulnerabilities or special circumstances.`;

        return prompt;
    }

    /**
     * Get chatbot conversation history for a case
     */
    async getChatHistory(caseId) {
        try {
            const response = await axios.get(`${this.chatbotUrl}/api/conversations/${caseId}`);
            return {
                success: true,
                conversations: response.data.conversations
            };
        } catch (error) {
            console.error('Error fetching chat history:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Trigger workflow execution from chatbot conversation
     */
    async triggerWorkflowFromChat(caseId, workflowType, chatContext) {
        try {
            // This would be called by the chatbot when it detects a need for workflow execution
            const workflowData = {
                case_id: caseId,
                workflow_type: workflowType,
                triggered_by: 'chatbot',
                context: chatContext
            };

            // Return workflow trigger data for the main workflow engine
            return {
                success: true,
                workflow_data: workflowData
            };
        } catch (error) {
            console.error('Error triggering workflow from chat:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Update chatbot with case status changes
     */
    async updateCaseStatus(caseId, statusUpdate) {
        try {
            await axios.post(`${this.chatbotUrl}/api/context/case-update`, {
                case_id: caseId,
                status_update: statusUpdate,
                timestamp: new Date().toISOString()
            });

            return { success: true };
        } catch (error) {
            console.error('Error updating case status in chatbot:', error);
            return { success: false, error: error.message };
        }
    }
}

module.exports = new ChatbotIntegrationService();
