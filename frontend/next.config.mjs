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
        source: '/api/deploy/:path*',
        destination: `${SPRING_URL}/api/deploy/:path*`,
      },
      {
        source: '/api/history',
        destination: `${SPRING_URL}/api/history`,
      },
      {
        source: '/api/history/:path*',
        destination: `${SPRING_URL}/api/history/:path*`,
      },
      {
        source: '/api/cuves',
        destination: `${SPRING_URL}/api/cuves`,
      },
      {
        source: '/api/cuves/:path*',
        destination: `${SPRING_URL}/api/cuves/:path*`,
      },
      {
        source: '/api/lots',
        destination: `${SPRING_URL}/api/lots`,
      },
      {
        source: '/api/lots/:path*',
        destination: `${SPRING_URL}/api/lots/:path*`,
      },
      {
        source: '/api/stockages',
        destination: `${SPRING_URL}/api/stockages`,
      },
      {
        source: '/api/stockages/:path*',
        destination: `${SPRING_URL}/api/stockages/:path*`,
      },
      {
        source: '/api/operations',
        destination: `${SPRING_URL}/api/operations`,
      },
      {
        source: '/api/operations/:path*',
        destination: `${SPRING_URL}/api/operations/:path*`,
      },
      {
        source: '/api/referentiels/:path*',
        destination: `${FASTAPI_URL}/api/referentiels/:path*`,
      },
      {
        source: '/api/:path*',
        destination: `${FASTAPI_URL}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
