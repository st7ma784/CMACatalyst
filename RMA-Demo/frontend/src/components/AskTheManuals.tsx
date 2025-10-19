'use client'

import { useState } from 'react'
import axios from 'axios'

const DEFAULT_RAG_SERVICE_URL = process.env.NEXT_PUBLIC_RAG_SERVICE_URL || 'http://localhost:8102'

const getRagServiceUrl = () => {
  if (typeof window === 'undefined') return DEFAULT_RAG_SERVICE_URL
  try {
    const url = new URL(DEFAULT_RAG_SERVICE_URL)
    if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
      const host = window.location.hostname
      if (host && host !== 'localhost' && host !== '127.0.0.1') {
        return `${window.location.protocol}//${host}:${url.port}`
      }
    }
    return DEFAULT_RAG_SERVICE_URL
  } catch (e) {
    return DEFAULT_RAG_SERVICE_URL
  }
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
}

export default function AskTheManuals() {
  const [question, setQuestion] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(false)

  const askQuestion = async () => {
    if (!question.trim()) return

    const userMessage: Message = { role: 'user', content: question }
    setMessages(prev => [...prev, userMessage])
    setQuestion('')
    setLoading(true)

    try {
      const headers: Record<string, string> = {'Content-Type': 'application/json'}
      const token = typeof window !== 'undefined' ? localStorage.getItem('advisor_token') : null
      if (token) headers['Authorization'] = `Bearer ${token}`

      const response = await axios.post(`${getRagServiceUrl()}/query`, { question }, { headers })

      const assistantMessage: Message = {
        role: 'assistant',
        content: response.data.answer,
        sources: response.data.sources,
        retrieved_chunks: response.data.retrieved_chunks
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
        <h2 className="text-2xl font-bold text-gray-900">Ask the Manuals</h2>
        <p className="text-gray-600">
          Query training manuals and documentation
        </p>
      </div>

      <div className="flex-1 overflow-y-auto mb-4 space-y-4 bg-gray-50 rounded-lg p-4">
        {messages.length === 0 ? (
          <div className="text-center text-gray-500 mt-8">
            <p className="mb-2">No messages yet</p>
            <p className="text-sm">Ask a question about the training manuals</p>
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
                <p className="whitespace-pre-wrap">{msg.content}</p>
                {msg.sources && msg.sources.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <p className="text-xs font-semibold text-gray-600 mb-1">Sources:</p>
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
              <div className="flex space-x-2">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
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
