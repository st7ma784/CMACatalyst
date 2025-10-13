/**
 * OCR Demo Dashboard JavaScript
 * Handles real-time updates, API interactions, and UI enhancements
 */

class OCRDashboard {
    constructor() {
        this.autoRefreshInterval = null;
        this.refreshRate = 30000; // 30 seconds
        this.activityLog = [];
        this.maxLogEntries = 50;
        this.isProcessing = false;
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.checkSystemHealth();
        this.loadInitialData();
        this.startAutoRefresh();
        this.addLogEntry('Dashboard initialized successfully', 'success');
    }

    setupEventListeners() {
        // Button event listeners
        document.getElementById('processNowBtn')?.addEventListener('click', () => this.processEmailsNow());
        document.getElementById('testApiBtn')?.addEventListener('click', () => this.testApiConnection());
        document.getElementById('refreshBtn')?.addEventListener('click', () => this.refreshData());
        document.getElementById('floatingRefresh')?.addEventListener('click', () => this.refreshData());
        
        // Auto-refresh toggle
        document.getElementById('autoRefresh')?.addEventListener('change', (e) => this.toggleAutoRefresh(e.target.checked));
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => this.handleKeyboardShortcuts(e));
        
        // Visibility change (pause when tab is not active)
        document.addEventListener('visibilitychange', () => this.handleVisibilityChange());
        
