-- Database initialization script for CMA Case Management System
-- Run this script to set up the database with initial data

-- Create database (run as postgres superuser)
-- CREATE DATABASE cma_case_management;
-- \c cma_case_management;

-- Run the main schema
\i schema.sql

-- Insert sample centre
INSERT INTO centres (name, address, phone, email, letterhead_address, letterhead_contact) VALUES
('Community Money Advice Centre', '123 High Street, London, SW1A 1AA', '020 7123 4567', 'info@cmacentre.org.uk', 
 '123 High Street\nLondon SW1A 1AA\nTel: 020 7123 4567', 'For enquiries contact: info@cmacentre.org.uk');

-- Insert sample users (password is 'password123' for all users)
INSERT INTO users (centre_id, username, email, password_hash, first_name, last_name, role) VALUES
(1, 'manager1', 'manager@cmacentre.org.uk', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LeVMpYxNg3jQ0OQAm', 'Sarah', 'Johnson', 'manager'),
(1, 'advisor1', 'john.smith@cmacentre.org.uk', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LeVMpYxNg3jQ0OQAm', 'John', 'Smith', 'advisor'),
(1, 'advisor2', 'emma.brown@cmacentre.org.uk', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LeVMpYxNg3jQ0OQAm', 'Emma', 'Brown', 'advisor');

-- Insert sample clients
INSERT INTO clients (centre_id, first_name, last_name, date_of_birth, phone, email, address, relationship_status, dependents, employment_status) VALUES
(1, 'Michael', 'Wilson', '1985-03-15', '07123456789', 'michael.wilson@email.com', '45 Oak Avenue, Manchester, M1 2AB', 'Married', 2, 'Part-time'),
(1, 'Lisa', 'Davis', '1978-11-22', '07987654321', 'lisa.davis@email.com', '78 Pine Road, Birmingham, B2 3CD', 'Single', 1, 'Unemployed'),
(1, 'Robert', 'Taylor', '1990-07-08', '07555123456', 'robert.taylor@email.com', '12 Elm Street, Leeds, LS1 4EF', 'Divorced', 0, 'Full-time'),
(1, 'Jennifer', 'Anderson', '1982-09-30', '07444987654', 'jennifer.anderson@email.com', '33 Maple Close, Liverpool, L3 5GH', 'Married', 3, 'Self-employed');

-- Insert sample cases
INSERT INTO cases (client_id, centre_id, assigned_advisor_id, case_number, debt_stage, priority, status, total_debt, monthly_income, monthly_expenses, disposable_income) VALUES
(1, 1, 2, 'CMA-2024-001', 'assessment', 'high', 'active', 25000.00, 1800.00, 1650.00, 150.00),
(2, 1, 2, 'CMA-2024-002', 'budgeting', 'urgent', 'active', 18500.00, 800.00, 950.00, -150.00),
(3, 1, 3, 'CMA-2024-003', 'negotiation', 'medium', 'active', 12000.00, 2200.00, 1800.00, 400.00),
(4, 1, 3, 'CMA-2024-004', 'assessment', 'low', 'active', 8500.00, 1500.00, 1300.00, 200.00);

-- Insert sample assets
INSERT INTO assets (case_id, asset_type, description, estimated_value, is_secured) VALUES
(1, 'property', 'Family home (mortgaged)', 180000.00, true),
(1, 'vehicle', '2018 Ford Focus', 8000.00, false),
(1, 'savings', 'ISA account', 2500.00, false),
(3, 'property', 'Flat (owned outright)', 120000.00, false),
(3, 'vehicle', '2020 Honda Civic', 12000.00, false),
(4, 'savings', 'Current account', 500.00, false);

-- Insert sample debts
INSERT INTO debts (case_id, creditor_name, debt_type, original_amount, current_balance, minimum_payment, interest_rate, is_priority, status) VALUES
(1, 'Barclaycard', 'credit_card', 8000.00, 7500.00, 150.00, 19.9, false, 'active'),
(1, 'Capital One', 'credit_card', 5000.00, 4800.00, 120.00, 24.9, false, 'active'),
(1, 'Santander Personal Loan', 'loan', 12000.00, 9500.00, 280.00, 8.5, false, 'active'),
(1, 'Council Tax', 'council_tax', 1500.00, 1200.00, 100.00, 0.0, true, 'active'),
(2, 'MBNA Credit Card', 'credit_card', 6000.00, 5800.00, 145.00, 22.9, false, 'active'),
(2, 'British Gas', 'utility', 800.00, 750.00, 50.00, 0.0, true, 'active'),
(2, 'Council Tax Arrears', 'council_tax', 2200.00, 2200.00, 150.00, 0.0, true, 'active'),
(2, 'Provident Loan', 'loan', 3000.00, 2800.00, 120.00, 35.0, false, 'active'),
(3, 'Halifax Credit Card', 'credit_card', 4000.00, 3500.00, 90.00, 18.9, false, 'active'),
(3, 'Tesco Personal Loan', 'loan', 8000.00, 6500.00, 180.00, 6.9, false, 'active'),
(4, 'Nationwide Credit Card', 'credit_card', 3000.00, 2800.00, 70.00, 16.9, false, 'active'),
(4, 'EDF Energy', 'utility', 400.00, 350.00, 30.00, 0.0, true, 'active');

-- Insert sample appointments
INSERT INTO appointments (case_id, user_id, title, description, appointment_date, duration_minutes, location, appointment_type, status, client_confirmed) VALUES
(1, 2, 'Initial Assessment', 'First meeting to assess financial situation', '2024-09-02 10:00:00', 90, 'Office - Room 1', 'consultation', 'scheduled', false),
(2, 2, 'Budget Review', 'Review monthly budget and expenses', '2024-09-02 14:00:00', 60, 'Office - Room 2', 'follow_up', 'confirmed', true),
(3, 3, 'Creditor Negotiation Update', 'Discuss progress with creditor negotiations', '2024-09-03 11:00:00', 45, 'Phone', 'phone_call', 'scheduled', false),
(4, 3, 'Home Visit', 'Visit client at home to complete paperwork', '2024-09-04 15:00:00', 120, 'Client Home', 'home_visit', 'confirmed', true);

-- Insert sample notes
INSERT INTO notes (case_id, user_id, title, content, note_type, is_private) VALUES
(1, 2, 'Initial Contact', 'Client contacted via phone. Very stressed about debt situation. Arranged initial appointment for assessment.', 'phone_call', false),
(1, 2, 'Assessment Meeting', 'Completed full financial assessment. Client has good income but high credit card debts. Recommended debt management plan.', 'meeting', false),
(2, 2, 'Urgent Action Required', 'Client facing eviction notice. Need to contact council housing department immediately.', 'action_required', false),
(3, 3, 'Creditor Response', 'Halifax agreed to freeze interest and accept reduced payments of £50/month. Tesco Bank still considering proposal.', 'general', false);

-- Insert sample letter templates
INSERT INTO letter_templates (centre_id, name, subject, content, template_type, is_active) VALUES
(1, 'Debt Management Plan Proposal', 'Debt Management Plan Proposal for {{client.full_name}}', 
'Dear {{recipient.name}},

I am writing on behalf of {{client.full_name}} regarding their account with your company.

{{client.full_name}} is currently experiencing financial difficulties and has sought advice from our debt advice service. After completing a thorough assessment of their financial situation, we have prepared a Debt Management Plan (DMP).

Client Details:
- Name: {{client.full_name}}
- Address: {{client.address}}
- Account Reference: [Please insert]

Financial Summary:
- Total Monthly Income: {{case.monthly_income}}
- Total Monthly Expenses: {{case.monthly_expenses}}
- Available for Creditors: {{case.disposable_income}}

We propose the following monthly payment arrangement:
[Payment details to be inserted]

We would be grateful if you could consider this proposal and confirm your acceptance in writing.

Yours sincerely,

{{centre.name}}
{{centre.letterhead_contact}}', 'debt_management_plan', true),

(1, 'Payment Arrangement Request', 'Payment Arrangement Request - {{client.full_name}}',
'Dear Sir/Madam,

I am writing on behalf of {{client.full_name}} to request a payment arrangement for their account.

{{client.full_name}} is currently experiencing temporary financial difficulties due to [reason]. They are committed to clearing this debt and would like to propose a payment arrangement.

Proposed Payment: £[amount] per month starting from [date]

Please confirm if this arrangement is acceptable.

Thank you for your consideration.

Yours faithfully,

{{centre.name}}', 'payment_arrangement', true);

-- Insert sample note templates
INSERT INTO note_templates (centre_id, name, content, template_type, is_active) VALUES
(1, 'Initial Phone Contact', 'Client contacted via phone on [date]. Discussed: [key points]. Next steps: [actions]. Follow-up required: [when].', 'phone_call', true),
(1, 'Assessment Meeting', 'Completed financial assessment on [date]. Income: £[amount]. Expenses: £[amount]. Disposable income: £[amount]. Recommendations: [advice given].', 'meeting', true),
(1, 'Creditor Contact', 'Contacted [creditor] on [date]. Outcome: [result]. Next steps: [actions]. Follow-up required: [when].', 'general', true);

-- Create indexes for better performance (already in schema.sql but ensuring they exist)
CREATE INDEX IF NOT EXISTS idx_users_centre_id ON users(centre_id);
CREATE INDEX IF NOT EXISTS idx_clients_centre_id ON clients(centre_id);
CREATE INDEX IF NOT EXISTS idx_cases_client_id ON cases(client_id);
CREATE INDEX IF NOT EXISTS idx_cases_centre_id ON cases(centre_id);
CREATE INDEX IF NOT EXISTS idx_cases_assigned_advisor_id ON cases(assigned_advisor_id);
CREATE INDEX IF NOT EXISTS idx_appointments_case_id ON appointments(case_id);
CREATE INDEX IF NOT EXISTS idx_appointments_user_id ON appointments(user_id);
CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(appointment_date);
CREATE INDEX IF NOT EXISTS idx_notes_case_id ON notes(case_id);
CREATE INDEX IF NOT EXISTS idx_files_case_id ON files(case_id);

-- Grant permissions (adjust as needed for your setup)
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO cma_user;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO cma_user;
