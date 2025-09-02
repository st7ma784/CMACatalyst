# Database Schema Documentation

The CMA Case Management System uses PostgreSQL as its primary database, designed with multi-tenancy and data isolation as core principles. This document details the database structure, relationships, and design decisions.

## Core Design Principles

### Multi-Tenant Architecture
Every table that contains center-specific data includes a `centre_id` foreign key to ensure complete data isolation between debt advice centers.

### Audit Trail
All business-critical tables include audit fields for compliance and tracking:
- `created_at`: Record creation timestamp
- `updated_at`: Last modification timestamp
- `created_by`: User who created the record
- `updated_by`: User who last modified the record

### Soft Deletes
Important records use soft deletion with `deleted_at` timestamp to maintain data integrity and audit history.

## Database Schema Overview

```{mermaid}
erDiagram
    centres ||--o{ users : "employs"
    centres ||--o{ cases : "manages"
    centres ||--o{ appointments : "schedules"
    
    users ||--o{ cases : "advises"
    users ||--o{ appointments : "attends"
    users ||--o{ case_notes : "creates"
    users ||--o{ documents : "uploads"
    
    cases ||--o{ case_notes : "has"
    cases ||--o{ documents : "contains"
    cases ||--o{ budget_sheets : "includes"
    cases ||--o{ case_compliance : "requires"
    
    clients ||--o{ cases : "owns"
    clients ||--o{ appointments : "books"
    
    cases ||--o{ creditors : "involves"
    creditors ||--o{ debts : "owns"
    
    appointments ||--o{ appointment_notes : "has"
```

## Core Tables

### centres
The foundation table for multi-tenancy support.

```sql
CREATE TABLE centres (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(10) UNIQUE NOT NULL,
    address_line1 VARCHAR(255),
    address_line2 VARCHAR(255),
    city VARCHAR(100),
    postcode VARCHAR(20),
    phone VARCHAR(20),
    email VARCHAR(255),
    manager_id INTEGER REFERENCES users(id),
    status VARCHAR(20) DEFAULT 'active',
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Key Features:**
- Unique center code for identification
- JSONB settings for flexible configuration
- Manager relationship for center administration
- Status field for managing center lifecycle

### users
User management with role-based access control and center association.

```sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    centre_id INTEGER NOT NULL REFERENCES centres(id),
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'advisor', 'manager', 'trainee')),
    phone VARCHAR(20),
    hire_date DATE,
    qualification_level VARCHAR(50),
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMP,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Role Definitions:**
- **admin**: System-wide administrative access
- **manager**: Center management and staff oversight
- **advisor**: Full case management capabilities
- **trainee**: Limited access with supervision requirements

### clients
Client information with privacy protection and data retention compliance.

```sql
CREATE TABLE clients (
    id SERIAL PRIMARY KEY,
    centre_id INTEGER NOT NULL REFERENCES centres(id),
    client_reference VARCHAR(50) UNIQUE NOT NULL,
    title VARCHAR(10),
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    date_of_birth DATE,
    national_insurance_number VARCHAR(13),
    phone_primary VARCHAR(20),
    phone_secondary VARCHAR(20),
    email VARCHAR(255),
    address_line1 VARCHAR(255),
    address_line2 VARCHAR(255),
    city VARCHAR(100),
    postcode VARCHAR(20),
    marital_status VARCHAR(20),
    employment_status VARCHAR(50),
    monthly_income DECIMAL(10,2),
    dependents INTEGER DEFAULT 0,
    vulnerability_flags JSONB DEFAULT '[]',
    data_consent BOOLEAN DEFAULT false,
    data_consent_date TIMESTAMP,
    gdpr_deletion_request BOOLEAN DEFAULT false,
    gdpr_deletion_date TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER REFERENCES users(id),
    updated_by INTEGER REFERENCES users(id)
);
```

### cases
Central case management with status tracking and compliance monitoring.

