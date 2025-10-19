'use client'

import { useState } from 'react'
import { BookOpen, Server, Globe, Zap, HelpCircle, FileText, Wrench, Database } from 'lucide-react'
import ManualsViewer from './ManualsViewer'

type DocSection = 'usage' | 'deployment' | 'domain' | 'aws' | 'troubleshooting' | 'manuals' | 'ai-architecture'

export default function Documentation() {
  const [activeSection, setActiveSection] = useState<DocSection>('usage')

  return (
    <div className="bg-white rounded-lg shadow-lg p-8 h-[calc(100vh-16rem)] flex">
      {/* Sidebar Navigation */}
      <div className="w-64 border-r border-gray-200 pr-6 mr-6">
        <h2 className="text-xl font-bold mb-4 text-gray-900">Documentation</h2>
        <nav className="space-y-2">
          <button
            onClick={() => setActiveSection('manuals')}
            className={`w-full flex items-center gap-3 px-4 py-2 rounded-md text-left transition-colors ${
              activeSection === 'manuals'
                ? 'bg-blue-50 text-blue-700 font-medium'
                : 'text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Database className="h-5 w-5" />
            Ingested Manuals
          </button>
          <button
            onClick={() => setActiveSection('usage')}
            className={`w-full flex items-center gap-3 px-4 py-2 rounded-md text-left transition-colors ${
              activeSection === 'usage'
                ? 'bg-blue-50 text-blue-700 font-medium'
                : 'text-gray-700 hover:bg-gray-50'
            }`}
          >
            <BookOpen className="h-5 w-5" />
            Using for Money Advice
          </button>
          <button
            onClick={() => setActiveSection('ai-architecture')}
            className={`w-full flex items-center gap-3 px-4 py-2 rounded-md text-left transition-colors ${
              activeSection === 'ai-architecture'
                ? 'bg-blue-50 text-blue-700 font-medium'
                : 'text-gray-700 hover:bg-gray-50'
            }`}
          >
            <HelpCircle className="h-5 w-5" />
            AI & Privacy
          </button>
          <button
            onClick={() => setActiveSection('deployment')}
            className={`w-full flex items-center gap-3 px-4 py-2 rounded-md text-left transition-colors ${
              activeSection === 'deployment'
                ? 'bg-blue-50 text-blue-700 font-medium'
                : 'text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Server className="h-5 w-5" />
            Local Deployment
          </button>
          <button
            onClick={() => setActiveSection('aws')}
            className={`w-full flex items-center gap-3 px-4 py-2 rounded-md text-left transition-colors ${
              activeSection === 'aws'
                ? 'bg-blue-50 text-blue-700 font-medium'
                : 'text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Zap className="h-5 w-5" />
            AWS Deployment
          </button>
          <button
            onClick={() => setActiveSection('domain')}
            className={`w-full flex items-center gap-3 px-4 py-2 rounded-md text-left transition-colors ${
              activeSection === 'domain'
                ? 'bg-blue-50 text-blue-700 font-medium'
                : 'text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Globe className="h-5 w-5" />
            Domain Registration
          </button>
          <button
            onClick={() => setActiveSection('troubleshooting')}
            className={`w-full flex items-center gap-3 px-4 py-2 rounded-md text-left transition-colors ${
              activeSection === 'troubleshooting'
                ? 'bg-blue-50 text-blue-700 font-medium'
                : 'text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Wrench className="h-5 w-5" />
            Troubleshooting
          </button>
        </nav>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto">
        {activeSection === 'manuals' && <ManualsViewer />}
        {activeSection === 'usage' && <UsageGuide />}
        {activeSection === 'ai-architecture' && <AIArchitectureGuide />}
        {activeSection === 'deployment' && <DeploymentGuide />}
        {activeSection === 'aws' && <AWSGuide />}
        {activeSection === 'domain' && <DomainGuide />}
        {activeSection === 'troubleshooting' && <TroubleshootingGuide />}
      </div>
    </div>
  )
}

function UsageGuide() {
  return (
    <div className="prose max-w-none">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Using RMA Dashboard for Money Advice</h1>

      <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-6">
        <div className="flex">
          <HelpCircle className="h-5 w-5 text-blue-400 mr-3 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-medium text-blue-800">Purpose</h3>
            <p className="text-sm text-blue-700">
              This dashboard helps money advisors streamline client communication, document management,
              and access training materials efficiently.
            </p>
          </div>
        </div>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">1. Notes to CoA (Course of Action)</h2>

      <h3 className="text-xl font-semibold text-gray-800 mb-3">Purpose</h3>
      <p className="text-gray-700 mb-4">
        Convert technical advisor notes into clear, client-friendly language. The AI automatically structures
        your notes into three sections that clients can easily understand.
      </p>

      <h3 className="text-xl font-semibold text-gray-800 mb-3">How to Use</h3>
      <ol className="list-decimal list-inside space-y-3 text-gray-700 mb-4">
        <li>
          <strong>Enter Client Name:</strong> Type the client's full name (e.g., "John Smith")
        </li>
        <li>
          <strong>Paste Your Notes:</strong> Copy your case notes from your system and paste them.
          These can include:
          <ul className="list-disc list-inside ml-6 mt-2 space-y-1">
            <li>Debt amounts and creditors</li>
            <li>Income and expenditure details</li>
            <li>Recommended actions (DMP, IVA, bankruptcy, etc.)</li>
            <li>Required documents</li>
            <li>Next steps and deadlines</li>
          </ul>
        </li>
        <li>
          <strong>Click Convert:</strong> The AI processes your notes (takes 5-15 seconds)
        </li>
        <li>
          <strong>Review Output:</strong> Check the three sections:
          <ul className="list-disc list-inside ml-6 mt-2 space-y-1">
            <li><strong>Matters Discussed:</strong> What you talked about in simple terms</li>
            <li><strong>Our Actions:</strong> What you (the advisor) will do</li>
            <li><strong>Your Actions:</strong> What the client needs to do</li>
          </ul>
        </li>
        <li>
          <strong>Copy and Use:</strong> Click the "Copy" button to copy the full letter,
          then paste into your email or letter system
        </li>
      </ol>

      <h3 className="text-xl font-semibold text-gray-800 mb-3">Example Workflow</h3>
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
        <p className="font-semibold text-gray-900 mb-2">Your Technical Notes:</p>
        <pre className="text-sm text-gray-700 bg-white p-3 rounded border border-gray-200 overflow-x-auto">
{`Client: Sarah Johnson
Debts: £23,400 across 5 creditors
- MBNA CC: £8,200
- Barclays loan: £7,500
- Santander CC: £4,200
- Catalogue debt: £2,100
- Council tax arrears: £1,400

Income: £1,650/mo (Universal Credit + part-time work)
Expenditure: £1,520/mo
Surplus: £130/mo

Recommended DMP via StepChange
Client agreed, will contact creditors
Need 3 months bank statements
Priority: Council tax payment plan first`}
        </pre>

        <p className="font-semibold text-gray-900 mb-2 mt-4">Generated Client Letter:</p>
        <div className="text-sm text-gray-700 bg-white p-3 rounded border border-gray-200">
          <p className="mb-2">Dear Sarah,</p>
          <p className="font-semibold mb-1">MATTERS DISCUSSED:</p>
          <p className="mb-3">
            We talked about your debts totaling £23,400 with five different companies. We looked at your
            income of £1,650 per month and your monthly expenses of £1,520, which leaves you with £130
            that you could use to pay towards your debts.
          </p>
          <p className="font-semibold mb-1">OUR ACTIONS:</p>
          <p className="mb-3">
            We will help you set up a Debt Management Plan with StepChange, a charity that will work
            with your creditors on your behalf. We will also contact the council to arrange a payment
            plan for your council tax arrears, as this is a priority debt.
          </p>
          <p className="font-semibold mb-1">YOUR ACTIONS:</p>
          <p className="mb-3">
            You need to gather your bank statements from the last three months and send them to us.
            These will help StepChange when they contact your creditors.
          </p>
        </div>
      </div>

      <h3 className="text-xl font-semibold text-gray-800 mb-3">Best Practices</h3>
      <ul className="list-disc list-inside space-y-2 text-gray-700 mb-6">
        <li>Include all relevant financial details in your notes</li>
        <li>Mention specific creditors and amounts</li>
        <li>Note any priority debts (council tax, rent, utilities)</li>
        <li>List required documents clearly</li>
        <li>Always review the output before sending to clients</li>
        <li>Edit the generated text if needed for your specific case</li>
      </ul>

      <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">2. Client QR Codes</h2>

      <h3 className="text-xl font-semibold text-gray-800 mb-3">Purpose</h3>
      <p className="text-gray-700 mb-4">
        Create QR codes that clients can scan with their phones to access a secure document upload portal.
        This eliminates the need for clients to email sensitive documents.
      </p>

      <h3 className="text-xl font-semibold text-gray-800 mb-3">How to Use</h3>
      <ol className="list-decimal list-inside space-y-3 text-gray-700 mb-4">
        <li>
          <strong>Create Client ID:</strong> Use a consistent format like CLIENT001, JS_2024_001, etc.
        </li>
        <li>
          <strong>Enter Client Name:</strong> Full name for your records
        </li>
        <li>
          <strong>Generate QR Code:</strong> Click to create the code
        </li>
        <li>
          <strong>Download:</strong> Save the QR code image
        </li>
        <li>
          <strong>Share with Client:</strong> Include in letters, emails, or print it out
        </li>
      </ol>

      <h3 className="text-xl font-semibold text-gray-800 mb-3">Client Instructions</h3>
      <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
        <p className="font-semibold text-green-900 mb-2">Share these steps with your clients:</p>
        <ol className="list-decimal list-inside space-y-1 text-green-800 text-sm">
          <li>Open your phone's camera app</li>
          <li>Point the camera at the QR code</li>
          <li>Tap the notification that appears</li>
          <li>You'll see a secure upload page</li>
          <li>Tap "Choose Files" and select your documents</li>
          <li>Tap "Upload" when ready</li>
        </ol>
      </div>

      <h3 className="text-xl font-semibold text-gray-800 mb-3">Document Management</h3>
      <p className="text-gray-700 mb-4">
        Once clients upload documents:
      </p>
      <ul className="list-disc list-inside space-y-2 text-gray-700 mb-6">
        <li>Documents are automatically converted to searchable text</li>
        <li>PDFs and images are processed using OCR</li>
        <li>You can access all client documents through the authenticated portal</li>
        <li>Documents are organized by client ID</li>
        <li>Both original files and processed markdown are saved</li>
      </ul>

      <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">3. Ask the Manuals</h2>

      <h3 className="text-xl font-semibold text-gray-800 mb-3">Purpose</h3>
      <p className="text-gray-700 mb-4">
        Quickly find information from training manuals, policies, and procedures without manually searching
        through PDFs. The AI understands context and provides relevant answers with source citations.
      </p>

      <h3 className="text-xl font-semibold text-gray-800 mb-3">How to Use</h3>
      <ol className="list-decimal list-inside space-y-3 text-gray-700 mb-4">
        <li>
          <strong>Type Your Question:</strong> Ask in natural language, as if asking a colleague
        </li>
        <li>
          <strong>Review Answer:</strong> The AI provides information from the manuals
        </li>
        <li>
          <strong>Check Sources:</strong> See which manuals the answer came from
        </li>
        <li>
          <strong>Follow Up:</strong> Ask clarifying questions in the same conversation
        </li>
      </ol>

      <h3 className="text-xl font-semibold text-gray-800 mb-3">Example Questions</h3>
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6 space-y-3">
        <div>
          <p className="font-semibold text-gray-900">Income & Expenditure:</p>
          <ul className="list-disc list-inside text-sm text-gray-700 ml-4">
            <li>"How do I calculate disposable income?"</li>
            <li>"What are allowable expenses for a DMP?"</li>
            <li>"How should I treat irregular income?"</li>
          </ul>
        </div>
        <div>
          <p className="font-semibold text-gray-900">Debt Solutions:</p>
          <ul className="list-disc list-inside text-sm text-gray-700 ml-4">
            <li>"What's the difference between DMP and DRO?"</li>
            <li>"When should I recommend bankruptcy?"</li>
            <li>"What are the eligibility criteria for an IVA?"</li>
          </ul>
        </div>
        <div>
          <p className="font-semibold text-gray-900">Priority Debts:</p>
          <ul className="list-disc list-inside text-sm text-gray-700 ml-4">
            <li>"How do I handle council tax arrears?"</li>
            <li>"What's the process for rent arrears?"</li>
            <li>"Priority order for multiple priority debts?"</li>
          </ul>
        </div>
        <div>
          <p className="font-semibold text-gray-900">Procedures:</p>
          <ul className="list-disc list-inside text-sm text-gray-700 ml-4">
            <li>"What documents do I need for a full money advice session?"</li>
            <li>"How do I refer to a specialist debt advisor?"</li>
            <li>"What's the escalation process for vulnerable clients?"</li>
          </ul>
        </div>
      </div>

      <h3 className="text-xl font-semibold text-gray-800 mb-3">Tips for Better Answers</h3>
      <ul className="list-disc list-inside space-y-2 text-gray-700 mb-6">
        <li>Be specific in your questions</li>
        <li>Include context when relevant (e.g., "for a single parent with DLA")</li>
        <li>Ask follow-up questions to drill down</li>
        <li>Check the source documents if you need more detail</li>
        <li>Verify critical information with your supervisor</li>
      </ul>

      <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">Data Protection & Security</h2>

      <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
        <div className="flex">
          <HelpCircle className="h-5 w-5 text-yellow-400 mr-3 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-medium text-yellow-800">Important Reminders</h3>
            <ul className="text-sm text-yellow-700 list-disc list-inside mt-2 space-y-1">
              <li>All data is processed locally on your infrastructure</li>
              <li>Client documents are stored securely with authentication</li>
              <li>Never share login credentials</li>
              <li>Follow your organization's data protection policies</li>
              <li>Log out when leaving your workstation</li>
              <li>Report any security concerns immediately</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

function AIArchitectureGuide() {
  return (
    <div className="prose max-w-none">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">AI Architecture & Privacy</h1>

      <div className="bg-green-50 border-l-4 border-green-400 p-4 mb-6">
        <div className="flex">
          <HelpCircle className="h-5 w-5 text-green-400 mr-3 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-medium text-green-800">🔒 Privacy First</h3>
            <p className="text-sm text-green-700">
              All AI processing happens locally on your infrastructure. No client data, manual content, 
              or queries are ever sent to external servers or third-party AI services.
            </p>
          </div>
        </div>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">How Our AI Services Work</h2>

      <p className="text-gray-700 mb-6">
        RMA Dashboard uses three main AI services to help money advisors work more efficiently while 
        maintaining complete data privacy. All services run locally on your server using open-source models.
      </p>

      <h3 className="text-xl font-semibold text-gray-800 mb-3">1. Notes to CoA Service</h3>
      
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
        <h4 className="font-semibold text-gray-900 mb-2">What it does:</h4>
        <p className="text-gray-700 mb-3">
          Converts your technical advisor notes into clear, client-friendly letters with three structured sections:
        </p>
        <ul className="list-disc list-inside text-gray-700 space-y-1 mb-3">
          <li><strong>Matters Discussed:</strong> Plain English summary of the consultation</li>
          <li><strong>Our Actions:</strong> What you (the advisor) will do next</li>
          <li><strong>Your Actions:</strong> What the client needs to do</li>
        </ul>
        
        <h4 className="font-semibold text-gray-900 mb-2 mt-4">How it works:</h4>
        <ol className="list-decimal list-inside text-gray-700 space-y-2 text-sm">
          <li>You paste your technical case notes into the system</li>
          <li>The AI model (Llama 3.2) reads and understands the content</li>
          <li>It restructures the information following Money Advice best practices</li>
          <li>Generates clear, empathetic language suitable for clients</li>
          <li>Returns the formatted letter in ~10-15 seconds</li>
        </ol>
        
        <div className="bg-blue-50 border border-blue-200 rounded p-3 mt-3">
          <p className="text-xs font-semibold text-blue-900 mb-1">🔒 Privacy:</p>
          <p className="text-xs text-blue-800">
            Your notes never leave your server. Processing happens entirely on your local infrastructure.
          </p>
        </div>
      </div>

      <h3 className="text-xl font-semibold text-gray-800 mb-3">2. Document Processing Service</h3>
      
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
        <h4 className="font-semibold text-gray-900 mb-2">What it does:</h4>
        <p className="text-gray-700 mb-3">
          Converts client-uploaded documents (PDFs, images) into searchable text and analyzes them for 
          risk assessment ("Should I worry about this?" button).
        </p>
        
        <h4 className="font-semibold text-gray-900 mb-2 mt-4">How it works:</h4>
        <ol className="list-decimal list-inside text-gray-700 space-y-2 text-sm">
          <li><strong>Text Extraction:</strong> Uses OCR (Tesseract) to read scanned documents</li>
          <li><strong>Vision Analysis:</strong> LLaVA model (13B parameters) "sees" and understands document layouts</li>
          <li><strong>Content Understanding:</strong> Identifies debt letters, court notices, payment demands, etc.</li>
          <li><strong>Risk Assessment:</strong> Evaluates urgency and priority (court dates, eviction notices, etc.)</li>
          <li><strong>Markdown Conversion:</strong> Saves structured, searchable version of each document</li>
        </ol>
        
        <h4 className="font-semibold text-gray-900 mb-2 mt-4">Vision AI Capability:</h4>
        <p className="text-gray-700 text-sm mb-2">
          The LLaVA model doesn't just read text—it understands visual context:
        </p>
        <ul className="list-disc list-inside text-gray-700 text-sm space-y-1">
          <li>Recognizes logos of creditors and official bodies</li>
          <li>Understands tables, forms, and structured layouts</li>
          <li>Identifies highlighted or bolded urgent sections</li>
          <li>Interprets signatures, stamps, and official marks</li>
        </ul>
        
        <div className="bg-blue-50 border border-blue-200 rounded p-3 mt-3">
          <p className="text-xs font-semibold text-blue-900 mb-1">🔒 Privacy:</p>
          <p className="text-xs text-blue-800">
            Client documents are processed locally. Images and PDFs stay on your server and are never 
            sent to external OCR or vision AI services.
          </p>
        </div>
      </div>

      <h3 className="text-xl font-semibold text-gray-800 mb-3">3. RAG Service - "Ask the Manuals"</h3>
      
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
        <h4 className="font-semibold text-gray-900 mb-2">What it does:</h4>
        <p className="text-gray-700 mb-3">
          Lets you query your training manuals, policies, and procedures in natural language. 
          The AI retrieves relevant information and provides answers with source citations.
        </p>
        
        <h4 className="font-semibold text-gray-900 mb-2 mt-4">How it works (RAG explained):</h4>
        <p className="text-gray-700 text-sm mb-3">
          RAG stands for <strong>Retrieval-Augmented Generation</strong>. It's a two-step process:
        </p>
        
        <div className="bg-white border border-gray-300 rounded p-3 mb-3">
          <p className="font-semibold text-gray-900 text-sm mb-2">Step 1: Document Ingestion (happens at startup)</p>
          <ol className="list-decimal list-inside text-gray-700 text-xs space-y-1">
            <li>All PDF manuals in the <code className="bg-gray-100 px-1 rounded">/manuals</code> directory are automatically processed</li>
            <li>Text is extracted from each PDF (using PyPDF2 or OCR for scanned documents)</li>
            <li>Long documents are split into ~1000 character chunks with 200 character overlap</li>
            <li>Each chunk is converted into a mathematical "embedding" (a list of numbers representing meaning)</li>
            <li>Embeddings are stored in ChromaDB vector database for fast similarity search</li>
          </ol>
        </div>
        
        <div className="bg-white border border-gray-300 rounded p-3 mb-3">
          <p className="font-semibold text-gray-900 text-sm mb-2">Step 2: Query Processing (when you ask a question)</p>
          <ol className="list-decimal list-inside text-gray-700 text-xs space-y-1">
            <li>Your question is converted into an embedding using the same model (nomic-embed-text)</li>
            <li>The system searches the vector database for chunks with similar meanings (not just keyword matching)</li>
            <li>Top 4 most relevant chunks are retrieved from different manuals</li>
            <li>These chunks are provided as "context" to the Llama 3.2 language model</li>
            <li>Llama reads the context and generates an answer to your specific question</li>
            <li>Response includes source citations showing which manuals were used</li>
          </ol>
        </div>
        
        <h4 className="font-semibold text-gray-900 mb-2 mt-4">Why this is better than keyword search:</h4>
        <ul className="list-disc list-inside text-gray-700 text-sm space-y-1 mb-3">
          <li><strong>Semantic Understanding:</strong> Finds information based on meaning, not just matching words</li>
          <li><strong>Context Aware:</strong> Understands questions phrased in different ways</li>
          <li><strong>Synthesizes Information:</strong> Combines relevant sections from multiple manuals</li>
          <li><strong>No Hallucination:</strong> Only uses information from your actual manuals</li>
        </ul>
        
        <div className="bg-blue-50 border border-blue-200 rounded p-3 mt-3">
          <p className="text-xs font-semibold text-blue-900 mb-1">🔒 Privacy:</p>
          <p className="text-xs text-blue-800">
            Your training manuals are processed and stored locally in ChromaDB. Questions and answers 
            never leave your infrastructure. The embedding model runs on your server.
          </p>
        </div>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">AI Models Used</h2>

      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-gray-300">
              <th className="text-left py-2 pr-4">Model</th>
              <th className="text-left py-2 pr-4">Size</th>
              <th className="text-left py-2 pr-4">Used For</th>
              <th className="text-left py-2">License</th>
            </tr>
          </thead>
          <tbody className="text-gray-700">
            <tr className="border-b border-gray-200">
              <td className="py-2 pr-4 font-semibold">Llama 3.2</td>
              <td className="py-2 pr-4">3.8GB</td>
              <td className="py-2 pr-4">Text generation (Notes, RAG answers)</td>
              <td className="py-2">Open (Meta)</td>
            </tr>
            <tr className="border-b border-gray-200">
              <td className="py-2 pr-4 font-semibold">LLaVA 13B</td>
              <td className="py-2 pr-4">7.4GB</td>
              <td className="py-2 pr-4">Vision + Text (Document understanding)</td>
              <td className="py-2">Open (UW/MBZUAI)</td>
            </tr>
            <tr>
              <td className="py-2 pr-4 font-semibold">nomic-embed-text</td>
              <td className="py-2 pr-4">274MB</td>
              <td className="py-2 pr-4">Creating embeddings for RAG search</td>
              <td className="py-2">Open (Nomic AI)</td>
            </tr>
          </tbody>
        </table>
        
        <p className="text-xs text-gray-600 mt-3">
          All models are fully open-source and run via Ollama, a local AI runtime. 
          Total storage required: ~12GB for all models.
        </p>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">How to Ask Good Questions</h2>

      <h3 className="text-xl font-semibold text-gray-800 mb-3">Best Practices for "Ask the Manuals"</h3>

      <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
        <h4 className="font-semibold text-yellow-900 mb-2">✅ DO: Ask Specific, Clear Questions</h4>
        <div className="space-y-3 text-sm">
          <div>
            <p className="text-green-700 font-semibold mb-1">✓ Good: "What are the income requirements for a DRO?"</p>
            <p className="text-gray-700">Clear, specific, and likely answered in manuals</p>
          </div>
          <div>
            <p className="text-green-700 font-semibold mb-1">✓ Good: "How do I handle rent arrears for a tenant with Universal Credit?"</p>
            <p className="text-gray-700">Specific scenario with clear context</p>
          </div>
          <div>
            <p className="text-green-700 font-semibold mb-1">✓ Good: "What documents do I need to complete a full income and expenditure assessment?"</p>
            <p className="text-gray-700">Procedural question about your processes</p>
          </div>
        </div>
      </div>

      <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-6">
        <h4 className="font-semibold text-red-900 mb-2">❌ DON'T: Ask Vague or Out-of-Scope Questions</h4>
        <div className="space-y-3 text-sm">
          <div>
            <p className="text-red-700 font-semibold mb-1">✗ Poor: "Tell me about debt"</p>
            <p className="text-gray-700">Too vague—will return generic information</p>
          </div>
          <div>
            <p className="text-red-700 font-semibold mb-1">✗ Poor: "What's the weather like today?"</p>
            <p className="text-gray-700">Not related to your manuals—AI will correctly say it doesn't know</p>
          </div>
          <div>
            <p className="text-red-700 font-semibold mb-1">✗ Poor: "Should I recommend bankruptcy for client John?"</p>
            <p className="text-gray-700">AI can't make client-specific decisions—ask about criteria instead</p>
          </div>
        </div>
      </div>

      <h3 className="text-xl font-semibold text-gray-800 mb-3">What the AI CAN Answer</h3>
      <ul className="list-disc list-inside space-y-2 text-gray-700 mb-6">
        <li><strong>Procedures & Policies:</strong> "What's the process for referring to specialist debt advice?"</li>
        <li><strong>Eligibility Criteria:</strong> "What are the requirements for an IVA?"</li>
        <li><strong>Definitions:</strong> "What's the difference between priority and non-priority debts?"</li>
        <li><strong>Documentation:</strong> "What evidence do I need for a DRO application?"</li>
        <li><strong>Time Limits:</strong> "How long do creditors have to pursue a debt?"</li>
        <li><strong>Calculations:</strong> "How is disposable income calculated for a DMP?"</li>
        <li><strong>Legal Requirements:</strong> "What are the FCA rules for debt advice?"</li>
        <li><strong>Best Practices:</strong> "How should I handle a vulnerable client with mental health issues?"</li>
      </ul>

      <h3 className="text-xl font-semibold text-gray-800 mb-3">What the AI CANNOT Answer</h3>
      <ul className="list-disc list-inside space-y-2 text-gray-700 mb-6">
        <li><strong>Real-Time Information:</strong> Current interest rates, today's news, or live data</li>
        <li><strong>Client-Specific Advice:</strong> Decisions about individual client cases</li>
        <li><strong>Information Not in Manuals:</strong> External policies, other organizations' procedures</li>
        <li><strong>Predictions:</strong> "What will happen if..." scenarios not covered in manuals</li>
        <li><strong>Personal Opinions:</strong> Subjective judgments or recommendations</li>
        <li><strong>External Contacts:</strong> Phone numbers, websites not documented in manuals</li>
      </ul>

      <h3 className="text-xl font-semibold text-gray-800 mb-3">Tips for Better Results</h3>
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
        <ol className="list-decimal list-inside space-y-3 text-gray-700 text-sm">
          <li>
            <strong>Include Context:</strong> "For a single parent with two children..." helps narrow results
          </li>
          <li>
            <strong>Use Specific Terms:</strong> Use correct terminology from manuals (DRO, IVA, DMP, etc.)
          </li>
          <li>
            <strong>Ask Follow-Up Questions:</strong> If first answer isn't quite right, refine your question
          </li>
          <li>
            <strong>Check Source Citations:</strong> Always verify which manual the answer came from
          </li>
          <li>
            <strong>Use the Debug Tab:</strong> View extracted text to ensure manuals were ingested correctly
          </li>
          <li>
            <strong>Combine with Manual Reading:</strong> Use AI for quick lookups, but read full sections for complex cases
          </li>
        </ol>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">Understanding AI Limitations</h2>

      <div className="bg-orange-50 border-l-4 border-orange-400 p-4 mb-6">
        <div className="flex">
          <HelpCircle className="h-5 w-5 text-orange-400 mr-3 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-medium text-orange-800">Important: AI is a Tool, Not a Replacement</h3>
            <p className="text-sm text-orange-700 mb-2">
              The AI services are designed to assist money advisors, not replace professional judgment.
            </p>
            <ul className="text-sm text-orange-700 list-disc list-inside space-y-1">
              <li>Always review AI-generated letters before sending to clients</li>
              <li>Verify critical information (dates, amounts, procedures) independently</li>
              <li>Use your professional expertise for complex or sensitive cases</li>
              <li>Consult supervisors when in doubt—don't rely solely on AI responses</li>
              <li>The AI doesn't know your client personally—you do</li>
            </ul>
          </div>
        </div>
      </div>

      <h3 className="text-xl font-semibold text-gray-800 mb-3">Why "Hallucinations" Are Rare (But Check Anyway)</h3>
      <p className="text-gray-700 mb-4">
        Unlike ChatGPT or other AI chatbots, the RAG system is designed to minimize "hallucinations" 
        (making up information):
      </p>
      <ul className="list-disc list-inside space-y-2 text-gray-700 text-sm mb-6">
        <li><strong>Grounded in Your Manuals:</strong> Only uses actual text from ingested documents</li>
        <li><strong>Source Citations:</strong> Every answer shows which manuals were referenced</li>
        <li><strong>Context Awareness:</strong> If relevant info isn't found, AI says "I don't know"</li>
        <li><strong>No External Training:</strong> Not mixing your procedures with internet knowledge</li>
        <li><strong>Debug Visibility:</strong> You can view extracted text to verify accuracy</li>
      </ul>

      <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">Data Privacy & GDPR Compliance</h2>

      <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
        <h3 className="font-semibold text-green-900 mb-3">Why Local Hosting Matters</h3>
        <p className="text-green-800 text-sm mb-3">
          Running AI models locally (instead of using cloud services like OpenAI, Anthropic, or Google) 
          provides critical advantages for money advice:
        </p>
        <ul className="text-green-800 text-sm list-disc list-inside space-y-2">
          <li>
            <strong>GDPR Compliance:</strong> Client data stays within your organization's infrastructure—no third-party processing
          </li>
          <li>
            <strong>No Data Leakage:</strong> Sensitive financial information never sent over the internet to AI providers
          </li>
          <li>
            <strong>No Training on Your Data:</strong> External AI services learn from queries—yours doesn't
          </li>
          <li>
            <strong>Complete Control:</strong> You control model updates, retention policies, and access logs
          </li>
          <li>
            <strong>Cost Predictable:</strong> No per-API-call charges or surprise bills for high usage
          </li>
          <li>
            <strong>No Internet Required:</strong> Works even if external services are down or blocked
          </li>
        </ul>
      </div>

      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
        <h3 className="font-semibold text-gray-900 mb-3">What Stays Local</h3>
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-gray-300">
              <th className="text-left py-2 pr-4">Data Type</th>
              <th className="text-left py-2">Storage Location</th>
            </tr>
          </thead>
          <tbody className="text-gray-700">
            <tr className="border-b border-gray-200">
              <td className="py-2 pr-4">Client notes</td>
              <td className="py-2">Processed in-memory, not permanently stored</td>
            </tr>
            <tr className="border-b border-gray-200">
              <td className="py-2 pr-4">Uploaded documents</td>
              <td className="py-2">Your server's <code className="bg-gray-100 px-1 rounded">/data/uploads</code> directory</td>
            </tr>
            <tr className="border-b border-gray-200">
              <td className="py-2 pr-4">Training manuals</td>
              <td className="py-2">ChromaDB vector database (local volume)</td>
            </tr>
            <tr className="border-b border-gray-200">
              <td className="py-2 pr-4">AI models</td>
              <td className="py-2">Ollama volume (12GB total)</td>
            </tr>
            <tr>
              <td className="py-2 pr-4">Query history</td>
              <td className="py-2">Not stored (unless you enable logging)</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="bg-blue-50 border-l-4 border-blue-400 p-4">
        <h3 className="text-sm font-medium text-blue-800 mb-2">💡 Best Practice</h3>
        <p className="text-sm text-blue-700">
          Even though the system is designed for privacy, follow your organization's data protection 
          policies. Don't include unnecessary personal details in notes or queries. Use client IDs 
          instead of names where possible. Regularly backup data and maintain access logs for compliance.
        </p>
      </div>
    </div>
  )
}

function DeploymentGuide() {
  return (
    <div className="prose max-w-none">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Local Deployment Guide</h1>

      <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-6">
        <div className="flex">
          <Server className="h-5 w-5 text-blue-400 mr-3 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-medium text-blue-800">Overview</h3>
            <p className="text-sm text-blue-700">
              Deploy RMA Dashboard on your local machine or internal server using Docker.
              Perfect for testing, development, or small single-centre deployments.
            </p>
          </div>
        </div>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">Prerequisites</h2>

      <h3 className="text-xl font-semibold text-gray-800 mb-3">System Requirements</h3>
      <ul className="list-disc list-inside space-y-2 text-gray-700 mb-6">
        <li><strong>RAM:</strong> 16GB minimum, 32GB recommended</li>
        <li><strong>Storage:</strong> 50GB free space (for models and data)</li>
        <li><strong>CPU:</strong> 4 cores minimum, 8+ recommended</li>
        <li><strong>GPU (Optional):</strong> NVIDIA GPU with 8GB+ VRAM for faster inference</li>
        <li><strong>OS:</strong> Linux (Ubuntu 22.04+), macOS, or Windows with WSL2</li>
      </ul>

      <h3 className="text-xl font-semibold text-gray-800 mb-3">Software Requirements</h3>
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
        <ul className="list-disc list-inside space-y-2 text-gray-700">
          <li>Docker Engine 24.0+</li>
          <li>Docker Compose 2.20+</li>
          <li>(Optional) NVIDIA Docker runtime for GPU support</li>
        </ul>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">Installation Steps</h2>

      <h3 className="text-xl font-semibold text-gray-800 mb-3">1. Install Docker</h3>

      <p className="text-gray-700 mb-2"><strong>Ubuntu/Debian:</strong></p>
      <pre className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto mb-4">
{`curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
# Log out and back in for group changes`}
      </pre>

      <p className="text-gray-700 mb-2"><strong>macOS:</strong></p>
      <p className="text-gray-700 mb-4">Download and install Docker Desktop from <a href="https://docker.com" className="text-blue-600">docker.com</a></p>

      <p className="text-gray-700 mb-2"><strong>Windows:</strong></p>
      <p className="text-gray-700 mb-4">
        Install WSL2, then Docker Desktop from <a href="https://docker.com" className="text-blue-600">docker.com</a>
      </p>

      <h3 className="text-xl font-semibold text-gray-800 mb-3">2. (Optional) Install NVIDIA Docker for GPU</h3>
      <pre className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto mb-4">
{`# Install NVIDIA drivers first
distribution=$(. /etc/os-release;echo $ID$VERSION_ID)
curl -s -L https://nvidia.github.io/nvidia-docker/gpgkey | sudo apt-key add -
curl -s -L https://nvidia.github.io/nvidia-docker/$distribution/nvidia-docker.list | \\
  sudo tee /etc/apt/sources.list.d/nvidia-docker.list

sudo apt-get update
sudo apt-get install -y nvidia-docker2
sudo systemctl restart docker

# Test GPU access
docker run --rm --gpus all nvidia/cuda:12.2.0-base-ubuntu22.04 nvidia-smi`}
      </pre>

      <h3 className="text-xl font-semibold text-gray-800 mb-3">3. Clone/Extract RMA-Demo</h3>
      <pre className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto mb-4">
{`cd /path/to/installation
# If from git:
git clone https://your-repo/RMA-Demo.git
cd RMA-Demo

# Or extract from archive:
tar -xzf RMA-Demo.tar.gz
cd RMA-Demo`}
      </pre>

      <h3 className="text-xl font-semibold text-gray-800 mb-3">4. Configure Environment</h3>
      <pre className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto mb-4">
{`# Copy example environment file
cp .env.example .env

# Edit configuration
nano .env  # or use your preferred editor`}
      </pre>

      <p className="text-gray-700 mb-2"><strong>Required Settings:</strong></p>
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
        <pre className="text-sm text-gray-800">
{`# Get API key from https://cloud.llamaindex.ai/
LLAMA_PARSE_API_KEY=llx-xxxxxxxxxxxxxxxx

# Generate secure secret: openssl rand -hex 32
JWT_SECRET=your-64-character-hex-string

# Your server's public URL (for QR codes)
APP_BASE_URL=http://your-server-ip:3000`}
        </pre>
      </div>

      <h3 className="text-xl font-semibold text-gray-800 mb-3">5. Initialize and Start</h3>
      <pre className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto mb-4">
{`# One-command setup
./init.sh

# This will:
# - Create configuration files
# - Start all Docker containers
# - Pull required AI models (7-8GB download)
# - Set up vector databases`}
      </pre>

      <p className="text-gray-700 mb-4">
        <strong>First-time setup takes 15-30 minutes</strong> due to model downloads.
      </p>

      <h3 className="text-xl font-semibold text-gray-800 mb-3">6. Verify Installation</h3>
      <pre className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto mb-4">
{`# Check all services are running
docker-compose ps

# Should show:
# rma-ollama          running
# rma-chromadb        running
# rma-notes-service   running
# rma-doc-processor   running
# rma-rag-service     running
# rma-upload-service  running
# rma-frontend        running`}
      </pre>

      <h3 className="text-xl font-semibold text-gray-800 mb-3">7. Access Dashboard</h3>
      <p className="text-gray-700 mb-4">
        Open your browser to: <code className="bg-gray-100 px-2 py-1 rounded">http://localhost:3000</code>
      </p>
      <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
        <p className="font-semibold text-green-900 mb-2">Default Login:</p>
        <p className="text-green-800">Username: <code>admin</code></p>
        <p className="text-green-800">Password: <code>admin123</code></p>
        <p className="text-sm text-green-700 mt-2">⚠️ Change these credentials in production!</p>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">Adding Training Manuals</h2>

      <h3 className="text-xl font-semibold text-gray-800 mb-3">1. Add PDF Files</h3>
      <pre className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto mb-4">
{`# Copy your training manuals
cp /path/to/manuals/*.pdf ./manuals/

# Example structure:
./manuals/
├── debt-advice-handbook.pdf
├── benefits-guide.pdf
├── bankruptcy-procedures.pdf
└── vulnerability-policy.pdf`}
      </pre>

      <h3 className="text-xl font-semibold text-gray-800 mb-3">2. Ingest Manuals</h3>
      <pre className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto mb-4">
{`# Run ingestion script
./scripts/ingest-manuals.sh

# This will:
# - Process each PDF with OCR
# - Extract text and structure
# - Create embeddings
# - Store in vector database
# Takes 2-5 minutes per manual`}
      </pre>

      <h3 className="text-xl font-semibold text-gray-800 mb-3">3. Verify Ingestion</h3>
      <pre className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto mb-4">
{`# Check RAG service stats
curl http://localhost:8102/stats

# Should return:
{
  "total_chunks": 1234,
  "collection_name": "manuals",
  "status": "ready"
}`}
      </pre>

      <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">Maintenance Commands</h2>

      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
        <h4 className="font-semibold text-gray-900 mb-3">Daily Operations</h4>
        <pre className="bg-gray-900 text-green-400 p-3 rounded overflow-x-auto text-sm mb-3">
{`# View logs
docker-compose logs -f

# View specific service
docker-compose logs -f notes-service

# Restart a service
docker-compose restart upload-service

# Stop all services
docker-compose down

# Start all services
docker-compose up -d`}
        </pre>

        <h4 className="font-semibold text-gray-900 mb-3 mt-4">Updates</h4>
        <pre className="bg-gray-900 text-green-400 p-3 rounded overflow-x-auto text-sm mb-3">
{`# Pull latest code
git pull

# Rebuild containers
docker-compose build

# Restart with new images
docker-compose up -d`}
        </pre>

        <h4 className="font-semibold text-gray-900 mb-3 mt-4">Backups</h4>
        <pre className="bg-gray-900 text-green-400 p-3 rounded overflow-x-auto text-sm">
{`# Backup volumes
docker run --rm \\
  -v rma-demo_ollama_data:/data \\
  -v $(pwd)/backups:/backup \\
  alpine tar czf /backup/ollama-\$(date +%Y%m%d).tar.gz /data

# Backup uploads
tar czf backups/uploads-\$(date +%Y%m%d).tar.gz data/uploads/`}
        </pre>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">Network Configuration</h2>

      <h3 className="text-xl font-semibold text-gray-800 mb-3">Accessing from Other Computers</h3>
      <p className="text-gray-700 mb-4">
        To allow other staff to access the dashboard:
      </p>

      <ol className="list-decimal list-inside space-y-3 text-gray-700 mb-6">
        <li>
          <strong>Configure Firewall:</strong>
          <pre className="bg-gray-900 text-green-400 p-3 rounded overflow-x-auto text-sm mt-2">
{`# Ubuntu/Debian
sudo ufw allow 3000/tcp

# Or allow from specific subnet
sudo ufw allow from 192.168.1.0/24 to any port 3000`}
          </pre>
        </li>
        <li>
          <strong>Find Server IP:</strong>
          <pre className="bg-gray-900 text-green-400 p-3 rounded overflow-x-auto text-sm mt-2">
{`# Linux/Mac
ip addr show | grep inet

# Example output:
inet 192.168.1.100/24`}
          </pre>
        </li>
        <li>
          <strong>Access Dashboard:</strong> Other computers can now access at{' '}
          <code className="bg-gray-100 px-2 py-1 rounded">http://192.168.1.100:3000</code>
        </li>
        <li>
          <strong>Update QR Codes:</strong> Edit <code className="bg-gray-100 px-2 py-1 rounded">.env</code>
          <pre className="bg-gray-900 text-green-400 p-3 rounded overflow-x-auto text-sm mt-2">
{`APP_BASE_URL=http://192.168.1.100:3000`}
          </pre>
          Then restart: <code className="bg-gray-100 px-2 py-1 rounded">docker-compose restart</code>
        </li>
      </ol>

      <h3 className="text-xl font-semibold text-gray-800 mb-3">Using a Custom Domain (Local Network)</h3>
      <p className="text-gray-700 mb-4">
        For easier access, set up a local domain:
      </p>
      <ol className="list-decimal list-inside space-y-2 text-gray-700 mb-6">
        <li>On your router, set a static IP for the server</li>
        <li>Add DNS entry in router settings (e.g., rma-dashboard.local → 192.168.1.100)</li>
        <li>Staff can access at: <code className="bg-gray-100 px-2 py-1 rounded">http://rma-dashboard.local:3000</code></li>
      </ol>

      <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">Security Hardening</h2>

      <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-6">
        <div className="flex">
          <HelpCircle className="h-5 w-5 text-red-400 mr-3 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-medium text-red-800">Production Checklist</h3>
            <ul className="text-sm text-red-700 list-disc list-inside mt-2 space-y-1">
              <li>Change default admin password</li>
              <li>Set strong JWT_SECRET (64+ characters)</li>
              <li>Enable HTTPS (use reverse proxy like nginx)</li>
              <li>Regular backups (daily recommended)</li>
              <li>Keep Docker and packages updated</li>
              <li>Monitor disk space (models are large)</li>
              <li>Restrict network access to internal only</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

function AWSGuide() {
  return (
    <div className="prose max-w-none">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">AWS Deployment with GPU Support</h1>

      <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-6">
        <div className="flex">
          <Zap className="h-5 w-5 text-blue-400 mr-3 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-medium text-blue-800">Overview</h3>
            <p className="text-sm text-blue-700">
              Deploy RMA Dashboard on AWS EKS (Elastic Kubernetes Service) with GPU acceleration,
              auto-scaling, high availability, and enterprise-grade reliability.
            </p>
          </div>
        </div>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">Prerequisites</h2>

      <h3 className="text-xl font-semibold text-gray-800 mb-3">AWS Account Setup</h3>
      <ol className="list-decimal list-inside space-y-2 text-gray-700 mb-6">
        <li>Active AWS account with billing enabled</li>
        <li>IAM user with administrator access</li>
        <li>AWS CLI configured with credentials</li>
        <li>Sufficient service limits (EKS, EC2, EBS)</li>
      </ol>

      <h3 className="text-xl font-semibold text-gray-800 mb-3">Local Tools</h3>
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
        <p className="font-semibold text-gray-900 mb-2">Install Required CLI Tools:</p>
        <pre className="bg-gray-900 text-green-400 p-3 rounded overflow-x-auto text-sm">
{`# AWS CLI
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install

# eksctl (EKS cluster manager)
curl --silent --location "https://github.com/weaveworks/eksctl/releases/latest/download/eksctl_\$(uname -s)_amd64.tar.gz" | tar xz -C /tmp
sudo mv /tmp/eksctl /usr/local/bin

# kubectl (Kubernetes CLI)
curl -LO "https://dl.k8s.io/release/\$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
sudo install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl`}
        </pre>
      </div>

      <h3 className="text-xl font-semibold text-gray-800 mb-3">Configure AWS CLI</h3>
      <pre className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto mb-6">
{`# Configure credentials
aws configure

# Enter when prompted:
AWS Access Key ID: AKIAXXXXXXXXXXXXXXXX
AWS Secret Access Key: xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
Default region name: us-east-1
Default output format: json

# Verify configuration
aws sts get-caller-identity`}
      </pre>

      <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">Deployment Process</h2>

      <h3 className="text-xl font-semibold text-gray-800 mb-3">Step 1: Prepare Configuration</h3>
      <pre className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto mb-4">
{`cd RMA-Demo

# Set environment variables
export LLAMA_PARSE_API_KEY="your-api-key"
export AWS_REGION="us-east-1"
export CLUSTER_NAME="rma-demo-cluster"`}
      </pre>

      <h3 className="text-xl font-semibold text-gray-800 mb-3">Step 2: Run Deployment Script</h3>
      <pre className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto mb-4">
{`cd aws-scripts
./deploy-eks.sh

# This script will:
# 1. Create EKS cluster (15-20 minutes)
# 2. Add GPU node group (5-10 minutes)
# 3. Install NVIDIA device plugin
# 4. Create ECR repositories
# 5. Build and push Docker images (10-15 minutes)
# 6. Deploy all services to Kubernetes
# 7. Create Load Balancer

# Total time: 30-45 minutes`}
      </pre>

      <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
        <div className="flex">
          <HelpCircle className="h-5 w-5 text-yellow-400 mr-3 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-medium text-yellow-800">Cost Warning</h3>
            <p className="text-sm text-yellow-700 mb-2">
              AWS EKS with GPU nodes is not free. Estimated monthly costs:
            </p>
            <ul className="text-sm text-yellow-700 list-disc list-inside space-y-1">
              <li>EKS Cluster: $73/month</li>
              <li>CPU Nodes (2x t3.large): ~$120/month</li>
              <li>GPU Node (1x g5.xlarge): ~$550/month</li>
              <li>Load Balancer: ~$16/month</li>
              <li>Storage (EBS): ~$20/month</li>
              <li><strong>Total: ~$780/month</strong></li>
            </ul>
            <p className="text-sm text-yellow-700 mt-2">
              💡 Tip: Scale GPU nodes to 0 when not in use to save $550/month
            </p>
          </div>
        </div>
      </div>

      <h3 className="text-xl font-semibold text-gray-800 mb-3">Step 3: Monitor Deployment</h3>
      <pre className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto mb-4">
{`# Watch pods come online
kubectl get pods -n rma-demo -w

# Check service status
kubectl get svc -n rma-demo

# View logs
kubectl logs -f deployment/frontend -n rma-demo`}
      </pre>

      <h3 className="text-xl font-semibold text-gray-800 mb-3">Step 4: Get Access URL</h3>
      <pre className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto mb-4">
{`# Get Load Balancer URL
kubectl get svc frontend -n rma-demo

# Output:
NAME       TYPE           EXTERNAL-IP
frontend   LoadBalancer   a1b2c3d4.us-east-1.elb.amazonaws.com

# Access dashboard at:
# http://a1b2c3d4.us-east-1.elb.amazonaws.com`}
      </pre>

      <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">GPU Configuration</h2>

      <h3 className="text-xl font-semibold text-gray-800 mb-3">GPU Instance Types</h3>
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-gray-300">
              <th className="text-left py-2">Instance</th>
              <th className="text-left py-2">GPU</th>
              <th className="text-left py-2">VRAM</th>
              <th className="text-left py-2">Cost/hour</th>
              <th className="text-left py-2">Best For</th>
            </tr>
          </thead>
          <tbody className="text-gray-700">
            <tr className="border-b border-gray-200">
              <td className="py-2">g5.xlarge</td>
              <td>NVIDIA A10G</td>
              <td>24GB</td>
              <td>$1.01</td>
              <td>Production (recommended)</td>
            </tr>
            <tr className="border-b border-gray-200">
              <td className="py-2">g5.2xlarge</td>
              <td>NVIDIA A10G</td>
              <td>24GB</td>
              <td>$1.21</td>
              <td>Higher CPU needs</td>
            </tr>
            <tr className="border-b border-gray-200">
              <td className="py-2">g4dn.xlarge</td>
              <td>NVIDIA T4</td>
              <td>16GB</td>
              <td>$0.53</td>
              <td>Budget option</td>
            </tr>
            <tr>
              <td className="py-2">p3.2xlarge</td>
              <td>NVIDIA V100</td>
              <td>16GB</td>
              <td>$3.06</td>
              <td>Heavy workloads</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h3 className="text-xl font-semibold text-gray-800 mb-3">Verify GPU Access</h3>
      <pre className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto mb-4">
{`# Check GPU nodes
kubectl get nodes -l workload=gpu

# Run test pod
kubectl run gpu-test --rm -it --restart=Never \\
  --image=nvidia/cuda:12.2.0-base-ubuntu22.04 \\
  --limits=nvidia.com/gpu=1 \\
  -- nvidia-smi

# Should show GPU info`}
      </pre>

      <h3 className="text-xl font-semibold text-gray-800 mb-3">Scale GPU Nodes</h3>
      <pre className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto mb-4">
{`# Scale down to save costs (when not in use)
eksctl scale nodegroup --cluster=rma-demo-cluster \\
  --name=gpu-nodes --nodes=0

# Scale up when needed
eksctl scale nodegroup --cluster=rma-demo-cluster \\
  --name=gpu-nodes --nodes=1`}
      </pre>

      <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">High Availability Setup</h2>

      <h3 className="text-xl font-semibold text-gray-800 mb-3">Auto-Scaling Configuration</h3>
      <p className="text-gray-700 mb-4">
        The deployment includes auto-scaling based on CPU/memory usage:
      </p>
      <pre className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto mb-4">
{`# Enable cluster autoscaler
kubectl apply -f k8s/cluster-autoscaler.yaml

# Configure horizontal pod autoscaling
kubectl autoscale deployment frontend -n rma-demo \\
  --min=2 --max=10 --cpu-percent=70

kubectl autoscale deployment notes-service -n rma-demo \\
  --min=1 --max=5 --cpu-percent=80`}
      </pre>

      <h3 className="text-xl font-semibold text-gray-800 mb-3">Multi-AZ Deployment</h3>
      <p className="text-gray-700 mb-4">
        For production, deploy across multiple availability zones:
      </p>
      <pre className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto mb-4">
{`# Edit deployment script to use multiple AZs
eksctl create cluster \\
  --name rma-demo-cluster \\
  --region us-east-1 \\
  --zones us-east-1a,us-east-1b,us-east-1c \\
  --node-type t3.large \\
  --nodes 3 \\
  --nodes-min 2 \\
  --nodes-max 6`}
      </pre>

      <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">Monitoring & Logging</h2>

      <h3 className="text-xl font-semibold text-gray-800 mb-3">CloudWatch Integration</h3>
      <pre className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto mb-4">
{`# Install CloudWatch agent
kubectl apply -f https://raw.githubusercontent.com/aws-samples/amazon-cloudwatch-container-insights/latest/k8s-deployment-manifest-templates/deployment-mode/daemonset/container-insights-monitoring/quickstart/cwagent-fluentd-quickstart.yaml

# View logs in CloudWatch
aws logs tail /aws/eks/rma-demo-cluster/cluster --follow`}
      </pre>

      <h3 className="text-xl font-semibold text-gray-800 mb-3">Metrics Dashboard</h3>
      <p className="text-gray-700 mb-4">
        Access metrics in AWS Console:
      </p>
      <ol className="list-decimal list-inside space-y-2 text-gray-700 mb-6">
        <li>Go to CloudWatch → Dashboards</li>
        <li>Create dashboard for RMA-Demo</li>
        <li>Add widgets for:
          <ul className="list-disc list-inside ml-6 mt-2">
            <li>Pod CPU/Memory usage</li>
            <li>Request rates</li>
            <li>Error rates</li>
            <li>GPU utilization</li>
          </ul>
        </li>
      </ol>

      <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">Backup & Disaster Recovery</h2>

      <h3 className="text-xl font-semibold text-gray-800 mb-3">EBS Snapshots</h3>
      <pre className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto mb-4">
{`# Enable automated EBS snapshots
aws dlm create-lifecycle-policy \\
  --description "Daily RMA backup" \\
  --state ENABLED \\
  --execution-role-arn arn:aws:iam::ACCOUNT:role/AWSDataLifecycleManager \\
  --policy-details file://backup-policy.json`}
      </pre>

      <h3 className="text-xl font-semibold text-gray-800 mb-3">Velero for K8s Backups</h3>
      <pre className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto mb-4">
{`# Install Velero
velero install \\
  --provider aws \\
  --plugins velero/velero-plugin-for-aws:v1.8.0 \\
  --bucket rma-demo-backups \\
  --backup-location-config region=us-east-1

# Create backup
velero backup create rma-demo-backup --include-namespaces rma-demo

# Restore from backup
velero restore create --from-backup rma-demo-backup`}
      </pre>

      <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">Security Best Practices</h2>

      <h3 className="text-xl font-semibold text-gray-800 mb-3">Network Security</h3>
      <ul className="list-disc list-inside space-y-2 text-gray-700 mb-6">
        <li>Use VPC with private subnets for worker nodes</li>
        <li>Restrict Load Balancer to specific IP ranges</li>
        <li>Enable VPC Flow Logs for audit</li>
        <li>Use AWS WAF for application firewall</li>
        <li>Enable encryption at rest for EBS volumes</li>
      </ul>

      <h3 className="text-xl font-semibold text-gray-800 mb-3">Secrets Management</h3>
      <pre className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto mb-4">
{`# Use AWS Secrets Manager
aws secretsmanager create-secret \\
  --name rma-demo/jwt-secret \\
  --secret-string "your-secret-here"

# Install External Secrets Operator
helm repo add external-secrets https://charts.external-secrets.io
helm install external-secrets external-secrets/external-secrets

# Configure secret sync to K8s`}
      </pre>

      <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">Updating the Deployment</h2>

      <h3 className="text-xl font-semibold text-gray-800 mb-3">Rolling Updates</h3>
      <pre className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto mb-4">
{`# Build new images
cd RMA-Demo
docker build -t ECR_REGISTRY/rma-frontend:v2 ./frontend
docker push ECR_REGISTRY/rma-frontend:v2

# Update deployment
kubectl set image deployment/frontend \\
  frontend=ECR_REGISTRY/rma-frontend:v2 \\
  -n rma-demo

# Watch rollout
kubectl rollout status deployment/frontend -n rma-demo

# Rollback if needed
kubectl rollout undo deployment/frontend -n rma-demo`}
      </pre>

      <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">Cost Optimization</h2>

      <h3 className="text-xl font-semibold text-gray-800 mb-3">Strategies to Reduce Costs</h3>
      <ol className="list-decimal list-inside space-y-3 text-gray-700 mb-6">
        <li>
          <strong>Use Spot Instances:</strong> Save 70% on non-GPU nodes
          <pre className="bg-gray-900 text-green-400 p-3 rounded overflow-x-auto text-sm mt-2">
{`eksctl create nodegroup --spot`}
          </pre>
        </li>
        <li>
          <strong>Schedule GPU nodes:</strong> Only run during business hours
        </li>
        <li>
          <strong>Use S3 Intelligent-Tiering:</strong> For document storage
        </li>
        <li>
          <strong>Enable EBS autoscaling:</strong> Only pay for used storage
        </li>
        <li>
          <strong>Use AWS Savings Plans:</strong> 1-year commitment saves 20-30%
        </li>
      </ol>

      <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">Cleanup</h2>

      <h3 className="text-xl font-semibold text-gray-800 mb-3">Delete Cluster</h3>
      <pre className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto mb-4">
{`# Delete everything
eksctl delete cluster --name rma-demo-cluster --region us-east-1

# This will remove:
# - EKS cluster
# - All node groups
# - Load Balancers
# - Associated resources

# Manually delete:
# - ECR repositories (if no longer needed)
# - EBS snapshots/backups
# - CloudWatch logs`}
      </pre>

      <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-6">
        <div className="flex">
          <HelpCircle className="h-5 w-5 text-red-400 mr-3 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-medium text-red-800">⚠️ Important</h3>
            <p className="text-sm text-red-700">
              Always verify all resources are deleted to avoid unexpected charges. Check:
            </p>
            <ul className="text-sm text-red-700 list-disc list-inside mt-1">
              <li>EC2 instances</li>
              <li>Load Balancers</li>
              <li>EBS volumes</li>
              <li>Elastic IPs</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

function DomainGuide() {
  return (
    <div className="prose max-w-none">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Domain Registration & DNS Setup</h1>

      <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-6">
        <div className="flex">
          <Globe className="h-5 w-5 text-blue-400 mr-3 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-medium text-blue-800">Overview</h3>
            <p className="text-sm text-blue-700">
              Set up a custom domain name for your RMA Dashboard (e.g., rma.yourorg.org.uk)
              instead of using AWS Load Balancer URLs or IP addresses.
            </p>
          </div>
        </div>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">Option 1: Register New Domain</h2>

      <h3 className="text-xl font-semibold text-gray-800 mb-3">Using AWS Route 53</h3>
      <ol className="list-decimal list-inside space-y-3 text-gray-700 mb-6">
        <li>
          <strong>Log in to AWS Console</strong>
          <p className="ml-6 mt-1">Navigate to Route 53 service</p>
        </li>
        <li>
          <strong>Register Domain</strong>
          <ul className="list-disc list-inside ml-6 mt-2 space-y-1">
            <li>Click "Register Domain"</li>
            <li>Search for available domain (e.g., your-org-rma.co.uk)</li>
            <li>Select domain and add to cart</li>
            <li>Typical costs: £10-30/year for .uk domains</li>
          </ul>
        </li>
        <li>
          <strong>Complete Registration</strong>
          <ul className="list-disc list-inside ml-6 mt-2 space-y-1">
            <li>Enter contact information</li>
            <li>Enable auto-renewal</li>
            <li>Complete payment</li>
            <li>Registration takes 10-15 minutes</li>
          </ul>
        </li>
      </ol>

      <h3 className="text-xl font-semibold text-gray-800 mb-3">Using Third-Party Registrar</h3>
      <p className="text-gray-700 mb-4">
        Popular UK registrars:
      </p>
      <ul className="list-disc list-inside space-y-2 text-gray-700 mb-6">
        <li><strong>Namecheap:</strong> £8-15/year, easy management</li>
        <li><strong>123-reg:</strong> £5-20/year, UK-based</li>
        <li><strong>GoDaddy:</strong> £10-25/year, well-known</li>
        <li><strong>Cloudflare:</strong> At-cost pricing, excellent security</li>
      </ul>

      <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">Option 2: Use Existing Domain</h2>

      <p className="text-gray-700 mb-4">
        If your organization already owns a domain (e.g., yourorg.org.uk), create a subdomain:
      </p>
      <ul className="list-disc list-inside space-y-2 text-gray-700 mb-6">
        <li>rma.yourorg.org.uk</li>
        <li>dashboard.yourorg.org.uk</li>
        <li>advice.yourorg.org.uk</li>
      </ul>

      <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">DNS Configuration</h2>

      <h3 className="text-xl font-semibold text-gray-800 mb-3">Method A: AWS Route 53 (Recommended for AWS)</h3>

      <p className="text-gray-700 mb-4">
        <strong>Step 1: Create Hosted Zone</strong>
      </p>
      <pre className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto mb-4">
{`# Using provided script
cd RMA-Demo/aws-scripts
./register-domain.sh your-domain.com

# This automatically:
# - Creates Route 53 hosted zone
# - Gets Load Balancer DNS
# - Creates A record (alias)
# - Sets up www subdomain`}
      </pre>

      <p className="text-gray-700 mb-4">
        <strong>Step 2: Update Nameservers (if domain registered elsewhere)</strong>
      </p>
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
        <ol className="list-decimal list-inside space-y-2 text-gray-700 text-sm">
          <li>Get nameservers from Route 53:
            <pre className="bg-gray-900 text-green-400 p-2 rounded overflow-x-auto text-xs mt-1">
{`aws route53 get-hosted-zone --id YOUR_ZONE_ID \\
  --query 'DelegationSet.NameServers'`}
            </pre>
          </li>
          <li>Log in to your domain registrar</li>
          <li>Find DNS/Nameserver settings</li>
          <li>Replace nameservers with Route 53 ones:
            <ul className="list-disc list-inside ml-4 mt-1">
              <li>ns-1234.awsdns-12.org</li>
              <li>ns-5678.awsdns-34.co.uk</li>
              <li>ns-9012.awsdns-56.com</li>
              <li>ns-3456.awsdns-78.net</li>
            </ul>
          </li>
          <li>Save changes (propagation takes 24-48 hours, usually faster)</li>
        </ol>
      </div>

      <h3 className="text-xl font-semibold text-gray-800 mb-3">Method B: External DNS Provider</h3>

      <p className="text-gray-700 mb-4">
        If using Cloudflare, Namecheap, etc.:
      </p>

      <p className="text-gray-700 mb-2"><strong>Step 1: Get Load Balancer DNS</strong></p>
      <pre className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto mb-4">
{`kubectl get svc frontend -n rma-demo

# Copy the EXTERNAL-IP:
# a1b2c3d4e5f6g7h8.us-east-1.elb.amazonaws.com`}
      </pre>

      <p className="text-gray-700 mb-2"><strong>Step 2: Add DNS Records</strong></p>
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
        <p className="font-semibold text-gray-900 mb-2">In your DNS provider dashboard:</p>
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-gray-300">
              <th className="text-left py-2">Type</th>
              <th className="text-left py-2">Name</th>
              <th className="text-left py-2">Value</th>
              <th className="text-left py-2">TTL</th>
            </tr>
          </thead>
          <tbody className="text-gray-700">
            <tr className="border-b border-gray-200">
              <td className="py-2">CNAME</td>
              <td>rma</td>
              <td>a1b2c3d4.us-east-1.elb.amazonaws.com</td>
              <td>300</td>
            </tr>
            <tr>
              <td className="py-2">CNAME</td>
              <td>www</td>
              <td>rma.yourdomain.com</td>
              <td>300</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">SSL/TLS Certificate Setup</h2>

      <h3 className="text-xl font-semibold text-gray-800 mb-3">Using AWS Certificate Manager (Free)</h3>

      <p className="text-gray-700 mb-4">
        <strong>Step 1: Request Certificate</strong>
      </p>
      <pre className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto mb-4">
{`# Request certificate
aws acm request-certificate \\
  --domain-name rma.yourdomain.com \\
  --subject-alternative-names www.rma.yourdomain.com \\
  --validation-method DNS \\
  --region us-east-1

# Note the CertificateArn from output`}
      </pre>

      <p className="text-gray-700 mb-4">
        <strong>Step 2: Validate Domain Ownership</strong>
      </p>
      <ol className="list-decimal list-inside space-y-2 text-gray-700 mb-4">
        <li>AWS Certificate Manager will provide DNS records</li>
        <li>Add these CNAME records to your DNS</li>
        <li>Wait for validation (5-30 minutes)</li>
        <li>Certificate status changes to "Issued"</li>
      </ol>

      <p className="text-gray-700 mb-4">
        <strong>Step 3: Configure Load Balancer</strong>
      </p>
      <pre className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto mb-4">
{`# Get Load Balancer ARN
LB_ARN=$(aws elbv2 describe-load-balancers \\
  --query 'LoadBalancers[?contains(LoadBalancerName, \`rma\`)].LoadBalancerArn' \\
  --output text)

# Add HTTPS listener
aws elbv2 create-listener \\
  --load-balancer-arn $LB_ARN \\
  --protocol HTTPS \\
  --port 443 \\
  --certificates CertificateArn=YOUR_CERT_ARN \\
  --default-actions Type=forward,TargetGroupArn=YOUR_TARGET_GROUP_ARN

# Redirect HTTP to HTTPS
aws elbv2 modify-listener \\
  --listener-arn YOUR_HTTP_LISTENER_ARN \\
  --default-actions Type=redirect,RedirectConfig="{Protocol=HTTPS,Port=443,StatusCode=HTTP_301}"`}
      </pre>

      <h3 className="text-xl font-semibold text-gray-800 mb-3">Using Let's Encrypt (Alternative)</h3>

      <p className="text-gray-700 mb-4">
        For non-AWS deployments or preference for Let's Encrypt:
      </p>
      <pre className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto mb-4">
{`# Install cert-manager
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.0/cert-manager.yaml

# Create issuer
kubectl apply -f - <<EOF
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: admin@yourdomain.com
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
    - http01:
        ingress:
          class: nginx
EOF

# Certificate will auto-renew every 90 days`}
      </pre>

      <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">Verification</h2>

      <h3 className="text-xl font-semibold text-gray-800 mb-3">Check DNS Propagation</h3>
      <pre className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto mb-4">
{`# Check DNS resolution
dig rma.yourdomain.com

# Or use online tools:
# - https://dnschecker.org
# - https://www.whatsmydns.net`}
      </pre>

      <h3 className="text-xl font-semibold text-gray-800 mb-3">Test SSL Certificate</h3>
      <pre className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto mb-4">
{`# Check certificate
curl -vI https://rma.yourdomain.com

# Or use online tools:
# - https://www.ssllabs.com/ssltest/
# Should show A+ rating`}
      </pre>

      <h3 className="text-xl font-semibold text-gray-800 mb-3">Access Dashboard</h3>
      <p className="text-gray-700 mb-4">
        Once DNS propagates and SSL is configured:
      </p>
      <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
        <p className="font-semibold text-green-900 mb-2">Your dashboard is now accessible at:</p>
        <p className="text-green-800 text-lg">🔒 https://rma.yourdomain.com</p>
        <p className="text-sm text-green-700 mt-2">
          ✅ Secure connection<br />
          ✅ Professional URL<br />
          ✅ Ready for production
        </p>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">Update Application Configuration</h2>

      <h3 className="text-xl font-semibold text-gray-800 mb-3">Update Environment Variables</h3>
      <pre className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto mb-4">
{`# Update .env file
APP_BASE_URL=https://rma.yourdomain.com

# Or for Kubernetes:
kubectl set env deployment/upload-service \\
  APP_BASE_URL=https://rma.yourdomain.com \\
  -n rma-demo

# Restart services to apply
kubectl rollout restart deployment/upload-service -n rma-demo`}
      </pre>

      <h3 className="text-xl font-semibold text-gray-800 mb-3">Regenerate QR Codes</h3>
      <p className="text-gray-700 mb-4">
        After updating the domain, regenerate any client QR codes so they point to the new URL.
      </p>

      <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">Subdomain Strategy</h2>

      <h3 className="text-xl font-semibold text-gray-800 mb-3">Recommended Structure</h3>
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
        <ul className="list-disc list-inside space-y-2 text-gray-700 text-sm">
          <li><strong>rma.yourorg.org.uk</strong> - Main dashboard (production)</li>
          <li><strong>rma-staging.yourorg.org.uk</strong> - Testing environment</li>
          <li><strong>rma-api.yourorg.org.uk</strong> - API endpoints (if exposing publicly)</li>
          <li><strong>docs.yourorg.org.uk</strong> - Documentation portal</li>
        </ul>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">Troubleshooting</h2>

      <h3 className="text-xl font-semibold text-gray-800 mb-3">DNS Not Resolving</h3>
      <ul className="list-disc list-inside space-y-2 text-gray-700 mb-6">
        <li>Wait up to 48 hours for propagation</li>
        <li>Check nameservers are correct</li>
        <li>Clear local DNS cache: <code className="bg-gray-100 px-2 py-1 rounded">sudo systemd-resolve --flush-caches</code></li>
        <li>Try different DNS server (8.8.8.8, 1.1.1.1)</li>
      </ul>

      <h3 className="text-xl font-semibold text-gray-800 mb-3">SSL Certificate Issues</h3>
      <ul className="list-disc list-inside space-y-2 text-gray-700 mb-6">
        <li>Verify DNS is resolving before requesting certificate</li>
        <li>Check validation records are added correctly</li>
        <li>Ensure Load Balancer has certificate attached</li>
        <li>Check security group allows HTTPS (port 443)</li>
      </ul>

      <h3 className="text-xl font-semibold text-gray-800 mb-3">Mixed Content Warnings</h3>
      <p className="text-gray-700 mb-4">
        If you see security warnings after enabling HTTPS:
      </p>
      <ol className="list-decimal list-inside space-y-2 text-gray-700 mb-6">
        <li>Update all service URLs in frontend to use https://</li>
        <li>Or use relative URLs: <code className="bg-gray-100 px-2 py-1 rounded">/api/endpoint</code></li>
        <li>Ensure API calls don't mix HTTP and HTTPS</li>
      </ol>

      <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-6">
        <div className="flex">
          <HelpCircle className="h-5 w-5 text-blue-400 mr-3 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-medium text-blue-800">💡 Pro Tip</h3>
            <p className="text-sm text-blue-700">
              Use Cloudflare (free tier) as DNS provider for additional benefits:
            </p>
            <ul className="text-sm text-blue-700 list-disc list-inside mt-1">
              <li>Free SSL/TLS</li>
              <li>DDoS protection</li>
              <li>Caching/CDN</li>
              <li>Analytics</li>
              <li>Faster DNS propagation</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

function TroubleshootingGuide() {
  return (
    <div className="prose max-w-none">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Troubleshooting Guide</h1>

      <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
        <div className="flex">
          <Wrench className="h-5 w-5 text-yellow-400 mr-3 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-medium text-yellow-800">Quick Diagnostics</h3>
            <p className="text-sm text-yellow-700">
              Most issues can be resolved by checking logs and service status. Start here before diving into specific problems.
            </p>
          </div>
        </div>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">Common Issues</h2>

      <div className="space-y-6">
        <div className="border border-gray-200 rounded-lg p-4">
          <h3 className="text-xl font-semibold text-gray-800 mb-3">🔴 Services Won't Start</h3>

          <p className="text-gray-700 mb-2"><strong>Symptoms:</strong></p>
          <ul className="list-disc list-inside text-gray-700 mb-3">
            <li>Dashboard not accessible</li>
            <li>Connection refused errors</li>
            <li>Docker containers exiting</li>
          </ul>

          <p className="text-gray-700 mb-2"><strong>Solutions:</strong></p>
          <pre className="bg-gray-900 text-green-400 p-3 rounded overflow-x-auto text-sm mb-2">
{`# Check Docker is running
docker ps

# Check service status
docker-compose ps

# View logs
docker-compose logs --tail=50

# Restart everything
docker-compose down
docker-compose up -d

# Check system resources
docker stats`}
          </pre>

          <p className="text-gray-700 mb-2"><strong>Common Causes:</strong></p>
          <ul className="list-disc list-inside text-gray-700 text-sm">
            <li>Insufficient memory (need 16GB+)</li>
            <li>Port conflicts (3000, 8100-8103, 11434 already in use)</li>
            <li>Docker daemon not running</li>
            <li>Corrupted volumes</li>
          </ul>
        </div>

        <div className="border border-gray-200 rounded-lg p-4">
          <h3 className="text-xl font-semibold text-gray-800 mb-3">🔴 Ollama Not Responding</h3>

          <p className="text-gray-700 mb-2"><strong>Symptoms:</strong></p>
          <ul className="list-disc list-inside text-gray-700 mb-3">
            <li>"Ollama service not available"</li>
            <li>Notes conversion times out</li>
            <li>RAG queries fail</li>
          </ul>

          <p className="text-gray-700 mb-2"><strong>Solutions:</strong></p>
          <pre className="bg-gray-900 text-green-400 p-3 rounded overflow-x-auto text-sm mb-2">
{`# Check Ollama logs
docker logs rma-ollama --tail=100

# Check if models are loaded
docker exec rma-ollama ollama list

# Pull models if missing
docker exec rma-ollama ollama pull llama3.2
docker exec rma-ollama ollama pull nomic-embed-text

# Restart Ollama
docker restart rma-ollama

# Test Ollama
curl http://localhost:11434/api/tags`}
          </pre>

          <p className="text-gray-700 mb-2"><strong>GPU Issues:</strong></p>
          <pre className="bg-gray-900 text-green-400 p-3 rounded overflow-x-auto text-sm">
{`# Check GPU is accessible
docker run --rm --gpus all nvidia/cuda:12.2.0-base-ubuntu22.04 nvidia-smi

# If GPU not found, check NVIDIA Docker runtime
sudo systemctl restart docker

# Or disable GPU and use CPU only
# Edit docker-compose.yml, remove 'runtime: nvidia'`}
          </pre>
        </div>

        <div className="border border-gray-200 rounded-lg p-4">
          <h3 className="text-xl font-semibold text-gray-800 mb-3">🔴 Document Processing Fails</h3>

          <p className="text-gray-700 mb-2"><strong>Symptoms:</strong></p>
          <ul className="list-disc list-inside text-gray-700 mb-3">
            <li>Uploads succeed but no markdown generated</li>
            <li>"Processing error" messages</li>
            <li>PDFs not converting</li>
          </ul>

          <p className="text-gray-700 mb-2"><strong>Solutions:</strong></p>
          <pre className="bg-gray-900 text-green-400 p-3 rounded overflow-x-auto text-sm mb-2">
{`# Check doc-processor logs
docker logs rma-doc-processor --tail=100

# Verify LLamaParse API key
docker exec rma-doc-processor printenv | grep LLAMA_PARSE

# Test Tesseract fallback
docker exec rma-doc-processor tesseract --version

# Restart processor
docker restart rma-doc-processor

# Test processing
curl -X POST http://localhost:8101/process \\
  -F "file=@test.pdf"`}
          </pre>

          <p className="text-gray-700 mb-2"><strong>Common Causes:</strong></p>
          <ul className="list-disc list-inside text-gray-700 text-sm">
            <li>Invalid LLamaParse API key</li>
            <li>File too large (limit: 50MB)</li>
            <li>Unsupported file format</li>
            <li>Insufficient memory</li>
          </ul>
        </div>

        <div className="border border-gray-200 rounded-lg p-4">
          <h3 className="text-xl font-semibold text-gray-800 mb-3">🔴 RAG/Manuals Not Working</h3>

          <p className="text-gray-700 mb-2"><strong>Symptoms:</strong></p>
          <ul className="list-disc list-inside text-gray-700 mb-3">
            <li>"Vector store not initialized"</li>
            <li>Questions return no results</li>
            <li>ChromaDB connection errors</li>
          </ul>

          <p className="text-gray-700 mb-2"><strong>Solutions:</strong></p>
          <pre className="bg-gray-900 text-green-400 p-3 rounded overflow-x-auto text-sm mb-2">
{`# Check ChromaDB
docker logs rma-chromadb --tail=50
curl http://localhost:8005/api/v1/heartbeat

# Check RAG service
docker logs rma-rag-service --tail=50
curl http://localhost:8102/stats

# Ingest manuals
./scripts/ingest-manuals.sh

# Or manually
curl -X POST http://localhost:8102/ingest \\
  -H "Content-Type: application/json" \\
  -d '{"documents": ["text"], "filenames": ["test.pdf"]}'

# Restart services
docker restart rma-chromadb rma-rag-service`}
          </pre>
        </div>

        <div className="border border-gray-200 rounded-lg p-4">
          <h3 className="text-xl font-semibold text-gray-800 mb-3">🔴 Authentication Issues</h3>

          <p className="text-gray-700 mb-2"><strong>Symptoms:</strong></p>
          <ul className="list-disc list-inside text-gray-700 mb-3">
            <li>Cannot log in</li>
            <li>"Invalid token" errors</li>
            <li>Session expires immediately</li>
          </ul>

          <p className="text-gray-700 mb-2"><strong>Solutions:</strong></p>
          <pre className="bg-gray-900 text-green-400 p-3 rounded overflow-x-auto text-sm mb-2">
{`# Check JWT_SECRET is set
cat .env | grep JWT_SECRET

# Default credentials
# Username: admin
# Password: admin123

# Reset password (edit upload-service)
docker exec -it rma-upload-service /bin/sh
# Edit app.py USERS dictionary

# Check upload service logs
docker logs rma-upload-service --tail=50`}
          </pre>
        </div>

        <div className="border border-gray-200 rounded-lg p-4">
          <h3 className="text-xl font-semibold text-gray-800 mb-3">🔴 Frontend Can't Connect to Services</h3>

          <p className="text-gray-700 mb-2"><strong>Symptoms:</strong></p>
          <ul className="list-disc list-inside text-gray-700 mb-3">
            <li>Dashboard loads but features don't work</li>
            <li>Network errors in browser console</li>
            <li>CORS errors</li>
          </ul>

          <p className="text-gray-700 mb-2"><strong>Solutions:</strong></p>
          <pre className="bg-gray-900 text-green-400 p-3 rounded overflow-x-auto text-sm mb-2">
{`# Check service URLs
cat .env | grep NEXT_PUBLIC

# For local deployment, should be:
# NEXT_PUBLIC_NOTES_SERVICE_URL=http://localhost:8100
# etc.

# Check all services are running
docker-compose ps

# Check browser console (F12)
# Look for failed network requests

# Verify ports are accessible
curl http://localhost:8100/health
curl http://localhost:8101/health
curl http://localhost:8102/health
curl http://localhost:8103/health`}
          </pre>
        </div>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">Performance Issues</h2>

      <div className="space-y-6">
        <div className="border border-gray-200 rounded-lg p-4">
          <h3 className="text-xl font-semibold text-gray-800 mb-3">⚠️ Slow Response Times</h3>

          <p className="text-gray-700 mb-2"><strong>Causes & Solutions:</strong></p>
          <ul className="list-disc list-inside space-y-2 text-gray-700 text-sm">
            <li>
              <strong>No GPU:</strong> LLM inference is slow on CPU
              <ul className="list-disc list-inside ml-6 mt-1">
                <li>Install NVIDIA Docker runtime</li>
                <li>Or use smaller model: llama3.2:1b instead of llama3.2</li>
                <li>Or increase CPU resources</li>
              </ul>
            </li>
            <li>
              <strong>Insufficient RAM:</strong> System swapping to disk
              <ul className="list-disc list-inside ml-6 mt-1">
                <li>Increase Docker memory limit</li>
                <li>Close other applications</li>
                <li>Use smaller batch sizes</li>
              </ul>
            </li>
            <li>
              <strong>Large Documents:</strong> OCR takes time
              <ul className="list-disc list-inside ml-6 mt-1">
                <li>Expected: 30-60s for 10-page PDF</li>
                <li>Reduce image quality in PDFs</li>
                <li>Process in batches</li>
              </ul>
            </li>
          </ul>

          <pre className="bg-gray-900 text-green-400 p-3 rounded overflow-x-auto text-sm mt-3">
{`# Monitor resource usage
docker stats

# Check swap usage
free -h

# If swapping, increase memory:
# Edit docker-compose.yml
services:
  ollama:
    mem_limit: 8g
    memswap_limit: 8g`}
          </pre>
        </div>

        <div className="border border-gray-200 rounded-lg p-4">
          <h3 className="text-xl font-semibold text-gray-800 mb-3">⚠️ Disk Space Issues</h3>

          <pre className="bg-gray-900 text-green-400 p-3 rounded overflow-x-auto text-sm mb-2">
{`# Check disk usage
df -h
docker system df

# Clean up Docker
docker system prune -a --volumes

# Backup and clean old uploads
tar czf backup.tar.gz data/uploads
rm -rf data/uploads/old_client_folders

# Remove unused models
docker exec rma-ollama ollama rm old-model`}
          </pre>
        </div>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">AWS/Kubernetes Issues</h2>

      <div className="space-y-6">
        <div className="border border-gray-200 rounded-lg p-4">
          <h3 className="text-xl font-semibold text-gray-800 mb-3">☁️ Pods Not Starting</h3>

          <pre className="bg-gray-900 text-green-400 p-3 rounded overflow-x-auto text-sm mb-2">
{`# Check pod status
kubectl get pods -n rma-demo

# Describe problematic pod
kubectl describe pod POD_NAME -n rma-demo

# Check logs
kubectl logs POD_NAME -n rma-demo

# Common issues:
# - ImagePullBackOff: Check ECR permissions
# - CrashLoopBackOff: Check logs for errors
# - Pending: Insufficient resources or GPU nodes not ready`}
          </pre>
        </div>

        <div className="border border-gray-200 rounded-lg p-4">
          <h3 className="text-xl font-semibold text-gray-800 mb-3">☁️ GPU Node Issues</h3>

          <pre className="bg-gray-900 text-green-400 p-3 rounded overflow-x-auto text-sm mb-2">
{`# Check GPU nodes
kubectl get nodes -l workload=gpu

# Check NVIDIA plugin
kubectl get pods -n kube-system | grep nvidia

# If not found, reinstall
kubectl apply -f https://raw.githubusercontent.com/NVIDIA/k8s-device-plugin/v0.14.0/nvidia-device-plugin.yml

# Test GPU
kubectl run gpu-test --rm -it --restart=Never \\
  --image=nvidia/cuda:12.2.0-base-ubuntu22.04 \\
  --limits=nvidia.com/gpu=1 \\
  -- nvidia-smi`}
          </pre>
        </div>

        <div className="border border-gray-200 rounded-lg p-4">
          <h3 className="text-xl font-semibold text-gray-800 mb-3">☁️ Load Balancer Not Accessible</h3>

          <pre className="bg-gray-900 text-green-400 p-3 rounded overflow-x-auto text-sm mb-2">
{`# Check service
kubectl get svc frontend -n rma-demo

# Check security groups
aws ec2 describe-security-groups \\
  --filters "Name=tag:kubernetes.io/cluster/rma-demo-cluster,Values=owned"

# Should allow:
# - Port 80 (HTTP)
# - Port 443 (HTTPS)
# - Your IP for management

# Check Load Balancer health
aws elbv2 describe-target-health \\
  --target-group-arn YOUR_TARGET_GROUP_ARN`}
          </pre>
        </div>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">Getting Help</h2>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <h3 className="font-semibold text-blue-900 mb-2">Before Asking for Help</h3>
        <p className="text-blue-800 text-sm mb-2">Gather this information:</p>
        <ol className="list-decimal list-inside text-blue-800 text-sm space-y-1">
          <li>Deployment type (local Docker, AWS EKS, etc.)</li>
          <li>Error messages (full text)</li>
          <li>Recent logs from affected services</li>
          <li>Steps to reproduce the issue</li>
          <li>System specifications (RAM, CPU, GPU)</li>
          <li>Recent changes made before issue appeared</li>
        </ol>
      </div>

      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <h3 className="font-semibold text-gray-900 mb-3">Useful Diagnostic Commands</h3>
        <pre className="bg-gray-900 text-green-400 p-3 rounded overflow-x-auto text-sm">
{`# Full system status
docker-compose ps
docker stats --no-stream
df -h
free -h

# All service logs
docker-compose logs --tail=100 > all-logs.txt

# Service health checks
curl http://localhost:8100/health
curl http://localhost:8101/health
curl http://localhost:8102/health
curl http://localhost:8103/health

# Network connectivity
docker network inspect rma-network

# For AWS/K8s
kubectl get all -n rma-demo
kubectl top nodes
kubectl top pods -n rma-demo`}
        </pre>
      </div>
    </div>
  )
}
