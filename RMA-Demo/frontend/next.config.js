/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  images: {
    unoptimized: true,
  },
  trailingSlash: true,
  // Skip validation for dynamic routes - they'll use fallback client-side routing
  experimental: {
    missingSuspenseWithCSRBailout: false,
  },
  // Remove API routes - they won't work with static export
  // All API calls will go directly to the coordinator
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'https://api.rmatool.org.uk',
  },
}

module.exports = nextConfig