        // Window resize
        window.addEventListener('resize', () => this.handleResize());
    }

    async processEmailsNow() {
        if (this.isProcessing) {
            this.addLogEntry('Email processing already in progress', 'warning');
            return;
        }

        const btn = document.getElementById('processNowBtn');
        const originalHTML = btn.innerHTML;
        
        try {
            this.isProcessing = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i>Processing...';
            btn.disabled = true;
            
            this.addLogEntry('Triggering email processing...', 'info');
            
            const response = await fetch('/api/process_now', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                }
            });
            
            const data = await response.json();
            
            if (data.status === 'success') {
                this.addLogEntry(`Processing started: ${data.message || 'Emails being processed'}`, 'success');
                
                // Start polling for updates
                this.pollProcessingStatus();
                
                // Refresh data after a delay
                setTimeout(() => this.refreshData(), 3000);
            } else {
                this.addLogEntry(`Processing failed: ${data.message || 'Unknown error'}`, 'error');
            }
        } catch (error) {
            this.addLogEntry(`Error triggering processing: ${error.message}`, 'error');
            console.error('Process emails error:', error);
        } finally {
            this.isProcessing = false;
            btn.innerHTML = originalHTML;
            btn.disabled = false;
        }
    }

    async testApiConnection() {
        const btn = document.getElementById('testApiBtn');
        const originalHTML = btn.innerHTML;
        
        try {
            btn.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i>Testing...';
            btn.disabled = true;
            
            this.addLogEntry('Testing API connection...', 'info');
            
            const response = await fetch('/api/test_api');
            const data = await response.json();
            
            if (data.status === 'success') {
                this.addLogEntry('API connection test successful', 'success');
                this.updateHealthStatus(data.health_data);
            } else {
                this.addLogEntry(`API test failed: ${data.message}`, 'error');
            }
        } catch (error) {
            this.addLogEntry(`API test error: ${error.message}`, 'error');
            console.error('API test error:', error);
        } finally {
            btn.innerHTML = originalHTML;
            btn.disabled = false;
        }
    }

    async refreshData() {
        try {
            this.addLogEntry('Refreshing dashboard data...', 'info');
            
            // Show loading indicators
            this.showLoadingState();
            
            // Fetch latest data
            const [statsData, documentsData, healthData] = await Promise.all([
                fetch('/api/stats').then(r => r.json()).catch(() => null),
                fetch('/api/recent_documents').then(r => r.json()).catch(() => null),
                fetch('/health').then(r => r.json()).catch(() => null)
            ]);
            
            if (statsData) {
                this.updateStats(statsData);
            }
            
            if (documentsData) {
                this.updateDocuments(documentsData.documents || []);
            }
            
            if (healthData) {
                this.updateHealthStatus(healthData);
            }
            
            this.addLogEntry('Dashboard data refreshed', 'success');
            
        } catch (error) {
            this.addLogEntry(`Refresh failed: ${error.message}`, 'error');
            console.error('Refresh error:', error);
        } finally {
            this.hideLoadingState();
        }
    }

    async checkSystemHealth() {
        try {
            const response = await fetch('/health');
            const data = await response.json();
            this.updateHealthStatus(data);
        } catch (error) {
            this.updateHealthStatus({ 
                status: 'error', 
                error: `Health check failed: ${error.message}`,
                services: { gmail: false, ocr: false, api: false }
            });
        }
    }

    updateHealthStatus(healthData) {
        const container = document.getElementById('healthStatus');
        if (!container) return;
        
        if (healthData.status === 'healthy') {
            container.innerHTML = `
                <div class="text-success text-center mb-3 fade-in">
                    <i class="fas fa-check-circle fa-2x health-icon"></i>
                    <p class="fw-bold">System Healthy</p>
                </div>
                <div class="row small">
                    ${Object.entries(healthData.services || {}).map(([service, status]) => `
                        <div class="col-6 mb-1">${this.capitalizeFirst(service)}:</div>
                        <div class="col-6 mb-1">
                            <span class="badge ${status ? 'bg-success' : 'bg-danger'}">
                                ${status ? 'OK' : 'Error'}
                            </span>
                        </div>
                    `).join('')}
                </div>
                ${healthData.last_check ? `
                    <div class="text-center mt-2">
                        <small class="text-muted">Last check: ${this.formatTime(healthData.last_check)}</small>
                    </div>
                ` : ''}
            `;
        } else {
            container.innerHTML = `
                <div class="text-danger text-center fade-in">
                    <i class="fas fa-exclamation-triangle fa-2x health-icon"></i>
                    <p class="fw-bold">System Issues</p>
                    <small class="text-muted">${healthData.error || 'Unknown error'}</small>
                </div>
            `;
        }
    }

    updateStats(statsData) {
        // Update stat cards with smooth animations
        const statElements = {
            'total_emails': document.querySelector('.stat-card:nth-child(1) .stat-number'),
            'total_documents': document.querySelector('.stat-card:nth-child(2) .stat-number'),
            'successful_uploads': document.querySelector('.stat-card:nth-child(3) .stat-number'),
            'failed_uploads': document.querySelector('.stat-card:nth-child(4) .stat-number')
        };

        Object.entries(statElements).forEach(([key, element]) => {
            if (element && statsData[key] !== undefined) {
                this.animateNumber(element, parseInt(element.textContent) || 0, statsData[key]);
            }
        });
    }

    updateDocuments(documents) {
        // This would update the document list
        // For now, we'll just log it
        this.addLogEntry(`Updated ${documents.length} documents in view`, 'info');
    }

    animateNumber(element, from, to) {
        const duration = 1000;
        const start = Date.now();
        const difference = to - from;

        const step = () => {
            const elapsed = Date.now() - start;
            const progress = Math.min(elapsed / duration, 1);
            const current = Math.floor(from + (difference * this.easeOutCubic(progress)));
            
            element.textContent = current;
            
            if (progress < 1) {
                requestAnimationFrame(step);
            }
        };
        
        requestAnimationFrame(step);
    }

    easeOutCubic(t) {
        return 1 - Math.pow(1 - t, 3);
    }

    startAutoRefresh() {
        const checkbox = document.getElementById('autoRefresh');
        if (checkbox?.checked) {
            this.autoRefreshInterval = setInterval(() => {
                if (!document.hidden) {
                    this.checkSystemHealth();
                    // Optionally refresh other data less frequently
                    if (Math.random() < 0.3) { // 30% chance every 30 seconds
                        this.refreshStats();
                    }
                }
            }, this.refreshRate);
            this.addLogEntry('Auto-refresh enabled', 'info');
        }
    }

    toggleAutoRefresh(enabled) {
        if (enabled) {
            this.startAutoRefresh();
        } else {
            if (this.autoRefreshInterval) {
                clearInterval(this.autoRefreshInterval);
                this.autoRefreshInterval = null;
            }
            this.addLogEntry('Auto-refresh disabled', 'info');
        }
    }

    async refreshStats() {
        try {
            const response = await fetch('/api/stats');
            const data = await response.json();
            this.updateStats(data);
        } catch (error) {
            console.error('Stats refresh error:', error);
        }
    }

    addLogEntry(message, type = 'info') {
        const timestamp = new Date().toLocaleTimeString();
        const logContainer = document.getElementById('activityLog');
        if (!logContainer) return;
        
        const iconMap = {
            'success': 'fas fa-check-circle text-success',
            'error': 'fas fa-exclamation-circle text-danger',
            'warning': 'fas fa-exclamation-triangle text-warning',
            'info': 'fas fa-info-circle text-info'
        };
        
        const icon = iconMap[type] || iconMap['info'];
        
        const logEntry = document.createElement('div');
        logEntry.className = 'mb-2 small fade-in';
        logEntry.innerHTML = `
            <span class="text-muted">${timestamp}</span>
            <i class="${icon} me-1"></i>
            <span>${this.escapeHtml(message)}</span>
        `;
        
        // Add to beginning of log
        logContainer.insertBefore(logEntry, logContainer.firstChild);
        
        // Store in memory
        this.activityLog.unshift({ timestamp, message, type });
        
        // Keep only recent entries
        while (logContainer.children.length > this.maxLogEntries) {
            logContainer.removeChild(logContainer.lastChild);
        }
        
        while (this.activityLog.length > this.maxLogEntries) {
            this.activityLog.pop();
        }
        
        // Auto-scroll if near top
        if (logContainer.scrollTop < 50) {
            logContainer.scrollTop = 0;
        }
    }

    async pollProcessingStatus() {
        let attempts = 0;
        const maxAttempts = 20; // Poll for up to 10 minutes
        
        const poll = async () => {
            if (attempts >= maxAttempts) return;
            
            try {
                const response = await fetch('/api/processing_status');
                const data = await response.json();
                
                if (data.is_processing) {
                    this.addLogEntry(`Processing: ${data.current_task || 'Working...'}`, 'info');
                    attempts++;
                    setTimeout(poll, 30000); // Poll every 30 seconds
                } else {
                    this.addLogEntry('Processing completed', 'success');
                    this.refreshData();
                }
            } catch (error) {
                console.error('Polling error:', error);
                attempts++;
                if (attempts < maxAttempts) {
                    setTimeout(poll, 30000);
                }
            }
        };
        
        setTimeout(poll, 5000); // Start polling after 5 seconds
    }

    showLoadingState() {
        // Add loading indicators to relevant sections
        const sections = ['healthStatus'];
        sections.forEach(id => {
            const element = document.getElementById(id);
            if (element && !element.querySelector('.spinner-border')) {
                const loader = document.createElement('div');
                loader.className = 'text-center';
                loader.innerHTML = '<div class="spinner-border spinner-border-sm text-primary" role="status"></div>';
                element.appendChild(loader);
            }
        });
    }

    hideLoadingState() {
        // Remove loading indicators
        document.querySelectorAll('.spinner-border').forEach(spinner => {
            if (spinner.closest('#healthStatus')) {
                spinner.closest('div').remove();
            }
        });
    }

    handleKeyboardShortcuts(e) {
        // Ctrl/Cmd + R: Refresh
        if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
            e.preventDefault();
            this.refreshData();
        }
        
        // Ctrl/Cmd + P: Process emails
        if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
            e.preventDefault();
            this.processEmailsNow();
        }
        
        // Ctrl/Cmd + T: Test API
        if ((e.ctrlKey || e.metaKey) && e.key === 't') {
            e.preventDefault();
            this.testApiConnection();
        }
    }

    handleVisibilityChange() {
        if (document.hidden) {
            // Page is hidden, pause auto-refresh
            if (this.autoRefreshInterval) {
                clearInterval(this.autoRefreshInterval);
                this.addLogEntry('Auto-refresh paused (tab inactive)', 'info');
            }
        } else {
            // Page is visible, resume auto-refresh
            const checkbox = document.getElementById('autoRefresh');
            if (checkbox?.checked) {
                this.startAutoRefresh();
                this.addLogEntry('Auto-refresh resumed', 'info');
            }
        }
    }

    handleResize() {
        // Handle responsive layout changes if needed
        const width = window.innerWidth;
        if (width < 768) {
            // Mobile view adjustments
            document.body.classList.add('mobile-view');
        } else {
            document.body.classList.remove('mobile-view');
        }
    }

    // Utility functions
    capitalizeFirst(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    formatTime(timestamp) {
        if (!timestamp) return 'Unknown';
        try {
            return new Date(timestamp).toLocaleString();
        } catch {
            return timestamp;
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    loadInitialData() {
        // Load any initial data needed
        this.addLogEntry('Loading initial dashboard data...', 'info');
        setTimeout(() => {
            this.refreshData();
            this.loadUnprocessedDocuments();
        }, 1000);
    }

    async loadUnprocessedDocuments() {
        try {
            const response = await fetch('/api/documents/unprocessed');
            const data = await response.json();

            if (data.status === 'success') {
                this.displayUnprocessedDocuments(data.documents, data.count);
            }
        } catch (error) {
            console.error('Error loading unprocessed documents:', error);
        }
    }

    displayUnprocessedDocuments(documents, count) {
        const container = document.getElementById('unprocessedDocuments');
        const countBadge = document.getElementById('unprocessedCount');

        if (!container) return;

        countBadge.textContent = `${count} pending`;

        if (documents.length === 0) {
            container.innerHTML = `
                <div class="text-center text-muted py-3">
                    <i class="fas fa-check-circle me-2"></i>No pending documents - All caught up!
                </div>
            `;
            return;
        }

        let html = '<div class="list-group">';
        documents.forEach(doc => {
            html += `
                <div class="list-group-item">
                    <div class="d-flex justify-content-between align-items-center">
                        <div>
                            <h6 class="mb-1">${doc.original_filename}</h6>
                            <small class="text-muted">
                                Status: <span class="badge bg-${doc.status === 'Error' ? 'danger' : 'warning'}">${doc.status}</span>
                                ${doc.processing_timestamp ? `| ${new Date(doc.processing_timestamp).toLocaleString()}` : ''}
                            </small>
                            ${doc.error_message ? `<br><small class="text-danger">${doc.error_message}</small>` : ''}
                        </div>
                        <div>
                            <button class="btn btn-sm btn-primary" onclick="processWithLlamaParse('${doc.email_id}')">
                                <i class="fas fa-robot me-1"></i>Process Now
                            </button>
                        </div>
                    </div>
                </div>
            `;
        });
        html += '</div>';

        container.innerHTML = html;
    }
}

// Document modal functions
function viewDocument(emailId) {
    const modal = new bootstrap.Modal(document.getElementById('documentModal'));
    const detailsContainer = document.getElementById('documentDetails');
    
    // Show loading state
    detailsContainer.innerHTML = `
        <div class="text-center">
            <div class="spinner-border text-primary" role="status">
                <span class="visually-hidden">Loading...</span>
            </div>
            <p class="mt-2">Loading document details...</p>
        </div>
    `;
    
    modal.show();
    
    // Fetch document details
    fetch(`/api/document/${emailId}`)
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                displayDocumentDetails(data.document);
            } else {
                detailsContainer.innerHTML = `
                    <div class="alert alert-danger">
                        <i class="fas fa-exclamation-triangle me-2"></i>
                        Failed to load document: ${data.message}
                    </div>
                `;
            }
        })
        .catch(error => {
            detailsContainer.innerHTML = `
                <div class="alert alert-danger">
                    <i class="fas fa-exclamation-triangle me-2"></i>
                    Error loading document: ${error.message}
                </div>
            `;
        });
}

function displayDocumentDetails(doc) {
    const detailsContainer = document.getElementById('documentDetails');
    
    detailsContainer.innerHTML = `
        <div class="row">
            <div class="col-md-6">
                <h6>Document Information</h6>
                <table class="table table-sm">
                    <tr><td><strong>Filename:</strong></td><td>${doc.original_filename || 'Unknown'}</td></tr>
                    <tr><td><strong>Client:</strong></td><td>${doc.client_name || 'Unknown'}</td></tr>
                    <tr><td><strong>Case Number:</strong></td><td>${doc.case_number || 'Unknown'}</td></tr>
                    <tr><td><strong>Processing Time:</strong></td><td>${doc.processing_timestamp || 'Unknown'}</td></tr>
                    <tr><td><strong>Status:</strong></td><td>
                        <span class="badge ${doc.status === 'Uploaded' ? 'bg-success' : doc.status === 'Error' ? 'bg-danger' : 'bg-warning'}">
                            ${doc.status}
                        </span>
                    </td></tr>
                </table>
            </div>
            <div class="col-md-6">
                <h6>Extracted Debts</h6>
                ${doc.debts && doc.debts.length > 0 ? `
                    <div class="list-group list-group-flush">
                        ${doc.debts.map(debt => `
                            <div class="list-group-item">
                                <div class="d-flex justify-content-between">
                                    <strong>£${(debt.amount || 0).toFixed(2)}</strong>
                                    <small class="text-muted">${debt.debt_type || 'Unknown'}</small>
                                </div>
                                <div>${debt.creditor_name || 'Unknown Creditor'}</div>
                                ${debt.account_number ? `<small class="text-muted">Account: ${debt.account_number}</small>` : ''}
                            </div>
                        `).join('')}
                    </div>
                ` : '<p class="text-muted">No debts extracted</p>'}
            </div>
        </div>
        
        ${doc.ocr_text ? `
            <div class="mt-3">
                <h6>OCR Text Preview</h6>
                <div class="border rounded p-3 bg-light" style="max-height: 200px; overflow-y: auto;">
                    <pre class="mb-0 small">${doc.ocr_text.substring(0, 1000)}${doc.ocr_text.length > 1000 ? '...' : ''}</pre>
                </div>
            </div>
        ` : ''}
        
        ${doc.error_message ? `
            <div class="alert alert-danger mt-3">
                <strong>Error:</strong> ${doc.error_message}
            </div>
        ` : ''}
    `;
}

