# API Reference Documentation

This document provides comprehensive API reference for the CMA Case Management System, including authentication, endpoints, request/response formats, and integration examples.

## Base URL and Versioning

```
Production: https://api.cma-platform.com/v1
Development: https://dev-api.cma-platform.com/v1
Local: http://localhost:5000/api/v1
```

## Authentication

### JWT Token Authentication
All API requests require a valid JWT token in the Authorization header:

```http
Authorization: Bearer <jwt_token>
```

### Login Endpoint
```http
POST /auth/login
Content-Type: application/json

{
  "email": "advisor@debtcentre.com",
  "password": "secure_password"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": 123,
      "email": "advisor@debtcentre.com",
      "firstName": "John",
      "lastName": "Smith",
      "role": "advisor",
      "centreId": 1,
      "centreName": "Manchester Debt Centre"
    },
    "expiresIn": 3600
  }
}
```

### Token Refresh
```http
POST /auth/refresh
Content-Type: application/json

{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

## Error Handling

### Standard Error Response Format
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input data",
    "details": [
      {
        "field": "email",
        "message": "Email is required"
      }
    ],
    "timestamp": "2024-01-15T10:30:00Z",
    "requestId": "req_123456789"
  }
}
```

### HTTP Status Codes
- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `422` - Validation Error
- `429` - Rate Limited
- `500` - Internal Server Error

## Cases API

### List Cases
```http
GET /cases?page=1&limit=20&status=open&advisor_id=123
Authorization: Bearer <token>
```

**Query Parameters:**
- `page` (integer): Page number (default: 1)
- `limit` (integer): Records per page (default: 20, max: 100)
- `status` (string): Filter by status (`open`, `in_progress`, `closed`, `referred`, `cancelled`)
- `advisor_id` (integer): Filter by advisor ID
- `client_name` (string): Search by client name
- `case_reference` (string): Search by case reference
- `priority` (string): Filter by priority (`low`, `medium`, `high`, `urgent`)
- `date_from` (date): Filter cases from date (YYYY-MM-DD)
- `date_to` (date): Filter cases to date (YYYY-MM-DD)

**Response:**
```json
{
  "success": true,
  "data": {
    "cases": [
      {
        "id": 1,
        "caseReference": "MC-2024-001",
        "client": {
          "id": 1,
          "firstName": "Jane",
          "lastName": "Doe",
          "email": "jane.doe@email.com",
          "phone": "01234567890"
        },
        "advisor": {
          "id": 123,
          "firstName": "John",
          "lastName": "Smith"
        },
        "status": "open",
        "priority": "medium",
        "caseType": "debt_advice",
        "totalDebt": 25000.00,
        "monthlySurplus": -150.00,
        "openingDate": "2024-01-10",
        "nextReviewDate": "2024-02-10",
        "aiRiskScore": 0.65,
        "complianceStatus": "compliant",
        "createdAt": "2024-01-10T09:00:00Z",
        "updatedAt": "2024-01-15T14:30:00Z"
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 5,
      "totalRecords": 95,
      "hasNextPage": true,
      "hasPreviousPage": false
    }
  }
}
```

### Get Case Details
```http
GET /cases/{case_id}
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "caseReference": "MC-2024-001",
    "client": {
      "id": 1,
      "firstName": "Jane",
      "lastName": "Doe",
      "dateOfBirth": "1985-06-15",
      "email": "jane.doe@email.com",
      "phone": "01234567890",
      "address": {
        "line1": "123 Main Street",
        "line2": "",
        "city": "Manchester",
        "postcode": "M1 1AA"
      },
      "maritalStatus": "single",
      "employmentStatus": "employed",
      "monthlyIncome": 2500.00,
      "dependents": 1,
      "vulnerabilityFlags": ["mental_health", "disability"]
    },
    "advisor": {
      "id": 123,
      "firstName": "John",
      "lastName": "Smith",
      "email": "john.smith@debtcentre.com"
    },
    "status": "open",
    "priority": "medium",
    "caseType": "debt_advice",
    "totalDebt": 25000.00,
    "monthlySurplus": -150.00,
    "debtSolution": null,
    "fcaOutcome": null,
    "openingDate": "2024-01-10",
    "closingDate": null,
    "nextReviewDate": "2024-02-10",
    "aiRiskScore": 0.65,
    "aiRecommendations": [
      {
        "type": "debt_management_plan",
        "confidence": 0.78,
        "reasoning": "Client has regular income with manageable debt levels"
      }
    ],
    "complianceStatus": "compliant",
    "creditors": [
      {
        "id": 1,
        "name": "Credit Card Company A",
        "type": "credit_card",
        "accountNumber": "****1234",
        "originalBalance": 8000.00,
        "currentBalance": 7500.00,
        "monthlyPayment": 150.00,
        "interestRate": 19.9,
        "arrearsAmount": 300.00,
        "priorityLevel": "non-priority"
      }
    ],
    "documents": [
      {
        "id": 1,
        "name": "Bank Statement - January 2024",
        "type": "bank_statement",
        "uploadDate": "2024-01-10T10:00:00Z",
        "size": 1024000,
        "status": "processed"
      }
    ],
    "createdAt": "2024-01-10T09:00:00Z",
    "updatedAt": "2024-01-15T14:30:00Z"
  }
}
```