```sql
CREATE TABLE cases (
    id SERIAL PRIMARY KEY,
    centre_id INTEGER NOT NULL REFERENCES centres(id),
    case_reference VARCHAR(50) UNIQUE NOT NULL,
    client_id INTEGER NOT NULL REFERENCES clients(id),
    advisor_id INTEGER NOT NULL REFERENCES users(id),
    case_type VARCHAR(50) NOT NULL,
    status VARCHAR(30) DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'closed', 'referred', 'cancelled')),
    priority VARCHAR(10) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    opening_date DATE NOT NULL DEFAULT CURRENT_DATE,
    closing_date DATE,
    closure_reason VARCHAR(100),
    total_debt DECIMAL(12,2),
    monthly_surplus DECIMAL(8,2),
    debt_solution VARCHAR(100),
    fca_outcome VARCHAR(100),
    compliance_status VARCHAR(30) DEFAULT 'pending',
    ai_risk_score DECIMAL(3,2),
    ai_recommendations JSONB DEFAULT '[]',
    next_review_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER REFERENCES users(id),
    updated_by INTEGER REFERENCES users(id)
);
```

**Status Workflow:**
1. **open**: Initial case creation
2. **in_progress**: Active advice delivery
3. **closed**: Case completed successfully
4. **referred**: Transferred to specialist service
5. **cancelled**: Case terminated without completion

## Financial Data Tables

### creditors
Creditor information with contact details and account management.

