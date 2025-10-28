# RMA Demo - Documentation Index

**Welcome to the Riverside Money Advice RAG System Documentation**

This documentation covers the entire system, from technical architecture to centre manager guides.

---

## 📚 Quick Navigation

### For Centre Managers (Non-Technical)

Start here if you're a centre manager or non-technical user:

1. **[n8n Centre Manager Guide](N8N_CENTRE_MANAGER_GUIDE.md)** 🌟
   - What n8n is and why you need it
   - Step-by-step: Creating your first workflow
   - Available tools and how to use them
   - Best practices and security

2. **[n8n Workflow Examples](N8N_WORKFLOW_EXAMPLES.md)**
   - 18 ready-to-use workflow templates
   - Client management, document processing, reporting
   - Copy-paste configurations

3. **[n8n Troubleshooting Guide](N8N_TROUBLESHOOTING.md)**
   - 10 common problems and solutions
   - When to call IT vs. fix yourself
   - Health checks and maintenance

4. **[Manuals Directory Guide](../manuals/README.md)**
   - What training manuals to add
   - How the system uses them
   - Adding and removing manuals

### For Technical Users & IT Staff

Technical documentation for developers and system administrators:

#### Architecture & Core Features

1. **[Agentic RAG Architecture](AGENTIC_RAG_ARCHITECTURE.md)**
   - LangGraph agent workflow
   - How symbolic reasoning works
   - Multi-step agent decision process

2. **[Agentic RAG Quick Reference](AGENTIC_RAG_QUICK_REFERENCE.md)**
   - API endpoints
   - Code snippets
   - Testing examples

3. **[Before/After Agentic RAG](BEFORE_AFTER_AGENTIC_RAG.md)**
   - What changed with LangGraph
   - Performance comparisons
   - Migration rationale

4. **[Client RAG Integration](../CLIENT_RAG_INTEGRATION_COMPLETE.md)**
   - How client documents work
   - "Should I worry?" feature
   - LangGraph integration for client RAG

#### Specific Features

5. **[Eligibility Checker](features/ELIGIBILITY_CHECKER.md)**
   - DRO/Bankruptcy eligibility logic
   - Threshold extraction
   - Symbolic constraint evaluation

6. **[Should I Worry Feature](../SHOULD_I_WORRY_FEATURE.md)**
   - Empathetic document analysis
   - Worry level assessment
   - Next steps generation

7. **[Dual Mode Architecture](../DUAL_MODE_ARCHITECTURE_DIAGRAM.md)**
   - General queries vs. client-specific queries
   - Two RAG services explained
   - Vectorstore separation

#### Deployment & Testing

8. **[Agentic RAG Deployment Success](../AGENTIC_RAG_DEPLOYMENT_SUCCESS.md)**
   - Deployment checklist
   - Service startup verification
   - Integration testing

9. **[Test Results](../TEST_RESULTS_AGENTIC_RAG.md)**
   - Comprehensive test suite results
   - Performance benchmarks
   - Edge case handling

10. **[Agentic RAG Summary](../AGENTIC_RAG_SUMMARY.md)**
    - Executive summary
    - Key features overview
    - Quick start guide

---

## 🗂️ Documentation by Role

### I'm a Centre Manager

**Goal: Automate routine tasks with n8n**

1. Read: [n8n Centre Manager Guide](N8N_CENTRE_MANAGER_GUIDE.md)
2. Browse: [n8n Workflow Examples](N8N_WORKFLOW_EXAMPLES.md)
3. Pick a workflow and try it out
4. Keep handy: [n8n Troubleshooting Guide](N8N_TROUBLESHOOTING.md)

**Goal: Update training manuals**

1. Read: [Manuals Directory Guide](../manuals/README.md)
2. Add your PDFs to `/manuals/`
3. Restart RAG service (or ask IT)

**Goal: Understand what the system can do**

1. Read: [Agentic RAG Summary](../AGENTIC_RAG_SUMMARY.md)
2. Read: [Eligibility Checker](features/ELIGIBILITY_CHECKER.md)
3. Read: [Should I Worry Feature](../SHOULD_I_WORRY_FEATURE.md)

### I'm a Debt Adviser

**Goal: Use the system effectively**

1. Read: [Agentic RAG Quick Reference](AGENTIC_RAG_QUICK_REFERENCE.md)
2. Understand: [Eligibility Checker](features/ELIGIBILITY_CHECKER.md)
3. Learn: [Should I Worry Feature](../SHOULD_I_WORRY_FEATURE.md)

