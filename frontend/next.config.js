/** @type {import('next').NextConfig} */
const path = require('path');

const nextConfig = {
  // 启用 basePath 用于代理环境
  basePath: '/notepads',
  assetPrefix: '/notepads',
  trailingSlash: true,
  reactStrictMode: true,
  swcMinify: true,
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
      }
    );
    
    return rewrites;
  },
}

module.exports = nextConfig; 