// PDF Viewing Function
function viewPDF(filename) {
    const modal = new bootstrap.Modal(document.getElementById('pdfModal'));
    const pdfViewer = document.getElementById('pdfViewer');
    const downloadBtn = document.getElementById('downloadPdfBtn');
    const modalTitle = document.getElementById('modalDocumentTitle');
    
    // Extract email_id from filename (assuming filename pattern)
    const emailId = filename.replace(/\.[^/.]+$/, ""); // Remove extension for email_id
    
    // Set modal title
    modalTitle.textContent = `Document: ${filename}`;
    
    // Set up download link
    const pdfUrl = `/api/document/${filename}/view`;
    downloadBtn.href = pdfUrl;
    downloadBtn.download = filename;
    
    // Initialize PDF viewer with loading
    pdfViewer.innerHTML = `
        <div class="text-center p-4">
            <div class="spinner-border text-primary" role="status">
                <span class="visually-hidden">Loading PDF...</span>
            </div>
            <p class="mt-2">Loading ${filename}...</p>
        </div>
    `;
    
    // Reset to PDF tab
    const pdfTab = document.getElementById('pdf-tab');
    const dataTab = document.getElementById('data-tab');
    const ocrTab = document.getElementById('ocr-tab');
    
    // Activate PDF tab
    pdfTab.click();
    
    // Show modal
    modal.show();
    
    // Load PDF in iframe
    pdfViewer.innerHTML = `
        <iframe 
            src="${pdfUrl}" 
            width="100%" 
            height="100%" 
            style="border: none;"
            onerror="handlePDFError()"
        ></iframe>
    `;
    
    // Load structured data
    loadDocumentData(emailId, filename);
}

async function loadDocumentData(emailId, filename) {
    try {
        // Show loading states
        document.getElementById('debts-container').innerHTML = `
            <div class="text-center">
                <div class="spinner-border spinner-border-sm text-primary" role="status"></div>
                <span class="ms-2">Loading debt information...</span>
            </div>
        `;
        
        document.getElementById('ocr-text-content').textContent = 'Loading OCR text...';
        document.getElementById('text-stats').textContent = 'Loading...';
        
        // Fetch detailed document data
        const response = await fetch(`/api/document/${emailId}/detailed`);
        const data = await response.json();
        
        if (data.status === 'success') {
            const doc = data.document;
            
            // Populate basic information
            populateBasicInfo(doc.basic_info);
            
            // Populate monetary analysis
            populateMonetaryAnalysis(doc.extracted_data.monetary_analysis);
            
            // Populate debts
            populateDebts(doc.extracted_data.debts, doc.extracted_data.total_debt_amount);
            
            // Populate OCR text
            populateOCRText(doc.ocr_analysis);
            
        } else {
            console.error('Failed to load document data:', data.message);
            showDataError('Failed to load document data: ' + data.message);
        }
        
    } catch (error) {
        console.error('Error loading document data:', error);
        showDataError('Error loading document data: ' + error.message);
    }
}

function populateBasicInfo(basicInfo) {
    document.getElementById('orig-filename').textContent = basicInfo.original_filename || '-';
    document.getElementById('proc-filename').textContent = basicInfo.processed_filename || '-';
    document.getElementById('client-name').textContent = basicInfo.client_name || '-';
    document.getElementById('case-number').textContent = basicInfo.case_number || '-';
    
    if (basicInfo.processing_timestamp) {
        const date = new Date(basicInfo.processing_timestamp);
        document.getElementById('process-time').textContent = date.toLocaleString();
    } else {
        document.getElementById('process-time').textContent = '-';
    }
    
    const statusElement = document.getElementById('doc-status');
    statusElement.textContent = basicInfo.status || '-';
    statusElement.className = `badge ${getStatusBadgeClass(basicInfo.status)}`;
}

function populateMonetaryAnalysis(monetaryData) {
    const summaryElement = document.getElementById('monetary-summary');
    const validationElement = document.getElementById('monetary-validation');
    const issuesElement = document.getElementById('monetary-issues');
    
    // Summary
    summaryElement.innerHTML = `
        <span class="badge bg-info">${monetaryData.count} amounts found</span>
        <span class="ms-2">${monetaryData.summary}</span>
    `;
    
    // Validation status
    const validationClass = monetaryData.validation_status === 'VALID' ? 'success' : 'warning';
    validationElement.innerHTML = `
        <span class="badge bg-${validationClass}">${monetaryData.validation_status}</span>
    `;
    
    // Issues
    if (monetaryData.issues && monetaryData.issues.length > 0) {
        issuesElement.innerHTML = `
            <div class="alert alert-warning alert-sm">
                <small><strong>Issues found:</strong></small>
                <ul class="mb-0 mt-1">
                    ${monetaryData.issues.map(issue => `<li><small>${issue}</small></li>`).join('')}
                </ul>
            </div>
        `;
    } else {
        issuesElement.innerHTML = '<small class="text-muted">No issues detected</small>';
    }
}

