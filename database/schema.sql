-- CMA Case Management System Database Schema

-- Centres table
CREATE TABLE centres (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    address TEXT,
    phone VARCHAR(20),
    email VARCHAR(255),
    letterhead_logo BYTEA, -- Binary logo data
    logo_filename VARCHAR(255), -- Original logo filename
    letterhead_template BYTEA, -- Binary letterhead template data
    letterhead_filename VARCHAR(255), -- Original letterhead filename
    letterhead_address TEXT,
    letterhead_contact TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Users table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    centre_id INTEGER REFERENCES centres(id) ON DELETE CASCADE,
    username VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    role VARCHAR(50) DEFAULT 'advisor', -- 'manager', 'advisor'
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Clients table
CREATE TABLE clients (
    id SERIAL PRIMARY KEY,
    centre_id INTEGER REFERENCES centres(id) ON DELETE CASCADE,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    date_of_birth DATE,
    phone VARCHAR(20),
    email VARCHAR(255),
    address TEXT,
    national_insurance_number VARCHAR(20),
    relationship_status VARCHAR(50),
    dependents INTEGER DEFAULT 0,
    employment_status VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Cases table
CREATE TABLE cases (
    id SERIAL PRIMARY KEY,
    client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
    centre_id INTEGER REFERENCES centres(id) ON DELETE CASCADE,
    assigned_advisor_id INTEGER REFERENCES users(id),
    case_number VARCHAR(50) UNIQUE NOT NULL,
    debt_stage VARCHAR(100), -- 'assessment', 'budgeting', 'negotiation', 'insolvency', 'closed'
    priority VARCHAR(20) DEFAULT 'medium', -- 'low', 'medium', 'high', 'urgent'
    status VARCHAR(50) DEFAULT 'active', -- 'active', 'on_hold', 'closed'
    total_debt DECIMAL(12,2) DEFAULT 0,
    monthly_income DECIMAL(10,2) DEFAULT 0,
    monthly_expenses DECIMAL(10,2) DEFAULT 0,
    disposable_income DECIMAL(10,2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Assets table
CREATE TABLE assets (
    id SERIAL PRIMARY KEY,
    case_id INTEGER REFERENCES cases(id) ON DELETE CASCADE,
    asset_type VARCHAR(100) NOT NULL, -- 'property', 'vehicle', 'savings', 'investments', 'other'
    description TEXT,
    estimated_value DECIMAL(12,2),
    is_secured BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Debts table
CREATE TABLE debts (
    id SERIAL PRIMARY KEY,
    case_id INTEGER REFERENCES cases(id) ON DELETE CASCADE,
    creditor_name VARCHAR(255) NOT NULL,
    debt_type VARCHAR(100), -- 'credit_card', 'loan', 'mortgage', 'utility', 'council_tax', 'other'
    original_amount DECIMAL(12,2),
    current_balance DECIMAL(12,2) NOT NULL,
    minimum_payment DECIMAL(10,2),
    interest_rate DECIMAL(5,2),
    is_priority BOOLEAN DEFAULT false,
    status VARCHAR(50) DEFAULT 'active', -- 'active', 'frozen', 'arrangement', 'written_off'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Appointments table
CREATE TABLE appointments (
    id SERIAL PRIMARY KEY,
    case_id INTEGER REFERENCES cases(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    appointment_date TIMESTAMP NOT NULL,
    duration_minutes INTEGER DEFAULT 60,
    location VARCHAR(255),
    appointment_type VARCHAR(50) DEFAULT 'consultation', -- 'consultation', 'follow_up', 'phone_call', 'home_visit'
    status VARCHAR(50) DEFAULT 'scheduled', -- 'scheduled', 'confirmed', 'completed', 'cancelled', 'no_show'
    client_confirmed BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Notes table (enhanced)
CREATE TABLE notes (
    id SERIAL PRIMARY KEY,
    case_id INTEGER REFERENCES cases(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id),
    title VARCHAR(255),
    content TEXT NOT NULL,
    note_type VARCHAR(50) DEFAULT 'general',
    note_category VARCHAR(50),
    priority_level VARCHAR(20) DEFAULT 'normal',
    follow_up_date TIMESTAMP,
    tags TEXT[],
    mentioned_users INTEGER[],
    is_private BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Files table
CREATE TABLE files (
    id SERIAL PRIMARY KEY,
    case_id INTEGER REFERENCES cases(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    filename VARCHAR(255) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL,
    file_size INTEGER,
    mime_type VARCHAR(100),
    file_type VARCHAR(50), -- 'document', 'image', 'letter', 'statement'
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Letter templates table
CREATE TABLE letter_templates (
    id SERIAL PRIMARY KEY,
    centre_id INTEGER REFERENCES centres(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    subject VARCHAR(255),
    content TEXT NOT NULL,
    template_type VARCHAR(100), -- 'debt_management_plan', 'payment_arrangement', 'complaint', 'general'
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Generated letters table
CREATE TABLE generated_letters (
    id SERIAL PRIMARY KEY,
    case_id INTEGER REFERENCES cases(id) ON DELETE CASCADE,
    template_id INTEGER REFERENCES letter_templates(id),
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    recipient_name VARCHAR(255),
    recipient_address TEXT,
    subject VARCHAR(255),
    content TEXT NOT NULL,
    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    sent_at TIMESTAMP,
    file_path TEXT
);

-- Note templates table
CREATE TABLE note_templates (
    id SERIAL PRIMARY KEY,
    centre_id INTEGER REFERENCES centres(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    template_type VARCHAR(100),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Debt tools table (for recommendations)
CREATE TABLE debt_tools (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    tool_type VARCHAR(100), -- 'dmp', 'iva', 'bankruptcy', 'debt_relief_order', 'administration_order'
    min_debt_amount DECIMAL(12,2),
    max_debt_amount DECIMAL(12,2),
    eligibility_criteria TEXT,
    pros TEXT,
    cons TEXT,
    is_active BOOLEAN DEFAULT true
);

-- Create indexes for better performance
CREATE INDEX idx_users_centre_id ON users(centre_id);
CREATE INDEX idx_clients_centre_id ON clients(centre_id);
CREATE INDEX idx_cases_client_id ON cases(client_id);
CREATE INDEX idx_cases_centre_id ON cases(centre_id);
CREATE INDEX idx_cases_assigned_advisor_id ON cases(assigned_advisor_id);
CREATE INDEX idx_appointments_case_id ON appointments(case_id);
CREATE INDEX idx_appointments_date ON appointments(appointment_date);
CREATE INDEX idx_notes_case_id ON notes(case_id);
CREATE INDEX idx_notes_created_at ON notes(created_at);
CREATE INDEX idx_files_case_id ON files(case_id);
CREATE INDEX idx_files_uploaded_at ON files(uploaded_at);

-- Agentic Workflow Tables
CREATE TABLE workflow_executions (
    id UUID PRIMARY KEY,
    workflow_id UUID NOT NULL,
    case_id INTEGER REFERENCES cases(id),
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    data JSONB,
    results JSONB,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    error_message TEXT,
    logs JSONB,
    created_by INTEGER REFERENCES users(id)
);

CREATE TABLE generated_documents (
    id SERIAL PRIMARY KEY,
    case_id INTEGER REFERENCES cases(id),
    document_type VARCHAR(50) NOT NULL,
    content TEXT NOT NULL,
    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    generated_by INTEGER REFERENCES users(id),
    workflow_execution_id UUID REFERENCES workflow_executions(id)
);

CREATE TABLE workflow_templates (
    id UUID PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    definition JSONB NOT NULL,
    version VARCHAR(10) DEFAULT '1.0.0',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER REFERENCES users(id),
    is_active BOOLEAN DEFAULT true
);

-- Indexes for workflow tables
CREATE INDEX idx_workflow_executions_case_id ON workflow_executions(case_id);
CREATE INDEX idx_workflow_executions_status ON workflow_executions(status);
CREATE INDEX idx_workflow_executions_started_at ON workflow_executions(started_at);
CREATE INDEX idx_generated_documents_case_id ON generated_documents(case_id);
CREATE INDEX idx_generated_documents_type ON generated_documents(document_type);
CREATE INDEX idx_workflow_templates_name ON workflow_templates(name);

-- Digital Referrals System (AdvicePro-style feature)
CREATE TABLE digital_referrals (
    id SERIAL PRIMARY KEY,
    centre_id INTEGER REFERENCES centres(id),
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    address TEXT,
    date_of_birth DATE,
    referral_source VARCHAR(100),
    urgency_level VARCHAR(20) DEFAULT 'medium', -- low, medium, high
    problem_description TEXT,
    preferred_contact VARCHAR(20) DEFAULT 'email', -- email, phone, post
    consent_given BOOLEAN NOT NULL,
    status VARCHAR(20) DEFAULT 'pending', -- pending, assigned, converted, rejected
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    assigned_to INTEGER REFERENCES users(id),
    assigned_at TIMESTAMP,
    processed_by INTEGER REFERENCES users(id),
    processed_at TIMESTAMP,
    case_id INTEGER REFERENCES cases(id) -- Set when converted to full case
);

-- Auto Actions System (AdvicePro-style feature)
CREATE TABLE auto_action_rules (
    id SERIAL PRIMARY KEY,
    centre_id INTEGER REFERENCES centres(id),
    name VARCHAR(200) NOT NULL,
    description TEXT,
    trigger_event VARCHAR(100) NOT NULL, -- case_created, case_closed, note_added, etc.
    trigger_conditions JSONB, -- Conditions that must be met
    actions JSONB NOT NULL, -- Actions to perform
    priority INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT true,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE auto_action_logs (
    id SERIAL PRIMARY KEY,
    rule_id INTEGER REFERENCES auto_action_rules(id),
    case_id INTEGER REFERENCES cases(id),
    execution_results JSONB,
    executed_by INTEGER REFERENCES users(id),
    executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Group Actions System (AdvicePro-style feature)
CREATE TABLE client_groups (
    id SERIAL PRIMARY KEY,
    centre_id INTEGER REFERENCES centres(id),
    name VARCHAR(200) NOT NULL,
    description TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE client_group_members (
    id SERIAL PRIMARY KEY,
    group_id INTEGER REFERENCES client_groups(id) ON DELETE CASCADE,
    client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
    added_by INTEGER REFERENCES users(id),
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(group_id, client_id)
);

-- Enhanced Reporting System
CREATE TABLE custom_reports (
    id SERIAL PRIMARY KEY,
    centre_id INTEGER REFERENCES centres(id),
    name VARCHAR(200) NOT NULL,
    description TEXT,
    report_type VARCHAR(50), -- client, case, financial, compliance
    query_definition JSONB NOT NULL,
    parameters JSONB,
    is_scheduled BOOLEAN DEFAULT false,
    schedule_frequency VARCHAR(20), -- daily, weekly, monthly
    schedule_recipients TEXT[], -- Email addresses
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_run TIMESTAMP
);

-- API Integrations tracking
CREATE TABLE api_integrations (
    id SERIAL PRIMARY KEY,
    centre_id INTEGER REFERENCES centres(id),
    integration_name VARCHAR(100) NOT NULL,
    integration_type VARCHAR(50), -- credit_bureau, sms, email, etc.
    configuration JSONB,
    is_active BOOLEAN DEFAULT true,
    last_used TIMESTAMP,
    usage_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Document Processing System
CREATE TABLE document_processing_jobs (
    id SERIAL PRIMARY KEY,
    file_id INTEGER REFERENCES files(id) ON DELETE CASCADE,
    processing_status VARCHAR(50) DEFAULT 'pending', -- pending, processing, completed, failed
    ocr_confidence DECIMAL(3,2),
    extracted_data JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
);

-- Additional workflow templates
CREATE TABLE workflow_template_library (
    id SERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    category VARCHAR(100), -- assessment, review, compliance, automation
    description TEXT,
    workflow_definition JSONB NOT NULL,
    usage_count INTEGER DEFAULT 0,
    is_system_template BOOLEAN DEFAULT false,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Advisor performance metrics
CREATE TABLE advisor_performance_metrics (
    id SERIAL PRIMARY KEY,
    advisor_id INTEGER REFERENCES users(id),
    metric_date DATE DEFAULT CURRENT_DATE,
    cases_active INTEGER DEFAULT 0,
    cases_completed INTEGER DEFAULT 0,
    avg_resolution_days DECIMAL(5,2),
    appointments_completed INTEGER DEFAULT 0,
    client_satisfaction_score DECIMAL(3,2),
    workflow_usage_count INTEGER DEFAULT 0,
    notes_created INTEGER DEFAULT 0,
    documents_processed INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(advisor_id, metric_date)
);

-- Case prioritization scores
CREATE TABLE case_priority_scores (
    id SERIAL PRIMARY KEY,
    case_id INTEGER REFERENCES cases(id) ON DELETE CASCADE,
    priority_score INTEGER NOT NULL, -- 1-100 scale
    urgency_factors JSONB, -- breakdown of factors contributing to score
    calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP -- when to recalculate
);

-- Case filestore system
CREATE TABLE case_folders (
    id SERIAL PRIMARY KEY,
    case_id INTEGER REFERENCES cases(id) ON DELETE CASCADE,
    folder_name VARCHAR(200) NOT NULL,
    folder_path VARCHAR(500) NOT NULL, -- Virtual path like /case_123/financial_documents/bank_statements
    parent_folder_id INTEGER REFERENCES case_folders(id) ON DELETE CASCADE,
    folder_type VARCHAR(100), -- system, user_created, auto_generated
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(case_id, folder_path)
);

-- Enhanced files table with folder organization
ALTER TABLE files ADD COLUMN folder_id INTEGER REFERENCES case_folders(id);
ALTER TABLE files ADD COLUMN document_category VARCHAR(100); -- financial, legal, correspondence, etc.
ALTER TABLE files ADD COLUMN document_subcategory VARCHAR(100); -- bank_statement, court_order, etc.
ALTER TABLE files ADD COLUMN is_generated BOOLEAN DEFAULT false; -- true for system-generated documents
ALTER TABLE files ADD COLUMN generation_source VARCHAR(100); -- workflow, template, ocr, etc.
ALTER TABLE files ADD COLUMN version_number INTEGER DEFAULT 1;
ALTER TABLE files ADD COLUMN is_current_version BOOLEAN DEFAULT true;
ALTER TABLE files ADD COLUMN replaced_by INTEGER REFERENCES files(id);
ALTER TABLE files ADD COLUMN file_hash VARCHAR(64); -- SHA-256 hash for duplicate detection
ALTER TABLE files ADD COLUMN retention_date DATE; -- when file can be deleted per policy
ALTER TABLE files ADD COLUMN access_level VARCHAR(50) DEFAULT 'standard'; -- standard, restricted, confidential

-- Document audit trail
CREATE TABLE document_audit_log (
    id SERIAL PRIMARY KEY,
    file_id INTEGER REFERENCES files(id) ON DELETE CASCADE,
    action VARCHAR(50) NOT NULL, -- uploaded, viewed, downloaded, moved, deleted, generated
    performed_by INTEGER REFERENCES users(id),
    details JSONB, -- additional context about the action
    ip_address INET,
    user_agent TEXT,
    performed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Document tags for better organization
CREATE TABLE document_tags (
    id SERIAL PRIMARY KEY,
    tag_name VARCHAR(100) NOT NULL UNIQUE,
    tag_color VARCHAR(7), -- hex color code
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE file_tags (
    id SERIAL PRIMARY KEY,
    file_id INTEGER REFERENCES files(id) ON DELETE CASCADE,
    tag_id INTEGER REFERENCES document_tags(id) ON DELETE CASCADE,
    tagged_by INTEGER REFERENCES users(id),
    tagged_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(file_id, tag_id)
);

-- Document sharing and permissions
CREATE TABLE document_shares (
    id SERIAL PRIMARY KEY,
    file_id INTEGER REFERENCES files(id) ON DELETE CASCADE,
    shared_with INTEGER REFERENCES users(id) ON DELETE CASCADE,
    permission_level VARCHAR(20) DEFAULT 'view', -- view, download, edit
    shared_by INTEGER REFERENCES users(id),
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(file_id, shared_with)
);

-- Additional indexes for new tables
CREATE INDEX idx_digital_referrals_centre_id ON digital_referrals(centre_id);
CREATE INDEX idx_digital_referrals_status ON digital_referrals(status);
CREATE INDEX idx_digital_referrals_urgency ON digital_referrals(urgency_level);
CREATE INDEX idx_digital_referrals_submitted_at ON digital_referrals(submitted_at);
CREATE INDEX idx_auto_action_rules_centre_id ON auto_action_rules(centre_id);
CREATE INDEX idx_auto_action_rules_trigger_event ON auto_action_rules(trigger_event);
CREATE INDEX idx_auto_action_logs_rule_id ON auto_action_logs(rule_id);
CREATE INDEX idx_auto_action_logs_case_id ON auto_action_logs(case_id);
CREATE INDEX idx_client_groups_centre_id ON client_groups(centre_id);
CREATE INDEX idx_case_folders_case_id ON case_folders(case_id);
CREATE INDEX idx_case_folders_parent_folder_id ON case_folders(parent_folder_id);
CREATE INDEX idx_case_folders_folder_path ON case_folders(folder_path);
CREATE INDEX idx_files_folder_id ON files(folder_id);
CREATE INDEX idx_files_document_category ON files(document_category);
CREATE INDEX idx_files_is_current_version ON files(is_current_version);
CREATE INDEX idx_files_file_hash ON files(file_hash);
CREATE INDEX idx_document_audit_log_file_id ON document_audit_log(file_id);
CREATE INDEX idx_document_audit_log_performed_by ON document_audit_log(performed_by);
CREATE INDEX idx_document_audit_log_performed_at ON document_audit_log(performed_at);
CREATE INDEX idx_file_tags_file_id ON file_tags(file_id);
CREATE INDEX idx_file_tags_tag_id ON file_tags(tag_id);
CREATE INDEX idx_document_shares_file_id ON document_shares(file_id);
CREATE INDEX idx_document_shares_shared_with ON document_shares(shared_with);
CREATE INDEX idx_custom_reports_centre_id ON custom_reports(centre_id);
CREATE INDEX idx_api_integrations_centre_id ON api_integrations(centre_id);
CREATE INDEX idx_document_processing_jobs_file_id ON document_processing_jobs(file_id);
CREATE INDEX idx_document_processing_jobs_status ON document_processing_jobs(processing_status);
CREATE INDEX idx_workflow_template_library_category ON workflow_template_library(category);
CREATE INDEX idx_advisor_performance_metrics_advisor_date ON advisor_performance_metrics(advisor_id, metric_date);
CREATE INDEX idx_case_priority_scores_case_id ON case_priority_scores(case_id);
CREATE INDEX idx_case_priority_scores_priority ON case_priority_scores(priority_score DESC);
CREATE INDEX idx_notes_tags ON notes USING GIN(tags);
CREATE INDEX idx_files_case_id ON files(case_id);
CREATE INDEX idx_note_follow_ups_assigned_to ON note_follow_ups(assigned_to);
CREATE INDEX idx_note_follow_ups_due_date ON note_follow_ups(due_date);

-- Note attachments table
CREATE TABLE note_attachments (
    id SERIAL PRIMARY KEY,
    note_id INTEGER REFERENCES notes(id) ON DELETE CASCADE,
    file_id INTEGER REFERENCES files(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Note templates with categories (enhanced)
CREATE TABLE note_templates (
    id SERIAL PRIMARY KEY,
    centre_id INTEGER REFERENCES centres(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(50),
    template_content TEXT NOT NULL,
    required_fields JSONB,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Clients table (enhanced with comprehensive personal information)
CREATE TABLE clients (
    id SERIAL PRIMARY KEY,
    centre_id INTEGER REFERENCES centres(id),
    
    -- Basic Information
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    previous_names TEXT[], -- Array of previous names
    preferred_name VARCHAR(100),
    title VARCHAR(10), -- Mr, Mrs, Ms, Dr, etc.
    
    -- Contact Information
    email VARCHAR(255),
    phone VARCHAR(20),
    mobile VARCHAR(20),
    alternative_contact_name VARCHAR(200),
    alternative_contact_phone VARCHAR(20),
    alternative_contact_relationship VARCHAR(50),
    
    -- Address Information
    current_address TEXT,
    previous_address TEXT,
    address_tenure VARCHAR(50), -- Owner, Tenant, Living with family, etc.
    address_move_in_date DATE,
    
    -- Personal Details
    date_of_birth DATE,
    national_insurance_number VARCHAR(15),
    gender VARCHAR(20),
    marital_status VARCHAR(50), -- Single, Married, Divorced, Widowed, Civil Partnership, etc.
    relationship_status VARCHAR(50), -- Living together, Separated, etc.
    
    -- Household Information
    dependents INTEGER DEFAULT 0,
    household_size INTEGER DEFAULT 1,
    partner_name VARCHAR(200),
    partner_employment_status VARCHAR(100),
    partner_income DECIMAL(10,2),
    
    -- Immigration Status
    immigration_status VARCHAR(100), -- British Citizen, EU Settled Status, Visa, Asylum Seeker, etc.
    immigration_documents_verified BOOLEAN DEFAULT false,
    immigration_notes TEXT,
    right_to_work BOOLEAN,
    
    -- Employment Information
    employment_status VARCHAR(100), -- Employed, Unemployed, Self-employed, Retired, Student, etc.
    employer_name VARCHAR(200),
    job_title VARCHAR(100),
    employment_start_date DATE,
    monthly_income DECIMAL(10,2),
    
    -- Benefits Information
    receives_benefits BOOLEAN DEFAULT false,
    benefit_types TEXT[], -- Array of benefit types
    total_monthly_benefits DECIMAL(10,2),
    
    -- Vulnerabilities and Special Circumstances
    vulnerabilities TEXT[], -- Array of vulnerability types
    vulnerability_details TEXT,
    mental_health_issues BOOLEAN DEFAULT false,
    physical_disabilities BOOLEAN DEFAULT false,
    learning_difficulties BOOLEAN DEFAULT false,
    language_barriers BOOLEAN DEFAULT false,
    preferred_language VARCHAR(50) DEFAULT 'English',
    requires_interpreter BOOLEAN DEFAULT false,
    
    -- Data Protection and Privacy
    data_protection_consent BOOLEAN DEFAULT false,
    data_protection_consent_date TIMESTAMP,
    marketing_consent BOOLEAN DEFAULT false,
    can_contact_by_phone BOOLEAN DEFAULT true,
    can_contact_by_email BOOLEAN DEFAULT true,
    can_contact_by_post BOOLEAN DEFAULT true,
    
    -- Privacy and Access Control
    is_confidential BOOLEAN DEFAULT false,
    restricted_advisors INTEGER[], -- Array of advisor IDs who cannot access this case
    confidentiality_reason TEXT,
    confidentiality_level VARCHAR(20) DEFAULT 'standard', -- standard, restricted, high
    
    -- Additional Information
    how_heard_about_service VARCHAR(100),
    referral_source VARCHAR(100),
    previous_advice_received BOOLEAN DEFAULT false,
    previous_advice_details TEXT,
    
    -- System Fields
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER REFERENCES users(id),
    last_updated_by INTEGER REFERENCES users(id)
);

-- Note follow-up actions
CREATE TABLE note_follow_ups (
    id SERIAL PRIMARY KEY,
    note_id INTEGER REFERENCES notes(id) ON DELETE CASCADE,
    assigned_to INTEGER REFERENCES users(id),
    action_required TEXT NOT NULL,
    due_date TIMESTAMP,
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'in_progress', 'completed', 'cancelled'
    completed_at TIMESTAMP,
    completed_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Credit reporting tables
CREATE TABLE credit_report_requests (
    id SERIAL PRIMARY KEY,
    case_id INTEGER REFERENCES cases(id) ON DELETE CASCADE,
    client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
    requested_by INTEGER REFERENCES users(id),
    bureau VARCHAR(50) NOT NULL, -- experian, equifax, transunion
    request_type VARCHAR(50) NOT NULL, -- full, summary, monitoring
    status VARCHAR(50) DEFAULT 'pending', -- pending, processing, completed, failed
    cost_pence INTEGER,
    consent_given BOOLEAN DEFAULT false,
    consent_date TIMESTAMP,
    external_reference VARCHAR(255),
    requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
);

CREATE TABLE credit_reports (
    id SERIAL PRIMARY KEY,
    request_id INTEGER REFERENCES credit_report_requests(id) ON DELETE CASCADE,
    bureau VARCHAR(50) NOT NULL,
    report_data JSONB,
    credit_score INTEGER,
    risk_grade VARCHAR(10),
    report_date DATE,
    file_path VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE credit_alerts (
    id SERIAL PRIMARY KEY,
    client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
    alert_type VARCHAR(100) NOT NULL, -- score_change, new_account, missed_payment, etc.
    severity VARCHAR(20) DEFAULT 'medium', -- low, medium, high
    description TEXT,
    resolved BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Notification system tables
CREATE TABLE notification_preferences (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    email_enabled BOOLEAN DEFAULT true,
    sms_enabled BOOLEAN DEFAULT false,
    push_enabled BOOLEAN DEFAULT true,
    appointment_reminders BOOLEAN DEFAULT true,
    payment_reminders BOOLEAN DEFAULT true,
    compliance_reminders BOOLEAN DEFAULT true,
    follow_up_reminders BOOLEAN DEFAULT true,
    document_reminders BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE scheduled_notifications (
    id SERIAL PRIMARY KEY,
    notification_type VARCHAR(100) NOT NULL,
    client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    scheduled_for TIMESTAMP NOT NULL,
    template_data JSONB,
    priority VARCHAR(20) DEFAULT 'normal', -- low, normal, high
    status VARCHAR(50) DEFAULT 'pending', -- pending, processing, sent, failed, cancelled
    sent_at TIMESTAMP,
    error_message TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE notification_history (
    id SERIAL PRIMARY KEY,
    notification_type VARCHAR(100) NOT NULL,
    client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    channels JSONB, -- ['email', 'sms', 'push']
    template_data JSONB,
    status VARCHAR(50) NOT NULL, -- sent, failed
    sent_by INTEGER REFERENCES users(id),
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Automated scheduling tables
CREATE TABLE scheduling_rules (
    id SERIAL PRIMARY KEY,
    centre_id INTEGER REFERENCES centres(id) ON DELETE CASCADE,
    rule_type VARCHAR(100) NOT NULL, -- follow_up, reminder, review
    trigger_event VARCHAR(100) NOT NULL, -- case_created, payment_missed, etc.
    schedule_offset_days INTEGER DEFAULT 0,
    schedule_offset_hours INTEGER DEFAULT 0,
    appointment_type VARCHAR(100),
    auto_assign BOOLEAN DEFAULT false,
    priority VARCHAR(20) DEFAULT 'normal',
    conditions JSONB, -- Additional conditions for rule activation
    is_active BOOLEAN DEFAULT true,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(centre_id, rule_type, trigger_event)
);

CREATE TABLE auto_scheduled_appointments (
    id SERIAL PRIMARY KEY,
    case_id INTEGER REFERENCES cases(id) ON DELETE CASCADE,
    rule_id INTEGER REFERENCES scheduling_rules(id) ON DELETE CASCADE,
    appointment_type VARCHAR(100) NOT NULL,
    scheduled_for TIMESTAMP NOT NULL,
    duration_minutes INTEGER DEFAULT 60,
    assigned_to INTEGER REFERENCES users(id),
    trigger_data JSONB,
    status VARCHAR(50) DEFAULT 'pending', -- pending, approved, rejected
    appointment_id INTEGER REFERENCES appointments(id),
    approved_by INTEGER REFERENCES users(id),
    approved_at TIMESTAMP,
    rejected_by INTEGER REFERENCES users(id),
    rejected_at TIMESTAMP,
    rejection_reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Additional indexes for new tables
CREATE INDEX idx_credit_requests_case ON credit_report_requests(case_id, requested_at);
CREATE INDEX idx_credit_requests_status ON credit_report_requests(status, requested_at);
CREATE INDEX idx_credit_alerts_client ON credit_alerts(client_id, created_at);
CREATE INDEX idx_credit_alerts_resolved ON credit_alerts(resolved, created_at);
CREATE INDEX idx_scheduled_notifications_due ON scheduled_notifications(scheduled_for, status);
CREATE INDEX idx_notification_history_client ON notification_history(client_id, sent_at);
CREATE INDEX idx_scheduling_rules_trigger ON scheduling_rules(centre_id, trigger_event, is_active);
CREATE INDEX idx_auto_scheduled_status ON auto_scheduled_appointments(status, scheduled_for);

-- Insert default debt tools
INSERT INTO debt_tools (name, description, tool_type, min_debt_amount, max_debt_amount, eligibility_criteria, pros, cons) VALUES
('Debt Management Plan (DMP)', 'Informal arrangement to pay creditors reduced monthly payments', 'dmp', 1000, NULL, 'Must have some disposable income', 'No legal fees, flexible payments, creditors may freeze interest', 'Not legally binding, may take longer to clear debts, affects credit rating'),
('Individual Voluntary Arrangement (IVA)', 'Formal agreement to pay portion of debts over 5-6 years', 'iva', 6000, NULL, 'Must have regular income, minimum £6000 debt', 'Legally binding, write off remaining debt, stops creditor action', 'Affects credit rating for 6 years, fees involved, strict payment terms'),
('Bankruptcy', 'Legal process to clear most debts', 'bankruptcy', 5000, NULL, 'Cannot pay debts, assets may be sold', 'Fresh start, stops creditor action, usually discharged after 1 year', 'Severe impact on credit rating, may lose assets, affects employment'),
('Debt Relief Order (DRO)', 'Formal insolvency procedure for people with low income and assets', 'debt_relief_order', 500, 30000, 'Low income, minimal assets, debts under £30k', 'Relatively cheap (£90 fee), stops creditor action, debts written off after 1 year', 'Strict eligibility criteria, affects credit rating, limited to certain debt types'),
('Administration Order', 'County court arrangement to pay debts in installments', 'administration_order', 1000, 5000, 'At least one county court judgment, debts under £5000', 'Single monthly payment, protection from creditors, may reduce total debt', 'Only for small debts, court fees, limited to certain debt types');