### Create New Case
```http
POST /cases
Authorization: Bearer <token>
Content-Type: application/json

{
  "clientId": 1,
  "caseType": "debt_advice",
  "priority": "medium",
  "totalDebt": 25000.00,
  "monthlySurplus": -150.00,
  "creditors": [
    {
      "name": "Credit Card Company A",
      "type": "credit_card",
      "currentBalance": 7500.00,
      "monthlyPayment": 150.00,
      "interestRate": 19.9,
      "priorityLevel": "non-priority"
    }
  ],
  "notes": "Initial assessment completed. Client seeking debt management options."
}
```

### Update Case
```http
PUT /cases/{case_id}
Authorization: Bearer <token>
Content-Type: application/json

{
  "status": "in_progress",
  "priority": "high",
  "debtSolution": "debt_management_plan",
  "monthlySurplus": 50.00,
  "nextReviewDate": "2024-03-15"
}
```

## Clients API

### List Clients
```http
GET /clients?page=1&limit=20&search=jane
Authorization: Bearer <token>
```

**Query Parameters:**
- `page` (integer): Page number
- `limit` (integer): Records per page
- `search` (string): Search by name or email
- `vulnerability` (string): Filter by vulnerability flag

### Create Client
```http
POST /clients
Authorization: Bearer <token>
Content-Type: application/json

{
  "firstName": "Jane",
  "lastName": "Doe",
  "dateOfBirth": "1985-06-15",
  "email": "jane.doe@email.com",
  "phone": "01234567890",
  "address": {
    "line1": "123 Main Street",
    "city": "Manchester",
    "postcode": "M1 1AA"
  },
  "maritalStatus": "single",
  "employmentStatus": "employed",
  "monthlyIncome": 2500.00,
  "dependents": 1,
  "vulnerabilityFlags": ["mental_health"],
  "dataConsent": true
}
```

## Appointments API

### List Appointments
```http
GET /appointments?date=2024-01-15&advisor_id=123
Authorization: Bearer <token>
```

**Query Parameters:**
- `date` (date): Filter by specific date
- `date_from` (date): Filter from date
- `date_to` (date): Filter to date
- `advisor_id` (integer): Filter by advisor
- `status` (string): Filter by status
- `type` (string): Filter by appointment type

### Create Appointment
```http
POST /appointments
Authorization: Bearer <token>
Content-Type: application/json

{
  "clientId": 1,
  "caseId": 1,
  "advisorId": 123,
  "appointmentType": "initial_assessment",
  "scheduledDate": "2024-01-20",
  "scheduledTime": "10:00",
  "durationMinutes": 60,
  "location": "Office 1",
  "meetingMode": "in_person",
  "preparationNotes": "Review client's financial documents"
}
```

## Documents API

### Upload Document
```http
POST /documents
Authorization: Bearer <token>
Content-Type: multipart/form-data

{
  "file": <file_data>,
  "caseId": 1,
  "documentType": "bank_statement",
  "documentName": "January Bank Statement"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "January Bank Statement",
    "type": "bank_statement",
    "size": 1024000,
    "mimeType": "application/pdf",
    "uploadStatus": "processing",
    "ocrStatus": "pending",
    "createdAt": "2024-01-15T10:00:00Z"
  }
}
```

### Get Document
```http
GET /documents/{document_id}
Authorization: Bearer <token>
```

### Download Document
```http
GET /documents/{document_id}/download
Authorization: Bearer <token>
```

## AI Services API

