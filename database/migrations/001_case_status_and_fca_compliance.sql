-- Migration: Enhanced Case Status and FCA Compliance Checklist
-- Date: 2025-09-01

-- Update cases table with comprehensive status options
ALTER TABLE cases DROP CONSTRAINT IF EXISTS cases_status_check;
ALTER TABLE cases ADD CONSTRAINT cases_status_check CHECK (status IN (
    'first_enquiry',
    'fact_finding', 
    'assessment_complete',
    'debt_options_presented',
    'solution_agreed',
    'implementation',
    'monitoring',
    'review_due',
    'closure_pending',
    'closed',
    'referred_external',
    'on_hold',
    'cancelled'
));

-- Set default status for new cases
ALTER TABLE cases ALTER COLUMN status SET DEFAULT 'first_enquiry';

-- Update existing cases with null status
UPDATE cases SET status = 'first_enquiry' WHERE status IS NULL;

-- Create FCA compliance checklist items table
CREATE TABLE fca_compliance_items (
    id SERIAL PRIMARY KEY,
    item_code VARCHAR(50) UNIQUE NOT NULL,
    category VARCHAR(100) NOT NULL, -- 'data_protection', 'complaints', 'advice_process', 'documentation'
    title VARCHAR(255) NOT NULL,
    description TEXT,
    is_mandatory BOOLEAN DEFAULT true,
    applies_to_status VARCHAR(50)[], -- Array of case statuses where this item applies
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create case compliance checklist tracking table
CREATE TABLE case_compliance_checklist (
    id SERIAL PRIMARY KEY,
    case_id INTEGER REFERENCES cases(id) ON DELETE CASCADE,
    compliance_item_id INTEGER REFERENCES fca_compliance_items(id) ON DELETE CASCADE,
    is_completed BOOLEAN DEFAULT false,
    completed_by INTEGER REFERENCES users(id),
    completed_at TIMESTAMP,
    notes TEXT,
    evidence_file_id INTEGER REFERENCES files(id), -- Link to supporting document
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(case_id, compliance_item_id)
);

-- Insert standard FCA compliance checklist items
INSERT INTO fca_compliance_items (item_code, category, title, description, is_mandatory, applies_to_status, sort_order) VALUES
-- Data Protection & Consent
('DP001', 'data_protection', 'Data Protection Consent Obtained', 'Client has given explicit consent for data processing and storage', true, ARRAY['first_enquiry'], 1),
('DP002', 'data_protection', 'Privacy Notice Provided', 'Client has been provided with privacy notice explaining how their data will be used', true, ARRAY['first_enquiry'], 2),
('DP003', 'data_protection', 'Data Retention Policy Explained', 'Client informed about how long their data will be retained', true, ARRAY['first_enquiry'], 3),
('DP004', 'data_protection', 'Third Party Data Sharing Consent', 'Consent obtained for sharing data with creditors/third parties if required', false, ARRAY['debt_options_presented', 'solution_agreed'], 4),

-- Complaints Procedure
('CP001', 'complaints', 'Complaints Procedure Explained', 'Client has been informed about the complaints procedure', true, ARRAY['first_enquiry'], 5),
('CP002', 'complaints', 'Compliments Procedure Explained', 'Client has been informed about how to provide feedback/compliments', true, ARRAY['first_enquiry'], 6),
('CP003', 'complaints', 'Financial Ombudsman Information Provided', 'Client informed about Financial Ombudsman Service if applicable', true, ARRAY['first_enquiry'], 7),

-- Advice Process
('AP001', 'advice_process', 'Fact Find Completed', 'Comprehensive fact finding has been completed', true, ARRAY['fact_finding'], 8),
('AP002', 'advice_process', 'Income and Expenditure Verified', 'Client income and expenditure has been verified with evidence', true, ARRAY['fact_finding'], 9),
('AP003', 'advice_process', 'Debt Verification Completed', 'All debts have been verified with creditor statements', true, ARRAY['fact_finding'], 10),
('AP004', 'advice_process', 'Vulnerability Assessment Completed', 'Assessment for vulnerable circumstances completed', true, ARRAY['fact_finding'], 11),
('AP005', 'advice_process', 'Options Analysis Completed', 'All available debt solutions have been analyzed', true, ARRAY['assessment_complete'], 12),
('AP006', 'advice_process', 'Suitability Assessment Documented', 'Suitability of recommended solution documented with reasons', true, ARRAY['debt_options_presented'], 13),
('AP007', 'advice_process', 'Risks and Benefits Explained', 'All risks and benefits of recommended solution explained to client', true, ARRAY['debt_options_presented'], 14),

-- Documentation
('DOC001', 'documentation', 'Confirmation of Advice Letter Sent', 'Written confirmation of advice provided to client', true, ARRAY['solution_agreed'], 15),
('DOC002', 'documentation', 'Client Agreement Obtained', 'Written agreement from client for recommended course of action', true, ARRAY['solution_agreed'], 16),
('DOC003', 'documentation', 'Case Notes Up to Date', 'All case notes are current and comprehensive', true, ARRAY['monitoring', 'review_due', 'closure_pending'], 17),
('DOC004', 'documentation', 'File Closure Checklist Completed', 'All file closure requirements completed', true, ARRAY['closure_pending'], 18),

-- Ongoing Monitoring
('MON001', 'monitoring', 'Regular Review Scheduled', 'Appropriate review schedule established based on solution type', true, ARRAY['implementation'], 19),
('MON002', 'monitoring', 'Client Contact Maintained', 'Regular contact maintained with client as per agreement', false, ARRAY['monitoring'], 20),
('MON003', 'monitoring', 'Progress Monitoring Documented', 'Client progress towards debt solution documented', true, ARRAY['monitoring', 'review_due'], 21),

-- Quality Assurance
('QA001', 'quality', 'Supervisor Review Completed', 'Case has been reviewed by supervisor if required', false, ARRAY['debt_options_presented', 'closure_pending'], 22),
('QA002', 'quality', 'Quality Standards Met', 'Case meets all internal quality standards', true, ARRAY['closure_pending'], 23);

-- Create indexes for performance
CREATE INDEX idx_case_compliance_case_id ON case_compliance_checklist(case_id);
CREATE INDEX idx_case_compliance_item_id ON case_compliance_checklist(compliance_item_id);
CREATE INDEX idx_case_compliance_completed ON case_compliance_checklist(is_completed, case_id);
CREATE INDEX idx_fca_compliance_category ON fca_compliance_items(category, is_active);
CREATE INDEX idx_fca_compliance_status ON fca_compliance_items USING GIN(applies_to_status);

-- Create function to auto-create compliance checklist items for new cases
CREATE OR REPLACE FUNCTION create_case_compliance_checklist()
RETURNS TRIGGER AS $$
BEGIN
    -- Insert compliance items that apply to the new case status
    INSERT INTO case_compliance_checklist (case_id, compliance_item_id)
    SELECT NEW.id, fci.id
    FROM fca_compliance_items fci
    WHERE fci.is_active = true
    AND (fci.applies_to_status IS NULL OR NEW.status = ANY(fci.applies_to_status));
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-create compliance checklist for new cases
CREATE TRIGGER trigger_create_case_compliance_checklist
    AFTER INSERT ON cases
    FOR EACH ROW
    EXECUTE FUNCTION create_case_compliance_checklist();

-- Create function to update compliance checklist when case status changes
CREATE OR REPLACE FUNCTION update_case_compliance_checklist()
RETURNS TRIGGER AS $$
BEGIN
    -- Only proceed if status actually changed
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        -- Add new compliance items for the new status
        INSERT INTO case_compliance_checklist (case_id, compliance_item_id)
        SELECT NEW.id, fci.id
        FROM fca_compliance_items fci
        WHERE fci.is_active = true
        AND NEW.status = ANY(fci.applies_to_status)
        AND NOT EXISTS (
            SELECT 1 FROM case_compliance_checklist ccl
            WHERE ccl.case_id = NEW.id AND ccl.compliance_item_id = fci.id
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update compliance checklist when case status changes
CREATE TRIGGER trigger_update_case_compliance_checklist
    AFTER UPDATE ON cases
    FOR EACH ROW
    EXECUTE FUNCTION update_case_compliance_checklist();
