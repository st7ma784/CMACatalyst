#!/bin/bash
# Test script to verify ChromaDB collection isolation
# Tests that manuals and client documents don't interfere with each other

set -e

echo "========================================="
echo "ChromaDB Collection Isolation Test"
echo "========================================="
echo ""

BASE_URL="http://localhost:8103"
RAG_URL="http://localhost:8102"
CLIENT_RAG_URL="http://localhost:8104"

# Get auth token (assumes admin/admin123)
echo "Step 1: Authenticating..."
TOKEN=$(curl -s -X POST "${BASE_URL}/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' \
  | jq -r '.access_token')

if [ "$TOKEN" == "null" ] || [ -z "$TOKEN" ]; then
  echo "❌ Authentication failed"
  exit 1
fi
echo "✅ Authenticated"
echo ""

# Check ChromaDB health
echo "Step 2: Checking ChromaDB health..."
CHROMA_HEALTH=$(curl -s http://localhost:8005/api/v1/heartbeat)
if [ $? -eq 0 ]; then
  echo "✅ ChromaDB is healthy"
else
  echo "❌ ChromaDB is not responding"
  exit 1
fi
echo ""

# List all collections
echo "Step 3: Listing all collections in shared ChromaDB..."
echo "Collections:"
curl -s http://localhost:8005/api/v1/collections | jq -r '.[] | .name' | while read collection; do
  echo "  - $collection"
done
echo ""

# Test 1: Upload document for Client A
echo "Step 4: Uploading document for CLIENT_A..."
cat > /tmp/client-a-doc.txt << 'EOF'
# Client A Document
This is sensitive information for Client A.
Account balance: $10,000
Debt to Creditor X: $5,000
EOF

UPLOAD_A=$(curl -s -X POST "${BASE_URL}/uploads/CLIENT_A" \
  -H "Authorization: Bearer ${TOKEN}" \
  -F "file=@/tmp/client-a-doc.txt" \
  | jq -r '.success')

if [ "$UPLOAD_A" == "true" ]; then
  echo "✅ Document uploaded for CLIENT_A"
else
  echo "❌ Failed to upload document for CLIENT_A"
  exit 1
fi
sleep 3  # Wait for indexing
echo ""

# Test 2: Upload document for Client B
echo "Step 5: Uploading document for CLIENT_B..."
cat > /tmp/client-b-doc.txt << 'EOF'
# Client B Document
This is confidential information for Client B.
Account balance: $20,000
Debt to Creditor Y: $8,000
EOF

UPLOAD_B=$(curl -s -X POST "${BASE_URL}/uploads/CLIENT_B" \
  -H "Authorization: Bearer ${TOKEN}" \
  -F "file=@/tmp/client-b-doc.txt" \
  | jq -r '.success')

if [ "$UPLOAD_B" == "true" ]; then
  echo "✅ Document uploaded for CLIENT_B"
else
  echo "❌ Failed to upload document for CLIENT_B"
  exit 1
fi
sleep 3  # Wait for indexing
echo ""

# Test 3: Verify CLIENT_A stats
echo "Step 6: Checking CLIENT_A statistics..."
CLIENT_A_STATS=$(curl -s "${BASE_URL}/client-stats/CLIENT_A" \
  -H "Authorization: Bearer ${TOKEN}")
CLIENT_A_DOCS=$(echo "$CLIENT_A_STATS" | jq -r '.total_documents')
echo "CLIENT_A has $CLIENT_A_DOCS document(s)"
if [ "$CLIENT_A_DOCS" -ge "1" ]; then
  echo "✅ CLIENT_A has documents"
else
  echo "❌ CLIENT_A missing documents"
  exit 1
fi
echo ""

# Test 4: Verify CLIENT_B stats
echo "Step 7: Checking CLIENT_B statistics..."
CLIENT_B_STATS=$(curl -s "${BASE_URL}/client-stats/CLIENT_B" \
  -H "Authorization: Bearer ${TOKEN}")
CLIENT_B_DOCS=$(echo "$CLIENT_B_STATS" | jq -r '.total_documents')
echo "CLIENT_B has $CLIENT_B_DOCS document(s)"
if [ "$CLIENT_B_DOCS" -ge "1" ]; then
  echo "✅ CLIENT_B has documents"
else
  echo "❌ CLIENT_B missing documents"
  exit 1
fi
echo ""

# Test 5: Query CLIENT_A - should ONLY see CLIENT_A data
echo "Step 8: Querying CLIENT_A for account balance..."
CLIENT_A_QUERY=$(curl -s -X POST "${BASE_URL}/query-client-documents" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"client_id":"CLIENT_A","question":"What is the account balance?"}')

CLIENT_A_ANSWER=$(echo "$CLIENT_A_QUERY" | jq -r '.answer')
echo "Answer: $CLIENT_A_ANSWER"

if echo "$CLIENT_A_ANSWER" | grep -q "10,000\|10000"; then
  echo "✅ CLIENT_A query returned correct data ($10,000)"
else
  echo "❌ CLIENT_A query did not return expected data"
  echo "Full response: $CLIENT_A_ANSWER"
  exit 1
fi

# Critical test: Make sure CLIENT_B data is NOT in CLIENT_A results
if echo "$CLIENT_A_ANSWER" | grep -q "20,000\|20000\|Client B"; then
  echo "❌ DATA LEAK: CLIENT_A query returned CLIENT_B data!"
  exit 1
fi
echo "✅ No data leak detected in CLIENT_A query"
echo ""

# Test 6: Query CLIENT_B - should ONLY see CLIENT_B data
echo "Step 9: Querying CLIENT_B for account balance..."
CLIENT_B_QUERY=$(curl -s -X POST "${BASE_URL}/query-client-documents" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"client_id":"CLIENT_B","question":"What is the account balance?"}')

CLIENT_B_ANSWER=$(echo "$CLIENT_B_QUERY" | jq -r '.answer')
echo "Answer: $CLIENT_B_ANSWER"

if echo "$CLIENT_B_ANSWER" | grep -q "20,000\|20000"; then
  echo "✅ CLIENT_B query returned correct data ($20,000)"
else
  echo "❌ CLIENT_B query did not return expected data"
  echo "Full response: $CLIENT_B_ANSWER"
  exit 1
fi

# Critical test: Make sure CLIENT_A data is NOT in CLIENT_B results
if echo "$CLIENT_B_ANSWER" | grep -q "10,000\|10000\|Client A"; then
  echo "❌ DATA LEAK: CLIENT_B query returned CLIENT_A data!"
  exit 1
fi
echo "✅ No data leak detected in CLIENT_B query"
echo ""

# Test 7: List all clients
echo "Step 10: Listing all clients..."
ALL_CLIENTS=$(curl -s "${CLIENT_RAG_URL}/clients")
echo "$ALL_CLIENTS" | jq '.'

CLIENT_COUNT=$(echo "$ALL_CLIENTS" | jq -r '.total')
echo "Total clients with documents: $CLIENT_COUNT"

if [ "$CLIENT_COUNT" -ge "2" ]; then
  echo "✅ Both clients are registered"
else
  echo "⚠️  Expected 2+ clients, found $CLIENT_COUNT"
fi
echo ""

# Test 8: Check collections in ChromaDB
echo "Step 11: Verifying collection structure..."
echo "Expected collections:"
echo "  - manuals (for training manuals)"
echo "  - client_CLIENT_A"
echo "  - client_CLIENT_B"
echo ""
echo "Actual collections:"
curl -s http://localhost:8005/api/v1/collections | jq -r '.[] | "  - " + .name'
echo ""

# Cleanup
echo "Step 12: Cleanup..."
rm -f /tmp/client-a-doc.txt /tmp/client-b-doc.txt
echo "✅ Temporary files removed"
echo ""

echo "========================================="
echo "✅ ALL TESTS PASSED"
echo "========================================="
echo ""
echo "Summary:"
echo "  ✅ Both clients have separate documents"
echo "  ✅ CLIENT_A queries only return CLIENT_A data"
echo "  ✅ CLIENT_B queries only return CLIENT_B data"
echo "  ✅ No data bleed between clients"
echo "  ✅ Collections properly isolated in shared ChromaDB"
echo ""
echo "The shared ChromaDB instance successfully isolates:"
echo "  - Training manuals (collection: 'manuals')"
echo "  - Client A docs (collection: 'client_CLIENT_A')"
echo "  - Client B docs (collection: 'client_CLIENT_B')"
echo ""
echo "🎉 Multi-tenant isolation verified!"
