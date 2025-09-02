-- Migration for new features: Tasks, Creditors, Letter Templates, and Auditor role

-- Tasks table
CREATE TABLE IF NOT EXISTS tasks (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
    assigned_to INTEGER REFERENCES users(id),
    due_date DATE,
    case_id INTEGER REFERENCES cases(id),
    centre_id INTEGER NOT NULL REFERENCES centres(id),
    created_by INTEGER NOT NULL REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Creditors table
CREATE TABLE IF NOT EXISTS creditors (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    contact_person VARCHAR(255),
    phone VARCHAR(50),
    email VARCHAR(255),
    address TEXT,
    website VARCHAR(255),
    notes TEXT,
    creditor_type VARCHAR(50) DEFAULT 'credit_card' CHECK (creditor_type IN ('credit_card', 'loan', 'mortgage', 'utility', 'other')),
    preferred_contact_method VARCHAR(20) DEFAULT 'email' CHECK (preferred_contact_method IN ('email', 'phone', 'post', 'online')),
    centre_id INTEGER NOT NULL REFERENCES centres(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Case-Creditor relationship table
CREATE TABLE IF NOT EXISTS case_creditors (
    id SERIAL PRIMARY KEY,
    case_id INTEGER NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    creditor_id INTEGER NOT NULL REFERENCES creditors(id) ON DELETE CASCADE,
    debt_amount DECIMAL(10,2),
    original_debt DECIMAL(10,2),
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(case_id, creditor_id)
);

-- Creditor correspondence history
CREATE TABLE IF NOT EXISTS creditor_correspondence (
    id SERIAL PRIMARY KEY,
    creditor_id INTEGER NOT NULL REFERENCES creditors(id) ON DELETE CASCADE,
    case_id INTEGER NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    correspondence_type VARCHAR(50) DEFAULT 'email' CHECK (correspondence_type IN ('email', 'phone', 'letter', 'online')),
    subject VARCHAR(255),
    summary TEXT,
    correspondence_date DATE DEFAULT CURRENT_DATE,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'received', 'resolved')),
    created_by INTEGER NOT NULL REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Letter templates table
CREATE TABLE IF NOT EXISTS letter_templates (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(50) DEFAULT 'general' CHECK (category IN ('general', 'debt_management', 'payment_plan', 'legal', 'compliance')),
    subject VARCHAR(255),
    content TEXT NOT NULL,
    variables TEXT, -- JSON string of available variables
    is_active BOOLEAN DEFAULT true,
    centre_id INTEGER NOT NULL REFERENCES centres(id),
    created_by INTEGER NOT NULL REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Update users table to support auditor role
ALTER TABLE users 
DROP CONSTRAINT IF EXISTS users_role_check;

ALTER TABLE users 
ADD CONSTRAINT users_role_check 
CHECK (role IN ('manager', 'advisor', 'auditor'));

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_tasks_centre_id ON tasks(centre_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);

CREATE INDEX IF NOT EXISTS idx_creditors_centre_id ON creditors(centre_id);
CREATE INDEX IF NOT EXISTS idx_creditors_name ON creditors(name);
CREATE INDEX IF NOT EXISTS idx_creditors_type ON creditors(creditor_type);

CREATE INDEX IF NOT EXISTS idx_case_creditors_case_id ON case_creditors(case_id);
CREATE INDEX IF NOT EXISTS idx_case_creditors_creditor_id ON case_creditors(creditor_id);

CREATE INDEX IF NOT EXISTS idx_creditor_correspondence_creditor_id ON creditor_correspondence(creditor_id);
CREATE INDEX IF NOT EXISTS idx_creditor_correspondence_case_id ON creditor_correspondence(case_id);
CREATE INDEX IF NOT EXISTS idx_creditor_correspondence_date ON creditor_correspondence(correspondence_date);

CREATE INDEX IF NOT EXISTS idx_letter_templates_centre_id ON letter_templates(centre_id);
CREATE INDEX IF NOT EXISTS idx_letter_templates_category ON letter_templates(category);
CREATE INDEX IF NOT EXISTS idx_letter_templates_active ON letter_templates(is_active);

-- Insert sample data
INSERT INTO tasks (title, description, priority, status, assigned_to, centre_id, created_by) 
SELECT 
    'Review client financial statements',
    'Complete review of all pending client financial assessments',
    'high',
    'pending',
    u.id,
    u.centre_id,
    u.id
FROM users u WHERE u.role = 'advisor' LIMIT 1;

INSERT INTO creditors (name, contact_person, phone, email, creditor_type, centre_id)
VALUES 
    ('Barclaycard', 'Customer Services', '0800 151 0900', 'customer.services@barclaycard.co.uk', 'credit_card', 1),
    ('HSBC Personal Loans', 'Loans Department', '0345 740 4404', 'loans@hsbc.co.uk', 'loan', 1),
    ('British Gas', 'Debt Recovery', '0800 048 0202', 'debt.recovery@britishgas.co.uk', 'utility', 1);

INSERT INTO letter_templates (name, description, category, subject, content, centre_id, created_by)
SELECT 
    'Standard Debt Management Plan Proposal',
    'Template for proposing debt management plans to creditors',
    'debt_management',
    'Debt Management Plan Proposal - {{client_name}}',
    'Dear {{creditor_name}},

I am writing on behalf of my client, {{client_name}}, regarding their account with your organization.

My client is experiencing financial difficulties and would like to propose a Debt Management Plan to address their outstanding debt of £{{debt_amount}}.

Based on our assessment of their financial situation, my client can afford to pay £{{payment_offer}} per month towards this debt.

We would be grateful if you could consider this proposal and confirm your acceptance.

Yours sincerely,
{{advisor_name}}
{{centre_name}}',
    u.centre_id,
    u.id
FROM users u WHERE u.role = 'manager' LIMIT 1;
