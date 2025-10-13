# OCR Demo - Automated Document Processing System

A comprehensive OCR-based document processing system that monitors Gmail for debt advice emails, extracts documents using OCR, processes debt information, and integrates with the Catalyst CMA system.

## 🎯 Overview

This system automatically:
- Monitors Gmail for emails sent to `+RMA@gmail.com`
- Extracts attachments from relevant emails
- Performs OCR on PDF and image documents
- Uses **Ollama LLM** for intelligent document analysis and client information extraction
- Extracts debt information using NLP
- Looks up or creates client cases in the Catalyst CMA system (with proper case detail retrieval)
- Uploads processed documents and debt records
- Provides a real-time monitoring dashboard

## 🏗️ Architecture

```
OCRDemo/
├── src/                    # Core application code
│   ├── main.py            # Flask web application & orchestrator
│   ├── gmail_service.py   # Gmail API integration
│   ├── ocr_processor.py   # OCR processing with Tesseract
│   ├── debt_extractor.py  # NLP-based debt extraction
│   ├── api_client.py      # Catalyst CMA API client
│   ├── database.py        # SQLite database operations
│   └── ollama_service.py  # Ollama LLM integration
├── templates/             # Web dashboard templates
│   ├── base.html         # Base template
│   └── dashboard.html    # Main dashboard interface
├── static/               # Static web assets
│   ├── css/dashboard.css # Dashboard styling
│   └── js/dashboard.js   # Dashboard JavaScript
├── credentials/          # Gmail API credentials (create this)
│   ├── credentials.json  # OAuth client configuration
│   └── token.json       # Access/refresh tokens (auto-created)
├── Dockerfile            # Container configuration
├── docker-compose.yml    # Service orchestration (includes Ollama)
├── requirements.txt      # Python dependencies
├── .env.example         # Environment variables template
├── setup.sh            # Automated setup script
├── GMAIL_SETUP.md      # Gmail API setup guide
└── README.md           # This file
```

## 🚀 Quick Start

### Prerequisites

- Docker and Docker Compose installed
- Gmail API credentials (OAuth2) - **See [GMAIL_SETUP.md](GMAIL_SETUP.md) for detailed setup**
- Access to Catalyst CMA system
- Linux/macOS environment (recommended)
- At least 4GB RAM (for Ollama LLM models)

### Installation

1. **Clone and navigate to the project:**
   ```bash
   cd OCRDemo
   ```

2. **Set up Gmail API credentials:**
   ```bash
   # Follow the detailed guide
   cat GMAIL_SETUP.md
   ```

3. **Run the automated setup:**
   ```bash
   ./setup.sh
   ```

4. **Configure environment variables:**
   - Edit `.env` file with your credentials
   - Run setup again: `./setup.sh`

5. **Authenticate with Gmail:**
   - Visit: http://localhost:5001/auth/gmail
   - Complete OAuth flow

6. **Access the dashboard:**
   - Open: http://localhost:5001
   - Monitor processing in real-time

## ⚙️ Configuration

### Environment Variables (.env)

```bash
# Gmail API Configuration
GMAIL_CLIENT_ID=your-client-id.googleusercontent.com
GMAIL_CLIENT_SECRET=your-client-secret
GMAIL_TARGET_EMAIL=+RMA@gmail.com

# Catalyst CMA System
CATALYST_BASE_URL=https://catalyst.communitymoneyadvice.com
CATALYST_USERNAME=your_username
CATALYST_PASSWORD=your_password

# Ollama LLM Configuration
OLLAMA_BASE_URL=http://ollama:11434
OLLAMA_MODEL=llama2:7b

# Application Settings
FLASK_PORT=5001
FLASK_DEBUG=false
GMAIL_CHECK_INTERVAL=300

# Security
SECRET_KEY=your_secret_key_here
```

### Gmail API Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable Gmail API
4. Create OAuth2 credentials
5. Add authorized redirect URI: `http://localhost:5001/auth/gmail/callback`
6. Download credentials and add to `.env`

### OCR Configuration

The system uses Tesseract OCR with automatic language detection and confidence filtering:
- Minimum confidence threshold: 60%
- Supported formats: PDF, PNG, JPG, TIFF
- Image enhancement: OpenCV preprocessing
- Output: Plain text with confidence scores

## � Enhanced Case Lookup Process

The system now implements a two-step process for accurate case number retrieval:

### Step 1: Search for Cases
```
POST /cases?perPage=20&filter={"client_name":{"like":"wade"}}
```
Returns a list of matching cases with basic information.

### Step 2: Get Case Details
For each matching case, the system retrieves detailed information by "double-clicking" the case:
```
GET /cases/{case_id}
```
This returns the complete case information including the actual case number used for document uploads.

This mimics the manual process users would follow in the Catalyst interface and ensures accurate case number retrieval.

## 📊 Dashboard Features

### Real-time Statistics
- Total emails processed
- Documents extracted
- Successful/failed uploads
- Processing status

### Document Management
- Recent document list
- Processing timestamps
- Confidence scores
- Error tracking

