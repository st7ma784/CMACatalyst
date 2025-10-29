/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  env: {
    NOTES_SERVICE_URL: process.env.NOTES_SERVICE_URL || 'http://localhost:8100',
    DOC_PROCESSOR_URL: process.env.DOC_PROCESSOR_URL || 'http://localhost:8101',
    RAG_SERVICE_URL: process.env.RAG_SERVICE_URL || 'http://localhost:8102',
    UPLOAD_SERVICE_URL: process.env.UPLOAD_SERVICE_URL || 'http://localhost:8103',
  },
  async rewrites() {
    return [
      {
        source: '/api/rag/:path*',
        destination: 'http://rag-service:8102/:path*',
      },
      {
        source: '/api/upload/:path*',
        destination: 'http://upload-service:8103/:path*',
      },
      {
        source: '/api/client-rag/:path*',
        destination: 'http://client-rag-service:8104/:path*',
      },
      {
        source: '/api/doc-processor/:path*',
        destination: 'http://doc-processor:8101/:path*',
      },
      {
        source: '/api/notes/:path*',
        destination: 'http://notes-service:8100/:path*',
      },
    ]
  },
}

module.exports = nextConfig
