const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const pool = require('./config/database');
require('dotenv').config();

// Import essential routes
const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');
const clientRoutes = require('./routes/clients');
const caseRoutes = require('./routes/cases');
const appointmentRoutes = require('./routes/appointments');
const noteRoutes = require('./routes/notes');
const tasksRoutes = require('./routes/tasks');
const creditorsRoutes = require('./routes/creditors');
const letterTemplatesRoutes = require('./routes/letterTemplates');

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

// Essential routes
app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/cases', caseRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/notes', noteRoutes);
app.use('/api/tasks', tasksRoutes);
app.use('/api/creditors', creditorsRoutes);
app.use('/api/letter-templates', letterTemplatesRoutes);

// Serve React app
app.use(express.static(path.join(__dirname, '../client/build')));

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ 
        message: 'Something went wrong!',
        error: process.env.NODE_ENV === 'development' ? err.message : {}
    });
});

// Handle React routing, return all requests to React app (must be last)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/build', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

module.exports = app;
