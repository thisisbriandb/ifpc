/** @type {import('next').NextConfig} */
const SPRING_URL = process.env.SPRING_URL || 'http://localhost:8080';
const FASTAPI_URL = process.env.FASTAPI_URL || 'http://localhost:8000';

const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/auth/:path*',
        destination: `${SPRING_URL}/api/auth/:path*`,
      },
      {
        source: '/api/admin/:path*',
        destination: `${SPRING_URL}/api/admin/:path*`,
      },
      {
        source: '/api/config/:path*',
        destination: `${SPRING_URL}/api/config/:path*`,
      },
      {
        source: '/api/history/:path*',
        destination: `${SPRING_URL}/api/history/:path*`,
      },
      {
        source: '/api/:path*',
        destination: `${FASTAPI_URL}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
