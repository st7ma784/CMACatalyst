#!/bin/bash
# Script to ingest PDF manuals into the RAG system

set -e

echo "========================================="
echo "Manual Ingestion Script"
echo "========================================="

MANUALS_DIR="./manuals"
DOC_PROCESSOR_URL="http://localhost:8101"
RAG_SERVICE_URL="http://localhost:8102"

if [ ! -d "$MANUALS_DIR" ]; then
  echo "Error: Manuals directory not found: $MANUALS_DIR"
  exit 1
fi

PDF_FILES=$(find "$MANUALS_DIR" -type f -name "*.pdf")

if [ -z "$PDF_FILES" ]; then
  echo "No PDF files found in $MANUALS_DIR"
  echo "Please add PDF manuals to the directory and run again."
  exit 0
fi

echo "Found PDF files:"
echo "$PDF_FILES"
echo ""

DOCUMENTS=()
FILENAMES=()

for pdf in $PDF_FILES; do
  filename=$(basename "$pdf")
  echo "Processing: $filename"

  # Convert PDF to markdown using doc-processor
  response=$(curl -s -X POST "$DOC_PROCESSOR_URL/process" \
    -F "file=@$pdf")

  markdown=$(echo "$response" | jq -r '.markdown')
  success=$(echo "$response" | jq -r '.success')

  if [ "$success" = "true" ]; then
    echo "  ✓ Converted to markdown"
    DOCUMENTS+=("$markdown")
    FILENAMES+=("$filename")
  else
    echo "  ✗ Failed to convert"
  fi
done

if [ ${#DOCUMENTS[@]} -eq 0 ]; then
  echo ""
  echo "No documents were successfully processed."
  exit 1
fi

echo ""
echo "Ingesting ${#DOCUMENTS[@]} documents into RAG system..."

# Create JSON payload
JSON_PAYLOAD=$(jq -n \
  --argjson documents "$(printf '%s\n' "${DOCUMENTS[@]}" | jq -R . | jq -s .)" \
  --argjson filenames "$(printf '%s\n' "${FILENAMES[@]}" | jq -R . | jq -s .)" \
  '{documents: $documents, filenames: $filenames}')

# Ingest into RAG service
curl -X POST "$RAG_SERVICE_URL/ingest" \
  -H "Content-Type: application/json" \
  -d "$JSON_PAYLOAD"

echo ""
echo "========================================="
echo "Ingestion Complete!"
echo "========================================="
echo ""
echo "You can now query the manuals using 'Ask the Manuals' tab"
echo "Check RAG stats: curl $RAG_SERVICE_URL/stats"
