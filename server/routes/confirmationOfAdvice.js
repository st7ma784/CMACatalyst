const express = require('express');
const router = express.Router();
const axios = require('axios');

// Generate Confirmation of Advice from case notes
router.post('/generate-coa', async (req, res) => {
    try {
        const { case_id, notes, include_case_context = true } = req.body;

        if (!notes || !Array.isArray(notes) || notes.length === 0) {
            return res.status(400).json({ message: 'Notes array is required' });
        }

        // Get case context if requested
        let caseContext = '';
        if (include_case_context && case_id) {
            try {
                const chatbotResponse = await axios.post(
                    `${process.env.CHATBOT_URL || 'http://localhost:8001'}/mcp/tools/get_case_details`,
                    { case_id: parseInt(case_id) }
                );
                
                if (chatbotResponse.data.result && chatbotResponse.data.result.case_details) {
                    const caseData = chatbotResponse.data.result.case_details;
                    const debts = chatbotResponse.data.result.debts || [];
                    
                    caseContext = `
Case Context:
- Client: ${caseData.first_name} ${caseData.last_name}
- Case Status: ${caseData.status}
- Total Debts: ${debts.length}
- Priority Debts: ${debts.filter(d => d.priority === 'priority').length}
                    `.trim();
                }
            } catch (error) {
                console.warn('Could not fetch case context:', error.message);
            }
        }

        // Prepare notes content for CoA generation
        const notesContent = notes.map(note => {
            return `
Note: ${note.title}
Category: ${note.note_category || 'General'}
Date: ${new Date(note.created_at).toLocaleDateString()}
Content: ${note.content}
            `.trim();
        }).join('\n\n');

        // Generate CoA using local LLM
        const prompt = `Convert the following case notes into a professional Confirmation of Advice letter for a debt advice client. 

${caseContext}

Case Notes:
${notesContent}

Generate a formal Confirmation of Advice that includes:
1. Summary of client's situation
2. Advice given during consultation
3. Recommended actions
4. Next steps
5. Contact information for follow-up

The letter should be professional, clear, and comply with FCA guidelines for debt advice confirmation.`;

        const chatbotResponse = await axios.post(
            `${process.env.CHATBOT_URL || 'http://localhost:8001'}/chat`,
            {
                message: prompt,
                case_id: case_id,
                user_id: req.user?.id
            }
        );

        const rawResponse = chatbotResponse.data.response;

        // Format the response as a proper CoA letter
        const confirmationOfAdvice = formatCoAResponse(rawResponse, case_id, caseContext);

        res.json({
            confirmation_of_advice: confirmationOfAdvice,
            generated_at: new Date().toISOString(),
            case_id: case_id,
            notes_count: notes.length
        });

    } catch (error) {
        console.error('Error generating Confirmation of Advice:', error);
        res.status(500).json({ 
            message: 'Failed to generate Confirmation of Advice',
            error: error.message 
        });
    }
});

// Generate CoA from multiple case notes
router.post('/generate-coa-bulk', async (req, res) => {
    try {
        const { case_id, note_ids, date_range } = req.body;

        if (!case_id) {
            return res.status(400).json({ message: 'Case ID is required' });
        }

        // Get notes from database
        const db = req.app.get('db');
        let notesQuery = `
            SELECT n.*, u.first_name, u.last_name 
            FROM notes n
            LEFT JOIN users u ON n.user_id = u.id
            WHERE n.case_id = $1
        `;
        let queryParams = [case_id];

        if (note_ids && note_ids.length > 0) {
            notesQuery += ` AND n.id = ANY($2)`;
            queryParams.push(note_ids);
        } else if (date_range) {
            notesQuery += ` AND n.created_at BETWEEN $2 AND $3`;
            queryParams.push(date_range.start, date_range.end);
        }

        notesQuery += ` ORDER BY n.created_at ASC`;

        const notesResult = await db.query(notesQuery, queryParams);
        const notes = notesResult.rows;

        if (notes.length === 0) {
            return res.status(404).json({ message: 'No notes found for the specified criteria' });
        }

        // Generate CoA using the notes
        const coaResponse = await axios.post('/api/enhanced-notes/generate-coa', {
            case_id,
            notes,
            include_case_context: true
        });

        res.json(coaResponse.data);

    } catch (error) {
        console.error('Error generating bulk CoA:', error);
        res.status(500).json({ 
            message: 'Failed to generate Confirmation of Advice',
            error: error.message 
        });
    }
});

function formatCoAResponse(rawResponse, caseId, caseContext) {
    const currentDate = new Date().toLocaleDateString('en-GB');
    
    // Extract client name from context if available
    const clientMatch = caseContext.match(/Client: (.+)/);
    const clientName = clientMatch ? clientMatch[1] : '[Client Name]';

    return `
CONFIRMATION OF ADVICE

Date: ${currentDate}
Case Reference: ${caseId}
Client: ${clientName}

Dear ${clientName},

This letter confirms the debt advice session we had today and summarises the guidance provided.

${rawResponse}

IMPORTANT INFORMATION:
- This advice is based on the information you provided during our consultation
- If your circumstances change, please contact us for updated advice
- Keep this confirmation for your records
- You have the right to complain if you are not satisfied with our service

If you need further assistance or have any questions about the advice given, please do not hesitate to contact us.

Yours sincerely,

[Advisor Name]
[Centre Name]
[Contact Details]

---
This Confirmation of Advice was generated using AI assistance and reviewed by qualified debt advisors.
Regulated by the Financial Conduct Authority.
    `.trim();
}

module.exports = router;