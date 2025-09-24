const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const pool = require('./config/database');
require('dotenv').config();

// Import routes
const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');
const clientRoutes = require('./routes/clients');
const caseRoutes = require('./routes/cases');
const appointmentRoutes = require('./routes/appointments');
const noteRoutes = require('./routes/notes');
const fileRoutes = require('./routes/files');
const letterRoutes = require('./routes/letters');
// Disabled problematic routes that cause server hanging
// const schedulingRoutes = require('./routes/scheduling');
// const agenticWorkflowRoutes = require('./routes/agenticWorkflow');
// const caseFilestoreRoutes = require('./routes/caseFilestore');
// const ocrRoutes = require('./routes/ocr');
// const creditReportRoutes = require('./routes/creditReports');
// const complianceRoutes = require('./routes/compliance');
// const notificationRoutes = require('./routes/notifications');
// const userManagementRoutes = require('./routes/userManagement');
// const debtToolsRoutes = require('./routes/debtTools');
const documentOCRRoutes = require('./routes/documentOCR');
const caseFilestoreRoutes = require('./routes/caseFilestore');
const debtToolsRoutes = require('./routes/debtTools');
const centreRoutes = require('./routes/centres');
const userRoutes = require('./routes/users');
const enhancedNotesRoutes = require('./routes/enhancedNotes');
const creditReportsRoutes = require('./routes/creditReports');
const notificationsRoutes = require('./routes/notifications');
const schedulingRoutes = require('./routes/scheduling');
const agenticWorkflowRoutes = require('./routes/agenticWorkflow');
const digitalReferralsRoutes = require('./routes/digitalReferrals');
const autoActionsRoutes = require('./routes/autoActions');
const complianceRoutes = require('./routes/compliance');
const documentRoutes = require('./routes/documents');

const app = express();
const PORT = process.env.PORT || 5000;

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

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/cases', caseRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/notes', noteRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/letters', letterRoutes);
// app.use('/api/financial-statements', financialStatementRoutes); // TODO: Create this route file
app.use('/api/debt-tools', debtToolsRoutes);
app.use('/api/credit-reports', creditReportsRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/scheduling', schedulingRoutes);
app.use('/api/agentic-workflow', agenticWorkflowRoutes);
app.use('/api/digital-referrals', digitalReferralsRoutes);
app.use('/api/auto-actions', autoActionsRoutes);
app.use('/api/document-ocr', documentOCRRoutes);
app.use('/api/case-filestore', caseFilestoreRoutes);
app.use('/api/compliance', complianceRoutes);
app.use('/api/documents', documentRoutes);

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
