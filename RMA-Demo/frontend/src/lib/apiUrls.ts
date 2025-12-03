/**
 * API URL configuration
 *
 * In production: Routes all requests through the Cloudflare Worker coordinator at api.rmatool.org.uk
 * In development: Uses environment variables or defaults to localhost
 */

const COORDINATOR_URL = process.env.NEXT_PUBLIC_COORDINATOR_URL || 'https://api.rmatool.org.uk'

export const getApiUrl = (service: 'rag' | 'upload' | 'client-rag' | 'doc-processor' | 'notes') => {
  // Map service names to coordinator routes
  const routeMap: Record<string, string> = {
    'rag': '/api/rag/query',
    'upload': '/api/upload',
    'client-rag': '/api/client-rag/query',
    'doc-processor': '/api/doc-processor',
    'notes': '/api/notes',
  }
  
  return `${COORDINATOR_URL}${routeMap[service] || `/api/${service}`}`
}

export const API_URLS = {
  rag: () => getApiUrl('rag'),
  upload: () => getApiUrl('upload'),
  clientRag: () => getApiUrl('client-rag'),
  docProcessor: () => getApiUrl('doc-processor'),
  notes: () => getApiUrl('notes'),
}
