'use client'

import { useState } from 'react'
import axios from 'axios'

const NOTES_SERVICE_URL = process.env.NEXT_PUBLIC_NOTES_SERVICE_URL || 'http://localhost:8100'

export default function NotesToCoA() {
  const [notes, setNotes] = useState('')
  const [clientName, setClientName] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)

  const handleConvert = async () => {
    if (!notes || !clientName) {
      alert('Please provide both notes and client name')
      return
    }

    setLoading(true)
    try {
      const response = await axios.post(`${NOTES_SERVICE_URL}/convert`, {
        notes,
        client_name: clientName
      })
      setResult(response.data)
    } catch (error: any) {
      alert(`Error: ${error.response?.data?.detail || error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    alert('Copied to clipboard!')
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-8">
      <h2 className="text-2xl font-bold mb-4 text-gray-900">Notes to Client Letter</h2>
      <p className="text-gray-600 mb-6">
        Convert your advisor notes into simple, client-friendly language
      </p>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Client Name
          </label>
          <input
            type="text"
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Enter client name"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Advisor Notes
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={8}
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
            placeholder="Paste your advisor notes here..."
          />
        </div>

        <button
          onClick={handleConvert}
          disabled={loading}
          className="w-full bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
        >
          {loading ? 'Converting...' : 'Convert to Client Letter'}
        </button>
      </div>

      {result && (
        <div className="mt-8 space-y-6">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h3 className="font-semibold text-green-900 mb-2">Conversion Successful!</h3>
            <p className="text-green-700 text-sm">
              Your notes have been converted to client-friendly language
            </p>
          </div>

          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-semibold text-blue-900 mb-2">Matters Discussed</h4>
              <p className="text-gray-700 whitespace-pre-wrap">{result.matters_discussed}</p>
            </div>

            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <h4 className="font-semibold text-purple-900 mb-2">Our Actions</h4>
              <p className="text-gray-700 whitespace-pre-wrap">{result.our_actions}</p>
            </div>

            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <h4 className="font-semibold text-orange-900 mb-2">Your Actions</h4>
              <p className="text-gray-700 whitespace-pre-wrap">{result.your_actions}</p>
            </div>

            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <div className="flex justify-between items-center mb-2">
                <h4 className="font-semibold text-gray-900">Full Letter</h4>
                <button
                  onClick={() => copyToClipboard(result.full_text)}
                  className="text-sm bg-gray-200 hover:bg-gray-300 px-3 py-1 rounded"
                >
                  Copy
                </button>
              </div>
              <p className="text-gray-700 whitespace-pre-wrap">{result.full_text}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
