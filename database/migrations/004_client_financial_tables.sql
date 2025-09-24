-- Migration 004: Client Financial and Personal Information Tables
-- This migration adds tables to support the comprehensive client management functionality

-- Client Income table
CREATE TABLE IF NOT EXISTS client_income (
    id SERIAL PRIMARY KEY,
    client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
    source VARCHAR(255) NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    frequency VARCHAR(20) DEFAULT 'monthly' CHECK (frequency IN ('weekly', 'monthly', 'annual')),
    type VARCHAR(50) DEFAULT 'employment' CHECK (type IN ('employment', 'benefits', 'pension', 'investment', 'other')),
    description TEXT,
    verified BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Client Expenditure table
CREATE TABLE IF NOT EXISTS client_expenditure (
    id SERIAL PRIMARY KEY,
    client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
    category VARCHAR(100) NOT NULL,
    description TEXT,
    amount DECIMAL(10,2) NOT NULL,
    frequency VARCHAR(20) DEFAULT 'monthly' CHECK (frequency IN ('weekly', 'monthly', 'annual')),
    is_essential BOOLEAN DEFAULT true,
    verified BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Client Debts table (separate from case-specific debts)
CREATE TABLE IF NOT EXISTS client_debts (
    id SERIAL PRIMARY KEY,
    client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
    creditor_name VARCHAR(255) NOT NULL,
    debt_type VARCHAR(100),
    original_amount DECIMAL(12,2),
    current_balance DECIMAL(12,2) NOT NULL,
    minimum_payment DECIMAL(10,2),
    interest_rate DECIMAL(5,2),
    is_priority BOOLEAN DEFAULT false,
    status VARCHAR(50) DEFAULT 'active',
    account_number VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Client Assets table (separate from case-specific assets)
CREATE TABLE IF NOT EXISTS client_assets (
    id SERIAL PRIMARY KEY,
    client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
    asset_type VARCHAR(100) NOT NULL,
    description TEXT,
    estimated_value DECIMAL(12,2),
    is_secured BOOLEAN DEFAULT false,
    secured_amount DECIMAL(12,2),
    ownership_percentage DECIMAL(5,2) DEFAULT 100.00,
    valuation_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Client Caseworkers table
CREATE TABLE IF NOT EXISTS client_caseworkers (
    id SERIAL PRIMARY KEY,
    client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(100),
    email VARCHAR(255),
    phone VARCHAR(20),
    organization VARCHAR(255),
    is_primary BOOLEAN DEFAULT false,
    start_date DATE,
    end_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Client Household Members table
CREATE TABLE IF NOT EXISTS client_household (
    id SERIAL PRIMARY KEY,
    client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    relationship VARCHAR(100),
    age INTEGER,
    date_of_birth DATE,
    dependent BOOLEAN DEFAULT false,
    income DECIMAL(10,2) DEFAULT 0,
    employment_status VARCHAR(100),
    benefits TEXT[],
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Financial Statements table
CREATE TABLE IF NOT EXISTS client_financial_statements (
    id SERIAL PRIMARY KEY,
    client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
    statement_type VARCHAR(50) DEFAULT 'sfs' CHECK (statement_type IN ('sfs', 'dro_fact_finder', 'iva_proposal')),
    data JSONB NOT NULL,
    generated_by INTEGER REFERENCES users(id),
    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_current BOOLEAN DEFAULT true,
    file_path TEXT
);

-- Update files table to support client-level files (not just case-level)
ALTER TABLE files ADD COLUMN client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE;

-- Update notes table to support client-level notes (not just case-level)  
ALTER TABLE notes ADD COLUMN client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE;

-- Update generated_letters table to support client-level letters
ALTER TABLE generated_letters ADD COLUMN client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_client_income_client_id ON client_income(client_id);
CREATE INDEX IF NOT EXISTS idx_client_expenditure_client_id ON client_expenditure(client_id);
CREATE INDEX IF NOT EXISTS idx_client_debts_client_id ON client_debts(client_id);
CREATE INDEX IF NOT EXISTS idx_client_assets_client_id ON client_assets(client_id);
CREATE INDEX IF NOT EXISTS idx_client_caseworkers_client_id ON client_caseworkers(client_id);
CREATE INDEX IF NOT EXISTS idx_client_household_client_id ON client_household(client_id);
CREATE INDEX IF NOT EXISTS idx_client_financial_statements_client_id ON client_financial_statements(client_id);
CREATE INDEX IF NOT EXISTS idx_files_client_id ON files(client_id);
CREATE INDEX IF NOT EXISTS idx_notes_client_id ON notes(client_id);
CREATE INDEX IF NOT EXISTS idx_generated_letters_client_id ON generated_letters(client_id);

-- Add constraints to ensure files and notes are linked to either a case or client (but not both)
ALTER TABLE files ADD CONSTRAINT files_case_or_client_check CHECK (
    (case_id IS NOT NULL AND client_id IS NULL) OR 
    (case_id IS NULL AND client_id IS NOT NULL)
);

ALTER TABLE notes ADD CONSTRAINT notes_case_or_client_check CHECK (
    (case_id IS NOT NULL AND client_id IS NULL) OR 
    (case_id IS NULL AND client_id IS NOT NULL)
);

ALTER TABLE generated_letters ADD CONSTRAINT letters_case_or_client_check CHECK (
    (case_id IS NOT NULL AND client_id IS NULL) OR 
    (case_id IS NULL AND client_id IS NOT NULL)
);