function populateDebts(debts, totalAmount) {
    const container = document.getElementById('debts-container');
    
    if (!debts || debts.length === 0) {
        container.innerHTML = `
            <div class="alert alert-info">
                <i class="fas fa-info-circle me-2"></i>
                No debts were extracted from this document.
            </div>
        `;
        return;
    }
    
    let html = `
        <div class="row mb-3">
            <div class="col-md-6">
                <span class="badge bg-primary">${debts.length} debt(s) found</span>
            </div>
            <div class="col-md-6 text-end">
                <strong>Total: £${totalAmount.toFixed(2)}</strong>
            </div>
        </div>
    `;
    
    debts.forEach((debt, index) => {
        html += `
            <div class="card mb-2">
                <div class="card-body py-2">
                    <div class="row">
                        <div class="col-md-2">
                            <small class="text-muted">Debt ${index + 1}</small>
                        </div>
                        <div class="col-md-3">
                            <strong>£${parseFloat(debt.amount || 0).toFixed(2)}</strong>
                        </div>
                        <div class="col-md-4">
                            <small>${debt.description || 'No description'}</small>
                        </div>
                        <div class="col-md-3">
                            <span class="badge bg-secondary">${debt.type || 'Unknown'}</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

function populateOCRText(ocrData) {
    const textContent = document.getElementById('ocr-text-content');
    const textStats = document.getElementById('text-stats');
    
    // Update stats
    textStats.textContent = `${ocrData.word_count} words, ${ocrData.line_count} lines`;
    
    // Update text content
    if (ocrData.full_text) {
        textContent.textContent = ocrData.full_text;
    } else {
        textContent.innerHTML = `
            <div class="text-center text-muted">
                <i class="fas fa-exclamation-triangle me-2"></i>
                No OCR text available for this document
            </div>
        `;
    }
}

function getStatusBadgeClass(status) {
    switch (status?.toLowerCase()) {
        case 'processed': return 'bg-success';
        case 'processing': return 'bg-warning';
        case 'failed': return 'bg-danger';
        case 'error': return 'bg-danger';
        default: return 'bg-secondary';
    }
}

function showDataError(message) {
    const containers = ['debts-container', 'ocr-text-content'];
    containers.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.innerHTML = `
                <div class="alert alert-danger">
                    <i class="fas fa-exclamation-triangle me-2"></i>
                    ${message}
                </div>
            `;
        }
    });
}

function handlePDFError() {
    const pdfViewer = document.getElementById('pdfViewer');
    pdfViewer.innerHTML = `
        <div class="text-center p-4">
            <div class="alert alert-warning">
                <i class="fas fa-exclamation-triangle"></i>
                <h5>PDF Preview Not Available</h5>
                <p>Unable to display PDF in browser. You can still download the file.</p>
                <a href="${document.getElementById('downloadPdfBtn').href}" class="btn btn-primary" download>
                    <i class="fas fa-download"></i> Download PDF
                </a>
            </div>
        </div>
    `;
}

// Enhanced Document Viewer Function
function viewDocumentEnhanced(emailId) {
    const modal = new bootstrap.Modal(document.getElementById('pdfModal'));
    const modalTitle = document.querySelector('#pdfModal .modal-title');
    const downloadRmaBtn = document.getElementById('downloadRmaBtn');
    
    // Set current email ID for downloads
    window.currentEmailId = emailId;
    
    // Update modal title
    modalTitle.textContent = 'Document Analysis & Viewer';
    
    // Update download button onclick
    downloadRmaBtn.onclick = () => downloadCustomFilename(emailId);
    
    // Set up document version toggle listeners
    document.getElementById('viewProcessed').addEventListener('change', function() {
        if (this.checked) {
            switchDocumentView('processed');
        }
    });
    
    document.getElementById('viewOriginal').addEventListener('change', function() {
        if (this.checked) {
            switchDocumentView('original');
        }
    });
    
    // Show modal first
    modal.show();
    
    // Load document details
    loadDocumentDetails(emailId);
}

// Custom Download Function
function downloadCustomFilename(emailId) {
    if (!emailId && window.currentEmailId) {
        emailId = window.currentEmailId;
    }
    
    if (!emailId) {
        console.error('No email ID provided for download');
        return;
    }
    
    // Show loading state
    const downloadBtn = document.getElementById('downloadRmaBtn');
    const originalText = downloadBtn.innerHTML;
    downloadBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i>Generating...';
    downloadBtn.disabled = true;
    
    // Create a temporary link to trigger download
    const downloadUrl = `/api/document/${emailId}/download`;
    
    // Create temporary anchor and trigger download
    const tempLink = document.createElement('a');
    tempLink.href = downloadUrl;
    tempLink.style.display = 'none';
    document.body.appendChild(tempLink);
    tempLink.click();
    document.body.removeChild(tempLink);
    
    // Reset button state
    setTimeout(() => {
        downloadBtn.innerHTML = originalText;
        downloadBtn.disabled = false;
    }, 2000);
    
    // Log the download
    console.log(`Downloaded document with custom filename for email ID: ${emailId}`);
}

// Download Original Document with Custom Filename
function downloadOriginalCustomFilename(emailId) {
    if (!emailId && window.currentEmailId) {
        emailId = window.currentEmailId;
    }
    
    if (!emailId) {
        console.error('No email ID provided for original download');
        return;
    }
    
    // Show loading state
    const downloadBtn = document.getElementById('downloadOriginalRmaBtn');
    const originalText = downloadBtn.innerHTML;
    downloadBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i>Generating...';
    downloadBtn.disabled = true;
    
    // Create a temporary link to trigger download
    const downloadUrl = `/api/document/${emailId}/download-original`;
    
    // Create temporary anchor and trigger download
    const tempLink = document.createElement('a');
    tempLink.href = downloadUrl;
    tempLink.style.display = 'none';
    document.body.appendChild(tempLink);
    tempLink.click();
    document.body.removeChild(tempLink);
    
    // Reset button state
    setTimeout(() => {
        downloadBtn.innerHTML = originalText;
        downloadBtn.disabled = false;
    }, 2000);
    
    // Log the download
    console.log(`Downloaded original document with custom filename for email ID: ${emailId}`);
}

// Switch between original and processed document view
function switchDocumentView(viewType) {
    const viewer = document.getElementById('documentViewer');
    const label = document.getElementById('currentViewLabel');
    
    if (!window.currentDocumentData) {
        console.error('No document data available');
        return;
    }
    
    const doc = window.currentDocumentData;
    
    if (viewType === 'original') {
        label.textContent = 'Original Version';
        label.className = 'badge bg-secondary';
        
        if (doc.basic_info.original_filepath) {
            const originalUrl = `/api/document/${doc.basic_info.original_filepath}/view-original`;
            viewer.innerHTML = `
                <iframe 
                    src="${originalUrl}" 
                    width="100%" 
                    height="100%" 
                    style="border: none; min-height: 600px;"
                    onerror="handlePDFViewerError()"
                ></iframe>
            `;
        } else {
            viewer.innerHTML = `
                <div class="alert alert-warning text-center">
                    <i class="fas fa-file-pdf fa-3x mb-3"></i>
                    <h5>Original Document Not Available</h5>
                    <p>The original document file is not available for viewing.</p>
                </div>
            `;
        }
    } else {
        label.textContent = 'Processed Version';
        label.className = 'badge bg-primary';
        
        if (doc.basic_info.processed_filename) {
            const processedUrl = `/api/document/${doc.basic_info.processed_filename}/view`;
            viewer.innerHTML = `
                <iframe 
                    src="${processedUrl}" 
                    width="100%" 
                    height="100%" 
                    style="border: none; min-height: 600px;"
                    onerror="handlePDFViewerError()"
                ></iframe>
            `;
        } else {
            viewer.innerHTML = `
                <div class="alert alert-warning text-center">
                    <i class="fas fa-file-pdf fa-3x mb-3"></i>
                    <h5>Processed Document Not Available</h5>
                    <p>The processed document file is not available for viewing.</p>
                </div>
            `;
        }
    }
}

// Enhanced document details loader
async function loadDocumentDetails(emailId) {
    try {
        // Show loading in all tabs
        document.getElementById('documentViewer').innerHTML = `
            <div class="text-center p-4">
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">Loading document...</span>
                </div>
                <p class="mt-2">Loading document viewer...</p>
            </div>
        `;
        
        document.getElementById('extracted-data-content').innerHTML = `
            <div class="text-center p-4">
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">Loading extracted data...</span>
                </div>
                <p class="mt-2">Analyzing document data...</p>
            </div>
        `;
        
        document.getElementById('ocr-text-content').textContent = 'Loading OCR text...';
        
        // Fetch detailed document information
        const response = await fetch(`/api/document/${emailId}/detailed`);
        const data = await response.json();
        
        if (data.status === 'success') {
            const doc = data.document;
            
            // Store document data globally for view switching and advisor overrides
            window.currentDocumentData = doc;
            currentDocumentId = emailId;
            currentDocumentData = doc;
            
            // Update PDF viewer with processed version by default
            switchDocumentView('processed');
            
            // Update extracted data tab
            updateExtractedDataTab(doc);

            // Update AI analysis section
            updateAIAnalysisTab(doc);

            // Update OCR text tab
            updateOCRTextTab(doc);

            // Update download links
            updateDownloadLinks(doc);

            // Handle advisor override display
            updateAdvisorOverrideDisplay(doc);
            
        } else {
            throw new Error(data.message || 'Failed to load document details');
        }
        
    } catch (error) {
        console.error('Error loading document details:', error);
        
        // Show error in all tabs
        const errorHtml = `
            <div class="alert alert-danger">
                <i class="fas fa-exclamation-triangle"></i>
                <strong>Error loading document:</strong> ${error.message}
            </div>
        `;
        
        document.getElementById('documentViewer').innerHTML = errorHtml;
        document.getElementById('extracted-data-content').innerHTML = errorHtml;
        document.getElementById('ocr-text-content').textContent = `Error: ${error.message}`;
    }
}

function updateExtractedDataTab(doc) {
    // Update basic info
    document.getElementById('orig-filename').textContent = doc.basic_info.original_filename || 'N/A';
    document.getElementById('proc-filename').textContent = doc.basic_info.processed_filename || 'N/A';
    document.getElementById('client-name').textContent = doc.basic_info.client_name || 'Unknown';
    document.getElementById('case-number').textContent = doc.basic_info.case_number || 'N/A';
    document.getElementById('process-time').textContent = doc.basic_info.processing_timestamp ?
        new Date(doc.basic_info.processing_timestamp).toLocaleString() : 'N/A';
    document.getElementById('doc-status').textContent = doc.basic_info.status || 'Unknown';
    
    // Update confidence if available
    if (doc.processing_info && doc.processing_info.confidence !== undefined) {
        const confidence = Math.round(doc.processing_info.confidence * 100);
        document.getElementById('doc-confidence').textContent = `${confidence}%`;
        
        // Update confidence bar
        const confidenceBar = document.querySelector('.confidence-fill');
        if (confidenceBar) {
            confidenceBar.style.width = `${confidence}%`;
            confidenceBar.className = `confidence-fill ${confidence > 70 ? 'confidence-high' : confidence > 40 ? 'confidence-medium' : 'confidence-low'}`;
        }
    }
    
    // Update monetary info
    const monetaryContainer = document.getElementById('monetary-info');
    if (doc.monetary_analysis && doc.monetary_analysis.amounts.length > 0) {
        let monetaryHtml = '';
        doc.monetary_analysis.amounts.forEach(amount => {
            monetaryHtml += `
                <div class="d-flex justify-content-between border-bottom py-2">
                    <span>£${amount.amount.toFixed(2)}</span>
                    <small class="text-muted">"${amount.original_text}"</small>
                </div>
            `;
        });
        
        if (doc.monetary_analysis.validation_status !== 'VALID') {
            monetaryHtml += `
                <div class="alert alert-warning mt-2">
                    <small><strong>Validation Issues:</strong> ${doc.monetary_analysis.issues.join(', ')}</small>
                </div>
            `;
        }
        
        monetaryContainer.innerHTML = monetaryHtml;
    } else {
        monetaryContainer.innerHTML = '<p class="text-muted">No monetary amounts detected</p>';
    }
    
    // Update debts
    const debtsContainer = document.getElementById('debts-container');
    if (doc.basic_info.debts && doc.basic_info.debts.length > 0) {
        let debtsHtml = '';
        doc.basic_info.debts.forEach(debt => {
            debtsHtml += `
                <div class="card mb-2">
                    <div class="card-body p-3">
                        <div class="d-flex justify-content-between">
                            <strong>£${debt.amount ? debt.amount.toFixed(2) : '0.00'}</strong>
                            <span class="badge bg-primary">${debt.creditor_name || 'Unknown'}</span>
                        </div>
                        ${debt.account_number ? `<small class="text-muted">Account: ${debt.account_number}</small>` : ''}
                        ${debt.reference ? `<br><small class="text-muted">Ref: ${debt.reference}</small>` : ''}
                    </div>
                </div>
            `;
        });
        debtsContainer.innerHTML = debtsHtml;
    } else {
        debtsContainer.innerHTML = '<p class="text-muted">No debts extracted</p>';
    }
}

function updateAIAnalysisTab(doc) {
    // Check if AI extracted info is available
    const aiInfo = doc.ai_extracted_info;

    if (!aiInfo) {
        // Show no AI data available message
        const sections = ['ai-extraction-method', 'ai-client-name', 'ai-file-summary', 'ai-document-type',
                         'ai-document-date', 'ai-urgency-level', 'ai-debt-type', 'ai-debt-amount',
                         'ai-creditor-name', 'ai-account-reference', 'ai-additional-references'];

        sections.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = 'N/A';
            }
        });

        document.getElementById('ai-extraction-method').textContent = 'No AI Analysis';
        document.getElementById('ai-extraction-method').className = 'badge bg-warning';
        document.getElementById('ai-quality-indicator').textContent = 'AI Analysis Not Available';
        document.getElementById('ai-quality-indicator').className = 'badge bg-warning';
        return;
    }

    // Update extraction method indicator
    const extractionMethod = aiInfo.extraction_method || 'unknown';
    const methodElement = document.getElementById('ai-extraction-method');
    methodElement.textContent = extractionMethod === 'ollama_ai' ? 'AI Enhanced' :
                               extractionMethod === 'regex_fallback' ? 'Regex Fallback' : 'Unknown';
    methodElement.className = extractionMethod === 'ollama_ai' ? 'badge bg-success' :
                             extractionMethod === 'regex_fallback' ? 'badge bg-warning' : 'badge bg-danger';

    // Update client information
    document.getElementById('ai-client-name').textContent = aiInfo.client_name || 'Unknown';
    document.getElementById('ai-file-summary').textContent = aiInfo.file_summary || 'No summary';
    document.getElementById('ai-document-type').textContent = aiInfo.document_type || 'Unknown';
    document.getElementById('ai-document-date').textContent = aiInfo.document_date || 'Unknown';

    // Update urgency level with appropriate styling
    const urgencyElement = document.getElementById('ai-urgency-level');
    const urgencyLevel = aiInfo.urgency_level || 'normal';
    urgencyElement.textContent = urgencyLevel.charAt(0).toUpperCase() + urgencyLevel.slice(1);
    urgencyElement.className = urgencyLevel === 'high' || urgencyLevel === 'urgent' ? 'badge bg-danger' :
                               urgencyLevel === 'normal' ? 'badge bg-primary' : 'badge bg-secondary';

    // Update debt information
    const debtTypeElement = document.getElementById('ai-debt-type');
    const debtType = aiInfo.debt_type || 'unknown';
    debtTypeElement.textContent = debtType.charAt(0).toUpperCase() + debtType.slice(1);
    debtTypeElement.className = debtType === 'priority' ? 'badge bg-danger' :
                               debtType === 'non-priority' ? 'badge bg-warning' : 'badge bg-secondary';

    // Format debt amount
    const debtAmount = parseFloat(aiInfo.debt_amount) || 0;
    document.getElementById('ai-debt-amount').innerHTML = debtAmount > 0 ?
        `<strong>£${debtAmount.toFixed(2)}</strong>` : 'Not specified';

    document.getElementById('ai-creditor-name').textContent = aiInfo.creditor_name || 'Unknown';
    document.getElementById('ai-account-reference').textContent = aiInfo.account_reference || 'Not found';

    // Update additional references
    const referencesContainer = document.getElementById('ai-additional-references');
    if (aiInfo.additional_references && aiInfo.additional_references.length > 0) {
        let referencesHtml = '';
        aiInfo.additional_references.forEach(ref => {
            referencesHtml += `<span class="badge bg-light text-dark me-1 mb-1">${ref}</span><br>`;
        });
        referencesContainer.innerHTML = referencesHtml;
    } else {
        referencesContainer.innerHTML = '<span class="text-muted">No references found</span>';
    }

    // Update quality indicator
    const qualityElement = document.getElementById('ai-quality-indicator');
    if (extractionMethod === 'ollama_ai') {
        qualityElement.textContent = 'AI Analysis Complete';
        qualityElement.className = 'badge bg-success';
    } else if (extractionMethod === 'regex_fallback') {
        qualityElement.textContent = 'Fallback Analysis';
        qualityElement.className = 'badge bg-warning';
    } else if (aiInfo.error) {
        qualityElement.textContent = 'Analysis Failed';
        qualityElement.className = 'badge bg-danger';
    } else {
        qualityElement.textContent = 'Analysis Unknown';
        qualityElement.className = 'badge bg-secondary';
    }

    // Add timestamp if available
    if (aiInfo.extraction_timestamp) {
        const timestamp = new Date(aiInfo.extraction_timestamp).toLocaleString();
        qualityElement.title = `Analyzed on: ${timestamp}`;
    }
}

function updateOCRTextTab(doc) {
    const textContent = document.getElementById('ocr-text-content');
    const textStats = document.getElementById('text-stats');
    
    if (doc.basic_info.extracted_text) {
        textContent.textContent = doc.basic_info.extracted_text;
        
        // Update stats
        const charCount = doc.basic_info.extracted_text.length;
        const wordCount = doc.basic_info.extracted_text.split(/\s+/).length;
        textStats.textContent = `${charCount} chars, ${wordCount} words`;
    } else {
        textContent.textContent = 'No OCR text available';
        textStats.textContent = 'No data';
    }
}

function updateDownloadLinks(doc) {
    const originalDownloadBtn = document.getElementById('downloadPdfBtn');
    if (originalDownloadBtn && doc.basic_info.processed_filename) {
        const pdfUrl = `/api/document/${doc.basic_info.processed_filename}/view`;
        originalDownloadBtn.href = pdfUrl;
        originalDownloadBtn.download = doc.basic_info.processed_filename;
    }
}

function handlePDFViewerError() {
    const viewer = document.getElementById('documentViewer');
    viewer.innerHTML = `
        <div class="text-center p-4">
            <div class="alert alert-warning">
                <i class="fas fa-exclamation-triangle fa-2x mb-3"></i>
                <h5>PDF Preview Not Available</h5>
                <p>Unable to display PDF in browser. You can still download the file using the buttons below.</p>
            </div>
        </div>
    `;
}

function updateAdvisorOverrideDisplay(doc) {
    const editBtn = document.getElementById('advisorEditBtn');
    const overrideNotice = document.getElementById('advisorOverrideNotice');
    const overrideDetails = document.getElementById('overrideDetails');
    
    // Show the advisor edit button if there are debts to edit
    if (doc.extracted_data && doc.extracted_data.debts && doc.extracted_data.debts.length > 0) {
        editBtn.style.display = 'inline-block';
    } else {
        editBtn.style.display = 'none';
    }
    
    // Check if there's an advisor override
    if (doc.advisor_override && doc.advisor_override.has_override) {
        const override = doc.advisor_override;
        overrideNotice.style.display = 'block';
        
        const overrideDate = new Date(override.override_date).toLocaleString();
        const originalTotal = override.original_debt_total.toFixed(2);
        const correctedTotal = override.corrected_debt_total.toFixed(2);
        
        overrideDetails.innerHTML = `
            <div class="row">
                <div class="col-md-6">
                    <strong>Advisor:</strong> ${override.advisor_name}<br>
                    <strong>Date:</strong> ${overrideDate}
                </div>
                <div class="col-md-6">
                    <strong>Original Total:</strong> £${originalTotal}<br>
                    <strong>Corrected Total:</strong> £${correctedTotal}
                </div>
            </div>
            ${override.notes ? `<div class="mt-2"><strong>Notes:</strong> <em>${override.notes}</em></div>` : ''}
        `;
        
        // Update button text to show override exists
        editBtn.innerHTML = '<i class="fas fa-edit me-1"></i>Modify Override';
    } else {
        overrideNotice.style.display = 'none';
        editBtn.innerHTML = '<i class="fas fa-edit me-1"></i>Advisor Override';
    }
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    window.ocrDashboard = new OCRDashboard();
});

// Advisor Override Functions
let currentDocumentId = null;
let currentDocumentData = null;

function toggleAdvisorMode() {
    const editForm = document.getElementById('advisorEditForm');
    const editBtn = document.getElementById('advisorEditBtn');
    
    if (editForm.style.display === 'none') {
        // Show edit form
        editForm.style.display = 'block';
        editBtn.innerHTML = '<i class="fas fa-times me-1"></i>Cancel Edit';
        editBtn.classList.remove('btn-outline-warning');
        editBtn.classList.add('btn-outline-danger');
        
        // Populate the edit form with current debts
        populateAdvisorEditForm();
    } else {
        // Hide edit form
        cancelAdvisorEdit();
    }
}

function cancelAdvisorEdit() {
    const editForm = document.getElementById('advisorEditForm');
    const editBtn = document.getElementById('advisorEditBtn');
    
    editForm.style.display = 'none';
    editBtn.innerHTML = '<i class="fas fa-edit me-1"></i>Advisor Override';
    editBtn.classList.remove('btn-outline-danger');
    editBtn.classList.add('btn-outline-warning');
    
    // Clear form
    document.getElementById('advisorName').value = '';
    document.getElementById('advisorNotes').value = '';
}

function populateAdvisorEditForm() {
    const container = document.getElementById('advisorDebtsContainer');
    if (!currentDocumentData || !currentDocumentData.extracted_data.debts) {
        container.innerHTML = '<p class="text-muted">No debts found to edit</p>';
        return;
    }
    
    let html = '<h6 class="mb-3">Edit Detected Debts:</h6>';
    
    currentDocumentData.extracted_data.debts.forEach((debt, index) => {
        html += `
            <div class="row mb-2 debt-edit-row" data-debt-index="${index}">
                <div class="col-md-4">
                    <label class="form-label">Creditor</label>
                    <input type="text" class="form-control" 
                           value="${debt.creditor_name || ''}" 
                           data-field="creditor_name" readonly>
                </div>
                <div class="col-md-3">
                    <label class="form-label">Original Amount</label>
                    <div class="input-group">
                        <span class="input-group-text">£</span>
                        <input type="text" class="form-control" 
                               value="${debt.amount || '0.00'}" 
                               data-field="original_amount" readonly>
                    </div>
                </div>
                <div class="col-md-3">
                    <label class="form-label">Corrected Amount</label>
                    <div class="input-group">
                        <span class="input-group-text">£</span>
                        <input type="number" step="0.01" min="0" class="form-control" 
                               value="${debt.amount || '0.00'}" 
                               data-field="corrected_amount" 
                               placeholder="Enter correct amount">
                    </div>
                </div>
                <div class="col-md-2 d-flex align-items-end">
                    <button type="button" class="btn btn-sm btn-outline-danger" 
                            onclick="removeDebtRow(${index})">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
    });
    
    html += `
        <div class="mt-3">
            <button type="button" class="btn btn-sm btn-outline-primary" onclick="addNewDebtRow()">
                <i class="fas fa-plus me-1"></i>Add New Debt
            </button>
        </div>
    `;
    
    container.innerHTML = html;
}

