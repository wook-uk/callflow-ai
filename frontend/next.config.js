const path = require('path')

/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
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
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': path.resolve(__dirname, 'src'),
    }
    return config
  },
}

module.exports = nextConfig
