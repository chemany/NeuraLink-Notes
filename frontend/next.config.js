/** @type {import('next').NextConfig} */
const path = require('path');

const nextConfig = {
  // 启用 basePath 用于代理环境
  basePath: '/notepads',
  assetPrefix: '/notepads',
  trailingSlash: true,
  reactStrictMode: true,
  swcMinify: true,
  
  // 性能优化配置
  experimental: {
    optimizeCss: true, // CSS优化
    scrollRestoration: true, // 滚动位置恢复
  },
  
  // 图片优化配置
  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60,
  },
  
  // 编译优化
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error', 'warn'],
    } : false,
  },
  webpack: (config, { isServer }) => {
    // 处理PDF.js的canvas依赖问题
    if (isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        canvas: path.resolve(__dirname, 'src/mocks/canvasMock.js'),
      };
    }
    
    // 允许加载外部 worker 脚本
    config.resolve.alias.canvas = false;
    
    return config;
  },
  // 配置安全策略以允许加载 PDF worker
  // 暂时禁用CORS头，避免在HTTP环境下的警告
  // async headers() {
  //   return [
  //     {
  //       source: '/:path*',
  //       headers: [
  //         {
  //           key: 'Cross-Origin-Opener-Policy',
  //           value: 'same-origin',
  //         },
  //         {
  //           key: 'Cross-Origin-Embedder-Policy',
  //           value: 'require-corp',
  //         },
  //       ],
  //     },
  //   ];
  // },

  // Re-enable rewrites for local development proxying
  async rewrites() {
    const rewrites = [];
    
    // 在nginx代理环境下，不需要Next.js的重写规则
    // nginx会处理 /notebooks/api/* 到后端的代理
    if (process.env.NODE_ENV === 'development') {
      rewrites.push({
        source: '/api/:path*',
        destination: `${process.env.BACKEND_API_URL || 'http://localhost:3001/api'}/:path*`,
      });
    }
    
    // 添加开发工具相关的重写规则，避免404错误
    rewrites.push(
      // 静默处理Chrome开发工具请求
      {
        source: '/.well-known/:path*',
        destination: '/api/dev-tools-silence', // 返回空响应
      },
      // 处理source map请求
      {
        source: '/:path*\\.map',
        destination: '/api/dev-tools-silence',
      },
      // 处理favicon请求 - 重定向到存在的图标
      {
        source: '/notepads/favicon.svg',
        destination: '/favicon-alt.svg', // 重定向到我们创建的SVG图标
      },
      // 处理manifest请求
      {
        source: '/notepads/manifest.json',
        destination: '/manifest.json',
      }
    );
    
    return rewrites;
  },
}

module.exports = nextConfig; 