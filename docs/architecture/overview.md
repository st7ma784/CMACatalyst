# System Architecture Overview

The CMA Case Management System employs a modern, cloud-native architecture designed for scalability, security, and multi-tenancy. This document provides a comprehensive overview of the system's architectural components and design decisions.

## High-Level Architecture

```{mermaid}
graph TB
    subgraph "Client Layer"
        WEB[React Web App]
        MOB[Mobile PWA]
        API_CLIENTS[API Clients]
    end
    
    subgraph "API Gateway Layer"
        NGINX[NGINX Load Balancer]
        GATEWAY[API Gateway]
        AUTH[Authentication Service]
    end
    
    subgraph "Application Layer"
        CORE[Core API Service]
        AI[AI Service]
        DOC[Document Service]
        NOTIFY[Notification Service]
        SCHED[Scheduler Service]
    end
    
    subgraph "Data Layer"
        POSTGRES[PostgreSQL]
        REDIS[Redis Cache]
        S3[AWS S3 Storage]
        ELASTIC[ElasticSearch]
    end
    
    subgraph "AI/ML Layer"
        OPENAI[OpenAI API]
        OCR[OCR Engine]
        ML[ML Models]
    end
    
    WEB --> NGINX
    MOB --> NGINX
    API_CLIENTS --> NGINX
    NGINX --> GATEWAY
    GATEWAY --> AUTH
    GATEWAY --> CORE
    GATEWAY --> AI
    GATEWAY --> DOC
    GATEWAY --> NOTIFY
    GATEWAY --> SCHED
    
    CORE --> POSTGRES
    CORE --> REDIS
    AI --> OPENAI
    AI --> ML
    DOC --> S3
    DOC --> OCR
    NOTIFY --> REDIS
    SCHED --> REDIS
    
    CORE --> ELASTIC
    DOC --> ELASTIC
```

## Architectural Principles

### 1. **Microservices Architecture**
The system is decomposed into discrete, loosely-coupled services:

- **Core API Service**: Primary business logic and data management
- **AI Service**: Machine learning and natural language processing
- **Document Service**: File management and OCR processing
- **Notification Service**: Multi-channel communication management
- **Scheduler Service**: Automated task and appointment scheduling

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
- **ElasticSearch**: Full-text search and analytics

### AI/ML Integration
- **OpenAI GPT-4**: Natural language processing
- **Tesseract OCR**: Document text extraction
- **TensorFlow.js**: Client-side ML models
- **Python ML Services**: Advanced analytics

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

### External Systems
- **Credit Reference Agencies**: Experian, Equifax, TransUnion
- **Government APIs**: HMRC, DWP benefit checking
- **Banking APIs**: Open Banking for account verification
- **Document Management**: Integration with existing DMS systems

### API Design
- **RESTful APIs**: Standard HTTP methods and status codes
- **GraphQL**: Flexible query language for complex data fetching
- **WebSocket**: Real-time communication for notifications
- **Webhook Support**: Event notifications to external systems

This architecture ensures the CMA Case Management System can scale efficiently while maintaining security, compliance, and performance standards required for debt advice services.