**Goal: Understand limitations**

1. Read: [Before/After Agentic RAG](BEFORE_AFTER_AGENTIC_RAG.md)
2. Check: [Test Results](../TEST_RESULTS_AGENTIC_RAG.md)

### I'm an IT Administrator

**Goal: Deploy and maintain the system**

1. Read: [Agentic RAG Deployment Success](../AGENTIC_RAG_DEPLOYMENT_SUCCESS.md)
2. Review: [Agentic RAG Architecture](AGENTIC_RAG_ARCHITECTURE.md)
3. Understand: [Dual Mode Architecture](../DUAL_MODE_ARCHITECTURE_DIAGRAM.md)
4. Test: [Test Results](../TEST_RESULTS_AGENTIC_RAG.md)

**Goal: Support centre managers with n8n**

1. Familiarize with: [n8n Centre Manager Guide](N8N_CENTRE_MANAGER_GUIDE.md)
2. Review: [n8n Workflow Examples](N8N_WORKFLOW_EXAMPLES.md)
3. Learn to fix: [n8n Troubleshooting Guide](N8N_TROUBLESHOOTING.md)

**Goal: Customize or extend the system**

1. Study: [Agentic RAG Architecture](AGENTIC_RAG_ARCHITECTURE.md)
2. Reference: [Agentic RAG Quick Reference](AGENTIC_RAG_QUICK_REFERENCE.md)
3. Review: [Client RAG Integration](../CLIENT_RAG_INTEGRATION_COMPLETE.md)

### I'm a Developer

**Goal: Understand the codebase**

1. Start: [Agentic RAG Architecture](AGENTIC_RAG_ARCHITECTURE.md)
2. Deep dive: [Agentic RAG Quick Reference](AGENTIC_RAG_QUICK_REFERENCE.md)
3. Client-side: [Client RAG Integration](../CLIENT_RAG_INTEGRATION_COMPLETE.md)
4. Features: [Eligibility Checker](features/ELIGIBILITY_CHECKER.md)

**Goal: Add new features**

1. Understand: [Before/After Agentic RAG](BEFORE_AFTER_AGENTIC_RAG.md)
2. Study: [Dual Mode Architecture](../DUAL_MODE_ARCHITECTURE_DIAGRAM.md)
3. Reference: LangGraph agent files in `/services/rag-service/`

**Goal: Test changes**

1. Review: [Test Results](../TEST_RESULTS_AGENTIC_RAG.md)
2. Follow: Testing examples in [Agentic RAG Quick Reference](AGENTIC_RAG_QUICK_REFERENCE.md)

---

## 📖 Documentation Structure

```
RMA-Demo/
├── docs/                                    # Main documentation
│   ├── README.md                            # 👈 You are here
│   ├── N8N_CENTRE_MANAGER_GUIDE.md          # n8n for non-technical users
│   ├── N8N_WORKFLOW_EXAMPLES.md             # 18 workflow templates
│   ├── N8N_TROUBLESHOOTING.md               # Fixing common n8n issues
│   ├── AGENTIC_RAG_ARCHITECTURE.md          # Technical deep dive
│   ├── AGENTIC_RAG_QUICK_REFERENCE.md       # API reference & code snippets
│   ├── BEFORE_AFTER_AGENTIC_RAG.md          # What changed and why
│   └── features/
│       └── ELIGIBILITY_CHECKER.md           # DRO/Bankruptcy checker
│
├── manuals/                                 # Training manual PDFs
│   └── README.md                            # How manuals are used
│
├── CLIENT_RAG_INTEGRATION_COMPLETE.md       # Client RAG + LangGraph
├── SHOULD_I_WORRY_FEATURE.md                # Worry analysis feature
├── DUAL_MODE_ARCHITECTURE_DIAGRAM.md        # Two RAG services explained
├── AGENTIC_RAG_DEPLOYMENT_SUCCESS.md        # Deployment guide
├── AGENTIC_RAG_SUMMARY.md                   # Executive summary
└── TEST_RESULTS_AGENTIC_RAG.md              # Test suite results
```

---

## 🚀 Quick Start by Task

### "I want to automate client onboarding"

