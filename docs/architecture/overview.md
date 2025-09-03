# System Architecture Overview

The CMA Case Management System employs a modern, cloud-native architecture designed for scalability, security, and multi-tenancy. This document provides a comprehensive overview of the system's architectural components and design decisions.

## High-Level Architecture

```{mermaid}
graph TB
    subgraph "Client Layer"
        WEB[React Web App with Enhanced Chatbot]
        MOB[Mobile PWA]
        API_CLIENTS[API Clients]
    end
    
    subgraph "Load Balancer"
        NGINX[NGINX Load Balancer]
    end
    
    subgraph "Core Application Services"
        CORE[Main API Service<br/>Port: 5000]
        AUTH[Authentication & Authorization]
    end
    
    subgraph "AI/ML Services (Local)"
        CHATBOT[Chatbot Service<br/>Port: 8001<br/>LLM + MCP + CoA]
        TRANSLATE[Translation Service<br/>Port: 8003<br/>Helsinki-NLP Models]
    end
    
    subgraph "Document Processing Services"
        DOC_INBOX[Document Inbox<br/>Port: 3001<br/>Email + Upload]
        OCR[OCR Processor<br/>Port: 3002<br/>Tesseract + Classification]
    end
    
    subgraph "Data Storage"
        POSTGRES[PostgreSQL<br/>Primary Database]
        REDIS[Redis<br/>Cache + Sessions]
        MINIO[MinIO<br/>S3-Compatible Storage]
    end
    
    subgraph "Message Queue"
        RABBITMQ[RabbitMQ<br/>Document Processing Queue]
    end
    
    WEB --> NGINX
    MOB --> NGINX
    API_CLIENTS --> NGINX
    
    NGINX --> CORE
    NGINX --> CHATBOT
    NGINX --> TRANSLATE
    
    CORE --> AUTH
    CORE --> POSTGRES
    CORE --> REDIS
    CORE --> CHATBOT
    CORE --> TRANSLATE
    
    CHATBOT --> POSTGRES
    CHATBOT --> REDIS
    
    DOC_INBOX --> MINIO
    DOC_INBOX --> RABBITMQ
    
    RABBITMQ --> OCR
    OCR --> MINIO
    OCR --> POSTGRES
    
    TRANSLATE --> REDIS
```

## Architectural Principles

### 1. **Enhanced Microservices Architecture**
The system is decomposed into discrete, loosely-coupled services with AI-first design:

#### Core Services
- **Main API Service**: Primary business logic, authentication, case management
- **Chatbot Service**: Local LLM, MCP endpoints, financial calculations, CoA generation
- **Translation Service**: Multi-language support using Helsinki-NLP models

#### Document Processing Pipeline  
- **Document Inbox Service**: Email processing, file upload handling
- **OCR Processor Service**: Text extraction, document classification (Tesseract-based)

#### Infrastructure Services
- **PostgreSQL**: Primary data storage with full ACID compliance
- **Redis**: Session management, caching, real-time data
- **MinIO**: S3-compatible object storage (local/self-hosted)
- **RabbitMQ**: Asynchronous message queue for document processing

### 2. **Multi-Tenant with Data Isolation**
```{note}
Each debt advice center operates as a separate tenant with complete data isolation while sharing the same infrastructure and application code.
```

**Implementation Strategy:**
- **Database Level**: `centre_id` foreign key on all tenant-specific tables
- **Application Level**: Automatic tenant filtering in all queries
- **API Level**: JWT tokens include center context
- **UI Level**: Role-based access control and center-specific data views

### 3. **Event-Driven Architecture**
Asynchronous communication between services using an event-driven pattern:

```{mermaid}
graph LR
    A[Case Created] --> B[Event Bus]
    B --> C[Compliance Check]
    B --> D[AI Analysis]
    B --> E[Notification]
    B --> F[Audit Log]
```

### 4. **CQRS (Command Query Responsibility Segregation)**
Separate read and write operations for optimal performance:

- **Command Side**: Handles data modifications and business logic
- **Query Side**: Optimized for reading and reporting
- **Event Store**: Maintains complete audit trail

## Technology Stack

### Frontend
- **React 18**: Modern component-based UI framework
- **Material-UI v5**: Professional component library
- **React Query**: Server state management and caching
- **React Router v6**: Client-side routing
- **PWA**: Progressive Web App capabilities

### Backend
- **Node.js 18+**: JavaScript runtime environment
- **Express.js**: Web application framework
- **JWT**: JSON Web Token authentication
- **Helmet**: Security middleware
- **Rate Limiting**: API protection

### Database
- **PostgreSQL 15**: Primary relational database
- **Redis 7**: Caching and session management
- **MinIO**: S3-compatible object storage for documents and files

