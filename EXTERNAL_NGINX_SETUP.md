# 灵枢笔记系统 - 外网Nginx代理配置指南

## 🌐 外网部署架构

```
外网用户请求 → Nginx (80/443) → 内网服务
├── /notepads/ → localhost:3000 (前端)
└── /notepads/api/ → localhost:3001/api/ (后端)
```

## 📋 外网部署配置要点

### 1. **Nginx配置添加**

在您现有的nginx配置文件中添加以下配置段：

```nginx
# ==================== 灵枢笔记系统配置 ====================
server {
    listen 80;
    listen 443 ssl;  # 如果需要HTTPS
    server_name your-domain.com;  # 替换为您的域名
    
    # SSL配置（如果需要HTTPS）
    # ssl_certificate /path/to/your/certificate.crt;
    # ssl_certificate_key /path/to/your/private.key;
    
    # 设置客户端最大上传文件大小为100MB
    client_max_body_size 100M;
    
    # ==================== 笔记本系统 API 代理规则 ====================
    # 匹配所有 /notepads/api/ 开头的请求（支持大小写）
    # 注意：API规则必须放在前端页面规则的前面，确保优先匹配！
    location ~ ^/notepads/[Aa][Pp][Ii]/ {
        # 关键：重写URL，去掉/notepads/api前缀，保留api前缀给后端
        # 因为后端使用了全局前缀 'api'，所以需要保留 /api/ 路径
        rewrite ^/notepads/[Aa][Pp][Ii]/(.*)$ /api/$1 break;
        
        # 将重写后的请求代理到笔记本后端的3001端口
        proxy_pass http://127.0.0.1:3001;

        # 设置必要的代理头信息
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # 添加 CORS 头信息支持
        add_header Access-Control-Allow-Origin * always;
        add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS" always;
        add_header Access-Control-Allow-Headers "Origin, X-Requested-With, Content-Type, Accept, Authorization" always;
        
        # 处理 OPTIONS 预检请求
        if ($request_method = 'OPTIONS') {
            add_header Access-Control-Allow-Origin * always;
            add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS" always;
            add_header Access-Control-Allow-Headers "Origin, X-Requested-With, Content-Type, Accept, Authorization" always;
            add_header Access-Control-Max-Age 1728000;
            add_header Content-Type 'text/plain charset=UTF-8';
            add_header Content-Length 0;
            return 204;
        }
    }

    # ==================== 笔记本前端页面代理规则 ====================
    # 处理 /notepads 不带斜杠的情况
    location = /notepads {
        # 直接代理，不进行重定向
        proxy_pass http://127.0.0.1:3000;
        
        # 设置代理头信息
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # 关键：禁用nginx的重定向处理，让前端处理
        proxy_redirect off;
        proxy_buffering off;
    }
    
    # 匹配所有 /notepads/ 开头的请求（非API请求）
    # 保持完整路径，因为前端设置了 basePath: '/notepads'
    location /notepads/ {
        # 直接代理，保持完整路径给前端处理
        # 前端的basePath会正确处理 /notepads/ 前缀
        proxy_pass http://127.0.0.1:3000;
        
        # 设置代理头信息
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # 支持 WebSocket 连接 (Next.js热重载)
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_http_version 1.1;
        proxy_cache_bypass $http_upgrade;
        
        # 关键：禁用nginx的重定向处理，让前端处理
        proxy_redirect off;
        proxy_buffering off;
    }

    # ==================== Next.js静态资源代理规则 ====================
    # 处理Next.js的静态资源
    location ~* ^/notepads/_next/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # 设置缓存
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

### 2. **当前项目配置检查**

您的项目配置已经适配了nginx代理环境，但需要确认以下几点：

#### ✅ Next.js配置 (`frontend/next.config.js`)
- `basePath: '/notepads'` ✅ 已配置
- 重写规则仅在开发环境生效 ✅ 已配置

#### ✅ API客户端配置 (`frontend/src/services/apiClient.ts`)
- 动态检测环境 ✅ 已配置
- 外网环境使用 `/notepads/api` ✅ 已配置

## 🚀 部署步骤

### 1. 启动内网服务
```bash
# 启动后端服务 (端口3001)
cd /path/to/notebook-lm-clone/backend
npm run start:prod  # 生产环境建议使用 start:prod

# 启动前端服务 (端口3000)
cd /path/to/notebook-lm-clone/frontend
npm run build      # 构建生产版本
npm run start      # 启动生产服务
```

### 2. 配置Nginx
1. 将上述配置添加到您的nginx配置文件中
2. 替换 `your-domain.com` 为您的实际域名
3. 如果需要HTTPS，配置SSL证书路径
4. 重新加载nginx配置：
   ```bash
   nginx -t          # 测试配置文件语法
   nginx -s reload   # 重新加载配置
   ```

### 3. 测试访问
- **外网访问**: `http://your-domain.com/notepads/`
- **API测试**: `http://your-domain.com/notepads/api/auth/check`

## 🔍 请求流程分析

### 前端页面请求
1. 用户访问: `your-domain.com/notepads/`
2. Nginx匹配: `location /notepads/`
3. 代理到: `localhost:3000/notepads/`
4. Next.js basePath处理: 正确显示页面

### API请求流程
1. 前端发起: `GET /notepads/api/notebooks`
2. 浏览器解析: `your-domain.com/notepads/api/notebooks`
3. Nginx匹配: `location ~ ^/notepads/[Aa][Pp][Ii]/`
4. 重写URL: `/notepads/api/notebooks` → `/api/notebooks`
5. 代理到: `localhost:3001/api/notebooks`
6. 后端处理: NestJS收到 `/api/notebooks` 请求

## ⚠️ 注意事项

### 1. **端口安全**
- 确保3000和3001端口只在内网监听
- 不要将这些端口直接暴露到外网

### 2. **HTTPS配置**
- 生产环境建议使用HTTPS
- 配置SSL证书和密钥文件路径
- 添加HTTP到HTTPS的重定向

### 3. **防火墙配置**
- 确保外网可以访问nginx监听的端口（80/443）
- 内网端口（3000/3001）应该只允许本地访问

### 4. **性能优化**
```nginx
# 在http块中添加以下配置优化性能
gzip on;
gzip_vary on;
gzip_min_length 1024;
gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;

# 缓存静态文件
location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
    add_header Vary Accept-Encoding;
}
```

## 🎯 测试清单

- [ ] 后端服务运行在3001端口
- [ ] 前端服务运行在3000端口
- [ ] nginx配置已更新并重启
- [ ] 外网访问 `your-domain.com/notepads/` 正常
- [ ] API请求能正确到达后端
- [ ] 用户登录和数据加载正常
- [ ] 文件上传功能正常
- [ ] WebSocket连接正常（如果使用）

## 🔧 故障排除

### 1. 404错误
```bash
# 检查服务状态
netstat -tulpn | grep :3000
netstat -tulpn | grep :3001

# 检查nginx日志
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log
```

### 2. API调用失败
- 检查浏览器控制台的网络请求
- 确认API路径是否正确
- 检查CORS配置

### 3. 静态资源加载失败
- 确认Next.js构建成功
- 检查basePath配置
- 验证nginx的静态文件处理规则

## 📞 联系支持

如果在部署过程中遇到问题，请提供：
1. nginx错误日志
2. 浏览器控制台错误信息
3. 网络请求详情（F12 Network标签）
4. 服务运行状态确认

---

**版本**: v1.0.0  
**更新时间**: 2024年12月  
**适用环境**: 外网nginx代理部署 