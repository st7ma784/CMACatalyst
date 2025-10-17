#!/bin/bash
# RMA-Demo AWS EKS Deployment Script

set -e

# Configuration
CLUSTER_NAME="rma-demo-cluster"
REGION="us-east-1"
NODE_TYPE_CPU="t3.large"
NODE_TYPE_GPU="g5.xlarge"
ECR_REGISTRY="<YOUR_AWS_ACCOUNT_ID>.dkr.ecr.${REGION}.amazonaws.com"

echo "========================================="
echo "RMA-Demo AWS EKS Deployment"
echo "========================================="

# Check prerequisites
echo "Checking prerequisites..."
command -v aws >/dev/null 2>&1 || { echo "AWS CLI is required but not installed. Aborting." >&2; exit 1; }
command -v eksctl >/dev/null 2>&1 || { echo "eksctl is required but not installed. Aborting." >&2; exit 1; }
command -v kubectl >/dev/null 2>&1 || { echo "kubectl is required but not installed. Aborting." >&2; exit 1; }

# Create EKS cluster with GPU support
echo ""
echo "Step 1: Creating EKS cluster..."
eksctl create cluster \
  --name ${CLUSTER_NAME} \
  --region ${REGION} \
  --node-type ${NODE_TYPE_CPU} \
  --nodes 2 \
  --nodes-min 1 \
  --nodes-max 4 \
  --with-oidc \
  --managed

# Add GPU node group for Ollama
echo ""
echo "Step 2: Adding GPU node group..."
eksctl create nodegroup \
  --cluster=${CLUSTER_NAME} \
  --region=${REGION} \
  --name=gpu-nodes \
  --node-type=${NODE_TYPE_GPU} \
  --nodes=1 \
  --nodes-min=0 \
  --nodes-max=2 \
  --node-labels="workload=gpu" \
  --node-ami-family=AmazonLinux2 \
  --managed

# Install NVIDIA device plugin for GPU support
echo ""
echo "Step 3: Installing NVIDIA device plugin..."
kubectl create -f https://raw.githubusercontent.com/NVIDIA/k8s-device-plugin/v0.14.0/nvidia-device-plugin.yml

# Create ECR repositories
echo ""
echo "Step 4: Creating ECR repositories..."
for service in notes-service doc-processor rag-service upload-service frontend; do
  aws ecr create-repository \
    --repository-name rma-${service} \
    --region ${REGION} \
    --image-scanning-configuration scanOnPush=true \
    || echo "Repository rma-${service} already exists"
done

# Build and push Docker images
echo ""
echo "Step 5: Building and pushing Docker images..."
aws ecr get-login-password --region ${REGION} | docker login --username AWS --password-stdin ${ECR_REGISTRY}

cd ../services/notes-service
docker build -t ${ECR_REGISTRY}/rma-notes-service:latest .
docker push ${ECR_REGISTRY}/rma-notes-service:latest

cd ../doc-processor
docker build -t ${ECR_REGISTRY}/rma-doc-processor:latest .
docker push ${ECR_REGISTRY}/rma-doc-processor:latest

cd ../rag-service
docker build -t ${ECR_REGISTRY}/rma-rag-service:latest .
docker push ${ECR_REGISTRY}/rma-rag-service:latest

cd ../upload-service
docker build -t ${ECR_REGISTRY}/rma-upload-service:latest .
docker push ${ECR_REGISTRY}/rma-upload-service:latest

cd ../../frontend
docker build -t ${ECR_REGISTRY}/rma-frontend:latest .
docker push ${ECR_REGISTRY}/rma-frontend:latest

cd ../aws-scripts

# Create secrets
echo ""
echo "Step 6: Creating Kubernetes secrets..."
kubectl create namespace rma-demo || echo "Namespace already exists"

kubectl create secret generic rma-secrets \
  --from-literal=jwt-secret=$(openssl rand -hex 32) \
  --from-literal=llama-parse-api-key="${LLAMA_PARSE_API_KEY:-}" \
  --namespace=rma-demo \
  --dry-run=client -o yaml | kubectl apply -f -

# Update K8s manifests with ECR registry
echo ""
echo "Step 7: Updating Kubernetes manifests..."
cd ../k8s
for file in *.yaml; do
  sed -i.bak "s|<YOUR_ECR_REGISTRY>|${ECR_REGISTRY}|g" "$file"
done

# Deploy to Kubernetes
echo ""
echo "Step 8: Deploying to Kubernetes..."
kubectl apply -f namespace.yaml
kubectl apply -f ollama-deployment.yaml
kubectl apply -f chromadb-deployment.yaml
kubectl apply -f services-deployment.yaml

# Wait for deployments
echo ""
echo "Step 9: Waiting for deployments to be ready..."
kubectl wait --for=condition=available --timeout=600s \
  deployment/ollama deployment/chromadb \
  deployment/notes-service deployment/doc-processor \
  deployment/rag-service deployment/upload-service \
  deployment/frontend \
  -n rma-demo

# Get Load Balancer URL
echo ""
echo "========================================="
echo "Deployment Complete!"
echo "========================================="
echo ""
echo "Getting Load Balancer URL..."
kubectl get service frontend -n rma-demo

echo ""
echo "To access the application, wait a few minutes for DNS propagation,"
echo "then visit the EXTERNAL-IP shown above."
echo ""
echo "To update the deployment:"
echo "  ./aws-scripts/update-deployment.sh"
echo ""
echo "To delete the cluster:"
echo "  eksctl delete cluster --name ${CLUSTER_NAME} --region ${REGION}"
