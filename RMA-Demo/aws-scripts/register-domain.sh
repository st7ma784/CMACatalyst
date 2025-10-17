#!/bin/bash
# Domain Registration and Route53 Configuration Script

set -e

# Configuration
DOMAIN_NAME="${1:-rma-demo.example.com}"
CLUSTER_NAME="rma-demo-cluster"
REGION="us-east-1"

echo "========================================="
echo "Domain Registration and DNS Setup"
echo "========================================="
echo "Domain: ${DOMAIN_NAME}"
echo ""

# Check if hosted zone exists
echo "Step 1: Checking for existing hosted zone..."
HOSTED_ZONE_ID=$(aws route53 list-hosted-zones-by-name \
  --query "HostedZones[?Name=='${DOMAIN_NAME}.'].Id" \
  --output text | cut -d'/' -f3)

if [ -z "$HOSTED_ZONE_ID" ]; then
  echo "No hosted zone found. Creating new hosted zone..."
  HOSTED_ZONE_ID=$(aws route53 create-hosted-zone \
    --name ${DOMAIN_NAME} \
    --caller-reference $(date +%s) \
    --query 'HostedZone.Id' \
    --output text | cut -d'/' -f3)
  echo "Created hosted zone: ${HOSTED_ZONE_ID}"

  echo ""
  echo "⚠️  IMPORTANT: Update your domain registrar's nameservers to:"
  aws route53 get-hosted-zone --id ${HOSTED_ZONE_ID} \
    --query 'DelegationSet.NameServers' \
    --output text
else
  echo "Found existing hosted zone: ${HOSTED_ZONE_ID}"
fi

# Get Load Balancer DNS
echo ""
echo "Step 2: Getting Load Balancer DNS..."
LB_DNS=$(kubectl get service frontend -n rma-demo \
  -o jsonpath='{.status.loadBalancer.ingress[0].hostname}')

if [ -z "$LB_DNS" ]; then
  echo "❌ Load Balancer not ready yet. Please wait and run this script again."
  exit 1
fi

echo "Load Balancer DNS: ${LB_DNS}"

# Get Load Balancer Hosted Zone ID (for ALB in us-east-1)
LB_HOSTED_ZONE_ID="Z35SXDOTRQ7X7K"

# Create/Update Route53 record
echo ""
echo "Step 3: Creating Route53 A record..."
cat > /tmp/route53-change.json <<EOF
{
  "Changes": [{
    "Action": "UPSERT",
    "ResourceRecordSet": {
      "Name": "${DOMAIN_NAME}",
      "Type": "A",
      "AliasTarget": {
        "HostedZoneId": "${LB_HOSTED_ZONE_ID}",
        "DNSName": "dualstack.${LB_DNS}",
        "EvaluateTargetHealth": true
      }
    }
  }]
}
EOF

aws route53 change-resource-record-sets \
  --hosted-zone-id ${HOSTED_ZONE_ID} \
  --change-batch file:///tmp/route53-change.json

rm /tmp/route53-change.json

# Create www subdomain
echo ""
echo "Step 4: Creating www subdomain..."
cat > /tmp/route53-www.json <<EOF
{
  "Changes": [{
    "Action": "UPSERT",
    "ResourceRecordSet": {
      "Name": "www.${DOMAIN_NAME}",
      "Type": "CNAME",
      "TTL": 300,
      "ResourceRecords": [{
        "Value": "${DOMAIN_NAME}"
      }]
    }
  }]
}
EOF

aws route53 change-resource-record-sets \
  --hosted-zone-id ${HOSTED_ZONE_ID} \
  --change-batch file:///tmp/route53-www.json

rm /tmp/route53-www.json

echo ""
echo "========================================="
echo "DNS Configuration Complete!"
echo "========================================="
echo ""
echo "Domain: ${DOMAIN_NAME}"
echo "Hosted Zone ID: ${HOSTED_ZONE_ID}"
echo "Load Balancer: ${LB_DNS}"
echo ""
echo "DNS propagation may take up to 48 hours."
echo "You can check the status with:"
echo "  dig ${DOMAIN_NAME}"
echo ""
echo "To set up SSL/TLS with AWS Certificate Manager:"
echo "  1. Request a certificate in ACM for ${DOMAIN_NAME}"
echo "  2. Add certificate ARN to ALB listener"
echo "  3. Update frontend service to use HTTPS"
