'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { LogOut, FileText, Download, RefreshCw, User, Calendar, HardDrive } from 'lucide-react'
import Link from 'next/link'

const UPLOAD_SERVICE_URL = process.env.NEXT_PUBLIC_UPLOAD_SERVICE_URL || 'http://localhost:8103'

interface ClientDocument {
  filename: string
  uploaded_at: string
  size: number
  markdown_path?: string
}

interface ClientData {
  client_id: string
  client_name: string
  documents: ClientDocument[]
}

export default function AdvisorDashboard() {
  const router = useRouter()
  const [clients, setClients] = useState<ClientData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [username, setUsername] = useState('')
  const [selectedClient, setSelectedClient] = useState<string | null>(null)

  useEffect(() => {
    // Check if user is logged in
    const token = localStorage.getItem('advisor_token')
    const storedUsername = localStorage.getItem('advisor_username')
    
    if (!token) {
      router.push('/advisor-login')
      return
    }

    setUsername(storedUsername || 'Advisor')
    loadAllClients(token)
  }, [router])

  const loadAllClients = async (token: string) => {
    setLoading(true)
    setError('')

    try {
      // Fetch all clients from the upload service
      const response = await fetch(`${UPLOAD_SERVICE_URL}/clients`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        if (response.status === 401) {
          router.push('/advisor-login')
          return
        }
        throw new Error('Failed to load clients')
      }

      const data = await response.json()
      const clientIds = data.clients.map((c: any) => c.client_id)
      
      // Load detailed document info for each client
      const clientDataPromises = clientIds.map((clientId: string) =>
        loadClientDocuments(clientId, token)
      )
      const clientsData = await Promise.all(clientDataPromises)
      setClients(clientsData.filter(c => c !== null) as ClientData[])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load clients')
    } finally {
      setLoading(false)
    }
  }

  const loadClientDocuments = async (clientId: string, token: string): Promise<ClientData | null> => {
    try {
      const response = await fetch(`${UPLOAD_SERVICE_URL}/uploads/${clientId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        return null
      }

      return await response.json()
    } catch (err) {
      console.error(`Failed to load documents for client ${clientId}:`, err)
      return null
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('advisor_token')
    localStorage.removeItem('advisor_username')
    router.push('/advisor-login')
  }

  const handleRefresh = () => {
    const token = localStorage.getItem('advisor_token')
    if (token) {
      loadAllClients(token)
    }
  }

  const handleDownload = async (clientId: string, filename: string) => {
    const token = localStorage.getItem('advisor_token')
    if (!token) return

    try {
      const response = await fetch(
        `${UPLOAD_SERVICE_URL}/uploads/${clientId}/${filename}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      )

      if (!response.ok) {
        throw new Error('Download failed')
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (err) {
      alert('Failed to download file')
    }
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  const formatDate = (dateStr: string): string => {
    try {
      return new Date(dateStr).toLocaleString()
    } catch {
      return dateStr
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600">Loading client data...</p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        <header className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">
              Advisor Dashboard
            </h1>
            <p className="text-gray-600 flex items-center gap-2">
              <User className="h-4 w-4" />
              Logged in as: {username}
            </p>
          </div>
          <div className="flex gap-3">
            <Button
              onClick={handleRefresh}
              variant="outline"
              className="flex items-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
            <Link href="/">
              <Button variant="outline">
                Back to Dashboard
              </Button>
            </Link>
            <Button
              onClick={handleLogout}
              variant="destructive"
              className="flex items-center gap-2"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </Button>
          </div>
        </header>

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {clients.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <FileText className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <h3 className="text-xl font-semibold mb-2">No Clients Found</h3>
              <p className="text-gray-600 mb-4">
                No clients have uploaded documents yet, or you need to add client IDs.
              </p>
              <Link href="/">
                <Button>
                  Go to QR Code Generator
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6">
            {clients.map((client) => (
              <Card key={client.client_id}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <User className="h-5 w-5" />
                      {client.client_name || client.client_id}
                    </span>
                    <span className="text-sm font-normal text-gray-600">
                      {client.documents.length} document{client.documents.length !== 1 ? 's' : ''}
                    </span>
                  </CardTitle>
                  <CardDescription>
                    Client ID: {client.client_id}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {client.documents.length === 0 ? (
                    <p className="text-gray-600 italic">No documents uploaded yet</p>
                  ) : (
                    <div className="space-y-3">
                      {client.documents.map((doc, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                        >
                          <div className="flex items-center gap-3 flex-1">
                            <FileText className="h-5 w-5 text-blue-600 flex-shrink-0" />
                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-gray-900 truncate">
                                {doc.filename}
                              </p>
                              <div className="flex items-center gap-4 text-sm text-gray-600">
                                <span className="flex items-center gap-1">
                                  <HardDrive className="h-3 w-3" />
                                  {formatFileSize(doc.size)}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  {formatDate(doc.uploaded_at)}
                                </span>
                                {doc.markdown_path && (
                                  <span className="text-green-600 text-xs font-semibold">
                                    ✓ Processed
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <Button
                            onClick={() => handleDownload(client.client_id, doc.filename)}
                            size="sm"
                            variant="outline"
                            className="flex items-center gap-2 flex-shrink-0"
                          >
                            <Download className="h-4 w-4" />
                            Download
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