### System Health
- Gmail API status
- OCR engine status
- Catalyst API connectivity
- Auto-refresh monitoring

### Control Panel
- Manual email processing
- API connection testing
- Data refresh controls
- System configuration

## 🔧 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Main dashboard |
| `/health` | GET | System health check |
| `/api/stats` | GET | Processing statistics |
| `/api/recent_documents` | GET | Recent documents list |
| `/api/document/<email_id>` | GET | Document details |
| `/api/process_now` | POST | Trigger email processing |
| `/api/test_api` | GET | Test API connections |
| `/api/ollama/test` | GET | Test Ollama LLM connection |
| `/auth/gmail` | GET | Initiate Gmail OAuth flow |
| `/auth/gmail/callback` | GET | Gmail OAuth callback |

## 🎛️ Management Commands

### Start/Stop Services
```bash
# Start all services
docker-compose up -d

# Stop all services
docker-compose down

# Restart services
docker-compose restart

# View logs
docker-compose logs -f ocr-demo
```

### Database Management
```bash
# Access database shell
docker-compose exec ocr-demo sqlite3 /app/data/ocr_demo.db

# Backup database
docker-compose exec ocr-demo cp /app/data/ocr_demo.db /app/data/backup_$(date +%Y%m%d_%H%M%S).db

# View processed documents
ls -la processed_docs/
```

### Debugging
```bash
# Check service status
docker-compose ps

# View application logs
docker-compose logs ocr-demo

# Check Gmail connectivity
curl http://localhost:5001/api/test_api

# Monitor processing
curl http://localhost:5001/api/processing_status
```

## 🔍 Debt Extraction Engine

The NLP-based debt extraction system identifies:

### Monetary Amounts
- Currency symbols (£, $, €)
- Decimal and comma separators
- Contextual amount validation
- Outstanding balance recognition

### Creditor Information
- Company name extraction
- Financial institution identification
- Contact information parsing
- Account number recognition

### Debt Classification
- Priority debt identification
- Debt type categorization
- Account status determination
- Payment history extraction

## 🔒 Security Features

### Authentication
- OAuth2 for Gmail access
- Cookie-based session management
- Encrypted credential storage
- API key rotation support

### Data Protection
- Local file encryption
- Secure API communications
- Audit trail logging
- Personal data anonymization

### Access Control
- Role-based permissions
- IP-based restrictions
- Rate limiting
- Session timeout management

## 📈 Monitoring & Alerts

### Performance Metrics
- Processing time per document
- OCR accuracy rates
- API response times
- Error frequency tracking

### Health Monitoring
- Service availability checks
- Resource utilization alerts
- Failed processing notifications
- System dependency status

### Logging
- Structured JSON logging
- Configurable log levels
- Log rotation and archival
- Centralized log aggregation

## 🔧 Troubleshooting

### Common Issues

**Gmail Authentication Fails:**
```bash
# Check credentials
curl http://localhost:5001/api/test_api

# Re-authenticate
# Visit: http://localhost:5001/auth/gmail
```

**OCR Processing Errors:**
```bash
# Check Tesseract installation
docker-compose exec ocr-demo tesseract --version

# Verify file permissions
docker-compose exec ocr-demo ls -la /app/temp/
```

**API Connection Issues:**
```bash
# Test Catalyst API
curl -X POST http://localhost:5001/api/test_api

# Check network connectivity
docker-compose exec ocr-demo ping catalyst.communitymoneyadvice.com
```

### Log Analysis
```bash
# View error logs
docker-compose logs ocr-demo | grep ERROR

# Monitor processing
docker-compose logs -f ocr-demo | grep "Processing"

# Check system health
curl http://localhost:5001/health | jq
```

## 🧪 Testing

### Unit Tests
```bash
# Run all tests
docker-compose run --rm ocr-demo python -m pytest

# Run specific test suite
docker-compose run --rm ocr-demo python -m pytest tests/test_ocr.py

# Coverage report
docker-compose run --rm ocr-demo python -m pytest --cov=src
```

### Integration Tests
```bash
# Test Gmail integration
docker-compose run --rm ocr-demo python tests/test_gmail_integration.py

# Test OCR processing
docker-compose run --rm ocr-demo python tests/test_ocr_integration.py

# Test API client
docker-compose run --rm ocr-demo python tests/test_api_client.py
```

## 📦 Deployment

### Production Deployment
1. Use environment-specific `.env` files
2. Configure external database (PostgreSQL recommended)
3. Set up SSL/TLS certificates
4. Configure reverse proxy (nginx)
5. Implement backup strategies

### Scaling Considerations
- Horizontal scaling with multiple instances
- Message queue for email processing
- External storage for documents
- Load balancing for web interface

## 🤝 Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature-name`
3. Commit changes: `git commit -am 'Add feature'`
4. Push branch: `git push origin feature-name`
5. Submit pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 📞 Support

For support and questions:
- Create an issue on GitHub
- Check the troubleshooting guide
- Review application logs
- Contact the development team

---

**Note:** This system handles sensitive financial data. Ensure compliance with relevant data protection regulations (GDPR, etc.) and implement appropriate security measures for production use.