/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath: '/notepads',
  assetPrefix: '/notepads',
  trailingSlash: true,
  reactStrictMode: true,
  swcMinify: true,
  
  // 关键性能优化
  poweredByHeader: false,
  compress: true,
  
  // 图片优化
  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60,
  },
  
  // 编译优化 - 只保留关键配置
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error', 'warn'],
    } : false,
  },
  
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.BACKEND_API_URL || 'http://localhost:3001/api'}/:path*`,
      },
      {
        source: '/notepads/api/:path*',
        destination: `${process.env.BACKEND_API_URL || 'http://localhost:3001/api'}/:path*`,
      },
    ];
  },
}

module.exports = nextConfig;