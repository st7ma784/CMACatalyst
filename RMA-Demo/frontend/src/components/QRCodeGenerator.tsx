'use client'

import { useState } from 'react'
import axios from 'axios'
import { QRCodeSVG } from 'qrcode.react'

const UPLOAD_SERVICE_URL = process.env.NEXT_PUBLIC_UPLOAD_SERVICE_URL || 'http://localhost:8103'

export default function QRCodeGenerator() {
  const [clientId, setClientId] = useState('')
  const [clientName, setClientName] = useState('')
  const [qrData, setQrData] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const generateQR = async () => {
    if (!clientId || !clientName) {
      alert('Please provide both client ID and name')
      return
    }

    setLoading(true)
    try {
      // For demo, we'll use a mock token. In production, implement proper auth
      const response = await axios.post(
        `${UPLOAD_SERVICE_URL}/generate-qr`,
        {
          client_id: clientId,
          client_name: clientName
        },
        {
          headers: {
            Authorization: `Bearer demo-token-replace-with-real-auth`
          }
        }
      )
      setQrData(response.data)
    } catch (error: any) {
      alert(`Error: ${error.response?.data?.detail || error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const downloadQR = () => {
    if (!qrData) return

    const svg = document.getElementById('qr-code-svg')
    if (!svg) return

    const svgData = new XMLSerializer().serializeToString(svg)
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    const img = new Image()

    canvas.width = 512
    canvas.height = 512

    img.onload = () => {
      ctx?.drawImage(img, 0, 0)
      const pngFile = canvas.toDataURL('image/png')

      const downloadLink = document.createElement('a')
      downloadLink.download = `qr_${clientId}.png`
      downloadLink.href = pngFile
      downloadLink.click()
    }

    img.src = 'data:image/svg+xml;base64,' + btoa(svgData)
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-8">
      <h2 className="text-2xl font-bold mb-4 text-gray-900">Generate Client QR Code</h2>
      <p className="text-gray-600 mb-6">
        Create a QR code for clients to access their document upload portal
      </p>

      <div className="space-y-4 mb-8">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Client ID
          </label>
          <input
            type="text"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="e.g., CLIENT001"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Client Name
          </label>
          <input
            type="text"
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="e.g., John Smith"
          />
        </div>

        <button
          onClick={generateQR}
          disabled={loading}
          className="w-full bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
        >
          {loading ? 'Generating...' : 'Generate QR Code'}
        </button>
      </div>

      {qrData && (
        <div className="mt-8 space-y-6">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h3 className="font-semibold text-green-900 mb-2">QR Code Generated!</h3>
            <p className="text-green-700 text-sm">
              Client can scan this code to access their upload portal
            </p>
          </div>

          <div className="flex flex-col items-center space-y-4">
            <div className="bg-white p-6 rounded-lg border-2 border-gray-200">
              <QRCodeSVG
                id="qr-code-svg"
                value={qrData.upload_url}
                size={256}
                level="H"
                includeMargin={true}
              />
            </div>

            <div className="text-center space-y-2">
              <p className="text-sm text-gray-600">
                Upload URL: <code className="bg-gray-100 px-2 py-1 rounded">{qrData.upload_url}</code>
              </p>
            </div>

            <button
              onClick={downloadQR}
              className="bg-indigo-600 text-white py-2 px-6 rounded-md hover:bg-indigo-700 transition-colors"
            >
              Download QR Code
            </button>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-semibold text-blue-900 mb-2">Instructions for Client:</h4>
            <ol className="list-decimal list-inside text-blue-800 space-y-1 text-sm">
              <li>Scan the QR code with your phone camera</li>
              <li>You'll be taken to your personal upload page</li>
              <li>Upload any documents you need to share</li>
              <li>Documents will be automatically processed and organized</li>
            </ol>
          </div>
        </div>
      )}
    </div>
  )
}
