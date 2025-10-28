# Training Manuals Directory

**Purpose:** Source of truth for debt advice knowledge
**Used by:** Main RAG Service for general queries
**Format:** PDF documents (automatically indexed)

---

## 📚 What Goes Here

This directory contains **official debt advice training manuals** that power the "Ask the Manuals" feature.

### ✅ DO Include:

- **Official guidance documents**
  - DRO (Debt Relief Order) guidelines
  - Bankruptcy procedures
  - IVA (Individual Voluntary Arrangement) guides
  - Debt management plan templates

- **CPAG (Child Poverty Action Group) handbooks**
  - Debt advice handbook chapters
  - Benefits and tax credits guides
  - Enforcement procedures
  - Priority debts guidance

- **Regulatory documents**
  - FCA guidance
  - ICO data protection guides
  - Money Advice Service materials
  - StepChange resources

- **Internal policies**
  - Centre procedures
  - Escalation processes
  - Quality standards
  - Compliance checklists

### ❌ DON'T Include:

- ✗ Client documents (use client upload feature)
- ✗ Personal notes
- ✗ Temporary/draft documents
- ✗ Outdated versions (archive these)
- ✗ Non-debt-advice materials

---

## 🔄 How It Works

### Automatic Processing

When the RAG service starts, it:

1. **Scans this directory** for PDF files
2. **Converts PDFs to text** using LlamaParse
3. **Splits into chunks** (1000 chars each, 200 overlap)
4. **Creates embeddings** using Ollama (nomic-embed-text)
5. **Stores in ChromaDB** (vectorstore)
6. **Extracts thresholds** (e.g., "DRO debt limit: £50,000")

### What Happens Next

When an adviser asks: **"What are the eligibility criteria for a DRO?"**

```
Question → RAG Service
          ↓
    Search vectorstore (ChromaDB)
          ↓
    Retrieve top 4 most relevant chunks
          ↓
    LangGraph Agent processes:
    - Analyze question complexity
    - Retrieve relevant context
    - Extract thresholds if needed
    - Use symbolic reasoning
    - Synthesize answer
          ↓
    Return answer with sources
```

---

## 📋 Current Contents

### CPAG Debt Advice Handbook

This directory contains chapters from the **Child Poverty Action Group (CPAG) Debt Advice Handbook**:

- **General approach** (`CPAG general approach to priority debts.pdf`)
- **Enforcement agents** (`CPAG 2 Enforcement Agents.pdf`)
- **Financial penalties** (`CPAG 2 financial penalties.pdf`)
- **Letter writing** (`CPAG 3 letter writing.pdf`)
- **Priority debts** (multiple chapters)
- **Court procedures** (`CPAG 2 before starting court action.pdf`)
- **Consumer credit** (`CPAG debts under consumer credit act 1974.pdf`)
- **Benefits & tax credits** (`CPAG 3 az of benefits and tax credits.pdf`)
- **Emergency action** (`CPAG 4 emergency action.pdf`)
- **Administration** (`CPAG 3 administration.pdf`)
- **Implementing strategies** (`CPAG 9 implementing chosen strategies.pdf`)

**Copyright Notice:**
```
© Copyright CPAG 2025. All Rights Reserved.
Subscriber: SAML_stevemander

These materials are licensed for use within your organization.
Do not redistribute without permission.
```

---

## 🆕 Adding New Manuals

### Step 1: Prepare the File

1. **Ensure it's a PDF**
   - If Word doc: Export as PDF
   - If webpage: Print to PDF
   - If scanned: Use OCR-enabled PDF

2. **Use clear naming**
   ```
   Good: "DRO_Eligibility_Criteria_2025.pdf"
   Bad:  "document1.pdf"
   ```

3. **Check file size**
   - Recommended: < 10 MB per file
   - Large files split into chapters if possible

### Step 2: Add to Directory

```bash
# Copy to manuals directory
cp /path/to/new-manual.pdf /manuals/

# Or use upload interface (if available)
```

