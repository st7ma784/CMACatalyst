const express = require('express');
const pool = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Get all debt tools
router.get('/', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT * FROM debt_tools 
            WHERE is_active = true
            ORDER BY name
        `);

        res.json(result.rows);
    } catch (error) {
        console.error('Get debt tools error:', error);
        res.status(500).json({ message: 'Error fetching debt tools' });
    }
});

// Get recommended debt tools for a case
router.get('/recommendations/:caseId', authenticateToken, async (req, res) => {
    try {
        const caseId = req.params.caseId;

        // Get case details
        const caseResult = await pool.query(`
            SELECT total_debt, monthly_income, disposable_income
            FROM cases 
            WHERE id = $1 AND centre_id = $2
        `, [caseId, req.user.centre_id]);

        if (caseResult.rows.length === 0) {
            return res.status(404).json({ message: 'Case not found' });
        }

        const caseData = caseResult.rows[0];
        const totalDebt = caseData.total_debt || 0;
        const monthlyIncome = caseData.monthly_income || 0;
        const disposableIncome = caseData.disposable_income || 0;

        // Get all debt tools and filter based on case criteria
        const toolsResult = await pool.query(`
            SELECT * FROM debt_tools 
            WHERE is_active = true
            ORDER BY name
        `);

        const recommendations = toolsResult.rows.map(tool => {
            let suitabilityScore = 0;
            let reasons = [];

            // Check debt amount criteria
            if (tool.min_debt_amount && totalDebt >= tool.min_debt_amount) {
                suitabilityScore += 20;
                reasons.push(`Meets minimum debt requirement (£${tool.min_debt_amount})`);
            } else if (tool.min_debt_amount && totalDebt < tool.min_debt_amount) {
                reasons.push(`Below minimum debt requirement (£${tool.min_debt_amount})`);
            }

            if (tool.max_debt_amount && totalDebt <= tool.max_debt_amount) {
                suitabilityScore += 20;
                reasons.push(`Within maximum debt limit (£${tool.max_debt_amount})`);
            } else if (tool.max_debt_amount && totalDebt > tool.max_debt_amount) {
                reasons.push(`Exceeds maximum debt limit (£${tool.max_debt_amount})`);
            }

            // Income-based recommendations
            if (tool.tool_type === 'dmp' && disposableIncome > 0) {
                suitabilityScore += 30;
                reasons.push('Has disposable income for payments');
            } else if (tool.tool_type === 'dmp' && disposableIncome <= 0) {
                reasons.push('Insufficient disposable income');
            }

            if (tool.tool_type === 'iva' && monthlyIncome > 0) {
                suitabilityScore += 25;
                reasons.push('Has regular income');
            }

            if (tool.tool_type === 'debt_relief_order' && monthlyIncome < 1000) {
                suitabilityScore += 35;
                reasons.push('Low income suitable for DRO');
            }

            // General suitability
            if (totalDebt > 0) {
                suitabilityScore += 10;
            }

            return {
                ...tool,
                suitability_score: Math.min(suitabilityScore, 100),
                reasons: reasons,
                recommendation_level: suitabilityScore >= 70 ? 'highly_recommended' : 
                    suitabilityScore >= 40 ? 'suitable' : 
                        suitabilityScore >= 20 ? 'consider' : 'not_suitable'
            };
        });

        // Sort by suitability score
        recommendations.sort((a, b) => b.suitability_score - a.suitability_score);

        res.json({
            case_summary: {
                total_debt: totalDebt,
                monthly_income: monthlyIncome,
                disposable_income: disposableIncome
            },
            recommendations: recommendations
        });
    } catch (error) {
        console.error('Get debt tool recommendations error:', error);
        res.status(500).json({ message: 'Error getting debt tool recommendations' });
    }
});

module.exports = router;
