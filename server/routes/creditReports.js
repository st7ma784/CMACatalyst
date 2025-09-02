const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticateToken, requireRole } = require('../middleware/auth');
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const puppeteer = require('puppeteer');

// Credit bureau configurations
const CREDIT_BUREAUS = {
    experian: {
        name: 'Experian',
        apiUrl: process.env.EXPERIAN_API_URL || 'https://sandbox.experian.com/api',
        apiKey: process.env.EXPERIAN_API_KEY,
        cost: 500 // pence
    },
    equifax: {
        name: 'Equifax',
        apiUrl: process.env.EQUIFAX_API_URL || 'https://sandbox.equifax.com/api',
        apiKey: process.env.EQUIFAX_API_KEY,
        cost: 450 // pence
    },
    transunion: {
        name: 'TransUnion',
        apiUrl: process.env.TRANSUNION_API_URL || 'https://sandbox.transunion.com/api',
        apiKey: process.env.TRANSUNION_API_KEY,
        cost: 475 // pence
    }
};

// Request credit report
router.post('/request', authenticateToken, async (req, res) => {
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');

        const {
            case_id,
            client_id,
            bureau,
            request_type = 'full',
            consent_given = false,
            client_details
        } = req.body;

        // Verify user has access to this case
        const caseCheck = await client.query(
            'SELECT id FROM cases WHERE id = $1 AND centre_id = $2',
            [case_id, req.user.centre_id]
        );
        
        if (caseCheck.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Case not found' });
        }

        // Validate bureau
        if (!CREDIT_BUREAUS[bureau]) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Invalid credit bureau' });
        }

        // Check consent
        if (!consent_given) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Client consent is required for credit report requests' });
        }

        // Create request record
        const requestResult = await client.query(`
            INSERT INTO credit_report_requests (
                case_id, client_id, requested_by, bureau, request_type, 
                status, cost_pence, consent_given, consent_date
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
            RETURNING *
        `, [
            case_id, 
            client_id, 
            req.user.id, 
            bureau, 
            request_type, 
            'pending',
            CREDIT_BUREAUS[bureau].cost,
            consent_given
        ]);

        const request = requestResult.rows[0];

        // Submit to credit bureau (mock implementation)
        try {
            const bureauResponse = await submitToCreditBureau(bureau, client_details, request_type);
            
            if (bureauResponse.success) {
                await client.query(`
                    UPDATE credit_report_requests 
                    SET status = $1, external_reference = $2
                    WHERE id = $3
                `, ['processing', bureauResponse.reference, request.id]);

                // If synchronous response, process immediately
                if (bureauResponse.data) {
                    await processCreditReport(request.id, bureauResponse.data);
                }
            } else {
                await client.query(`
                    UPDATE credit_report_requests 
                    SET status = $1
                    WHERE id = $2
                `, ['failed', request.id]);
            }
        } catch (error) {
            console.error('Credit bureau submission error:', error);
            await client.query(`
                UPDATE credit_report_requests 
                SET status = $1
                WHERE id = $2
            `, ['failed', request.id]);
        }

        await client.query('COMMIT');

        // Return updated request
        const updatedRequest = await pool.query(
            'SELECT * FROM credit_report_requests WHERE id = $1',
            [request.id]
        );

        res.status(201).json(updatedRequest.rows[0]);
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error requesting credit report:', error);
        res.status(500).json({ error: 'Internal server error' });
    } finally {
        client.release();
    }
});

