'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { 
  Brain, 
  CheckCircle, 
  AlertTriangle, 
  AlertCircle, 
  Loader2,
  ArrowRight,
  FileText
} from 'lucide-react'

const CLIENT_RAG_SERVICE_URL = process.env.NEXT_PUBLIC_CLIENT_RAG_SERVICE_URL || 'http://localhost:8104'

interface WorryAnalysis {
  worry_level: 'low' | 'medium' | 'high'
  reassurance: string
  context: string
  next_steps: string[]
  related_docs: string[]
  confidence: string
}

interface ShouldIWorryDialogProps {
  open: boolean
  onClose: () => void
  clientId: string
  filename: string
  documentSummary?: string
}

export default function ShouldIWorryDialog({
  open,
  onClose,
  clientId,
  filename,
  documentSummary
}: ShouldIWorryDialogProps) {
  const [loading, setLoading] = useState(false)
  const [analysis, setAnalysis] = useState<WorryAnalysis | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open && !analysis && !loading) {
      analyzeDocument()
    }
  }, [open])

  const analyzeDocument = async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`${CLIENT_RAG_SERVICE_URL}/should-i-worry`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: clientId,
          filename: filename,
          document_summary: documentSummary
        })
      })

      if (!response.ok) {
        throw new Error('Could not analyze document')
      }

      const data = await response.json()
      setAnalysis(data)
    } catch (err) {
      console.error('Error analyzing document:', err)
      setError(err instanceof Error ? err.message : 'Could not analyze document')
    } finally {
      setLoading(false)
    }
  }

  const getWorryBadge = (level: string) => {
    switch (level) {
      case 'low':
        return {
          icon: <CheckCircle className="h-4 w-4" />,
          text: "Don't worry!",
          className: 'bg-green-100 text-green-800 border-green-200'
        }
      case 'medium':
        return {
          icon: <AlertTriangle className="h-4 w-4" />,
          text: 'Keep an eye on this',
          className: 'bg-yellow-100 text-yellow-800 border-yellow-200'
        }
      case 'high':
        return {
          icon: <AlertCircle className="h-4 w-4" />,
          text: 'Important - Take action',
          className: 'bg-red-100 text-red-800 border-red-200'
        }
      default:
        return {
          icon: null,
          text: '',
          className: ''
        }
    }
  }

  const worryBadge = analysis ? getWorryBadge(analysis.worry_level) : null

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-blue-600" />
            Should I worry about this document?
          </DialogTitle>
          <DialogDescription>
            AI-powered analysis of your document
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {loading && (
            <div className="flex flex-col items-center justify-center py-8">
              <Loader2 className="h-8 w-8 text-blue-600 animate-spin mb-4" />
              <p className="text-gray-600">Analyzing your document...</p>
            </div>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {analysis && !loading && (
            <div className="space-y-6">
              {/* Worry Level Badge */}
              {worryBadge && (
                <div className="flex justify-center">
                  <Badge 
                    variant="outline" 
                    className={`${worryBadge.className} px-4 py-2 text-base font-semibold border-2`}
                  >
                    <span className="flex items-center gap-2">
                      {worryBadge.icon}
                      {worryBadge.text}
                    </span>
                  </Badge>
                </div>
              )}

              {/* Reassurance Message */}
              <Alert className="bg-blue-50 border-blue-200">
                <Brain className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-blue-900 mt-2">
                  <p className="font-semibold mb-2">Here's what you need to know:</p>
                  <p className="leading-relaxed">{analysis.reassurance}</p>
                </AlertDescription>
              </Alert>

              {/* Context */}
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-start gap-2 mb-2">
                  <ArrowRight className="h-5 w-5 text-gray-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <h3 className="font-semibold text-gray-900">
                      Where this fits in your journey
                    </h3>
                    <p className="text-gray-700 mt-1 leading-relaxed">
                      {analysis.context}
                    </p>
                  </div>
                </div>
              </div>

              {/* Next Steps */}
              {analysis.next_steps && analysis.next_steps.length > 0 && (
                <div>
                  <h3 className="font-semibold text-gray-900 mb-3">
                    Recommended next steps:
                  </h3>
                  <ol className="space-y-2">
                    {analysis.next_steps.map((step, index) => (
                      <li key={index} className="flex items-start gap-3">
                        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-semibold">
                          {index + 1}
                        </span>
                        <span className="text-gray-700 pt-0.5">{step}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              {/* Related Documents */}
              {analysis.related_docs && analysis.related_docs.length > 0 && (
                <div>
                  <h3 className="font-semibold text-gray-900 mb-3">
                    Related documents in your file:
                  </h3>
                  <div className="space-y-2">
                    {analysis.related_docs.map((doc, index) => (
                      <div 
                        key={index}
                        className="flex items-center gap-2 text-sm text-gray-700 bg-gray-50 rounded p-2"
                      >
                        <FileText className="h-4 w-4 text-gray-500 flex-shrink-0" />
                        <span>{doc}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Confidence Footer */}
              <div className="pt-4 border-t border-gray-200">
                <p className="text-xs text-gray-500 italic text-center">
                  Analysis confidence: {analysis.confidence}
                </p>
              </div>
            </div>
          )}

          {/* Close Button */}
          <div className="flex justify-end pt-4">
            <Button onClick={onClose} className="min-w-[150px]">
              Thanks, I understand
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
