#!/bin/bash

# CMA Kubernetes Deployment Script
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
NAMESPACE_PREFIX="cma"
ENVIRONMENT=${1:-"staging"}
CLUSTER_NAME="cma-${ENVIRONMENT}"
REGION="eu-west-2"

echo -e "${GREEN}Starting CMA deployment to ${ENVIRONMENT}...${NC}"

# Check if kubectl is installed
if ! command -v kubectl &> /dev/null; then
    echo -e "${RED}kubectl is not installed. Please install kubectl first.${NC}"
    exit 1
fi

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo -e "${RED}AWS CLI is not installed. Please install AWS CLI first.${NC}"
    exit 1
fi

# Update kubeconfig
echo -e "${YELLOW}Updating kubeconfig for cluster ${CLUSTER_NAME}...${NC}"
aws eks update-kubeconfig --name ${CLUSTER_NAME} --region ${REGION}

# Verify cluster connection
echo -e "${YELLOW}Verifying cluster connection...${NC}"
kubectl cluster-info

# Create namespaces
echo -e "${YELLOW}Creating namespaces...${NC}"
kubectl apply -f namespace.yaml

# Apply secrets (these should be updated with real values)
echo -e "${YELLOW}Applying secrets...${NC}"
echo -e "${RED}WARNING: Please update secrets.yaml with real values before production deployment!${NC}"
kubectl apply -f secrets.yaml

# Apply config maps
echo -e "${YELLOW}Applying config maps...${NC}"
kubectl apply -f configmap.yaml

# Deploy data layer (PostgreSQL and Redis)
echo -e "${YELLOW}Deploying data layer...${NC}"
kubectl apply -f postgres.yaml
kubectl apply -f redis.yaml

# Wait for database to be ready
echo -e "${YELLOW}Waiting for PostgreSQL to be ready...${NC}"
kubectl wait --for=condition=ready pod -l app=postgres -n cma-data --timeout=300s

echo -e "${YELLOW}Waiting for Redis to be ready...${NC}"
kubectl wait --for=condition=ready pod -l app=redis -n cma-data --timeout=300s

# Deploy application services
echo -e "${YELLOW}Deploying API Gateway...${NC}"
kubectl apply -f api-gateway.yaml

echo -e "${YELLOW}Deploying Frontend...${NC}"
kubectl apply -f frontend.yaml

echo -e "${YELLOW}Deploying Chatbot service...${NC}"
kubectl apply -f chatbot.yaml

# Deploy ingress
echo -e "${YELLOW}Deploying ingress...${NC}"
kubectl apply -f ingress.yaml

# Deploy monitoring (production only)
if [ "$ENVIRONMENT" = "production" ]; then
    echo -e "${YELLOW}Deploying monitoring stack...${NC}"
    kubectl apply -f monitoring.yaml
fi

# Wait for deployments to be ready
echo -e "${YELLOW}Waiting for deployments to be ready...${NC}"
kubectl rollout status deployment/api-gateway -n cma-api --timeout=300s
kubectl rollout status deployment/frontend -n cma-frontend --timeout=300s
kubectl rollout status deployment/chatbot -n cma-ai --timeout=300s

# Get service status
echo -e "${GREEN}Deployment completed! Service status:${NC}"
kubectl get pods -n cma-api
kubectl get pods -n cma-frontend
kubectl get pods -n cma-ai
kubectl get pods -n cma-data

# Get ingress information
echo -e "${GREEN}Ingress information:${NC}"
kubectl get ingress -n cma-system

# Get service endpoints
echo -e "${GREEN}Service endpoints:${NC}"
kubectl get services -A | grep cma

echo -e "${GREEN}CMA deployment to ${ENVIRONMENT} completed successfully!${NC}"

# Show next steps
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Update DNS records to point to the load balancer"
echo "2. Update SSL certificates in ingress.yaml"
echo "3. Update secrets.yaml with production values"
echo "4. Configure monitoring and alerting"
echo "5. Set up backup procedures"
