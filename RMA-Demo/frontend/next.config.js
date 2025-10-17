/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  env: {
    NOTES_SERVICE_URL: process.env.NOTES_SERVICE_URL || 'http://localhost:8100',
    DOC_PROCESSOR_URL: process.env.DOC_PROCESSOR_URL || 'http://localhost:8101',
    RAG_SERVICE_URL: process.env.RAG_SERVICE_URL || 'http://localhost:8102',
    UPLOAD_SERVICE_URL: process.env.UPLOAD_SERVICE_URL || 'http://localhost:8103',
  },
}

module.exports = nextConfig
