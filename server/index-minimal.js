const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const pool = require('./config/database');
require('dotenv').config();

// Import only essential routes
const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');
const clientRoutes = require('./routes/clients');

const app = express();
const PORT = process.env.PORT || 5010;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Test endpoint
app.get('/api/test', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Essential routes only
app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/clients', clientRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ 
        message: 'Something went wrong!',
        error: process.env.NODE_ENV === 'development' ? err.message : {}
    });
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

module.exports = app;