function removeDebtRow(index) {
    const row = document.querySelector(`[data-debt-index="${index}"]`);
    if (row) {
        row.remove();
    }
}

function addNewDebtRow() {
    const container = document.getElementById('advisorDebtsContainer');
    const existingRows = container.querySelectorAll('.debt-edit-row');
    const newIndex = existingRows.length;
    
    const newRowHtml = `
        <div class="row mb-2 debt-edit-row" data-debt-index="${newIndex}">
            <div class="col-md-4">
                <label class="form-label">Creditor</label>
                <input type="text" class="form-control" 
                       value="" 
                       data-field="creditor_name" 
                       placeholder="Enter creditor name">
            </div>
            <div class="col-md-3">
                <label class="form-label">Original Amount</label>
                <div class="input-group">
                    <span class="input-group-text">£</span>
                    <input type="text" class="form-control" 
                           value="0.00" 
                           data-field="original_amount" readonly>
                </div>
            </div>
            <div class="col-md-3">
                <label class="form-label">Corrected Amount</label>
                <div class="input-group">
                    <span class="input-group-text">£</span>
                    <input type="number" step="0.01" min="0" class="form-control" 
                           value="0.00" 
                           data-field="corrected_amount" 
                           placeholder="Enter amount">
                </div>
            </div>
            <div class="col-md-2 d-flex align-items-end">
                <button type="button" class="btn btn-sm btn-outline-danger" 
                        onclick="removeDebtRow(${newIndex})">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
    `;
    
    // Insert before the "Add New Debt" button
    const addButton = container.querySelector('.mt-3');
    addButton.insertAdjacentHTML('beforebegin', newRowHtml);
}

