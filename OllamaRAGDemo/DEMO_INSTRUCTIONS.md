# OllamaRAGDemo - Demo Instructions

## What's Ready for Your Demo

### 1. Web Interface
- Simple chat interface accessible from your browser
- Ask questions in the text box, answers appear below with sources
- Shows which documents were used to answer each question

### 2. Documents Added

#### Julian Mander Profile
- Personal document about Julian who likes Doctor Who and trains
- Story about his recent Scottish holiday combining both interests
- Great for demonstrating specific information retrieval

**Sample questions to demo:**
- "What are Julian's hobbies?"
- "What does Julian like about Doctor Who?"
- "Where did Julian go on holiday?"
- "What trains did Julian see in Scotland?"

#### UK Financial Advice Documents (13 total)

**Long comprehensive guides:**
1. UK Pensions Guide - Complete overview of pension system
2. UK Mortgage Guide - Everything about home loans
3. UK Retirement Planning - Securing your financial future
4. UK Estate Planning & Inheritance Tax
5. UK Self-Employment & Business Finance (longest document)

**Medium-length guides:**
6. Investment Fundamentals for UK Investors
7. UK Debt Management and Credit
8. UK Insurance Guide
9. UK Savings Accounts Guide
10. UK Retirement Planning Guide

**Shorter guides:**
11. ISA Guide
12. UK Tax Basics
13. First-Time Buyer Guide
14. Budgeting and Money Management
15. Student Finance Guide
16. Benefits and Tax Credits

## How to Run the Demo

### Start the Application

```bash
cd /home/user/CMACatalyst/OllamaRAGDemo
docker-compose up -d
```

### Re-ingest Documents (Important!)
The new documents need to be added to the vector store:

```bash
docker-compose exec app python3 /app/ingest_documents.py
```

Wait for ingestion to complete (will show number of chunks created).

### Access the Web Interface

Open your browser to: **http://localhost:8000**

You'll see a clean chat interface ready for questions.

## Demo Script Suggestions

### Haystack Search Demonstration

The "haystack" concept means finding specific information among lots of data. Here's a demo flow:

1. **Start with Julian questions** (needle in the haystack)
   - "Who is Julian Mander?"
   - "What TV show does Julian like?"
   - Shows RAG finding specific person among many financial documents

2. **Ask broad financial questions**
   - "What is the UK State Pension age?"
   - "How much can I save in an ISA?"
   - Shows RAG searching through multiple long documents

3. **Ask specific technical questions**
   - "What is the mortgage stamp duty for first-time buyers?"
   - "How much is Child Benefit?"
   - Demonstrates finding precise information in lengthy guides

4. **Ask questions requiring synthesis**
   - "How should I plan for retirement if I'm self-employed?"
   - This will pull from multiple documents (pensions, self-employment, retirement planning)

5. **Compare information**
   - "What's the difference between ISA and pension contributions?"
   - Shows RAG understanding context across documents

### Key Demo Points

- **Sources displayed**: Each answer shows which documents were used
- **Accurate retrieval**: RAG finds relevant chunks even in very long documents
- **Context understanding**: Answers synthesize information from multiple sources
- **Haystack concept**: Finding Julian among 15+ financial documents demonstrates searching in large document sets

## Troubleshooting

If you get "Vector store not initialized" error:
```bash
docker-compose restart app
```

To check ingestion status:
```bash
docker-compose logs app
```

To rebuild everything:
```bash
docker-compose down
docker-compose up --build -d
docker-compose exec app python3 /app/ingest_documents.py
```

## Technical Details

- **Total documents**: 18 (16 financial + Julian + 2 original samples)
- **Web framework**: FastAPI with embedded HTML
- **Vector store**: ChromaDB with Ollama embeddings
- **LLM**: Ollama llama3.2
- **Embedding model**: nomic-embed-text

## Tips for a Great Demo

1. **Warm up the system**: Ask 1-2 questions before the actual demo
2. **Vary question complexity**: Start simple, then show complex queries
3. **Highlight sources**: Point out how it shows which docs were used
4. **Show the haystack**: Explain there are many large documents, RAG finds the right info
5. **Interactive**: Have audience suggest questions