### Step 3: Restart RAG Service

The service needs to re-index manuals:

```bash
# If using Docker
docker-compose restart rag-service

# Wait for initialization
docker-compose logs -f rag-service | grep "indexed"
```

**You'll see:**
```
✓ Found 45 PDF files in /manuals
✓ Processing documents...
✓ Created 892 chunks
✓ Stored in vectorstore
✓ Extracted 28 thresholds
✓ RAG service ready
```

### Step 4: Test

Ask a question that requires the new manual:

```
Question: "What does the new manual say about X?"

Expected: Answer with source citation from new manual
```

---

## 🗑️ Removing Outdated Manuals

### When to Remove

- Manual superseded by newer version
- Guidance no longer applicable
- Regulatory changes make content outdated

### How to Remove

1. **Move to archive (don't delete immediately)**
   ```bash
   mkdir -p /manuals/archive/2024
   mv old-manual.pdf /manuals/archive/2024/
   ```

2. **Document why removed**
   ```
   /manuals/archive/2024/CHANGELOG.md:
   - Removed "DRO Guidelines 2024.pdf"
   - Reason: Superseded by 2025 version
   - Date: 2025-10-24
   ```

3. **Restart RAG service**
   ```bash
   docker-compose restart rag-service
   ```

4. **Verify removal**
   - Ask question from old manual
   - Should NOT cite archived version
   - Should cite current version

---

## 🔍 Threshold Extraction

The RAG service automatically extracts **financial thresholds** from manuals.

### What Gets Extracted

**Example from DRO guidelines:**
```
Text: "To be eligible for a DRO, your total debts must be
       less than £50,000."

Extracted:
- Threshold name: "DRO maximum debt"
- Amount: 50000
- Operator: <
- Currency: GBP
```

### How It's Used

1. **Stored in threshold cache** (in-memory)
2. **Shared with client-rag service** via `/thresholds` endpoint
3. **Used by symbolic reasoning** to check eligibility
4. **Prevents hardcoded values** (always up-to-date)

### Viewing Extracted Thresholds

```bash
# Query the RAG service
curl http://localhost:8102/thresholds | jq .

# Expected output:
{
  "thresholds": {
    "dro_maximum_debt": {
      "amount": 50000,
      "context": "DRO eligibility criteria",
      "source": "DRO_Guidelines_2025.pdf"
    },
    "dro_maximum_income": {
      "amount": 75,
      "context": "Monthly disposable income limit",
      "source": "DRO_Guidelines_2025.pdf"
    },
    ...
  },
  "count": 28,
  "last_updated": "2025-10-24T10:30:00Z"
}
```

---

## 📊 Monitoring Manual Usage

### Check What's Being Used

```bash
# View recent queries and their sources
docker-compose logs rag-service | grep "sources"

# Example output:
"sources": [
  {"source": "CPAG general approach to priority debts.pdf", "page": 5},
  {"source": "DRO_Guidelines_2025.pdf", "page": 12}
]
```

### Analytics

**Most cited manuals:**
- Track which manuals are referenced most
- Identifies gaps in coverage
- Guides future manual selection

**Unanswered questions:**
- Questions with low confidence (<0.6)
- May indicate missing manuals
- Opportunity to expand knowledge base

---

## 🔐 Copyright & Licensing

### CPAG Materials

**License:** Subscription-based organizational license
**Subscriber:** SAML_stevemander
**Restrictions:**
- ✓ Use within organization
- ✓ Share with staff
- ✓ Use for client advice
- ✗ Redistribute publicly
- ✗ Commercial reuse
- ✗ Share outside organization

### Other Materials

Check licensing for each manual:
- FCA guidance: Usually free to use
- StepChange: Check terms
- Internal docs: Organization owns

**When in doubt:**
- Check document footer for copyright
- Contact publisher for permissions
- Document license in README

---

## 🛠️ Troubleshooting

### Problem: Manual not indexed

**Symptoms:**
- Questions about manual return "no relevant information"
- Manual not in sources

**Check:**
1. File is in `/manuals/` (not subdirectory)
2. File is PDF format
3. RAG service restarted after adding
4. File not corrupted (can open in PDF reader)

**Solutions:**
```bash
# Check if file is readable
ls -lh /manuals/new-manual.pdf

# Check RAG service logs
docker-compose logs rag-service | grep -i error

# Try re-indexing
docker-compose restart rag-service
```

### Problem: Threshold not extracted

**Symptoms:**
- Manual has threshold but not in `/thresholds` endpoint
- Symbolic reasoning not using value

**Common causes:**
1. **Threshold not in standard format**
   ```
   ✗ "Maximum debt is fifty thousand pounds"
   ✓ "Maximum debt is £50,000"
   ```

2. **Complex sentence structure**
   ```
   ✗ "The debt, which should be less than fifty thousand..."
   ✓ "Total debt must be less than £50,000"
   ```

**Solution:**
- Simplify language in manual (if you control it)
- Or manually document threshold in code

### Problem: Answers citing outdated manual

**Symptoms:**
- Response cites archived manual
- Information contradicts current guidance

**Cause:**
- Archived file still in `/manuals/`
- Old vectorstore not cleared

**Solution:**
```bash
# Ensure file is moved to archive
mv /manuals/old-manual.pdf /manuals/archive/

# Clear vectorstore (careful!)
# This deletes all indexed manuals
rm -rf /data/vectorstore/manuals

# Restart service (will re-index all)
docker-compose restart rag-service
```

---

## 📝 Best Practices

### ✅ DO

1. **Version control your manuals**
   ```
   DRO_Guidelines_2024_v1.pdf
   DRO_Guidelines_2024_v2.pdf  (updated)
   DRO_Guidelines_2025.pdf     (new year)
   ```

2. **Keep a changelog**
   ```markdown
   # Manuals Changelog

   ## 2025-10-24
   - Added: DRO_Guidelines_2025.pdf
   - Removed: DRO_Guidelines_2024_v2.pdf (outdated)
   - Updated: CPAG debt advice handbook (latest edition)
   ```

3. **Test after changes**
   - Ask questions you know the answer to
   - Verify sources are correct
   - Check confidence scores

4. **Document sources**
   ```markdown
   # Manual Sources

   - CPAG Handbook: Subscription (renewed annually)
   - DRO Guidelines: https://www.gov.uk/dro-guidelines
   - StepChange: https://www.stepchange.org/resources
   ```

### ❌ DON'T

1. **Don't mix client and manual docs**
   - Client uploads → Client RAG (separate vectorstore)
   - Manuals → Main RAG (this directory)

2. **Don't delete without archiving**
   - Always move to `/archive/` first
   - Document why removed
   - Keep for audit trail

3. **Don't ignore licensing**
   - Check copyright before adding
   - Document permissions
   - Respect restrictions

---

## 🆘 Getting Help

**Questions about:**
- **Adding manuals** → IT team (it@riverside.org.uk)
- **Copyright/licensing** → Manager or legal team
- **Manual not indexing** → Check logs, contact IT
- **Wrong answers from system** → May need better manuals

---

## 📚 Recommended Manual Library

### Essential (Must Have)

- ✓ CPAG Debt Advice Handbook (latest)
- ✓ DRO eligibility criteria
- ✓ Bankruptcy guidance
- ✓ Priority debts guide

### Recommended (Should Have)

- ○ IVA provider guides
- ○ Debt management plan templates
- ○ Benefits eligibility guides
- ○ Enforcement procedures

### Nice to Have

- ○ Case studies
- ○ Letter templates
- ○ Court form guides
- ○ Training materials

---

**Directory Maintained By:** IT Team & Centre Manager
**Last Updated:** October 24, 2025
**Version:** 1.0.0

**Questions?** Email: it@riverside.org.uk
