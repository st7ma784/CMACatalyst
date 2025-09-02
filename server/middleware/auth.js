const jwt = require('jsonwebtoken');
const pool = require('../config/database');

const authenticateToken = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: 'Access token required' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
        
        // Get user details from database
        const userResult = await pool.query(
            'SELECT u.*, c.name as centre_name FROM users u LEFT JOIN centres c ON u.centre_id = c.id WHERE u.id = $1 AND u.is_active = true',
            [decoded.userId]
        );

        if (userResult.rows.length === 0) {
            return res.status(403).json({ message: 'User not found or inactive' });
        }

        req.user = userResult.rows[0];
        next();
    } catch (error) {
        return res.status(403).json({ message: 'Invalid or expired token' });
    }
};

const requireRole = (roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ message: 'Authentication required' });
        }

        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ message: 'Insufficient permissions' });
        }

        next();
    };
};

const requireCentreAccess = async (req, res, next) => {
    try {
        const centreId = req.params.centreId || req.body.centre_id;
        
        if (!centreId) {
            return res.status(400).json({ message: 'Centre ID required' });
        }

        if (req.user.centre_id !== parseInt(centreId)) {
            return res.status(403).json({ message: 'Access denied to this centre' });
        }

        next();
    } catch (error) {
        res.status(500).json({ message: 'Error checking centre access' });
    }
};

module.exports = {
    authenticateToken,
    requireRole,
    requireCentreAccess
};
