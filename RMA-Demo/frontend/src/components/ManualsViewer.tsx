'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { FileText, RefreshCw, CheckCircle, AlertCircle, Book, Database } from 'lucide-react'

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

interface SourceInfo {
  filename: string
  chunk_count: number
  total_characters: number
  preview: string
}

export default function ManualsViewer() {
  const [sources, setSources] = useState<SourceInfo[]>([])
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    loadManuals()
  }, [])

  const loadManuals = async () => {
    setLoading(true)
    setError('')

    try {
      // Get stats
  const statsRes = await fetch(`${getRagServiceUrl()}/stats`)
      if (!statsRes.ok) throw new Error('Failed to fetch stats')
      const statsData = await statsRes.json()
      setStats(statsData)

      // Get all sources
  const sourcesRes = await fetch(`${getRagServiceUrl()}/debug/sources`)
      if (!sourcesRes.ok) throw new Error('Failed to fetch sources')
      const sourcesData = await sourcesRes.json()

      // Get detailed info for each source
      const sourceDetails: SourceInfo[] = []
      for (const source of sourcesData.sources || []) {
        try {
          const docsRes = await fetch(`${getRagServiceUrl()}/debug/documents?source=${encodeURIComponent(source)}&limit=1000`)
          if (docsRes.ok) {
            const docsData = await docsRes.json()
            const chunks = docsData.documents || []
            
            // Calculate total characters
            const totalChars = chunks.reduce((sum: number, doc: any) => sum + (doc.text?.length || 0), 0)
            
            // Get first chunk as preview
            const preview = chunks[0]?.text || 'No text available'
            
            sourceDetails.push({
              filename: source,
              chunk_count: chunks.length,
              total_characters: totalChars,
              preview: preview.substring(0, 300) + (preview.length > 300 ? '...' : '')
            })
          }
        } catch (err) {
          console.error(`Error loading details for ${source}:`, err)
        }
      }

      setSources(sourceDetails)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load manuals')
    } finally {
      setLoading(false)
    }
  }

  const formatNumber = (num: number): string => {
    return num.toLocaleString()
  }

  const estimatePages = (characters: number): number => {
    // Rough estimate: ~2000 characters per page
    return Math.ceil(characters / 2000)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
        <span className="ml-3 text-gray-600">Loading manual information...</span>
      </div>
    )
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Manuals</p>
                <p className="text-3xl font-bold text-gray-900">{sources.length}</p>
              </div>
              <Book className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Chunks</p>
                <p className="text-3xl font-bold text-gray-900">
                  {stats?.total_chunks ? formatNumber(stats.total_chunks) : '0'}
                </p>
              </div>
              <Database className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Status</p>
                <p className="text-lg font-semibold text-green-600 flex items-center gap-2">
                  <CheckCircle className="h-5 w-5" />
                  {stats?.status || 'Unknown'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Manual Details */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Ingested Manuals</CardTitle>
              <CardDescription>
                Detailed information about each manual in the RAG system
              </CardDescription>
            </div>
            <Button onClick={loadManuals} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {sources.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-600">No manuals have been ingested yet.</p>
              <p className="text-sm text-gray-500 mt-2">
                Use the <code className="bg-gray-100 px-2 py-1 rounded">/ingest-pdf</code> endpoint to add manuals.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {sources.map((source, idx) => (
                <Card key={idx} className="bg-gray-50">
                  <CardContent className="pt-6">
                    <div className="space-y-4">
                      {/* Header */}
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3 flex-1">
                          <FileText className="h-6 w-6 text-blue-600 flex-shrink-0 mt-1" />
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-gray-900 text-lg mb-2 break-words">
                              {source.filename}
                            </h3>
                            
                            {/* Stats Grid */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                              <div className="bg-white rounded-lg p-3">
                                <p className="text-xs text-gray-600 mb-1">Est. Pages</p>
                                <p className="text-xl font-bold text-gray-900">
                                  {estimatePages(source.total_characters)}
                                </p>
                              </div>
                              
                              <div className="bg-white rounded-lg p-3">
                                <p className="text-xs text-gray-600 mb-1">Characters</p>
                                <p className="text-xl font-bold text-gray-900">
                                  {formatNumber(source.total_characters)}
                                </p>
                              </div>
                              
                              <div className="bg-white rounded-lg p-3">
                                <p className="text-xs text-gray-600 mb-1">Chunks</p>
                                <p className="text-xl font-bold text-gray-900">
                                  {source.chunk_count}
                                </p>
                              </div>
                              
                              <div className="bg-white rounded-lg p-3">
                                <p className="text-xs text-gray-600 mb-1">Avg Chunk Size</p>
                                <p className="text-xl font-bold text-gray-900">
                                  {Math.round(source.total_characters / source.chunk_count)}
                                </p>
                              </div>
                            </div>

                            {/* Preview */}
                            <div className="bg-white rounded-lg p-4 border border-gray-200">
                              <p className="text-xs font-semibold text-gray-700 mb-2">
                                TEXT PREVIEW (First 300 characters)
                              </p>
                              <p className="text-sm text-gray-700 font-mono whitespace-pre-wrap">
                                {source.preview}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Help Text */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="pt-6">
          <h4 className="font-semibold text-blue-900 mb-2">About These Statistics</h4>
          <ul className="text-sm text-blue-800 space-y-1">
            <li><strong>Est. Pages:</strong> Estimated page count based on ~2000 characters per page</li>
            <li><strong>Characters:</strong> Total characters extracted from the PDF</li>
            <li><strong>Chunks:</strong> Number of text segments stored in the vector database</li>
            <li><strong>Avg Chunk Size:</strong> Average characters per chunk (target: 1000)</li>
            <li><strong>Text Preview:</strong> First 300 characters of the extracted text to verify quality</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
