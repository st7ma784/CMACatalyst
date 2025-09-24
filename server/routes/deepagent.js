const express = require('express');
const { spawn } = require('child_process');
const path = require('path');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Process client case with DeepAgent AI
router.post('/process-case', authenticateToken, async (req, res) => {
    try {
        const { client_input, case_id, client_name } = req.body;

        if (!client_input) {
            return res.status(400).json({ 
                success: false, 
                error: 'client_input is required' 
            });
        }

        // Prepare Python script execution
        const pythonScript = path.join(__dirname, '../../python/deepagent_processor.py');
        const args = [
            '--client_input', client_input,
            '--api_token', req.token, // Pass the JWT token
            '--api_base_url', process.env.API_BASE_URL || 'http://localhost:5010/api'
        ];

        if (case_id) args.push('--case_id', case_id);
        if (client_name) args.push('--client_name', client_name);

        // Execute DeepAgent processing
        const pythonProcess = spawn('python3', [pythonScript, ...args]);
        
        let output = '';
        let errorOutput = '';

        pythonProcess.stdout.on('data', (data) => {
            output += data.toString();
        });

        pythonProcess.stderr.on('data', (data) => {
            errorOutput += data.toString();
        });

        pythonProcess.on('close', (code) => {
            if (code === 0) {
                try {
                    const result = JSON.parse(output);
                    res.json({
                        success: true,
                        data: result,
                        processed_at: new Date().toISOString()
                    });
                } catch (parseError) {
                    res.status(500).json({
                        success: false,
                        error: 'Failed to parse DeepAgent response',
                        raw_output: output
                    });
                }
            } else {
                res.status(500).json({
                    success: false,
                    error: 'DeepAgent processing failed',
                    details: errorOutput,
                    exit_code: code
                });
            }
        });

    } catch (error) {
        console.error('DeepAgent processing error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: error.message
        });
    }
});

// Bulk process multiple cases
router.post('/bulk-process', authenticateToken, async (req, res) => {
    try {
        const { cases } = req.body;

        if (!Array.isArray(cases) || cases.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'cases array is required'
            });
        }

        const results = [];
        
        // Process cases sequentially to avoid overwhelming the system
        for (const caseData of cases) {
            try {
                const { client_input, case_id, client_name } = caseData;
                
                // Call the individual processing endpoint internally
                const processResult = await new Promise((resolve, reject) => {
                    const pythonScript = path.join(__dirname, '../../python/deepagent_processor.py');
                    const args = [
                        '--client_input', client_input,
                        '--api_token', req.token,
                        '--api_base_url', process.env.API_BASE_URL || 'http://localhost:5010/api'
                    ];

                    if (case_id) args.push('--case_id', case_id);
                    if (client_name) args.push('--client_name', client_name);

                    const pythonProcess = spawn('python3', [pythonScript, ...args]);
                    let output = '';
                    let errorOutput = '';

                    pythonProcess.stdout.on('data', (data) => {
                        output += data.toString();
                    });

                    pythonProcess.stderr.on('data', (data) => {
                        errorOutput += data.toString();
                    });

                    pythonProcess.on('close', (code) => {
                        if (code === 0) {
                            try {
                                resolve(JSON.parse(output));
                            } catch (e) {
                                reject(new Error('Failed to parse output'));
                            }
                        } else {
                            reject(new Error(errorOutput || 'Processing failed'));
                        }
                    });
                });

                results.push({
                    ...caseData,
                    result: processResult,
                    status: 'success'
                });

            } catch (error) {
                results.push({
                    ...caseData,
                    error: error.message,
                    status: 'failed'
                });
            }

            // Add delay between cases to prevent system overload
            await new Promise(resolve => setTimeout(resolve, 2000));
        }

        const successCount = results.filter(r => r.status === 'success').length;
        const failedCount = results.filter(r => r.status === 'failed').length;

        res.json({
            success: true,
            summary: {
                total: cases.length,
                successful: successCount,
                failed: failedCount
            },
            results: results,
            processed_at: new Date().toISOString()
        });

    } catch (error) {
        console.error('Bulk processing error:', error);
        res.status(500).json({
            success: false,
            error: 'Bulk processing failed',
            details: error.message
        });
    }
});

// Get DeepAgent analysis for existing case
router.get('/analyze-case/:caseId', authenticateToken, async (req, res) => {
    try {
        const caseId = req.params.caseId;

        // Fetch case details first
        const caseResponse = await fetch(`${process.env.API_BASE_URL}/cases/${caseId}`, {
            headers: {
                'Authorization': `Bearer ${req.token}`
            }
        });

        if (!caseResponse.ok) {
            return res.status(404).json({
                success: false,
                error: 'Case not found'
            });
        }

        const caseData = await caseResponse.json();
        
        // Create analysis input from case data
        const analysisInput = `
Client: ${caseData.client_name}
Case Status: ${caseData.status}
Priority: ${caseData.priority}
Total Debt: £${caseData.total_debt || 'Unknown'}
Case Description: ${caseData.description || 'No description available'}
Recent Notes: ${caseData.recent_notes ? caseData.recent_notes.slice(0, 500) : 'No recent notes'}
        `.trim();

        // Process with DeepAgent
        const pythonScript = path.join(__dirname, '../../python/deepagent_processor.py');
        const args = [
            '--client_input', analysisInput,
            '--case_id', caseId,
            '--client_name', caseData.client_name,
            '--api_token', req.token,
            '--api_base_url', process.env.API_BASE_URL || 'http://localhost:5010/api'
        ];

        const pythonProcess = spawn('python3', [pythonScript, ...args]);
        let output = '';
        let errorOutput = '';

        pythonProcess.stdout.on('data', (data) => {
            output += data.toString();
        });

        pythonProcess.stderr.on('data', (data) => {
            errorOutput += data.toString();
        });

        pythonProcess.on('close', (code) => {
            if (code === 0) {
                try {
                    const result = JSON.parse(output);
                    res.json({
                        success: true,
                        case_data: caseData,
                        ai_analysis: result,
                        analyzed_at: new Date().toISOString()
                    });
                } catch (parseError) {
                    res.status(500).json({
                        success: false,
                        error: 'Failed to parse DeepAgent analysis',
                        raw_output: output
                    });
                }
            } else {
                res.status(500).json({
                    success: false,
                    error: 'DeepAgent analysis failed',
                    details: errorOutput
                });
            }
        });

    } catch (error) {
        console.error('Case analysis error:', error);
        res.status(500).json({
            success: false,
            error: 'Analysis failed',
            details: error.message
        });
    }
});

// Health check for DeepAgent system
router.get('/health', (req, res) => {
    try {
        const pythonScript = path.join(__dirname, '../../python/deepagent_health.py');
        const pythonProcess = spawn('python3', [pythonScript]);
        
        let output = '';
        let errorOutput = '';

        pythonProcess.stdout.on('data', (data) => {
            output += data.toString();
        });

        pythonProcess.stderr.on('data', (data) => {
            errorOutput += data.toString();
        });

        pythonProcess.on('close', (code) => {
            if (code === 0) {
                res.json({
                    success: true,
                    status: 'healthy',
                    details: output.trim(),
                    checked_at: new Date().toISOString()
                });
            } else {
                res.status(500).json({
                    success: false,
                    status: 'unhealthy',
                    error: errorOutput.trim(),
                    exit_code: code
                });
            }
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            status: 'error',
            error: error.message
        });
    }
});

module.exports = router;
