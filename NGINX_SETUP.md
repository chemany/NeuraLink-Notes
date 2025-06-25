# Notebook LM Clone - Nginx 代理配置说明

## 🔧 架构概览

```
外网请求 → Nginx (8081) → 内网服务
├── /notebooks/ → localhost:3000 (前端)
└── /notebooks/api/ → localhost:3001/api/ (后端)
```

## 📋 修复要点

### 1. **Next.js 配置修复**

**问题**: `basePath: '/notebooks'` 在nginx代理环境下会导致路径冲突

**解决方案**: 
- ✅ 注释掉 `basePath: '/notebooks'`
- ✅ 修改 rewrites 规则仅在开发环境生效

**文件**: `frontend/next.config.js`

### 2. **API 客户端配置修复**

**问题**: API路径配置不适合nginx代理环境

**解决方案**:
- ✅ 动态检测当前路径
- ✅ 在 `/notebooks/` 路径下使用 `/notebooks/api` 作为API基础路径

**文件**: `frontend/src/services/apiClient.ts`

## 🚀 部署步骤

### 1. 启动服务
```bash
# 运行启动脚本
C:\code\notebook-lm-clone\start-services.bat
```

或手动启动：
```bash
# 后端 (3001端口)
cd C:\code\notebook-lm-clone\backend
npm run start:dev

# 前端 (3000端口)
cd C:\code\notebook-lm-clone\frontend  
npm run dev
```

### 2. 验证服务状态
```bash
netstat -ano | findstr ":3000\|:3001"
```

### 3. 测试访问
- **本地开发**: http://localhost:3000
- **Nginx代理**: http://localhost:8081/notebooks/
- **外网访问**: http://your-domain:8081/notebooks/

## 🔍 请求流程分析

### 前端页面请求
1. 用户访问: `your-domain:8081/notebooks/`
2. Nginx匹配: `location /notebooks/`
3. 代理到: `localhost:3000/`
4. 前端正常加载

### API请求流程
1. 前端发起: `GET /notebooks/api/notebooks`
2. 浏览器解析: `your-domain:8081/notebooks/api/notebooks`
3. Nginx匹配: `location ~* ^/notebooks/api/`
4. 重写URL: `/notebooks/api/notebooks` → `/api/notebooks`
5. 代理到: `localhost:3001/api/notebooks`
6. 后端处理: NestJS收到 `/api/notebooks` 请求

## 📝 Nginx 配置要点

```nginx
# API代理 - 必须在前端代理之前
location ~* ^/notebooks/api/ {
    rewrite ^/notebooks/api/(.*)$ /api/$1 break;
    proxy_pass http://127.0.0.1:3001;
    # ... 其他代理头配置
}

# 前端代理
location /notebooks/ {
    proxy_pass http://127.0.0.1:3000;
    # ... 其他代理头配置
}
```

## ⚠️ 常见问题

### 1. 404 错误
- 检查服务是否在3000/3001端口运行
- 确认nginx配置正确加载

### 2. API调用失败
- 检查浏览器控制台的网络请求
- 确认API路径是否正确

### 3. 静态资源加载失败
- 确认没有设置错误的basePath
- 检查nginx的静态文件处理

## 🎯 测试清单

- [ ] 后端服务运行在3001端口
- [ ] 前端服务运行在3000端口  
- [ ] nginx配置已更新并重启
- [ ] 本地访问 localhost:8081/notebooks/ 正常
- [ ] API请求能正确到达后端
- [ ] 用户登录和数据加载正常 