1. Read: [n8n Centre Manager Guide](N8N_CENTRE_MANAGER_GUIDE.md) - Section "Creating Your First Workflow"
2. Copy: [New Client Onboarding workflow](N8N_WORKFLOW_EXAMPLES.md#1-new-client-onboarding-🟢)
3. Customize for your centre
4. Test with dummy data

### "I want to check if a client is DRO eligible"

**Option 1: Use the frontend**
- Go to client page
- Click "Check Eligibility" button
- See results with explanations

**Option 2: Understand how it works**
- Read: [Eligibility Checker](features/ELIGIBILITY_CHECKER.md)
- Review: Code in `/services/rag-service/symbolic_reasoning.py`

**Option 3: Call the API**
- Reference: [Agentic RAG Quick Reference](AGENTIC_RAG_QUICK_REFERENCE.md) - "Eligibility Checking" section

### "I want to add new training manuals"

1. Read: [Manuals Directory Guide](../manuals/README.md)
2. Prepare PDFs (clear naming, <10MB each)
3. Copy to `/manuals/` directory
4. Restart RAG service
5. Test by asking a question that requires the new manual

### "I want to create a weekly report workflow"

1. Browse: [n8n Workflow Examples](N8N_WORKFLOW_EXAMPLES.md#10-weekly-statistics-report-🟢)
2. Import the template into n8n
3. Configure credentials (email, MCP API key)
4. Set schedule (Friday 5 PM)
5. Test manually first
6. Activate workflow

### "I want to understand the 'Should I worry?' feature"

1. Read: [Should I Worry Feature](../SHOULD_I_WORRY_FEATURE.md)
2. See integration: [Client RAG Integration](../CLIENT_RAG_INTEGRATION_COMPLETE.md) - "Should I Worry?" section
3. Try it: Upload a document, click "Should I worry?"

### "Something's broken in n8n"

1. Quick check: [n8n Troubleshooting Guide](N8N_TROUBLESHOOTING.md) - "Quick Diagnosis"
2. Find your problem: Review 10 common problems
3. Still stuck? Check "When to Escalate" section
4. Contact IT with troubleshooting checklist completed

---

## 🔑 Key Concepts

### What is RAG?

**Retrieval-Augmented Generation** - The system retrieves relevant information from training manuals before generating an answer.

**Example:**
```
Question: "What's the DRO debt limit?"
    ↓
Search manuals for "DRO debt limit"
    ↓
Find: "DRO maximum debt is £50,000"
    ↓
Generate answer: "The DRO debt limit is £50,000..."
```

### What is LangGraph?

**Graph-based agent workflow** - Instead of a simple question-answer, the system uses multiple steps to reason about complex queries.

**Example:**
```
Question: "Am I eligible for a DRO?"
    ↓
Step 1: Analyze question (complex, needs eligibility check)
    ↓
Step 2: Retrieve client financial data
    ↓
Step 3: Extract values (debt, income, assets)
    ↓
Step 4: Load thresholds from manuals
    ↓
Step 5: Compare symbolically (debt < £50k? ✓)
    ↓
Step 6: Generate answer with reasoning
```

### What is Symbolic Reasoning?

**Using Python math instead of LLM guessing** - For financial calculations, we use Python code to ensure accuracy.

**Why:**
- ✗ LLM: "Is £15,000 < £50,000? Probably yes..."
- ✓ Python: `15000 < 50000  # True` (always correct)

### What is n8n?

**Visual workflow automation** - Create automated processes by connecting blocks together (like LEGO).

**Example workflow:**
```
New client registers → Send welcome email → Create calendar appointment → Notify adviser
```

No coding required!

### What are Thresholds?

**Financial limits extracted from manuals** - The system automatically finds limits like "DRO max debt: £50,000" and uses them for eligibility checks.

**Benefits:**
- No hardcoded values
- Always up-to-date (update manual → restart → new thresholds)
- Source-traceable (know which manual it came from)

---

## 💡 Common Questions

### Q: Can I use this system without technical knowledge?

**A:** Yes! The [n8n Centre Manager Guide](N8N_CENTRE_MANAGER_GUIDE.md) is written for non-technical users. You can:
- Create simple workflows with visual drag-and-drop
- Use pre-built templates from [Workflow Examples](N8N_WORKFLOW_EXAMPLES.md)
- Ask IT for help with complex tasks

### Q: How accurate is the eligibility checker?

**A:** Very accurate for straightforward cases. See [Test Results](../TEST_RESULTS_AGENTIC_RAG.md) for detailed accuracy metrics. The system uses:
- Symbolic reasoning (Python math, not LLM guessing)
- Thresholds from official manuals (not hallucinated)
- Confidence scores (tells you when it's unsure)

**Important:** Always have a qualified adviser review eligibility decisions.

### Q: What data does the system store?

**A:**
- **General RAG**: Training manual content (no personal data)
- **Client RAG**: Client-uploaded documents (separated per client)
- **n8n**: Workflow configurations and execution logs

See [n8n Centre Manager Guide](N8N_CENTRE_MANAGER_GUIDE.md) - "Security & Privacy" section.

### Q: Can I add my own training manuals?

**A:** Yes! See [Manuals Directory Guide](../manuals/README.md) for:
- What formats are supported (PDF)
- How to add manuals
- How to verify they're indexed
- Copyright considerations

### Q: What if n8n stops working?

**A:** See [n8n Troubleshooting Guide](N8N_TROUBLESHOOTING.md):
1. Quick diagnosis (is n8n running?)
2. 10 common problems with solutions
3. When to call IT
4. Health check procedures

### Q: Can I modify the workflows?

**A:** Absolutely! That's the point. See [n8n Workflow Examples](N8N_WORKFLOW_EXAMPLES.md) for:
- Templates to start from
- Best practices for modifications
- Testing before activating
- Version control tips

### Q: How do I know if the system is working correctly?

**A:** Multiple checks:
1. **For n8n**: Check Executions tab for green checkmarks
2. **For RAG**: Ask a test question with known answer
3. **For thresholds**: Query `/thresholds` endpoint
4. **Full system**: See [Agentic RAG Deployment Success](../AGENTIC_RAG_DEPLOYMENT_SUCCESS.md)

### Q: What's the difference between the two RAG services?

**A:** See [Dual Mode Architecture](../DUAL_MODE_ARCHITECTURE_DIAGRAM.md):
- **Main RAG Service** (port 8102): General debt advice questions, searches training manuals
- **Client RAG Service** (port 8104): Client-specific questions, searches client's uploaded documents

Both now use LangGraph agents!

---

## 🆘 Getting Help

### Documentation Issues

If documentation is:
- Unclear or confusing
- Out of date
- Missing important information

**Contact:** IT team (it@riverside.org.uk)

### System Issues

If the system is:
- Not responding
- Giving wrong answers
- Throwing errors

1. Check [n8n Troubleshooting Guide](N8N_TROUBLESHOOTING.md) first
2. Check [Agentic RAG Quick Reference](AGENTIC_RAG_QUICK_REFERENCE.md) - "Common Issues"
3. Contact IT with details (error message, what you were doing, screenshots)

### Training

Need help learning:
- How to use n8n
- How to create workflows
- How the system works

**Resources:**
1. This documentation (start with guides for your role)
2. Internal training sessions (ask your manager)
3. IT team for one-on-one support

---

## 📋 Documentation Checklist

Before deploying a change, ensure:

**For Centre Managers:**
- [ ] Updated [n8n Centre Manager Guide](N8N_CENTRE_MANAGER_GUIDE.md) if workflows changed
- [ ] Added new workflows to [n8n Workflow Examples](N8N_WORKFLOW_EXAMPLES.md)
- [ ] Updated [n8n Troubleshooting Guide](N8N_TROUBLESHOOTING.md) if new issues discovered

**For Technical Changes:**
- [ ] Updated [Agentic RAG Architecture](AGENTIC_RAG_ARCHITECTURE.md) if architecture changed
- [ ] Updated [Agentic RAG Quick Reference](AGENTIC_RAG_QUICK_REFERENCE.md) if API changed
- [ ] Updated [Test Results](../TEST_RESULTS_AGENTIC_RAG.md) with new test outcomes
- [ ] Created/updated feature docs in `/docs/features/` if new features added

**For Manual Updates:**
- [ ] Updated [Manuals Directory Guide](../manuals/README.md) if new manuals added
- [ ] Documented which manuals were added/removed in changelog
- [ ] Verified thresholds extracted correctly

---

## 🔄 Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0.0 | 2025-10-24 | Initial comprehensive documentation index | IT Team |

---

## 📞 Support Contacts

- **IT Support:** it@riverside.org.uk
- **n8n Issues:** See [Troubleshooting Guide](N8N_TROUBLESHOOTING.md) first, then IT
- **Training Requests:** Manager or IT team
- **Documentation Feedback:** IT team

---

**Last Updated:** October 24, 2025
**Maintained By:** IT Team
**Version:** 1.0.0

**🎉 Welcome to the RMA RAG System! Start with the guide for your role above.**
