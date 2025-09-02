const express = require('express');
const handlebars = require('handlebars');
const puppeteer = require('puppeteer');
const pool = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Get letter templates
router.get('/templates', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT * FROM letter_templates 
            WHERE centre_id = $1 AND is_active = true
            ORDER BY name
        `, [req.user.centre_id]);

        res.json(result.rows);
    } catch (error) {
        console.error('Get letter templates error:', error);
        res.status(500).json({ message: 'Error fetching letter templates' });
    }
});

// Create letter template
router.post('/templates', authenticateToken, async (req, res) => {
    try {
        const { name, subject, content, template_type } = req.body;

        if (!name || !content) {
            return res.status(400).json({ message: 'Name and content are required' });
        }

        const result = await pool.query(`
            INSERT INTO letter_templates (centre_id, name, subject, content, template_type)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *
        `, [req.user.centre_id, name, subject, content, template_type]);

        res.status(201).json({
            message: 'Letter template created successfully',
            template: result.rows[0]
        });
    } catch (error) {
        console.error('Create letter template error:', error);
        res.status(500).json({ message: 'Error creating letter template' });
    }
});

// Generate letter from template
router.post('/generate', authenticateToken, async (req, res) => {
    try {
        const { template_id, case_id, recipient_name, recipient_address, custom_data = {} } = req.body;

        if (!template_id || !case_id) {
            return res.status(400).json({ message: 'Template ID and Case ID are required' });
        }

        // Get template
        const templateResult = await pool.query(
            'SELECT * FROM letter_templates WHERE id = $1 AND centre_id = $2',
            [template_id, req.user.centre_id]
        );

        if (templateResult.rows.length === 0) {
            return res.status(404).json({ message: 'Template not found' });
        }

        // Get case and client data
        const caseResult = await pool.query(`
            SELECT c.*, 
                   cl.first_name, cl.last_name, cl.address as client_address,
                   cl.phone, cl.email, cl.date_of_birth,
                   centre.name as centre_name, centre.address as centre_address,
                   centre.phone as centre_phone, centre.email as centre_email,
                   centre.letterhead_address, centre.letterhead_contact
            FROM cases c
            JOIN clients cl ON c.client_id = cl.id
            JOIN centres centre ON c.centre_id = centre.id
            WHERE c.id = $1 AND c.centre_id = $2
        `, [case_id, req.user.centre_id]);

        if (caseResult.rows.length === 0) {
            return res.status(404).json({ message: 'Case not found' });
        }

        const template = templateResult.rows[0];
        const caseData = caseResult.rows[0];

        // Prepare template data
        const templateData = {
            client: {
                first_name: caseData.first_name,
                last_name: caseData.last_name,
                full_name: `${caseData.first_name} ${caseData.last_name}`,
                address: caseData.client_address,
                phone: caseData.phone,
                email: caseData.email,
                date_of_birth: caseData.date_of_birth
            },
            case: {
                case_number: caseData.case_number,
                debt_stage: caseData.debt_stage,
                total_debt: caseData.total_debt,
                monthly_income: caseData.monthly_income,
                monthly_expenses: caseData.monthly_expenses,
                disposable_income: caseData.disposable_income
            },
            centre: {
                name: caseData.centre_name,
                address: caseData.centre_address,
                phone: caseData.centre_phone,
                email: caseData.centre_email,
                letterhead_address: caseData.letterhead_address,
                letterhead_contact: caseData.letterhead_contact
            },
            recipient: {
                name: recipient_name || 'Dear Sir/Madam',
                address: recipient_address || ''
            },
            date: new Date().toLocaleDateString('en-GB'),
            ...custom_data
        };

        // Compile and render template
        const compiledSubject = handlebars.compile(template.subject || '');
        const compiledContent = handlebars.compile(template.content);

        const renderedSubject = compiledSubject(templateData);
        const renderedContent = compiledContent(templateData);

        // Save generated letter
        const letterResult = await pool.query(`
            INSERT INTO generated_letters (
                case_id, template_id, user_id, recipient_name, recipient_address, 
                subject, content
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *
        `, [case_id, template_id, req.user.id, recipient_name, recipient_address, renderedSubject, renderedContent]);

        res.json({
            message: 'Letter generated successfully',
            letter: letterResult.rows[0],
            rendered_content: renderedContent,
            rendered_subject: renderedSubject
        });
    } catch (error) {
        console.error('Generate letter error:', error);
        res.status(500).json({ message: 'Error generating letter' });
    }
});

// Get generated letters for a case
router.get('/case/:caseId', authenticateToken, async (req, res) => {
    try {
        const caseId = req.params.caseId;

        const result = await pool.query(`
            SELECT gl.*, lt.name as template_name, u.first_name || ' ' || u.last_name as generated_by
            FROM generated_letters gl
            LEFT JOIN letter_templates lt ON gl.template_id = lt.id
            JOIN users u ON gl.user_id = u.id
            JOIN cases c ON gl.case_id = c.id
            WHERE gl.case_id = $1 AND c.centre_id = $2
            ORDER BY gl.generated_at DESC
        `, [caseId, req.user.centre_id]);

        res.json(result.rows);
    } catch (error) {
        console.error('Get generated letters error:', error);
        res.status(500).json({ message: 'Error fetching generated letters' });
    }
});

// Generate PDF from letter
router.post('/:id/pdf', authenticateToken, async (req, res) => {
    try {
        const letterId = req.params.id;

        const result = await pool.query(`
            SELECT gl.*, c.centre_id, centre.letterhead_logo
            FROM generated_letters gl
            JOIN cases c ON gl.case_id = c.id
            JOIN centres centre ON c.centre_id = centre.id
            WHERE gl.id = $1 AND c.centre_id = $2
        `, [letterId, req.user.centre_id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Letter not found' });
        }

        const letter = result.rows[0];

        // Create HTML for PDF generation
        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <style>
                    body { font-family: Arial, sans-serif; margin: 40px; }
                    .letterhead { text-align: center; border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 30px; }
                    .logo { max-height: 100px; margin-bottom: 10px; }
                    .date { text-align: right; margin-bottom: 30px; }
                    .recipient { margin-bottom: 30px; }
                    .content { line-height: 1.6; }
                    .signature { margin-top: 50px; }
                </style>
            </head>
            <body>
                <div class="letterhead">
                    ${letter.letterhead_logo ? `<img src="data:image/png;base64,${letter.letterhead_logo}" class="logo" alt="Logo">` : ''}
                    <h2>${letter.centre_name || 'Community Money Advice Centre'}</h2>
                </div>
                
                <div class="date">${new Date().toLocaleDateString('en-GB')}</div>
                
                <div class="recipient">
                    ${letter.recipient_name || ''}<br>
                    ${letter.recipient_address || ''}
                </div>
                
                <div class="content">
                    <h3>${letter.subject}</h3>
                    ${letter.content.replace(/\n/g, '<br>')}
                </div>
                
                <div class="signature">
                    <p>Yours sincerely,</p>
                    <br><br>
                    <p>Money Advice Team</p>
                </div>
            </body>
            </html>
        `;

        // Generate PDF
        const browser = await puppeteer.launch({ headless: 'new' });
        const page = await browser.newPage();
        await page.setContent(html);
        const pdf = await page.pdf({ 
            format: 'A4',
            printBackground: true,
            margin: { top: '20mm', bottom: '20mm', left: '20mm', right: '20mm' }
        });
        await browser.close();

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="Letter_${letter.id}.pdf"`);
        res.send(pdf);
    } catch (error) {
        console.error('Generate PDF error:', error);
        res.status(500).json({ message: 'Error generating PDF' });
    }
});

module.exports = router;
