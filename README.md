# CMA Case Management System

A comprehensive case management system for Community Money Advice centres, built with Node.js, Express, PostgreSQL, and React.

## 🎯 Projects in This Repository

### 1. CMA Case Management (Main Project)
Traditional centralized case management system for advice centres.

### 2. RMA Distributed System ([RMA-Demo/](./RMA-Demo/))
**NEW:** Distributed AI compute pool with 99.9% cost reduction!

```
Traditional Setup:  $730/month GPU server
Distributed Setup:  $1/month (Fly.io free tier + volunteers)
────────────────────────────────────────────────────
Savings:            $729/month (99.9% reduction)
```

**Architecture:**
- Free-tier coordinator (Fly.io)
- Volunteer worker pool (community donated)
- Real-time monitoring dashboard
- Auto-scaling and load balancing

**📖 See [RMA-Demo/VISUAL_SUMMARY.md](./RMA-Demo/VISUAL_SUMMARY.md) for diagrams**

---

## CMA System Features

### Core System
- **Multi-centre Management**: Complete data isolation and role-based access control
- **Client & Case Management**: Comprehensive tracking with financial analysis
- **Advanced Scheduling**: Automated appointment booking with intelligent rules
- **Enhanced Notes System**: Categories, tags, attachments, follow-ups, and templates
- **FCA Compliance**: Automated checklists, audit trails, and review scheduling
- **Credit Reporting**: Integration with Experian, Equifax, and TransUnion
- **AI Chatbot**: Context-aware assistant with OpenAI GPT-4 integration
- **Smart Notifications**: Multi-channel alerts (Email, SMS, Push) with preferences

### Advanced Features
- **Automated Workflows**: Rule-based scheduling and notification triggers
- **Credit Monitoring**: Real-time alerts and score tracking
- **Document Management**: Secure file storage with template generation
- **Financial Tools**: Debt recommendation engine and Excel export
- **Compliance Dashboard**: Real-time FCA compliance tracking
- **Audit Logging**: Complete activity trails for regulatory compliance

## Architecture

### Tech Stack
- **Backend**: Node.js, Express.js, PostgreSQL, Redis
- **Frontend**: React 19, Material-UI, WebSocket integration
- **AI Services**: Python FastAPI, OpenAI GPT-4, Transformers
- **Infrastructure**: Kubernetes, Docker, AWS EKS
- **CI/CD**: GitHub Actions, Trivy security scanning
- **Monitoring**: Prometheus, Grafana, Health checks

### Microservices Architecture
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   API Gateway   │    │   AI Chatbot    │
│   (React)       │    │   (Node.js)     │    │   (Python)      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
         ┌─────────────────────────────────────────────┐
         │              Load Balancer                  │
         │            (AWS ALB/Nginx)                  │
         └─────────────────────────────────────────────┘
                                 │
         ┌─────────────────────────────────────────────┐
         │                Database                     │
         │         (PostgreSQL + Redis)                │
         └─────────────────────────────────────────────┘
```

## Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- Docker & Docker Compose
- Kubernetes cluster (for production)

### Local Development

1. **Clone and Install**:
```bash
git clone <repository-url>
cd windsurf-project
npm install
cd client && npm install --legacy-peer-deps
```

2. **Environment Setup**:
```bash
cp .env.example .env
# Configure your database, API keys, and service credentials
```

3. **Database Setup**:
```bash
# Create database
createdb cma_system

# Run migrations
psql -d cma_system -f database/schema.sql
psql -d cma_system -f database/init.sql
```

4. **Start Development**:
```env
REACT_APP_API_URL=http://localhost:5000/api
```

## Running the Application

### Development Mode
```bash
# Start both server and client
npm run dev

# Or start separately:
# Server only
npm run server

# Client only (in another terminal)
npm run client
```

### Production Mode
```bash
# Build the client
npm run build

# Start the server
npm start
```

The application will be available at:
- Frontend: http://localhost:3000 (development) or http://localhost:5000 (production)
- Backend API: http://localhost:5000/api

## Default Login Credentials

After running the database initialization script, you can log in with:

**Manager Account:**
- Username: `manager1`
- Password: `password123`

**Advisor Accounts:**
- Username: `advisor1` / Password: `password123`
- Username: `advisor2` / Password: `password123`

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# Authentication
JWT_SECRET=your-super-secret-jwt-key

# File Storage
FILE_STORAGE_PATH=./uploads

# Optional: Email notifications
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# Optional: SMS notifications
TWILIO_ACCOUNT_SID=your-twilio-account-sid
TWILIO_AUTH_TOKEN=your-twilio-auth-token
TWILIO_PHONE_NUMBER=your-twilio-phone-number

# Chatbot
CHATBOT_URL=http://localhost:8001

# Environment
NODE_ENV=development
PORT=5000
```

## 📚 API Documentation

### Authentication Endpoints
- `POST /api/auth/login` - User authentication
- `POST /api/auth/register` - User registration (admin only)
- `GET /api/auth/me` - Current user profile
- `POST /api/auth/refresh` - Refresh JWT token

### Core Management
- `GET /api/clients` - List clients with pagination
- `POST /api/clients` - Create new client
- `GET /api/clients/:id` - Client details with cases
- `PUT /api/clients/:id` - Update client information
- `GET /api/cases` - List cases with filtering
- `POST /api/cases` - Create new case
- `GET /api/cases/:id` - Case details with full data

### Advanced Features
- `POST /api/document-ocr/scan` - OCR document processing
- `GET /api/document-ocr/jobs/:id/status` - OCR job status
- `POST /api/agentic-workflow/execute` - Execute workflow
- `GET /api/agentic-workflow/templates` - Available workflows
- `POST /api/case-filestore/:caseId/initialize` - Initialize case folders
- `POST /api/case-filestore/:caseId/folders/:folderId/upload` - Upload documents

### Credit Reports & Compliance
- `POST /api/credit-reports/generate` - Generate credit report
- `GET /api/credit-reports/:id` - Download report
- `POST /api/compliance/checklist` - Create compliance checklist
- `GET /api/compliance/case/:caseId` - Case compliance status

## 🧪 Testing

### Run Tests
```bash
# All tests
## Key Differentiators

### vs. Catalyst CMA
- ✅ Self-hosted AI (no external dependencies)
- ✅ Automated workflow engine
- ✅ Real-time analytics dashboards
- ✅ Advanced vulnerability tracking
- ✅ Intelligent document generation

### vs. AdvicePro
- ✅ Built-in AI automation
- ✅ Comprehensive workflow templates
- ✅ Advanced financial calculation tools
- ✅ Multi-dimensional risk assessment
- ✅ Open-source flexibility

## Performance & Scalability

- **Database Optimization**: 50+ indexes for fast queries
- **Caching Strategy**: Redis for session and data caching
- **Async Processing**: Background job processing
- **Load Balancing**: Kubernetes-ready architecture
- **Monitoring**: Prometheus metrics with Grafana visualization

## Testing

```bash
# Backend tests
npm test

# Frontend tests
cd client && npm test

# AI chatbot tests
cd chatbot && python -m pytest
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License - see LICENSE file for details.

## Support

For support and documentation, please refer to the comprehensive guides in the `/docs` directory or contact the development team.

## Support

For support and questions, please contact the development team or create an issue in the repository.