async function saveAdvisorOverride() {
    const advisorName = document.getElementById('advisorName').value.trim();
    if (!advisorName) {
        alert('Please enter your name as the advisor');
        return;
    }
    
    const advisorNotes = document.getElementById('advisorNotes').value.trim();
    
    // Collect debt corrections
    const debtRows = document.querySelectorAll('.debt-edit-row');
    const originalDebts = currentDocumentData.extracted_data.debts || [];
    const debtCorrections = [];
    let originalTotal = 0;
    let correctedTotal = 0;
    
    debtRows.forEach((row, index) => {
        const creditorInput = row.querySelector('[data-field="creditor_name"]');
        const originalAmountInput = row.querySelector('[data-field="original_amount"]');
        const correctedAmountInput = row.querySelector('[data-field="corrected_amount"]');
        
        const creditorName = creditorInput.value.trim();
        const originalAmount = parseFloat(originalAmountInput.value) || 0;
        const correctedAmount = parseFloat(correctedAmountInput.value) || 0;
        
        if (creditorName && correctedAmount > 0) {
            debtCorrections.push({
                creditor_name: creditorName,
                original_amount: originalAmount,
                corrected_amount: correctedAmount,
                account_number: (originalDebts[index] && originalDebts[index].account_number) || null
            });
            
            originalTotal += originalAmount;
            correctedTotal += correctedAmount;
        }
    });
    
    if (debtCorrections.length === 0) {
        alert('Please add at least one debt with a corrected amount');
        return;
    }
    
    const overrideData = {
        email_id: currentDocumentId,
        advisor_name: advisorName,
        original_debt_total: originalTotal,
        corrected_debt_total: correctedTotal,
        debt_corrections: debtCorrections,
        notes: advisorNotes
    };
    
    try {
        const response = await fetch('/api/advisor/save_override', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(overrideData)
        });
        
        const result = await response.json();
        
        if (result.status === 'success') {
            alert('Advisor override saved successfully!');
            cancelAdvisorEdit();
            // Refresh the document data to show the override
            viewDocumentEnhanced(currentDocumentId);
        } else {
            alert('Error saving override: ' + result.message);
        }
    } catch (error) {
        console.error('Error saving advisor override:', error);
        alert('Error saving override. Please try again.');
    }
}

