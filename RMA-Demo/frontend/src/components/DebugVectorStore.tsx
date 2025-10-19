'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  Search, 
  RefreshCw, 
  FileText, 
  Database, 
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Filter
} from 'lucide-react'

const DEFAULT_RAG_SERVICE_URL = process.env.NEXT_PUBLIC_RAG_SERVICE_URL || 'http://localhost:8102'

const getRagServiceUrl = () => {
  if (typeof window === 'undefined') return DEFAULT_RAG_SERVICE_URL

  try {
    const url = new URL(DEFAULT_RAG_SERVICE_URL)
    // If configured to localhost, and the frontend is being accessed via a network hostname
    // (e.g., from a phone), replace the hostname with the browser's hostname so requests
    // target the host machine where the backend is reachable.
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

interface Document {
  id: string
  text: string
  source: string
  chunk: number | string
  preview: string
}

interface DebugData {
  documents: Document[]
  total: number
  limit: number
  offset: number
  status: string
}

interface SourceInfo {
  sources: string[]
  total_sources: number
  status: string
}

export default function DebugVectorStore() {
  const [debugData, setDebugData] = useState<DebugData | null>(null)
  const [sources, setSources] = useState<SourceInfo | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [selectedSource, setSelectedSource] = useState<string>('')
  const [expandedChunks, setExpandedChunks] = useState<Set<string>>(new Set())
  const [limit, setLimit] = useState(50)
  const [offset, setOffset] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    loadSources()
    loadDocuments()
  }, [])

  const loadSources = async () => {
    try {
  const response = await fetch(`${getRagServiceUrl()}/debug/sources`)
      if (!response.ok) throw new Error('Failed to load sources')
      const data = await response.json()
      setSources(data)
    } catch (err) {
      console.error('Error loading sources:', err)
    }
  }

  const loadDocuments = async (sourceFilter?: string, offsetValue?: number) => {
    setLoading(true)
    setError('')

    try {
      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: (offsetValue ?? offset).toString()
      })
      
      if (sourceFilter) {
        params.append('source', sourceFilter)
      }

  const response = await fetch(`${getRagServiceUrl()}/debug/documents?${params}`)
      
      if (!response.ok) {
        throw new Error('Failed to load documents')
      }

      const data = await response.json()
      setDebugData(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load debug data')
    } finally {
      setLoading(false)
    }
  }

  const handleSourceFilter = (source: string) => {
    setSelectedSource(source)
    setOffset(0)
    loadDocuments(source, 0)
  }

  const handleRefresh = () => {
    loadSources()
    loadDocuments(selectedSource || undefined)
  }

  const toggleChunk = (chunkId: string) => {
    const newExpanded = new Set(expandedChunks)
    if (newExpanded.has(chunkId)) {
      newExpanded.delete(chunkId)
    } else {
      newExpanded.add(chunkId)
    }
    setExpandedChunks(newExpanded)
  }

  const handleNextPage = () => {
    const newOffset = offset + limit
    setOffset(newOffset)
    loadDocuments(selectedSource || undefined, newOffset)
  }

  const handlePrevPage = () => {
    const newOffset = Math.max(0, offset - limit)
    setOffset(newOffset)
    loadDocuments(selectedSource || undefined, newOffset)
  }

  const filteredDocuments = debugData?.documents.filter(doc =>
    searchQuery === '' ||
    doc.text.toLowerCase().includes(searchQuery.toLowerCase()) ||
    doc.source.toLowerCase().includes(searchQuery.toLowerCase())
  ) || []

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Vector Store Debug Viewer
          </CardTitle>
          <CardDescription>
            View raw chunks stored in the vector database to verify manual content
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="flex items-end gap-4">
            <div className="flex-1">
              <Label htmlFor="search">Search in chunks</Label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  id="search"
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search text in chunks..."
                  className="pl-10"
                />
              </div>
            </div>
            
            <Button onClick={handleRefresh} variant="outline" className="flex items-center gap-2">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>

          {sources && sources.sources.length > 0 && (
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Filter className="h-4 w-4" />
                Filter by Source Manual
              </Label>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant={selectedSource === '' ? 'default' : 'outline'}
                  onClick={() => handleSourceFilter('')}
                >
                  All Sources ({sources.total_sources})
                </Button>
                {sources.sources.map((source) => (
                  <Button
                    key={source}
                    size="sm"
                    variant={selectedSource === source ? 'default' : 'outline'}
                    onClick={() => handleSourceFilter(source)}
                  >
                    {source}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {debugData && (
            <div className="space-y-3">
              <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
                <div>
                  <p className="font-semibold text-blue-900">
                    Total Chunks: {debugData.total}
                  </p>
                  <p className="text-sm text-blue-700">
                    Showing {offset + 1} - {Math.min(offset + limit, debugData.total)} of {debugData.total}
                    {selectedSource && ` (filtered by: ${selectedSource})`}
                  </p>
                  {searchQuery && (
                    <p className="text-sm text-blue-700">
                      Found {filteredDocuments.length} matching chunks
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handlePrevPage}
                    disabled={offset === 0 || loading}
                  >
                    Previous
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleNextPage}
                    disabled={offset + limit >= debugData.total || loading}
                  >
                    Next
                  </Button>
                </div>
              </div>

              <div className="space-y-3">
                {filteredDocuments.map((doc) => {
                  const isExpanded = expandedChunks.has(doc.id)
                  return (
                    <Card key={doc.id} className="overflow-hidden">
                      <div
                        className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                        onClick={() => toggleChunk(doc.id)}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3 flex-1">
                            <FileText className="h-5 w-5 text-blue-600 mt-1 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-semibold text-gray-900">
                                  {doc.source}
                                </span>
                                <span className="text-xs bg-gray-200 px-2 py-1 rounded">
                                  Chunk {doc.chunk}
                                </span>
                              </div>
                              <p className="text-sm text-gray-700 line-clamp-2">
                                {doc.preview}
                              </p>
                              {!isExpanded && doc.text.length > 200 && (
                                <p className="text-xs text-blue-600 mt-1">
                                  Click to view full text ({doc.text.length} characters)
                                </p>
                              )}
                            </div>
                          </div>
                          {isExpanded ? (
                            <ChevronUp className="h-5 w-5 text-gray-400 flex-shrink-0" />
                          ) : (
                            <ChevronDown className="h-5 w-5 text-gray-400 flex-shrink-0" />
                          )}
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="border-t bg-gray-50 p-4">
                          <Label className="text-xs text-gray-600 mb-2 block">
                            Full Chunk Text:
                          </Label>
                          <pre className="text-sm whitespace-pre-wrap bg-white p-4 rounded border overflow-auto max-h-96">
                            {doc.text}
                          </pre>
                          <div className="mt-3 flex gap-4 text-xs text-gray-600">
                            <span>ID: {doc.id}</span>
                            <span>Length: {doc.text.length} chars</span>
                          </div>
                        </div>
                      )}
                    </Card>
                  )
                })}
              </div>

              {filteredDocuments.length === 0 && (
                <div className="text-center py-12 text-gray-500">
                  <Database className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                  <p>No chunks found{searchQuery && ' matching your search'}</p>
                </div>
              )}
            </div>
          )}

          {!debugData && !loading && (
            <div className="text-center py-12 text-gray-500">
              <AlertCircle className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <p>No vector store data available</p>
              <p className="text-sm">Ingest some manuals first</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>How to Use This Debug View</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-gray-700">
          <p>
            <strong>Purpose:</strong> This view shows the actual text chunks stored in the vector
            database that are used to answer questions.
          </p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Each chunk is a piece of text from your training manuals</li>
            <li>When you ask a question, the system searches these chunks for relevant information</li>
            <li>If answers are wrong, check if the chunks contain the correct information</li>
            <li>Use filters to narrow down to specific manuals</li>
            <li>Search to find specific text or figures</li>
          </ul>
          <Alert className="bg-yellow-50 border-yellow-200">
            <AlertCircle className="h-4 w-4 text-yellow-600" />
            <AlertDescription className="text-yellow-800">
              <strong>Debugging Tips:</strong> If you get wrong answers, search for the specific
              figures or facts mentioned. If they're not in any chunk, the manuals may be incomplete.
              If they ARE in chunks but still wrong, the AI might be hallucinating or misinterpreting.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  )
}
