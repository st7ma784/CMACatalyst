-- Document Processing Schema Migration
-- Creates tables for document upload, OCR processing, and classification

-- Documents table for storing file metadata
CREATE TABLE IF NOT EXISTS documents (
    id SERIAL PRIMARY KEY,
    file_id UUID UNIQUE NOT NULL,
    case_id INTEGER NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    original_name VARCHAR(255) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    s3_key VARCHAR(500) NOT NULL,
    s3_url VARCHAR(500),
    mime_type VARCHAR(100) NOT NULL,
    file_size INTEGER NOT NULL,
    source VARCHAR(50) DEFAULT 'upload', -- 'upload' or 'email'
    from_email VARCHAR(255), -- for email attachments
    subject VARCHAR(255), -- for email attachments
    status VARCHAR(50) DEFAULT 'uploaded', -- 'uploaded', 'processing', 'processed', 'error'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Document classifications table for OCR results
CREATE TABLE IF NOT EXISTS document_classifications (
    id SERIAL PRIMARY KEY,
    file_id UUID NOT NULL REFERENCES documents(file_id) ON DELETE CASCADE,
    case_id INTEGER NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id),
    extracted_text TEXT,
    classification_type VARCHAR(50), -- 'debt', 'bank_statement', 'internal', 'unknown'
    confidence DECIMAL(3,2), -- 0.00 to 1.00
    extracted_data JSONB, -- structured data extracted from document
    approved BOOLEAN DEFAULT FALSE,
    overrides JSONB, -- user corrections/overrides
    requires_approval BOOLEAN DEFAULT TRUE,
    processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    approved_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(file_id)
);

-- Case email addresses table
CREATE TABLE IF NOT EXISTS case_email_addresses (
    id SERIAL PRIMARY KEY,
    case_id INTEGER NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    email_address VARCHAR(255) UNIQUE NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deactivated_at TIMESTAMP,
    UNIQUE(case_id)
);

-- Document processing queue table (for tracking processing status)
CREATE TABLE IF NOT EXISTS document_processing_queue (
    id SERIAL PRIMARY KEY,
    file_id UUID NOT NULL REFERENCES documents(file_id) ON DELETE CASCADE,
    processing_stage VARCHAR(50) NOT NULL, -- 'upload', 'ocr', 'classification', 'approval'
    status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMP,
    completed_at TIMESTAMP
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_documents_case_id ON documents(case_id);
CREATE INDEX IF NOT EXISTS idx_documents_file_id ON documents(file_id);
CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);
CREATE INDEX IF NOT EXISTS idx_documents_created_at ON documents(created_at);

CREATE INDEX IF NOT EXISTS idx_document_classifications_case_id ON document_classifications(case_id);
CREATE INDEX IF NOT EXISTS idx_document_classifications_file_id ON document_classifications(file_id);
CREATE INDEX IF NOT EXISTS idx_document_classifications_type ON document_classifications(classification_type);
CREATE INDEX IF NOT EXISTS idx_document_classifications_approved ON document_classifications(approved);

CREATE INDEX IF NOT EXISTS idx_case_email_addresses_case_id ON case_email_addresses(case_id);
CREATE INDEX IF NOT EXISTS idx_case_email_addresses_email ON case_email_addresses(email_address);

CREATE INDEX IF NOT EXISTS idx_processing_queue_file_id ON document_processing_queue(file_id);
CREATE INDEX IF NOT EXISTS idx_processing_queue_status ON document_processing_queue(status);
CREATE INDEX IF NOT EXISTS idx_processing_queue_stage ON document_processing_queue(processing_stage);

-- Add source_document column to debts table to link with documents
ALTER TABLE debts ADD COLUMN IF NOT EXISTS source_document UUID REFERENCES documents(file_id);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers
DROP TRIGGER IF EXISTS update_documents_updated_at ON documents;
CREATE TRIGGER update_documents_updated_at 
    BEFORE UPDATE ON documents 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_document_classifications_updated_at ON document_classifications;
CREATE TRIGGER update_document_classifications_updated_at 
    BEFORE UPDATE ON document_classifications 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to generate case email address
CREATE OR REPLACE FUNCTION generate_case_email(p_case_id INTEGER, p_domain VARCHAR DEFAULT 'mordecai.local')
RETURNS VARCHAR AS $$
DECLARE
    email_address VARCHAR;
BEGIN
    email_address := 'case-' || p_case_id || '@' || p_domain;
    
    INSERT INTO case_email_addresses (case_id, email_address)
    VALUES (p_case_id, email_address)
    ON CONFLICT (case_id) DO NOTHING;
    
    RETURN email_address;
END;
$$ LANGUAGE plpgsql;

-- Function to automatically create email address for new cases
CREATE OR REPLACE FUNCTION auto_create_case_email()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM generate_case_email(NEW.id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to create email address for new cases
DROP TRIGGER IF EXISTS create_case_email_trigger ON cases;
CREATE TRIGGER create_case_email_trigger
    AFTER INSERT ON cases
    FOR EACH ROW EXECUTE FUNCTION auto_create_case_email();
