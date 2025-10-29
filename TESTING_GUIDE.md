# MordecAI Testing & CI/CD Guide

## Overview
Comprehensive testing and CI/CD setup for the MordecAI advisor tool with full coverage across all microservices.

## Testing Architecture

### 🧪 Unit Tests
- **Backend Server**: Jest with 70%+ coverage requirement
- **Document Inbox Service**: Jest with 80%+ coverage 
- **OCR Processor Service**: Jest with 80%+ coverage
- **Translation Service**: Pytest with 80%+ coverage

### 🎭 End-to-End Tests
- **Frontend**: Playwright tests covering key user journeys
- **Integration**: Microservices communication testing

### 🔧 Test Commands

```bash
# Run all tests
npm run test:all

# Individual test suites
npm run test:server          # Backend unit tests
npm run test:client          # Frontend unit tests  
npm run test:services        # All microservice tests
npm run test:integration     # Integration tests
npm run test:e2e            # Playwright E2E tests

# Coverage reports
npm run test:coverage       # Generate coverage reports
```

## 🐳 Docker & Containerization

### Services with Docker Support
- ✅ Main API (Express.js backend + React frontend)
- ✅ Chatbot Service (Python)
- ✅ Document Inbox Service (Node.js)
- ✅ OCR Processor Service (Node.js) 
- ✅ Translation Service (Python)
- ✅ LLaMA Service (Python)

### Build Commands
```bash
npm run docker:build:all      # Build core services
npm run docker:build:services # Build microservices
docker-compose up --build     # Build and run all services
```

## 🚀 CI/CD Pipeline

### GitHub Actions Workflow
- **Testing Phase**: 
  - Unit tests for all services
  - Integration tests
  - E2E tests with Playwright
  - Coverage reporting
- **Building Phase**:
  - Docker images for all services
  - Container registry pushes
- **Deployment Phase**:
  - Staging deployment (develop branch)
  - Production deployment (main branch)
- **Security Phase**:
  - Trivy vulnerability scanning

### Test Matrix
- ✅ Node.js unit tests (server, document-inbox, ocr-processor)
- ✅ Python unit tests (translation-service)
- ✅ React component tests
- ✅ Playwright E2E tests (Chrome, Firefox, Safari, Mobile)
- ✅ Integration tests across microservices

## 📦 Dependency Management

### Dependabot Configuration
- **Weekly updates** for all package ecosystems:
  - npm (main + microservices)
  - pip (Python services)
  - Docker base images
  - GitHub Actions

### Update Schedule
- All dependencies: Weekly scan
- Security updates: Immediate
- Max open PRs: 5-10 per service

## 🎯 Coverage Requirements

| Service | Tool | Coverage Target |
|---------|------|-----------------|
| Backend Server | Jest | 70% |
| Document Inbox | Jest | 80% |
| OCR Processor | Jest | 80% |
| Translation Service | Pytest | 80% |
| Frontend | Jest | 70% |

## 🔍 Quality Gates

### Required Checks Before Merge
1. ✅ All unit tests pass
2. ✅ Coverage thresholds met
3. ✅ E2E tests pass (non-LLM features)
4. ✅ Docker builds succeed
5. ✅ Security scans pass
6. ✅ Linting passes

### LLM-Dependent Tests
- Skipped in CI until GPU runners available
- Run manually during development
- Covered by integration tests with mocked responses

## 🚨 Monitoring & Alerts

### Test Failures
- GitHub notifications for failed builds
- Coverage reports in PR comments
- Security scan results in Security tab

### Service Health
- Health check endpoints for all services
- Docker health checks configured
- K8s readiness/liveness probes

## 📝 Development Workflow

### Local Testing
1. `npm run test:all` - Full test suite
2. `npm run dev` - Start development servers
3. `npm run test:e2e:ui` - Interactive E2E testing

### Pre-commit Checks
- Linting with ESLint
- Type checking (where applicable)
- Unit test runs on changed files

### CI/CD Triggers
- **Push to main/develop**: Full pipeline
- **Pull Requests**: Tests only
- **Security**: Vulnerability scanning on all pushes

This setup ensures comprehensive testing coverage while maintaining fast feedback loops for developers.




## good questions for testing include: 

When a client has 61 k in debts, 2 assets ( a couple of cars worth 2k and 6k), and amostly paid off mortgage, theyve lost their job on medical reasons, so theyre behind on their payments , what are the steps to managing the debt? 