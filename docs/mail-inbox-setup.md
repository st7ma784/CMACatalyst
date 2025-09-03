# Mail Inbox Setup Guide

This guide explains how to set up and configure mail inboxes for the MordecAI document processing system using only open-source, self-hosted solutions.

## Architecture Overview

The mail inbox system consists of:
- **Document Inbox Service**: Handles file uploads and email processing
- **MinIO**: Local object storage (S3-compatible)
- **RabbitMQ**: Message queue for document processing
- **OCR Processor**: Text extraction using Tesseract (no cloud dependencies)

## Email Configuration

### 1. Local SMTP Server Setup

For local development, use a local SMTP server like Postfix or Docker-based solutions:

```bash
# Using Docker for local SMTP testing
docker run -d -p 1025:1025 -p 1080:1080 mailhog/mailhog
```

### 2. Environment Variables

Configure the document-inbox service with these environment variables:

```env
# Email Configuration
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_SECURE=false
SMTP_USER=
SMTP_PASSWORD=
EMAIL_DOMAIN=mordecai.local

# Storage Configuration (MinIO)
MINIO_ENDPOINT=minio
MINIO_PORT=9000
MINIO_ROOT_USER=minioadmin
MINIO_ROOT_PASSWORD=minioadmin
MINIO_BUCKET=mordecai-documents

# Message Queue
RABBITMQ_URL=amqp://admin:password@rabbitmq:5672
```

## Case Email Registration

### 1. Automatic Email Generation

Each case automatically gets a unique email address:

```javascript
// Example: Case 123 gets email case-123@mordecai.local
const emailAddress = `case-${caseId}@${process.env.EMAIL_DOMAIN}`;
```

### 2. Email Processing Flow

1. **Incoming Email** → Document Inbox Service webhook
2. **Extract Attachments** → Upload to MinIO storage
3. **Queue Processing** → RabbitMQ message to OCR processor
4. **Text Extraction** → Tesseract OCR (local processing)
5. **Classification** → AI-based document classification
6. **Storage** → Structured data saved to PostgreSQL

### 3. Supported Document Types

- **Images**: JPEG, PNG, GIF, BMP
- **PDFs**: Full text extraction
- **Word Documents**: DOCX support
- **Email Attachments**: Automatic processing

## Local Development Setup

### 1. Start All Services

```bash
# Start the full stack locally
docker-compose up -d

# Check service health
curl http://localhost:3001/health  # Document Inbox
curl http://localhost:3002/health  # OCR Processor
curl http://localhost:8001/health  # Chatbot
```

### 2. MinIO Console Access

Access MinIO management console at: http://localhost:9001
- Username: `minioadmin`
- Password: `minioadmin`

### 3. RabbitMQ Management

Access RabbitMQ management at: http://localhost:15672
- Username: `admin`
- Password: `password`

## Production Email Setup

### 1. Real SMTP Configuration

For production, configure a real SMTP server:

```env
SMTP_HOST=your-smtp-server.com
SMTP_PORT=587
SMTP_SECURE=true
SMTP_USER=your-email@domain.com
SMTP_PASSWORD=your-app-password
EMAIL_DOMAIN=your-domain.com
```

### 2. Email Routing

Configure your email server to forward emails to the webhook:

```nginx
# Example nginx configuration for email webhook
location /api/email/webhook {
    proxy_pass http://document-inbox:3001;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}
```

## API Endpoints

### Document Upload
```http
POST /api/documents/upload
Content-Type: multipart/form-data

file: [binary file]
caseId: 123
documentType: debt_letter
```

### Email Webhook
```http
POST /api/email/webhook
Content-Type: application/json

{
  "to": "case-123@mordecai.local",
  "from": "creditor@bank.com",
  "subject": "Account Statement",
  "attachments": [
    {
      "filename": "statement.pdf",
      "content": "base64-encoded-content",
      "contentType": "application/pdf"
    }
  ]
}
```

### Case Files
```http
GET /api/cases/123/files
```

## Security Considerations

- All processing happens locally (no external APIs)
- MinIO provides S3-compatible storage on-premise
- Email data never leaves your infrastructure
- Document classification uses local models only
- OCR processing via Tesseract (open-source)

## Monitoring

Monitor the services using:
- Health check endpoints (`/health`)
- RabbitMQ management console
- MinIO console for storage usage
- Application logs in each service

## Troubleshooting

### Common Issues

1. **MinIO Connection Failed**
   - Check MinIO is running: `docker ps | grep minio`
   - Verify credentials in environment variables

2. **RabbitMQ Connection Failed**
   - Ensure RabbitMQ is healthy: `curl http://localhost:15672`
   - Check queue creation in management console

3. **OCR Processing Slow**
   - Tesseract processing is CPU-intensive
   - Consider allocating more CPU resources to OCR container
   - Monitor processing queue length

4. **Email Not Processing**
   - Check webhook endpoint is accessible
   - Verify email format matches expected pattern
   - Check document-inbox logs for errors