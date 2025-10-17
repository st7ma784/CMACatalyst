'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Search, FileText, CheckCircle } from 'lucide-react'

interface Source {
  filename: string
  chunk: number
  text_preview: string
}

interface QueryResult {
  answer: string
  sources: Source[]
  client_id: string
}

interface ClientStats {
  client_id: string
  total_chunks: number
  total_documents: number
  documents: string[]
  status: string
}

export default function ClientDocumentSearch() {
  const [clientId, setClientId] = useState('')
  const [question, setQuestion] = useState('')
  const [result, setResult] = useState<QueryResult | null>(null)
  const [stats, setStats] = useState<ClientStats | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadingStats, setLoadingStats] = useState(false)
  const [error, setError] = useState('')

  const UPLOAD_SERVICE_URL = process.env.NEXT_PUBLIC_UPLOAD_SERVICE_URL || 'http://localhost:8103'

  // Load stats when client ID changes
  useEffect(() => {
    if (clientId.length > 2) {
      loadClientStats()
    } else {
      setStats(null)
    }
  }, [clientId])

  const loadClientStats = async () => {
    setLoadingStats(true)
    setError('')

    try {
      const token = localStorage.getItem('token')
      if (!token) {
        setError('Please login first')
        return
      }

      const response = await fetch(`${UPLOAD_SERVICE_URL}/client-stats/${clientId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        setStats(data)
      } else if (response.status === 404) {
        setStats({
          client_id: clientId,
          total_chunks: 0,
          total_documents: 0,
          documents: [],
          status: 'not_initialized'
        })
      } else {
        setError('Failed to load client statistics')
      }
    } catch (err) {
      console.error('Error loading stats:', err)
    } finally {
      setLoadingStats(false)
    }
  }

  const handleSearch = async () => {
    if (!clientId.trim() || !question.trim()) {
      setError('Please enter both client ID and question')
      return
    }

    setLoading(true)
    setError('')
    setResult(null)

    try {
      const token = localStorage.getItem('token')
      if (!token) {
        setError('Please login first')
        setLoading(false)
        return
      }

      const response = await fetch(`${UPLOAD_SERVICE_URL}/query-client-documents`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          client_id: clientId,
          question: question,
          model: 'llama3.2'
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || 'Failed to query documents')
      }

      const data = await response.json()
      setResult(data)
    } catch (err: any) {
      setError(err.message || 'An error occurred while searching')
    } finally {
      setLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSearch()
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Search Client Documents</CardTitle>
          <CardDescription>
            Use AI to search and query a client's uploaded documents
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="clientId">Client ID</Label>
            <Input
              id="clientId"
              placeholder="Enter client ID (e.g., SMITH_JOHN_12345)"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
            />
          </div>

          {stats && stats.status === 'ready' && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <span className="font-semibold text-green-900">Documents Available</span>
              </div>
              <div className="text-sm text-green-800 space-y-1">
                <p>{stats.total_documents} document(s) indexed</p>
                <p>{stats.total_chunks} searchable chunks</p>
                {stats.documents.length > 0 && (
                  <div className="mt-2">
                    <p className="font-medium">Documents:</p>
                    <ul className="list-disc list-inside">
                      {stats.documents.map((doc, idx) => (
                        <li key={idx} className="text-xs">{doc}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}

          {stats && stats.status === 'not_initialized' && (
            <Alert>
              <AlertDescription>
                No documents have been uploaded for this client yet. Upload documents first to enable search.
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="question">Question</Label>
            <Input
              id="question"
              placeholder="e.g., What debts does this client have?"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyPress={handleKeyPress}
            />
          </div>

          <Button
            onClick={handleSearch}
            disabled={loading || !clientId.trim() || !question.trim()}
            className="w-full"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Searching...
              </>
            ) : (
              <>
                <Search className="mr-2 h-4 w-4" />
                Search Documents
              </>
            )}
          </Button>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader>
            <CardTitle>Search Results</CardTitle>
            <CardDescription>
              Based on {result.sources.length} relevant section(s) from client documents
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-semibold text-blue-900 mb-2">Answer</h3>
              <p className="text-sm text-blue-800 whitespace-pre-wrap">{result.answer}</p>
            </div>

            {result.sources.length > 0 && (
              <div className="space-y-2">
                <h3 className="font-semibold text-sm">Sources</h3>
                <div className="space-y-2">
                  {result.sources.map((source, idx) => (
                    <div key={idx} className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                      <div className="flex items-start gap-2 mb-2">
                        <FileText className="h-4 w-4 text-gray-600 mt-0.5" />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">{source.filename}</p>
                          <p className="text-xs text-gray-600">Section {source.chunk + 1}</p>
                        </div>
                      </div>
                      <p className="text-xs text-gray-700 italic">
                        "{source.text_preview}"
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card className="bg-gray-50">
        <CardHeader>
          <CardTitle className="text-sm">How to Use</CardTitle>
        </CardHeader>
        <CardContent className="text-xs space-y-2">
          <p>1. Enter the client ID (same ID used for document uploads)</p>
          <p>2. Ask questions about the client's documents in natural language</p>
          <p>3. The AI will search through all uploaded documents and provide answers with sources</p>
          <p className="font-semibold mt-4">Example Questions:</p>
          <ul className="list-disc list-inside space-y-1 text-gray-700">
            <li>What debts does this client have?</li>
            <li>What is the total amount owed?</li>
            <li>When is the payment deadline?</li>
            <li>Who is the creditor for the largest debt?</li>
            <li>What income sources are documented?</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
