'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Upload, FileText, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'

const UPLOAD_SERVICE_URL = process.env.NEXT_PUBLIC_UPLOAD_SERVICE_URL || 'http://localhost:8103'

interface UploadedFile {
  filename: string
  status: 'uploading' | 'success' | 'error'
  message?: string
}

export default function ClientUpload() {
  const params = useParams()
  const clientId = params?.clientId as string
  const [uploading, setUploading] = useState(false)
  const [files, setFiles] = useState<UploadedFile[]>([])
  const [dragActive, setDragActive] = useState(false)

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFiles(Array.from(e.dataTransfer.files))
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault()
    if (e.target.files && e.target.files[0]) {
      handleFiles(Array.from(e.target.files))
    }
  }

  const handleFiles = async (fileList: File[]) => {
    setUploading(true)

    for (const file of fileList) {
      const fileEntry: UploadedFile = {
        filename: file.name,
        status: 'uploading'
      }
      setFiles(prev => [...prev, fileEntry])

      try {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('client_id', clientId)

        const response = await fetch(`${UPLOAD_SERVICE_URL}/uploads/${clientId}`, {
          method: 'POST',
          body: formData,
        })

        if (!response.ok) {
          throw new Error('Upload failed')
        }

        const result = await response.json()

        setFiles(prev =>
          prev.map(f =>
            f.filename === file.name
              ? { ...f, status: 'success', message: result.message }
              : f
          )
        )
      } catch (error) {
        setFiles(prev =>
          prev.map(f =>
            f.filename === file.name
              ? { ...f, status: 'error', message: 'Upload failed' }
              : f
          )
        )
      }
    }

    setUploading(false)
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-3xl mx-auto">
          <header className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-2">
              Document Upload Portal
            </h1>
            <p className="text-gray-600">
              Upload your documents securely
            </p>
            <p className="text-sm text-gray-500 mt-2">
              Client ID: <span className="font-mono font-semibold">{clientId}</span>
            </p>
          </header>

          <Card>
            <CardHeader>
              <CardTitle>Upload Your Documents</CardTitle>
              <CardDescription>
                Drag and drop files here or click to browse. Your documents will be securely processed.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div
                className={`relative border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
                  dragActive
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-300 hover:border-gray-400'
                }`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
              >
                <input
                  type="file"
                  multiple
                  onChange={handleChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  disabled={uploading}
                />
                <div className="space-y-4">
                  <div className="flex justify-center">
                    <div className="bg-blue-100 p-4 rounded-full">
                      <Upload className="h-8 w-8 text-blue-600" />
                    </div>
                  </div>
                  <div>
                    <p className="text-lg font-medium text-gray-900">
                      {dragActive ? 'Drop files here' : 'Drop files here or click to browse'}
                    </p>
                    <p className="text-sm text-gray-600 mt-1">
                      PDF, Images, Word documents, and more
                    </p>
                  </div>
                </div>
              </div>

              {files.length > 0 && (
                <div className="mt-6 space-y-3">
                  <h3 className="font-semibold text-gray-900">Uploaded Files</h3>
                  {files.map((file, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                    >
                      <div className="flex items-center gap-3 flex-1">
                        <FileText className="h-5 w-5 text-gray-600" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 truncate">
                            {file.filename}
                          </p>
                          {file.message && (
                            <p className="text-sm text-gray-600">{file.message}</p>
                          )}
                        </div>
                      </div>
                      <div>
                        {file.status === 'uploading' && (
                          <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />
                        )}
                        {file.status === 'success' && (
                          <CheckCircle className="h-5 w-5 text-green-600" />
                        )}
                        {file.status === 'error' && (
                          <AlertCircle className="h-5 w-5 text-red-600" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {files.some(f => f.status === 'success') && (
                <Alert className="mt-6 bg-green-50 border-green-200">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-800">
                    Your documents have been uploaded successfully and are being processed.
                    Your advisor will review them shortly.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          <div className="mt-8 p-6 bg-white rounded-lg shadow-sm">
            <h3 className="font-semibold text-gray-900 mb-3">What happens next?</h3>
            <ol className="list-decimal list-inside space-y-2 text-gray-700">
              <li>Your documents are securely uploaded to your advisor</li>
              <li>Documents are automatically processed and organized</li>
              <li>Your advisor will review them and contact you if needed</li>
              <li>All data is kept confidential and secure</li>
            </ol>
          </div>
        </div>
      </div>
    </main>
  )
}
