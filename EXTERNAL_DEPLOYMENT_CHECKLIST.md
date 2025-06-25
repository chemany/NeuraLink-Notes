# 灵枢笔记系统 - 外网部署清单

## ✅ 配置完成状态

### 🎯 项目配置 (已完成)
- ✅ **Next.js配置**: `basePath: '/notepads'` 已设置
- ✅ **API客户端**: 动态环境检测已配置
- ✅ **Nginx配置**: 本地nginx.conf已包含完整配置
- ✅ **CORS设置**: 已修复并完善
- ✅ **静态资源**: Next.js资源代理已配置

### 🚀 外网部署所需步骤

#### 1. 复制Nginx配置到外网服务器
将以下配置段添加到您的外网nginx配置中：

```nginx
# ==================== 灵枢笔记系统配置 ====================
# 笔记本应用 API 代理规则
location ~ ^/notepads/[Aa][Pp][Ii]/ {
    rewrite ^/notepads/[Aa][Pp][Ii]/(.*)$ /api/$1 break;
    proxy_pass http://127.0.0.1:3001;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    
    add_header Access-Control-Allow-Origin * always;
    add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS" always;
    add_header Access-Control-Allow-Headers "Origin, X-Requested-With, Content-Type, Accept, Authorization" always;
    
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

# 笔记本静态资源代理
location ~* ^/notepads/_next/ {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    expires 1y;
    add_header Cache-Control "public, immutable";
}

# 笔记本前端页面代理
location = /notepads {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_redirect off;
    proxy_buffering off;
}

location /notepads/ {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_http_version 1.1;
    proxy_cache_bypass $http_upgrade;
    proxy_redirect off;
    proxy_buffering off;
}
```

#### 2. 启动服务
```bash
# 后端 (端口3001)
cd /path/to/notebook-lm-clone/backend
npm run start:prod

# 前端 (端口3000)
cd /path/to/notebook-lm-clone/frontend  
npm run build
npm run start
```

#### 3. 重启Nginx
```bash
nginx -t          # 测试配置
nginx -s reload   # 重新加载
```

## 🔍 测试点

### 基础访问测试
- [ ] `http://your-domain.com/notepads/` - 前端页面加载
- [ ] `http://your-domain.com/notepads/api/auth/check` - API健康检查

### 功能测试
- [ ] 用户登录/注册
- [ ] 创建笔记本
- [ ] AI聊天功能
- [ ] 保存AI回答到笔记本
- [ ] 富文本编辑器功能
- [ ] 文件上传功能

### 格式测试 (最新修复)
- [ ] AI回答的markdown格式正确转换为HTML
- [ ] 标题顶格显示（无缩进）
- [ ] 正文段落首行缩进2个字符
- [ ] 列表和引用块格式正确

## 🚨 故障排除

### 如果页面无法访问
1. 检查服务状态：`netstat -tulpn | grep :3000` 和 `netstat -tulpn | grep :3001`
2. 检查nginx日志：`tail -f /var/log/nginx/error.log`
3. 确认防火墙设置

### 如果API调用失败
1. 打开浏览器F12 → Network标签
2. 查看API请求的实际URL和状态码
3. 检查CORS配置是否正确

### 如果格式显示异常
1. 检查浏览器控制台是否有CSS相关错误
2. 确认前端构建包含最新的格式修复代码
3. 清除浏览器缓存后重试

## 📋 关键配置文件

- **Nginx配置**: `/etc/nginx/nginx.conf` 或您的nginx配置路径
- **前端配置**: `frontend/next.config.js` (已完成)
- **API客户端**: `frontend/src/services/apiClient.ts` (已完成)
- **格式工具**: `frontend/src/utils/markdownToHtml.ts` (已完成)

## 🎉 部署完成

当所有测试点都通过后，您的灵枢笔记系统就可以正常通过外网访问了！

**访问地址**: `http://your-domain.com/notepads/`

---

**注意**: 将 `your-domain.com` 替换为您的实际域名或IP地址。 