### Get Case Analysis
```http
GET /ai/cases/{case_id}/analysis
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "riskScore": 0.65,
    "riskLevel": "medium",
    "contributingFactors": [
      {
        "factor": "debt_to_income_ratio",
        "impact": 0.3,
        "description": "High debt relative to income"
      }
    ],
    "recommendations": [
      {
        "solution": "debt_management_plan",
        "suitabilityScore": 0.78,
        "estimatedDuration": "36 months",
        "estimatedMonthlyPayment": 650.00,
        "confidence": 0.85
      }
    ],
    "complianceChecks": {
      "overallScore": 0.92,
      "checks": [
        {
          "requirement": "affordability_assessment",
          "status": "compliant",
          "confidence": 0.95
        }
      ]
    },
    "modelVersion": "v2.1.0",
    "processedAt": "2024-01-15T10:30:00Z"
  }
}
```

### Process Document with OCR
```http
POST /ai/documents/{document_id}/process
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "extractedText": "Bank Statement...",
    "confidence": 0.92,
    "classification": "bank_statement",
    "extractedFields": {
      "accountNumber": "12345678",
      "balance": 1250.00,
      "statementDate": "2024-01-31",
      "transactions": [
        {
          "date": "2024-01-15",
          "description": "SALARY PAYMENT",
          "amount": 2500.00,
          "type": "credit"
        }
      ]
    },
    "processingTime": 2.5
  }
}
```

## Compliance API

### Get Compliance Status
```http
GET /compliance/cases/{case_id}
Authorization: Bearer <token>
```

### Submit Compliance Check
```http
POST /compliance/cases/{case_id}/checks
Authorization: Bearer <token>
Content-Type: application/json

{
  "complianceType": "affordability_assessment",
  "requirementMet": true,
  "evidenceProvided": true,
  "evidenceDocumentId": 123,
  "notes": "Comprehensive affordability assessment completed"
}
```

## Centers Management API

### List Centers (Admin/Manager only)
```http
GET /centers
Authorization: Bearer <token>
```

### Create Center Registration (Public endpoint)
```http
POST /centers/register
Content-Type: application/json

{
  "centerInfo": {
    "name": "Birmingham Debt Centre",
    "code": "BDC",
    "address": {
      "line1": "456 High Street",
      "city": "Birmingham",
      "postcode": "B1 1BB"
    },
    "phone": "0121234567",
    "email": "info@birminghamdebt.org"
  },
  "managerInfo": {
    "firstName": "Sarah",
    "lastName": "Johnson",
    "email": "sarah.johnson@birminghamdebt.org",
    "phone": "0121234568",
    "qualificationLevel": "Level 4 Debt Advice"
  },
  "registrationReason": "Expanding debt advice services in Birmingham area"
}
```

## Rate Limiting

API endpoints are rate limited to prevent abuse:

- **Authentication endpoints**: 5 requests per minute
- **Standard endpoints**: 100 requests per minute
- **Upload endpoints**: 10 requests per minute
- **AI processing endpoints**: 20 requests per minute

Rate limit headers are included in responses:
```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1642781600
```

## Webhooks

### Webhook Events
Subscribe to real-time events:

- `case.created`
- `case.updated` 
- `case.status_changed`
- `appointment.scheduled`
- `appointment.completed`
- `document.processed`
- `compliance.check_failed`

### Webhook Payload Example
```json
{
  "event": "case.status_changed",
  "timestamp": "2024-01-15T10:30:00Z",
  "data": {
    "caseId": 123,
    "oldStatus": "open",
    "newStatus": "in_progress",
    "updatedBy": {
      "id": 456,
      "name": "John Smith"
    }
  },
  "signature": "sha256=..."
}
```

## SDK Examples

### JavaScript/Node.js
```javascript
const CMAClient = require('@cma/api-client');

const client = new CMAClient({
  baseURL: 'https://api.cma-platform.com/v1',
  apiKey: 'your-api-key'
});

// List cases
const cases = await client.cases.list({
  status: 'open',
  page: 1,
  limit: 20
});

// Create new case
const newCase = await client.cases.create({
  clientId: 1,
  caseType: 'debt_advice',
  priority: 'medium'
});

// Upload document
const document = await client.documents.upload({
  file: fileBuffer,
  caseId: 1,
  documentType: 'bank_statement'
});
```

### Python
```python
from cma_client import CMAClient

client = CMAClient(
    base_url='https://api.cma-platform.com/v1',
    api_key='your-api-key'
)

# List cases
cases = client.cases.list(
    status='open',
    page=1,
    limit=20
)

# Get AI analysis
analysis = client.ai.get_case_analysis(case_id=123)

# Process document
result = client.ai.process_document(document_id=456)
```

This API documentation provides comprehensive coverage of all available endpoints, authentication methods, and integration examples for developers working with the CMA Case Management System.
