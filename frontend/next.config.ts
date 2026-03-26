// next.config.ts
import type { NextConfig } from 'next'

const config: NextConfig = {
  async rewrites() {
    // In dev: proxy /api/* to FastAPI backend
    return process.env.NODE_ENV === 'development'
      ? [{ source: '/api/:path*', destination: 'http://localhost:8000/api/:path*' }]
      : []
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      { protocol: 'https', hostname: '*.r2.cloudflarestorage.com' },
    ],
  },
}

export default config
