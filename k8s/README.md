# CMA Kubernetes Deployment

This directory contains Kubernetes manifests and deployment scripts for the CMA Case Management System.

## Prerequisites

- AWS CLI configured with appropriate permissions
- kubectl installed and configured
- EKS cluster created (see cluster setup below)
- Docker images built and pushed to container registry

## Quick Start

1. **Deploy to staging:**
   ```bash
   cd k8s
   ./deploy.sh staging
   ```

2. **Deploy to production:**
   ```bash
   cd k8s
   ./deploy.sh production
   ```

## Cluster Setup

### Create EKS Cluster

```bash
# Install eksctl if not already installed
curl --silent --location "https://github.com/weaveworks/eksctl/releases/latest/download/eksctl_$(uname -s)_amd64.tar.gz" | tar xz -C /tmp
sudo mv /tmp/eksctl /usr/local/bin

# Create staging cluster
eksctl create cluster \
  --name cma-staging \
  --region eu-west-2 \
  --version 1.28 \
  --nodegroup-name standard-workers \
  --node-type t3.medium \
  --nodes 3 \
  --nodes-min 1 \
  --nodes-max 10 \
  --managed

# Create production cluster
eksctl create cluster \
  --name cma-production \
  --region eu-west-2 \
  --version 1.28 \
  --nodegroup-name standard-workers \
  --node-type t3.large \
  --nodes 5 \
  --nodes-min 3 \
  --nodes-max 20 \
  --managed
```

### Install AWS Load Balancer Controller

```bash
# Create IAM role for AWS Load Balancer Controller
eksctl create iamserviceaccount \
  --cluster=cma-production \
  --namespace=kube-system \
  --name=aws-load-balancer-controller \
  --role-name AmazonEKSLoadBalancerControllerRole \
  --attach-policy-arn=arn:aws:iam::aws:policy/ElasticLoadBalancingFullAccess \
  --approve

# Install AWS Load Balancer Controller
helm repo add eks https://aws.github.io/eks-charts
helm repo update
helm install aws-load-balancer-controller eks/aws-load-balancer-controller \
  -n kube-system \
  --set clusterName=cma-production \
  --set serviceAccount.create=false \
  --set serviceAccount.name=aws-load-balancer-controller
```

## Configuration

### Secrets

Before deploying, update `secrets.yaml` with real values:

```bash
# Generate secure passwords
openssl rand -base64 32  # For database password
openssl rand -base64 64  # For JWT secret
openssl rand -base64 32  # For Redis password
```

### SSL Certificates

1. Request SSL certificate in AWS Certificate Manager
2. Update `ingress.yaml` with the certificate ARN

### DNS Configuration

1. Get the load balancer DNS name:
   ```bash
   kubectl get ingress -n cma-system
   ```

2. Create CNAME records:
   - `app.cmacentre.org.uk` → Load Balancer DNS
   - `api.cmacentre.org.uk` → Load Balancer DNS

## Monitoring

### Prometheus and Grafana

The monitoring stack is automatically deployed in production. Access Grafana:

```bash
kubectl port-forward -n cma-monitoring svc/grafana 3000:80
```

Default credentials: admin/admin

### Logs

View application logs:

```bash
# API Gateway logs
kubectl logs -f deployment/api-gateway -n cma-api

# Frontend logs
kubectl logs -f deployment/frontend -n cma-frontend

# Chatbot logs
kubectl logs -f deployment/chatbot -n cma-ai
```

## Scaling

### Manual Scaling

```bash
# Scale API Gateway
kubectl scale deployment api-gateway --replicas=5 -n cma-api

# Scale Frontend
kubectl scale deployment frontend --replicas=3 -n cma-frontend
```

### Auto Scaling

HPA (Horizontal Pod Autoscaler) is configured for all services:
- API Gateway: 3-20 replicas
- Frontend: 2-10 replicas
- Chatbot: 2-8 replicas

## Backup and Recovery

### Database Backup

```bash
# Create backup
kubectl exec -n cma-data deployment/postgres -- pg_dump -U cma_user cma_db > backup.sql

# Restore backup
kubectl exec -i -n cma-data deployment/postgres -- psql -U cma_user cma_db < backup.sql
```

### Persistent Volume Backup

Use AWS EBS snapshots for persistent volume backups.

## Troubleshooting

### Common Issues

1. **Pods not starting:**
   ```bash
   kubectl describe pod <pod-name> -n <namespace>
   kubectl logs <pod-name> -n <namespace>
   ```

2. **Database connection issues:**
   ```bash
   kubectl exec -it deployment/postgres -n cma-data -- psql -U cma_user cma_db
   ```

3. **Ingress not working:**
   ```bash
   kubectl describe ingress cma-ingress -n cma-system
   kubectl get events -n cma-system
   ```

### Health Checks

All services have health check endpoints:
- API Gateway: `/health`
- Chatbot: `/health`
- Frontend: `/` (nginx status)

## Security

### Network Policies

Implement network policies to restrict pod-to-pod communication:

```bash
kubectl apply -f network-policies.yaml
```

### Pod Security Standards

All pods run with security contexts and non-root users where possible.

### Secrets Management

Consider using AWS Secrets Manager or HashiCorp Vault for production secrets management.

## Cost Optimization

### Resource Requests and Limits

All deployments have resource requests and limits configured to ensure efficient resource usage.

### Cluster Autoscaler

Install cluster autoscaler for automatic node scaling:

```bash
kubectl apply -f https://raw.githubusercontent.com/kubernetes/autoscaler/master/cluster-autoscaler/cloudprovider/aws/examples/cluster-autoscaler-autodiscover.yaml
```

## Maintenance

### Updates

1. Update container images in CI/CD pipeline
2. Rolling updates are performed automatically
3. Monitor deployment status during updates

### Node Maintenance

Use node draining for maintenance:

```bash
kubectl drain <node-name> --ignore-daemonsets --delete-emptydir-data
kubectl uncordon <node-name>
```