```sql
CREATE TABLE creditors (
    id SERIAL PRIMARY KEY,
    case_id INTEGER NOT NULL REFERENCES cases(id),
    creditor_name VARCHAR(255) NOT NULL,
    creditor_type VARCHAR(50),
    account_number VARCHAR(100),
    original_balance DECIMAL(10,2),
    current_balance DECIMAL(10,2),
    monthly_payment DECIMAL(8,2),
    interest_rate DECIMAL(5,2),
    arrears_amount DECIMAL(10,2),
    priority_level VARCHAR(20) DEFAULT 'non-priority',
    contact_name VARCHAR(100),
    contact_phone VARCHAR(20),
    contact_email VARCHAR(255),
    status VARCHAR(30) DEFAULT 'active',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### budget_sheets
Financial assessment and budgeting information.

```sql
CREATE TABLE budget_sheets (
    id SERIAL PRIMARY KEY,
    case_id INTEGER NOT NULL REFERENCES cases(id),
    sheet_type VARCHAR(30) DEFAULT 'initial' CHECK (sheet_type IN ('initial', 'revised', 'final')),
    total_income DECIMAL(10,2) NOT NULL DEFAULT 0,
    total_expenses DECIMAL(10,2) NOT NULL DEFAULT 0,
    surplus_deficit DECIMAL(10,2) GENERATED ALWAYS AS (total_income - total_expenses) STORED,
    income_details JSONB DEFAULT '{}',
    expense_details JSONB DEFAULT '{}',
    verification_status VARCHAR(30) DEFAULT 'unverified',
    verified_by INTEGER REFERENCES users(id),
    verified_date TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER REFERENCES users(id)
);
```

## Document Management

### documents
File management with version control and security features.

```sql
CREATE TABLE documents (
    id SERIAL PRIMARY KEY,
    centre_id INTEGER NOT NULL REFERENCES centres(id),
    case_id INTEGER REFERENCES cases(id),
    document_name VARCHAR(255) NOT NULL,
    document_type VARCHAR(100),
    file_path VARCHAR(500),
    file_size BIGINT,
    mime_type VARCHAR(100),
    version_number INTEGER DEFAULT 1,
    is_encrypted BOOLEAN DEFAULT false,
    encryption_key_id VARCHAR(100),
    upload_status VARCHAR(30) DEFAULT 'pending',
    ocr_status VARCHAR(30) DEFAULT 'not_processed',
    ocr_confidence DECIMAL(3,2),
    extracted_text TEXT,
    ai_classification JSONB DEFAULT '{}',
    access_level VARCHAR(30) DEFAULT 'case_team',
    retention_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER REFERENCES users(id)
);
```

## Scheduling and Appointments

### appointments
Appointment management with availability tracking.

```sql
CREATE TABLE appointments (
    id SERIAL PRIMARY KEY,
    centre_id INTEGER NOT NULL REFERENCES centres(id),
    case_id INTEGER REFERENCES cases(id),
    client_id INTEGER NOT NULL REFERENCES clients(id),
    advisor_id INTEGER NOT NULL REFERENCES users(id),
    appointment_type VARCHAR(50) NOT NULL,
    status VARCHAR(30) DEFAULT 'scheduled',
    scheduled_date DATE NOT NULL,
    scheduled_time TIME NOT NULL,
    duration_minutes INTEGER DEFAULT 60,
    location VARCHAR(255),
    meeting_mode VARCHAR(30) DEFAULT 'in_person',
    preparation_notes TEXT,
    outcome_summary TEXT,
    follow_up_required BOOLEAN DEFAULT false,
    follow_up_date DATE,
    reminder_sent BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER REFERENCES users(id)
);
```

## Compliance and Audit

### case_compliance
FCA compliance tracking and monitoring.

```sql
CREATE TABLE case_compliance (
    id SERIAL PRIMARY KEY,
    case_id INTEGER NOT NULL REFERENCES cases(id),
    compliance_type VARCHAR(100) NOT NULL,
    requirement_met BOOLEAN DEFAULT false,
    evidence_provided BOOLEAN DEFAULT false,
    evidence_document_id INTEGER REFERENCES documents(id),
    check_date DATE DEFAULT CURRENT_DATE,
    checked_by INTEGER REFERENCES users(id),
    notes TEXT,
    remedial_action TEXT,
    deadline_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### audit_logs
Comprehensive activity logging for security and compliance.

```sql
CREATE TABLE audit_logs (
    id BIGSERIAL PRIMARY KEY,
    centre_id INTEGER REFERENCES centres(id),
    user_id INTEGER REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    table_name VARCHAR(100),
    record_id INTEGER,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    session_id VARCHAR(255),
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## AI and ML Integration

### ai_insights
Machine learning analysis and recommendations.

```sql
CREATE TABLE ai_insights (
    id SERIAL PRIMARY KEY,
    case_id INTEGER NOT NULL REFERENCES cases(id),
    insight_type VARCHAR(100) NOT NULL,
    confidence_score DECIMAL(3,2),
    analysis_data JSONB NOT NULL,
    recommendations JSONB DEFAULT '[]',
    model_version VARCHAR(50),
    processed_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(30) DEFAULT 'active',
    feedback_rating INTEGER CHECK (feedback_rating BETWEEN 1 AND 5),
    feedback_notes TEXT
);
```

## Indexes and Performance

### Key Indexes
```sql
-- Multi-tenant filtering
CREATE INDEX idx_cases_centre_id ON cases(centre_id);
CREATE INDEX idx_users_centre_id ON users(centre_id);
CREATE INDEX idx_clients_centre_id ON clients(centre_id);
CREATE INDEX idx_appointments_centre_id ON appointments(centre_id);

-- Case management
CREATE INDEX idx_cases_advisor_status ON cases(advisor_id, status);
CREATE INDEX idx_cases_client_id ON cases(client_id);
CREATE INDEX idx_cases_reference ON cases(case_reference);

-- Appointment scheduling
CREATE INDEX idx_appointments_advisor_date ON appointments(advisor_id, scheduled_date);
CREATE INDEX idx_appointments_date_status ON appointments(scheduled_date, status);

-- Document search
CREATE INDEX idx_documents_case_type ON documents(case_id, document_type);
CREATE INDEX idx_documents_ocr_text ON documents USING gin(to_tsvector('english', extracted_text));

-- Audit and compliance
CREATE INDEX idx_audit_logs_user_timestamp ON audit_logs(user_id, timestamp);
CREATE INDEX idx_compliance_case_type ON case_compliance(case_id, compliance_type);
```

## Data Retention and Privacy

### GDPR Compliance
- **Right to Erasure**: Soft delete with anonymization after retention period
- **Data Portability**: JSON export functionality for all client data
- **Consent Tracking**: Explicit consent logging with timestamps
- **Audit Trail**: Complete activity history for data access and modifications

### Retention Policies
- **Active Cases**: Retained indefinitely while case is open
- **Closed Cases**: 6 years retention for FCA compliance
- **Financial Data**: 7 years retention for tax purposes
- **Audit Logs**: 10 years retention for security compliance
- **Personal Data**: Automatic anonymization after retention period

This database design ensures regulatory compliance, data security, and scalable performance while supporting the complex requirements of debt advice case management.