// Get credit report requests for a case
router.get('/case/:caseId', authenticateToken, async (req, res) => {
    try {
        const { caseId } = req.params;

        // Verify user has access to this case
        const caseCheck = await pool.query(
            'SELECT id FROM cases WHERE id = $1 AND centre_id = $2',
            [caseId, req.user.centre_id]
        );
        
        if (caseCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Case not found' });
        }

        const result = await pool.query(`
            SELECT crr.*, u.first_name, u.last_name,
                   cr.credit_score, cr.risk_grade, cr.report_date, cr.file_path
            FROM credit_report_requests crr
            JOIN users u ON crr.requested_by = u.id
            LEFT JOIN credit_reports cr ON crr.id = cr.request_id
            WHERE crr.case_id = $1
            ORDER BY crr.requested_at DESC
        `, [caseId]);

        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching credit report requests:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get credit report details
router.get('/report/:requestId', authenticateToken, async (req, res) => {
    try {
        const { requestId } = req.params;

        // Verify user has access to this report
        const reportCheck = await pool.query(`
            SELECT cr.*, crr.case_id
            FROM credit_reports cr
            JOIN credit_report_requests crr ON cr.request_id = crr.id
            JOIN cases c ON crr.case_id = c.id
            WHERE cr.request_id = $1 AND c.centre_id = $2
        `, [requestId, req.user.centre_id]);

        if (reportCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Credit report not found' });
        }

        const report = reportCheck.rows[0];
        
        // Parse report data for display
        const parsedReport = {
            ...report,
            summary: extractReportSummary(report.report_data),
            accounts: extractAccounts(report.report_data),
            searches: extractSearches(report.report_data),
            public_records: extractPublicRecords(report.report_data)
        };

        res.json(parsedReport);
    } catch (error) {
        console.error('Error fetching credit report:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Download credit report PDF
router.get('/report/:requestId/download', authenticateToken, async (req, res) => {
    try {
        const { requestId } = req.params;

        // Verify user has access to this report
        const reportCheck = await pool.query(`
            SELECT cr.file_path, crr.case_id
            FROM credit_reports cr
            JOIN credit_report_requests crr ON cr.request_id = crr.id
            JOIN cases c ON crr.case_id = c.id
            WHERE cr.request_id = $1 AND c.centre_id = $2
        `, [requestId, req.user.centre_id]);

        if (reportCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Credit report not found' });
        }

        const filePath = reportCheck.rows[0].file_path;
        
        if (!filePath || !await fileExists(filePath)) {
            return res.status(404).json({ error: 'Report file not found' });
        }

        res.download(filePath, `credit_report_${requestId}.pdf`);
    } catch (error) {
        console.error('Error downloading credit report:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Generate credit report summary
router.post('/report/:requestId/summary', authenticateToken, async (req, res) => {
    try {
        const { requestId } = req.params;

        // Get report data
        const reportResult = await pool.query(`
            SELECT cr.*, crr.case_id, cl.first_name, cl.last_name
            FROM credit_reports cr
            JOIN credit_report_requests crr ON cr.request_id = crr.id
            JOIN cases c ON crr.case_id = c.id
            JOIN clients cl ON c.client_id = cl.id
            WHERE cr.request_id = $1 AND c.centre_id = $2
        `, [requestId, req.user.centre_id]);

        if (reportResult.rows.length === 0) {
            return res.status(404).json({ error: 'Credit report not found' });
        }

        const report = reportResult.rows[0];
        const summary = await generateCreditReportSummary(report);

        res.json(summary);
    } catch (error) {
        console.error('Error generating credit report summary:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get credit monitoring alerts
router.get('/alerts', authenticateToken, async (req, res) => {
    try {
        const { resolved = false } = req.query;

        const result = await pool.query(`
            SELECT ca.*, cl.first_name, cl.last_name, c.id as case_id
            FROM credit_alerts ca
            JOIN clients cl ON ca.client_id = cl.id
            JOIN cases c ON cl.id = c.client_id
            WHERE c.centre_id = $1 AND ca.resolved = $2
            ORDER BY ca.created_at DESC
        `, [req.user.centre_id, resolved]);

        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching credit alerts:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Mark credit alert as resolved
router.put('/alerts/:alertId/resolve', authenticateToken, async (req, res) => {
    try {
        const { alertId } = req.params;

        // Verify user has access to this alert
        const alertCheck = await pool.query(`
            SELECT ca.id
            FROM credit_alerts ca
            JOIN clients cl ON ca.client_id = cl.id
            JOIN cases c ON cl.id = c.client_id
            WHERE ca.id = $1 AND c.centre_id = $2
        `, [alertId, req.user.centre_id]);

        if (alertCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Alert not found' });
        }

        const result = await pool.query(`
            UPDATE credit_alerts 
            SET resolved = true 
            WHERE id = $1
            RETURNING *
        `, [alertId]);

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error resolving credit alert:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Helper functions
async function submitToCreditBureau(bureau, clientDetails, requestType) {
    // Mock implementation - replace with actual API calls
    const bureauConfig = CREDIT_BUREAUS[bureau];
    
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Mock response
    return {
        success: true,
        reference: `${bureau}_${Date.now()}`,
        data: generateMockCreditData(clientDetails)
    };
}

function generateMockCreditData(clientDetails) {
    return {
        personal_details: clientDetails,
        credit_score: Math.floor(Math.random() * 500) + 300,
        risk_grade: ['A', 'B', 'C', 'D', 'E'][Math.floor(Math.random() * 5)],
        accounts: [
            {
                creditor: 'Sample Bank',
                account_type: 'Credit Card',
                balance: 2500,
                credit_limit: 5000,
                status: 'Active',
                payment_history: 'Good'
            }
        ],
        searches: [
            {
                date: new Date().toISOString(),
                creditor: 'Sample Lender',
                search_type: 'Credit Application'
            }
        ],
        public_records: []
    };
}

async function processCreditReport(requestId, reportData) {
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');

        // Generate PDF report
        const pdfPath = await generateCreditReportPDF(requestId, reportData);

        // Store report in database
        await client.query(`
            INSERT INTO credit_reports (
                request_id, bureau, report_data, credit_score, 
                risk_grade, report_date, file_path
            )
            VALUES ($1, $2, $3, $4, $5, CURRENT_DATE, $6)
        `, [
            requestId,
            reportData.bureau || 'unknown',
            JSON.stringify(reportData),
            reportData.credit_score,
            reportData.risk_grade,
            pdfPath
        ]);

        // Update request status
        await client.query(`
            UPDATE credit_report_requests 
            SET status = 'completed', completed_at = CURRENT_TIMESTAMP
            WHERE id = $1
        `, [requestId]);

        // Check for alerts
        await checkForCreditAlerts(reportData);

        await client.query('COMMIT');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error processing credit report:', error);
        throw error;
    } finally {
        client.release();
    }
}

async function generateCreditReportPDF(requestId, reportData) {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    
    const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Credit Report</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 20px; }
                .header { text-align: center; margin-bottom: 30px; }
                .section { margin-bottom: 20px; }
                .score { font-size: 24px; font-weight: bold; color: #2196F3; }
                table { width: 100%; border-collapse: collapse; }
                th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                th { background-color: #f2f2f2; }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>Credit Report</h1>
                <p>Generated on ${new Date().toLocaleDateString()}</p>
            </div>
            
            <div class="section">
                <h2>Credit Score</h2>
                <div class="score">${reportData.credit_score}</div>
                <p>Risk Grade: ${reportData.risk_grade}</p>
            </div>
            
            <div class="section">
                <h2>Account Summary</h2>
                <table>
                    <tr>
                        <th>Creditor</th>
                        <th>Type</th>
                        <th>Balance</th>
                        <th>Status</th>
                    </tr>
                    ${reportData.accounts.map(account => `
                        <tr>
                            <td>${account.creditor}</td>
                            <td>${account.account_type}</td>
                            <td>£${account.balance}</td>
                            <td>${account.status}</td>
                        </tr>
                    `).join('')}
                </table>
            </div>
        </body>
        </html>
    `;
    
    await page.setContent(htmlContent);
    
    const uploadsDir = path.join(__dirname, '../uploads/credit-reports');
    await fs.mkdir(uploadsDir, { recursive: true });
    
    const pdfPath = path.join(uploadsDir, `credit_report_${requestId}.pdf`);
    await page.pdf({ path: pdfPath, format: 'A4' });
    
    await browser.close();
    
    return pdfPath;
}

async function checkForCreditAlerts(reportData) {
    // Implementation for checking credit alerts
    // This would analyze the report data for concerning patterns
}

function extractReportSummary(reportData) {
    return {
        credit_score: reportData.credit_score,
        risk_grade: reportData.risk_grade,
        total_accounts: reportData.accounts?.length || 0,
        total_balance: reportData.accounts?.reduce((sum, acc) => sum + (acc.balance || 0), 0) || 0
    };
}

function extractAccounts(reportData) {
    return reportData.accounts || [];
}

function extractSearches(reportData) {
    return reportData.searches || [];
}

function extractPublicRecords(reportData) {
    return reportData.public_records || [];
}

async function generateCreditReportSummary(report) {
    const reportData = report.report_data;
    
    return {
        client_name: `${report.first_name} ${report.last_name}`,
        credit_score: report.credit_score,
        risk_grade: report.risk_grade,
        report_date: report.report_date,
        summary: extractReportSummary(reportData),
        recommendations: generateRecommendations(reportData),
        key_findings: generateKeyFindings(reportData)
    };
}

function generateRecommendations(reportData) {
    const recommendations = [];
    
    if (reportData.credit_score < 500) {
        recommendations.push('Consider debt consolidation options');
        recommendations.push('Focus on paying down high-interest debts first');
    }
    
    if (reportData.accounts?.some(acc => acc.status === 'Default')) {
        recommendations.push('Address defaulted accounts as priority');
    }
    
    return recommendations;
}

function generateKeyFindings(reportData) {
    const findings = [];
    
    const totalDebt = reportData.accounts?.reduce((sum, acc) => sum + (acc.balance || 0), 0) || 0;
    if (totalDebt > 10000) {
        findings.push(`High total debt: £${totalDebt}`);
    }
    
    return findings;
}

async function fileExists(filePath) {
    try {
        await fs.access(filePath);
        return true;
    } catch {
        return false;
    }
}

module.exports = router;
