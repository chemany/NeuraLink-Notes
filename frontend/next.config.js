/** @type {import('next').NextConfig} */
const path = require('path');

const nextConfig = {
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
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin',
          },
          {
            key: 'Cross-Origin-Embedder-Policy',
            value: 'require-corp',
          },
        ],
      },
    ];
  },

  // --- 添加 API 代理配置 ---
  async rewrites() {
    return [
      {
        source: '/api/:path*', // 匹配所有 /api 开头的请求
        // FIX: 确保 destination 指向你 NestJS 后端的正确地址和端口 (默认为 3001)
        destination: 'http://localhost:3001/api/:path*', 
      },
    ]
  },
  // --- 结束 API 代理配置 ---
}

module.exports = nextConfig; 