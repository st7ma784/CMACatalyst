/**
 * API URL configuration
 *
 * Uses Next.js API proxy routes to avoid CORS issues with Docker rootless networking.
 * All API calls should use these URLs instead of directly accessing backend services.
 */

export const getApiUrl = (service: 'rag' | 'upload' | 'client-rag' | 'doc-processor' | 'notes') => {
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/api/${service}`
  }
  return `/api/${service}`
}

export const API_URLS = {
  rag: () => getApiUrl('rag'),
  upload: () => getApiUrl('upload'),
  clientRag: () => getApiUrl('client-rag'),
  docProcessor: () => getApiUrl('doc-processor'),
  notes: () => getApiUrl('notes'),
}
