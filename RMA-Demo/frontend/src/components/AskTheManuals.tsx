'use client'

import { useState } from 'react'
import axios from 'axios'
import { API_URLS } from '@/lib/apiUrls'

// Use Next.js API proxy to avoid CORS issues
const getRagServiceUrl = () => API_URLS.rag()

interface ReasoningStep {
  step: string
  description: string
  result: any
}

interface Message {
  role: 'user' | 'assistant'
  content: string
  sources?: string[]
  retrieved_chunks?: Array<{
    text: string
    source: string
    chunk_id: number | string
  }>
  // Agentic fields
  reasoning_steps?: ReasoningStep[]
  iterations_used?: number
  confidence?: string
  is_agentic?: boolean
}

export default function AskTheManuals() {
  const [question, setQuestion] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(false)
  const [useAgenticMode, setUseAgenticMode] = useState(true) // Auto-enabled
  const [showReasoning, setShowReasoning] = useState(true)

  // Detect if question is complex
  const isComplexQuestion = (q: string): boolean => {
    const lowerQ = q.toLowerCase()
    return (
      q.split(' ').length > 15 || // Long question
      lowerQ.includes(' and ') ||
      lowerQ.includes(' or ') ||
      lowerQ.includes(' vs ') ||
      lowerQ.includes('compare') ||
      lowerQ.includes('difference') ||
      lowerQ.includes('steps to') ||
      lowerQ.includes('how do i') ||
      lowerQ.includes('what if') ||
      lowerQ.includes('when should') ||
      lowerQ.includes('which is better')
    )
  }

  const askQuestion = async () => {
    if (!question.trim()) return

    const userMessage: Message = { role: 'user', content: question }
    setMessages(prev => [...prev, userMessage])
    
    const currentQuestion = question
    setQuestion('')
    setLoading(true)

    try {
      const headers: Record<string, string> = {'Content-Type': 'application/json'}
      const token = typeof window !== 'undefined' ? localStorage.getItem('advisor_token') : null
      if (token) headers['Authorization'] = `Bearer ${token}`

      // Decide whether to use agentic mode
      const shouldUseAgentic = useAgenticMode && isComplexQuestion(currentQuestion)
      const endpoint = shouldUseAgentic ? '/agentic-query' : '/query'

      let response
      if (shouldUseAgentic) {
        response = await axios.post(
          `${getRagServiceUrl()}${endpoint}`,
          {
            question: currentQuestion,
            model: 'llama3.2',
            max_iterations: 3,
            top_k: 4,
            show_reasoning: showReasoning
          },
          { headers }
        )
      } else {
        response = await axios.post(
          `${getRagServiceUrl()}${endpoint}`,
          { question: currentQuestion },
          { headers }
        )
      }

      const assistantMessage: Message = {
        role: 'assistant',
        content: response.data.answer,
        sources: response.data.sources,
        retrieved_chunks: response.data.retrieved_chunks,
        is_agentic: shouldUseAgentic,
        reasoning_steps: response.data.reasoning_steps,
        iterations_used: response.data.iterations_used,
        confidence: response.data.confidence
      }

      setMessages(prev => [...prev, assistantMessage])
    } catch (error: any) {
      const errorMessage: Message = {
        role: 'assistant',
        content: `Error: ${error.response?.data?.detail || error.message}`
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      askQuestion()
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-8 h-[calc(100vh-16rem)] flex flex-col">
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-2xl font-bold text-gray-900">Ask the Manuals</h2>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={useAgenticMode}
                onChange={(e) => setUseAgenticMode(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-gray-700">🤖 Agent Mode</span>
            </label>
            {useAgenticMode && (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={showReasoning}
                  onChange={(e) => setShowReasoning(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-gray-700">🧠 Show Reasoning</span>
              </label>
            )}
          </div>
        </div>
        <p className="text-gray-600">
          Query training manuals and documentation
          {useAgenticMode && (
            <span className="ml-2 text-sm text-blue-600">
              • Agent will analyze complex questions and plan optimal search strategy
            </span>
          )}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto mb-4 space-y-4 bg-gray-50 rounded-lg p-4">
        {messages.length === 0 ? (
          <div className="text-center text-gray-500 mt-8">
            <p className="mb-2">No messages yet</p>
            <p className="text-sm">Ask a question about the training manuals</p>
            {useAgenticMode && (
              <div className="mt-4 p-4 bg-blue-50 rounded-lg max-w-md mx-auto">
                <p className="text-sm text-blue-800 font-semibold mb-2">🤖 Agent Mode Active</p>
                <p className="text-xs text-blue-700">
                  Complex questions will be analyzed and answered using multi-step reasoning
                </p>
              </div>
            )}
          </div>
        ) : (
          messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-lg p-4 ${
                  msg.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white border border-gray-200 text-gray-900'
                }`}
              >
                {/* Agentic Badge */}
                {msg.is_agentic && (
                  <div className="mb-2 flex items-center gap-2 text-xs">
                    <span className="bg-purple-100 text-purple-700 px-2 py-1 rounded-full font-semibold">
                      🤖 Agent Response
                    </span>
                    {msg.iterations_used && (
                      <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                        {msg.iterations_used} iteration{msg.iterations_used > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                )}

                {/* Main Answer */}
                <p className="whitespace-pre-wrap">{msg.content}</p>

                {/* Confidence Rating */}
                {msg.confidence && (
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <div className="flex items-start gap-2">
                      <span className="text-xs font-semibold text-gray-600">Confidence:</span>
                      <span className={`text-xs font-medium ${
                        msg.confidence.startsWith('HIGH') ? 'text-green-600' :
                        msg.confidence.startsWith('MEDIUM') ? 'text-yellow-600' :
                        'text-red-600'
                      }`}>
                        {msg.confidence}
                      </span>
                    </div>
                  </div>
                )}

                {/* Reasoning Steps */}
                {msg.reasoning_steps && msg.reasoning_steps.length > 0 && (
                  <details className="mt-3 pt-3 border-t border-gray-200">
                    <summary className="text-xs font-semibold text-purple-600 cursor-pointer hover:text-purple-700 flex items-center gap-1">
                      🧠 Agent Reasoning ({msg.reasoning_steps.length} steps)
                    </summary>
                    <div className="mt-2 space-y-2">
                      {msg.reasoning_steps.map((step, i) => (
                        <div key={i} className="text-xs bg-purple-50 p-3 rounded border border-purple-200">
                          <div className="font-semibold text-purple-900 mb-1 flex items-center gap-1">
                            <span className="bg-purple-200 text-purple-800 px-2 py-0.5 rounded-full text-xs">
                              {i + 1}
                            </span>
                            {step.step.toUpperCase()}: {step.description}
                          </div>
                          <div className="text-gray-700 ml-6">
                            <pre className="whitespace-pre-wrap text-xs bg-white p-2 rounded border border-purple-100 overflow-x-auto">
                              {JSON.stringify(step.result, null, 2)}
                            </pre>
                          </div>
                        </div>
                      ))}
                    </div>
                  </details>
                )}

                {/* Sources */}
                {msg.sources && msg.sources.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <p className="text-xs font-semibold text-gray-600 mb-1">📚 Sources ({msg.sources.length}):</p>
                    <ul className="text-xs text-gray-600 space-y-1">
                      {msg.sources.map((source, i) => (
                        <li key={i} className="flex items-start">
                          <span className="mr-1">•</span>
                          <span>{source}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Retrieved Chunks */}
                {msg.retrieved_chunks && msg.retrieved_chunks.length > 0 && (
                  <details className="mt-3 pt-3 border-t border-gray-200">
                    <summary className="text-xs font-semibold text-blue-600 cursor-pointer hover:text-blue-700">
                      🔍 View Retrieved Chunks ({msg.retrieved_chunks.length})
                    </summary>
                    <div className="mt-2 space-y-2 max-h-60 overflow-y-auto">
                      {msg.retrieved_chunks.map((chunk, i) => (
                        <div key={i} className="text-xs bg-gray-50 p-2 rounded border border-gray-200">
                          <div className="font-semibold text-gray-700 mb-1">
                            {chunk.source} (Chunk {chunk.chunk_id})
                          </div>
                          <div className="text-gray-600 whitespace-pre-wrap text-xs">
                            {chunk.text}
                          </div>
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </div>
            </div>
          ))
        )}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                {useAgenticMode && (
                  <span className="text-xs text-gray-500 ml-2">Agent is thinking...</span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyPress={handleKeyPress}
          rows={3}
          placeholder="Ask a question about the manuals..."
          className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
        />
        <button
          onClick={askQuestion}
          disabled={loading || !question.trim()}
          className="px-6 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
        >
          Send
        </button>
      </div>
    </div>
  )
}