async function viewOverrideHistory() {
    if (!currentDocumentId) {
        alert('No document selected');
        return;
    }
    
    try {
        const response = await fetch(`/api/advisor/override_history/${currentDocumentId}`);
        const result = await response.json();
        
        if (result.status === 'success' && result.overrides.length > 0) {
            let historyHtml = '<h6>Override History:</h6>';
            result.overrides.forEach(override => {
                historyHtml += `
                    <div class="border rounded p-2 mb-2">
                        <strong>${override.advisor_name}</strong> - ${new Date(override.override_timestamp).toLocaleString()}
                        <br><small>Original: £${override.original_debt_total.toFixed(2)} → Corrected: £${override.corrected_debt_total.toFixed(2)}</small>
                        ${override.notes ? `<br><small><em>${override.notes}</em></small>` : ''}
                    </div>
                `;
            });
            
            // Show in a simple alert for now (could be enhanced with a modal)
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = historyHtml;
            alert(tempDiv.textContent || tempDiv.innerText);
        } else {
            alert('No override history found for this document');
        }
    } catch (error) {
        console.error('Error fetching override history:', error);
        alert('Error fetching override history');
    }
}

// LlamaParse and JSON viewing functions
async function processWithLlamaParse(emailId) {
    try {
        // Show loading indicator
        const button = event.target;
        const originalText = button.innerHTML;
        button.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i>Processing...';
        button.disabled = true;

        const response = await fetch(`/api/document/${emailId}/llamaparse`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        const result = await response.json();

        if (result.status === 'success') {
            alert('Document processed with LlamaParse successfully!');
            // Refresh document view to show new data
            loadDocumentData(emailId);
        } else {
            alert('Error processing with LlamaParse: ' + result.message);
        }

        button.innerHTML = originalText;
        button.disabled = false;

    } catch (error) {
        console.error('Error processing with LlamaParse:', error);
        alert('Error processing document with LlamaParse');
    }
}

async function viewOriginalDocument(emailId, filename) {
    try {
        // Open original document in new tab
        const url = `/api/document/${filename}/view-original`;
        window.open(url, '_blank');
    } catch (error) {
        console.error('Error viewing original document:', error);
        alert('Error viewing original document');
    }
}

async function viewDocumentJSON(emailId) {
    try {
        const response = await fetch(`/api/document/${emailId}/json`);
        const result = await response.json();

        if (result.status === 'success') {
            // Create and show JSON modal
            showJSONModal(result.data, result.extraction_method);
        } else {
            alert('Error loading document JSON: ' + result.message);
        }
    } catch (error) {
        console.error('Error loading document JSON:', error);
        alert('Error loading document JSON');
    }
}

function showJSONModal(jsonData, extractionMethod) {
    // Create modal HTML
    const modalHTML = `
        <div class="modal fade" id="jsonModal" tabindex="-1" aria-labelledby="jsonModalLabel" aria-hidden="true">
            <div class="modal-dialog modal-lg modal-dialog-scrollable">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title" id="jsonModalLabel">
                            <i class="fas fa-code me-2"></i>Extracted JSON Data
                            <span class="badge bg-info ms-2">${extractionMethod}</span>
                        </h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body">
                        <div class="d-flex justify-content-end mb-2">
                            <button class="btn btn-sm btn-outline-primary" onclick="copyJSONToClipboard()">
                                <i class="fas fa-copy me-1"></i>Copy JSON
                            </button>
                            <button class="btn btn-sm btn-outline-success ms-2" onclick="downloadJSON()">
                                <i class="fas fa-download me-1"></i>Download JSON
                            </button>
                        </div>
                        <pre id="jsonContent" class="bg-light p-3 rounded" style="max-height: 600px; overflow-y: auto;"><code>${JSON.stringify(jsonData, null, 2)}</code></pre>

                        <div class="mt-3">
                            <h6>Key Fields:</h6>
                            <table class="table table-sm table-bordered">
                                <tbody>
                                    <tr>
                                        <td><strong>Client Name:</strong></td>
                                        <td>${jsonData.client_name || 'N/A'}</td>
                                    </tr>
                                    <tr>
                                        <td><strong>Document Date:</strong></td>
                                        <td>${jsonData.document_date || 'N/A'}</td>
                                    </tr>
                                    <tr>
                                        <td><strong>Document URI:</strong></td>
                                        <td><small>${jsonData.document_uri || 'N/A'}</small></td>
                                    </tr>
                                    <tr>
                                        <td><strong>Total Financial Value:</strong></td>
                                        <td>${jsonData.financial_values?.total_amount || 'N/A'} ${jsonData.financial_values?.currency || ''}</td>
                                    </tr>
                                    <tr>
                                        <td><strong>Contact Numbers:</strong></td>
                                        <td>${jsonData.contact_info?.phone_numbers?.join(', ') || 'None'}</td>
                                    </tr>
                                    <tr>
                                        <td><strong>Email Addresses:</strong></td>
                                        <td>${jsonData.contact_info?.email_addresses?.join(', ') || 'None'}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Remove existing modal if present
    const existingModal = document.getElementById('jsonModal');
    if (existingModal) {
        existingModal.remove();
    }

    // Add modal to body
    document.body.insertAdjacentHTML('beforeend', modalHTML);

    // Store JSON data for copy/download functions
    window.currentJSONData = jsonData;

    // Show modal
    const modal = new bootstrap.Modal(document.getElementById('jsonModal'));
    modal.show();
}

function copyJSONToClipboard() {
    const jsonText = JSON.stringify(window.currentJSONData, null, 2);
    navigator.clipboard.writeText(jsonText).then(() => {
        alert('JSON copied to clipboard!');
    }).catch(err => {
        console.error('Error copying to clipboard:', err);
        alert('Error copying to clipboard');
    });
}

function downloadJSON() {
    const jsonText = JSON.stringify(window.currentJSONData, null, 2);
    const blob = new Blob([jsonText], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `document_${window.currentJSONData.client_name || 'data'}_${new Date().toISOString()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

async function viewDocumentMarkdown(emailId) {
    try {
        const response = await fetch(`/api/document/${emailId}/markdown`);
        const result = await response.json();

        if (result.status === 'success') {
            showMarkdownModal(result.markdown, result.extraction_method);
        } else {
            alert('Error loading markdown: ' + result.message);
        }
    } catch (error) {
        console.error('Error loading markdown:', error);
        alert('Error loading markdown');
    }
}

function showMarkdownModal(markdown, extractionMethod) {
    const modalHTML = `
        <div class="modal fade" id="markdownModal" tabindex="-1" aria-labelledby="markdownModalLabel" aria-hidden="true">
            <div class="modal-dialog modal-xl modal-dialog-scrollable">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title" id="markdownModalLabel">
                            <i class="fas fa-file-alt me-2"></i>Document Markdown
                            <span class="badge bg-info ms-2">${extractionMethod}</span>
                        </h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body">
                        <div class="d-flex justify-content-end mb-2">
                            <button class="btn btn-sm btn-outline-primary" onclick="copyMarkdownToClipboard()">
                                <i class="fas fa-copy me-1"></i>Copy Markdown
                            </button>
                        </div>
                        <pre class="bg-light p-3 rounded" style="max-height: 600px; overflow-y: auto; white-space: pre-wrap;">${markdown}</pre>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                    </div>
                </div>
            </div>
        </div>
    `;

    const existingModal = document.getElementById('markdownModal');
    if (existingModal) {
        existingModal.remove();
    }

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    window.currentMarkdown = markdown;

    const modal = new bootstrap.Modal(document.getElementById('markdownModal'));
    modal.show();
}

function copyMarkdownToClipboard() {
    navigator.clipboard.writeText(window.currentMarkdown).then(() => {
        alert('Markdown copied to clipboard!');
    }).catch(err => {
        console.error('Error copying to clipboard:', err);
        alert('Error copying to clipboard');
    });
}

// Error reporting and correction functions
async function reportErrors(emailId) {
    try {
        // First, load the document data
        const response = await fetch(`/api/document/${emailId}/json`);
        const result = await response.json();

        if (result.status === 'success') {
            showCorrectionModal(emailId, result.data, result.extraction_method);
        } else {
            alert('Error loading document data: ' + result.message);
        }
    } catch (error) {
        console.error('Error loading document for correction:', error);
        alert('Error loading document for correction');
    }
}

function showCorrectionModal(emailId, jsonData, extractionMethod) {
    const modalHTML = `
        <div class="modal fade" id="correctionModal" tabindex="-1" aria-labelledby="correctionModalLabel" aria-hidden="true">
            <div class="modal-dialog modal-xl modal-dialog-scrollable">
                <div class="modal-content">
                    <div class="modal-header bg-danger text-white">
                        <h5 class="modal-title" id="correctionModalLabel">
                            <i class="fas fa-exclamation-triangle me-2"></i>Report Extraction Errors
                            <span class="badge bg-white text-dark ms-2">${extractionMethod}</span>
                        </h5>
                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body">
                        <div class="alert alert-info">
                            <i class="fas fa-info-circle me-2"></i>
                            <strong>Help us improve!</strong> Review the extracted data below and correct any errors.
                            Your corrections will help train the model to be more accurate.
                        </div>

                        <form id="correctionForm">
                            <input type="hidden" id="correction_email_id" value="${emailId}">
                            <input type="hidden" id="correction_extraction_method" value="${extractionMethod}">

                            <div class="row">
                                <div class="col-md-6 mb-3">
                                    <label class="form-label"><strong>Client Name</strong></label>
                                    <input type="text" class="form-control" id="correct_client_name" value="${jsonData.client_name || ''}" placeholder="Enter correct client name">
                                    <small class="text-muted">Original: ${jsonData.client_name || 'Not extracted'}</small>
                                </div>

                                <div class="col-md-6 mb-3">
                                    <label class="form-label"><strong>Document Date</strong></label>
                                    <input type="text" class="form-control" id="correct_document_date" value="${jsonData.document_date || ''}" placeholder="YYYY-MM-DD">
                                    <small class="text-muted">Original: ${jsonData.document_date || 'Not extracted'}</small>
                                </div>
                            </div>

                            <div class="row">
                                <div class="col-md-6 mb-3">
                                    <label class="form-label"><strong>Document Type</strong></label>
                                    <select class="form-control" id="correct_document_type">
                                        <option value="">Select type</option>
                                        <option value="statement" ${jsonData.document_type === 'statement' ? 'selected' : ''}>Statement</option>
                                        <option value="demand" ${jsonData.document_type === 'demand' ? 'selected' : ''}>Demand Letter</option>
                                        <option value="notice" ${jsonData.document_type === 'notice' ? 'selected' : ''}>Notice</option>
                                        <option value="correspondence" ${jsonData.document_type === 'correspondence' ? 'selected' : ''}>Correspondence</option>
                                        <option value="legal" ${jsonData.document_type === 'legal' ? 'selected' : ''}>Legal Document</option>
                                        <option value="other" ${jsonData.document_type === 'other' ? 'selected' : ''}>Other</option>
                                    </select>
                                    <small class="text-muted">Original: ${jsonData.document_type || 'Not extracted'}</small>
                                </div>

                                <div class="col-md-6 mb-3">
                                    <label class="form-label"><strong>Creditor Name</strong></label>
                                    <input type="text" class="form-control" id="correct_creditor_name" value="${jsonData.creditor_name || ''}" placeholder="Enter creditor name">
                                    <small class="text-muted">Original: ${jsonData.creditor_name || 'Not extracted'}</small>
                                </div>
                            </div>

                            <div class="mb-3">
                                <label class="form-label"><strong>Phone Numbers</strong></label>
                                <input type="text" class="form-control" id="correct_phone_numbers" value="${jsonData.contact_info?.phone_numbers?.join(', ') || ''}" placeholder="Comma-separated phone numbers">
                                <small class="text-muted">Original: ${jsonData.contact_info?.phone_numbers?.join(', ') || 'None extracted'}</small>
                            </div>

                            <div class="mb-3">
                                <label class="form-label"><strong>Email Addresses</strong></label>
                                <input type="text" class="form-control" id="correct_email_addresses" value="${jsonData.contact_info?.email_addresses?.join(', ') || ''}" placeholder="Comma-separated email addresses">
                                <small class="text-muted">Original: ${jsonData.contact_info?.email_addresses?.join(', ') || 'None extracted'}</small>
                            </div>

                            <div class="row">
                                <div class="col-md-6 mb-3">
                                    <label class="form-label"><strong>Total Financial Amount</strong></label>
                                    <input type="text" class="form-control" id="correct_total_amount" value="${jsonData.financial_values?.total_amount || ''}" placeholder="0.00">
                                    <small class="text-muted">Original: ${jsonData.financial_values?.total_amount || 'Not extracted'}</small>
                                </div>

                                <div class="col-md-6 mb-3">
                                    <label class="form-label"><strong>Currency</strong></label>
                                    <input type="text" class="form-control" id="correct_currency" value="${jsonData.financial_values?.currency || 'GBP'}" placeholder="GBP">
                                    <small class="text-muted">Original: ${jsonData.financial_values?.currency || 'Not specified'}</small>
                                </div>
                            </div>

                            <div class="mb-3">
                                <label class="form-label"><strong>Reference Numbers (JSON format)</strong></label>
                                <textarea class="form-control" id="correct_references" rows="3" placeholder='{"account_number": "", "case_number": ""}'>${JSON.stringify(jsonData.reference_numbers || {}, null, 2)}</textarea>
                                <small class="text-muted">Edit as JSON. Original reference numbers shown above.</small>
                            </div>

                            <div class="mb-3">
                                <label class="form-label"><strong>Summary</strong></label>
                                <textarea class="form-control" id="correct_summary" rows="3" placeholder="Brief summary of document">${jsonData.summary || ''}</textarea>
                                <small class="text-muted">Original: ${jsonData.summary || 'Not extracted'}</small>
                            </div>

                            <div class="mb-3">
                                <label class="form-label"><strong>Additional Notes</strong></label>
                                <textarea class="form-control" id="correction_notes" rows="2" placeholder="Any additional context or notes about these corrections"></textarea>
                            </div>

                            <div class="mb-3">
                                <label class="form-label"><strong>Your Name/ID (Optional)</strong></label>
                                <input type="text" class="form-control" id="correction_user_id" placeholder="Enter your name or ID">
                            </div>
                        </form>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                        <button type="button" class="btn btn-primary" onclick="submitCorrections()">
                            <i class="fas fa-paper-plane me-1"></i>Submit Corrections
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Remove existing modal if present
    const existingModal = document.getElementById('correctionModal');
    if (existingModal) {
        existingModal.remove();
    }

    // Add modal to body
    document.body.insertAdjacentHTML('beforeend', modalHTML);

    // Store original JSON for comparison
    window.originalCorrectionJSON = jsonData;

    // Show modal
    const modal = new bootstrap.Modal(document.getElementById('correctionModal'));
    modal.show();
}

async function submitCorrections() {
    try {
        const emailId = document.getElementById('correction_email_id').value;
        const extractionMethod = document.getElementById('correction_extraction_method').value;
        const userId = document.getElementById('correction_user_id').value || 'anonymous';
        const notes = document.getElementById('correction_notes').value;

        // Build corrected JSON
        const correctedJSON = {
            client_name: document.getElementById('correct_client_name').value,
            document_date: document.getElementById('correct_document_date').value,
            document_type: document.getElementById('correct_document_type').value,
            creditor_name: document.getElementById('correct_creditor_name').value,
            contact_info: {
                phone_numbers: document.getElementById('correct_phone_numbers').value.split(',').map(s => s.trim()).filter(s => s),
                email_addresses: document.getElementById('correct_email_addresses').value.split(',').map(s => s.trim()).filter(s => s)
            },
            financial_values: {
                total_amount: document.getElementById('correct_total_amount').value,
                currency: document.getElementById('correct_currency').value
            },
            reference_numbers: JSON.parse(document.getElementById('correct_references').value || '{}'),
            summary: document.getElementById('correct_summary').value
        };

        // Submit correction
        const response = await fetch('/api/corrections/submit', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                document_id: emailId,
                email_id: emailId,
                correction_type: 'extraction',
                original_json: window.originalCorrectionJSON,
                corrected_json: correctedJSON,
                extraction_method: extractionMethod,
                user_id: userId,
                notes: notes
            })
        });

        const result = await response.json();

        if (result.status === 'success') {
            alert('✓ Corrections submitted successfully! Thank you for helping improve the model.');

            // Close modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('correctionModal'));
            modal.hide();

            // Reload document data
            if (typeof loadDocumentData === 'function') {
                loadDocumentData(emailId);
            }
        } else {
            alert('Error submitting corrections: ' + result.message);
        }

    } catch (error) {
        console.error('Error submitting corrections:', error);
        alert('Error submitting corrections. Please check the console for details.');
    }
}

// Export for debugging
if (typeof module !== 'undefined' && module.exports) {
    module.exports = OCRDashboard;
}