### AI/ML Integration (Local/Open-Source)
- **Hugging Face Transformers**: Local LLM hosting (DialoGPT, Llama 2)
- **Helsinki-NLP**: Local translation models for 10+ languages
- **Tesseract OCR**: Enhanced document text extraction with preprocessing
- **Natural Language Processing**: Local document classification and analysis
- **MCP (Model Context Protocol)**: Standardized AI tool access for case data

### AI Features
- **Financial Calculations**: Automated debt-to-income ratios, payment plans
- **Case Analysis**: AI-powered insights from case notes and documents  
- **Confirmation of Advice**: Automated generation from case notes
- **Multi-Language Support**: Real-time translation for international clients
- **Local Council Search**: Web search integration for local authority information

## Security Architecture

### Authentication & Authorization
```{mermaid}
sequenceDiagram
    participant Client
    participant Gateway
    participant Auth
    participant Core
    participant Database
    
    Client->>Gateway: Login Request
    Gateway->>Auth: Validate Credentials
    Auth->>Database: Check User & Center
    Database-->>Auth: User Data
    Auth-->>Gateway: JWT Token
    Gateway-->>Client: Authenticated Session
    
    Client->>Gateway: API Request + JWT
    Gateway->>Auth: Validate Token
    Auth-->>Gateway: User Context
    Gateway->>Core: Request + Center Context
    Core->>Database: Query with Centre Filter
    Database-->>Core: Center-specific Data
    Core-->>Gateway: Response
    Gateway-->>Client: Filtered Data
```

### Data Protection
- **Encryption at Rest**: AES-256 encryption for database and file storage
- **Encryption in Transit**: TLS 1.3 for all communications
- **Field-Level Encryption**: Sensitive PII encrypted at application level
- **Access Control**: Role-based permissions with center isolation

### Compliance Features
- **Audit Logging**: Complete activity trail for all user actions
- **Data Retention**: Configurable retention policies
- **GDPR Compliance**: Right to erasure and data portability
- **FCA Compliance**: Automated compliance checking and reporting

## Scalability Design

### Horizontal Scaling
- **Stateless Services**: All application services are stateless
- **Load Balancing**: NGINX with health checks
- **Container Orchestration**: Kubernetes-ready architecture
- **Database Sharding**: Tenant-based database partitioning

### Performance Optimization
- **CDN Integration**: Static asset delivery via CloudFront
- **Caching Strategy**: Multi-layer caching (Redis, Application, CDN)
- **Database Optimization**: Read replicas and query optimization
- **Async Processing**: Background job processing for heavy operations

## Monitoring & Observability

### Application Monitoring
- **Health Checks**: Service availability monitoring
- **Performance Metrics**: Response times and throughput
- **Error Tracking**: Comprehensive error logging and alerting
- **User Analytics**: Usage patterns and feature adoption

### Infrastructure Monitoring
- **Resource Utilization**: CPU, memory, and storage monitoring
- **Network Performance**: Latency and bandwidth monitoring
- **Security Monitoring**: Intrusion detection and vulnerability scanning
- **Cost Monitoring**: AWS cost tracking and optimization

## Disaster Recovery

### Backup Strategy
- **Database Backups**: Automated daily backups with point-in-time recovery
- **File Backups**: S3 cross-region replication
- **Configuration Backups**: Infrastructure as Code (Terraform)
- **Application Backups**: Container image versioning

### Recovery Planning
- **RTO (Recovery Time Objective)**: 4 hours
- **RPO (Recovery Point Objective)**: 1 hour
- **Failover Strategy**: Multi-AZ deployment with automatic failover
- **Testing**: Quarterly disaster recovery testing

## Integration Points

### External Systems (Optional)
- **Credit Reference Agencies**: Experian, Equifax, TransUnion (configurable)
- **Government APIs**: HMRC, DWP benefit checking (when available)
- **Banking APIs**: Open Banking for account verification (opt-in)
- **Translation APIs**: Google Translate (fallback option, data leaves system)

### Local Systems (Primary)
- **Local LLM**: On-premise AI processing for advice generation and CoA
- **Helsinki-NLP**: Local translation models (data stays within system)
- **Tesseract OCR**: Local document processing without external dependencies
- **MinIO Storage**: Self-hosted S3-compatible storage

### API Design
- **RESTful APIs**: Standard HTTP methods and status codes
- **GraphQL**: Flexible query language for complex data fetching
- **WebSocket**: Real-time communication for notifications
- **Webhook Support**: Event notifications to external systems

This architecture ensures the CMA Case Management System can scale efficiently while maintaining security, compliance, and performance standards required for debt advice services.
