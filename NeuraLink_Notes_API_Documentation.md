# 📝 灵枢笔记 (NeuraLink-Notes) - API接口文档

## 概述

灵枢笔记是一个基于AI的智能笔记管理平台，提供笔记本管理、文档上传处理、AI对话、向量化搜索等功能。系统采用NestJS后端框架，集成统一认证服务和设置管理。

## 基本信息

- **本地前端地址**: http://localhost:3001
- **外网访问地址**: https://www.cheman.top/notepads
- **后端地址**: http://localhost:4000
- **技术栈**: NestJS + Prisma + TypeScript + React
- **认证方式**: 统一设置服务JWT认证
- **数据库**: SQLite (Prisma ORM)

## 认证说明

所有API都需要在请求头中包含从统一设置服务获取的JWT Token：

```
Authorization: Bearer <your_jwt_token>
```

系统通过`UnifiedAuthGuard`验证token，并与统一设置服务通信验证用户身份。

## 统一设置服务集成

### 认证流程
1. 用户在前端登录统一设置服务
2. 获取JWT token后访问灵枢笔记API
3. 后端通过`UnifiedAuthService`验证token：
   - 缓存机制：5分钟内相同token直接返回缓存结果
   - 验证接口：`GET http://localhost:3002/api/auth/verify`
   - 用户信息接口：`GET http://localhost:3002/api/auth/me`
4. 自动同步用户到本地数据库（如果不存在则创建）

### 设置管理集成
系统通过`UnifiedSettingsService`与统一设置服务集成：
- LLM配置：从统一设置服务获取AI模型配置
- Embedding配置：向量化模型设置
- Reranking配置：搜索重排序设置
- 用户映射：邮箱到用户ID的映射机制

## API 接口文档

### 1. 笔记本管理 (/notebooks)

#### GET /notebooks
**描述**: 获取用户的所有笔记本  
**认证**: 需要  
**查询参数**: 
- `folderId` (可选): 按文件夹筛选

**响应**:
```json
[
  {
    "id": "notebook-id",
    "title": "笔记本标题",
    "description": "笔记本描述",
    "folderId": "folder-id",
    "userId": "user-id",
    "createdAt": "2025-01-30T10:00:00.000Z",
    "updatedAt": "2025-01-30T10:00:00.000Z"
  }
]
```

#### POST /notebooks
**描述**: 创建新笔记本  
**认证**: 需要  
**请求体**:
```json
{
  "title": "新笔记本标题",
  "description": "笔记本描述",
  "folderId": "folder-id"
}
```

**响应**: 创建的笔记本对象

#### GET /notebooks/:id
**描述**: 获取指定笔记本详情  
**认证**: 需要  
**路径参数**: `id` - 笔记本ID

**响应**: 笔记本对象

#### PATCH /notebooks/:id
**描述**: 更新笔记本信息  
**认证**: 需要  
**路径参数**: `id` - 笔记本ID  
**请求体**:
```json
{
  "title": "更新的标题",
  "description": "更新的描述",
  "folderId": "新的folder-id"
}
```

#### PUT /notebooks/:id
**描述**: 完整更新笔记本信息  
**认证**: 需要  
**参数和请求体**: 与PATCH相同

#### DELETE /notebooks/:id
**描述**: 删除笔记本  
**认证**: 需要  
**路径参数**: `id` - 笔记本ID

**响应**: 被删除的笔记本对象

#### GET /notebooks/:id/notesfile
**描述**: 获取笔记本的notes.json文件内容  
**认证**: 需要  
**路径参数**: `id` - 笔记本ID

**响应**:
```json
{
  "notes": "笔记内容字符串或null"
}
```

#### POST /notebooks/:id/notesfile
**描述**: 更新笔记本的notes.json文件内容  
**认证**: 需要  
**路径参数**: `id` - 笔记本ID  
**请求体**:
```json
{
  "notesContent": "新的笔记内容"
}
```

### 2. 文档管理 (/documents)

#### POST /documents/upload
**描述**: 上传文档文件  
**认证**: 需要  
**Content-Type**: multipart/form-data  
**查询参数**: 
- `notebookId` (必需): 笔记本ID

**表单字段**:
- `file`: 上传的文件 (最大100MB)
- `originalName` (可选): 原始文件名

**响应**: 创建的文档对象
```json
{
  "id": "document-id",
  "fileName": "文件名.pdf",
  "filePath": "/path/to/file",
  "notebookId": "notebook-id",
  "status": "pending",
  "statusMessage": null,
  "textContent": null,
  "createdAt": "2025-01-30T10:00:00.000Z"
}
```

#### GET /documents/notebook/:notebookId
**描述**: 获取指定笔记本的所有文档  
**认证**: 需要  
**路径参数**: `notebookId` - 笔记本ID

**响应**: 文档对象数组

#### GET /documents/:id
**描述**: 获取文档详情  
**认证**: 需要  
**路径参数**: `id` - 文档ID

**响应**: 文档对象

#### GET /documents/:id/content
**描述**: 获取文档的文本内容  
**认证**: 需要  
**路径参数**: `id` - 文档ID

**响应**: 文档的文本内容字符串

#### GET /documents/:id/raw
**描述**: 获取文档的原始文件内容  
**认证**: 需要  
**路径参数**: `id` - 文档ID

**响应**: 原始文件流（用于在浏览器中预览）

#### GET /documents/:id/download
**描述**: 下载原始文档文件  
**认证**: 需要  
**路径参数**: `id` - 文档ID

**响应**: 文件下载流

#### DELETE /documents/:id
**描述**: 删除文档  
**认证**: 需要  
**路径参数**: `id` - 文档ID

**响应**: 被删除的文档对象

#### PATCH /documents/:id/reprocess
**描述**: 重新处理文档  
**认证**: 需要  
**路径参数**: `id` - 文档ID

**响应**: 更新的文档对象

#### GET /documents/:id/status
**描述**: 获取文档处理状态  
**认证**: 需要  
**路径参数**: `id` - 文档ID

**响应**:
```json
{
  "id": "document-id",
  "status": "completed",
  "statusMessage": "处理完成",
  "filePath": "/path/to/file",
  "textContentExists": true,
  "fileExists": true
}
```

#### POST /documents/:id/vector-data
**描述**: 保存文档的向量数据  
**认证**: 需要  
**路径参数**: `id` - 文档ID  
**请求体**:
```json
{
  "vectorData": {
    "embeddings": [/* 向量数据 */],
    "chunks": [/* 文本块 */],
    "metadata": {/* 元数据 */}
  }
}
```

#### GET /documents/:id/vector-data
**描述**: 获取文档的向量数据  
**认证**: 需要  
**路径参数**: `id` - 文档ID

**响应**: 向量数据对象或null

### 3. 统一设置集成 (/unified-settings)

#### GET /unified-settings/default-models
**描述**: 获取默认AI模型配置  
**认证**: 需要

**响应**:
```json
{
  "success": true,
  "data": {
    "builtin_free": {
      "provider": "openrouter",
      "api_key": "sk-or-xxx",
      "model_name": "deepseek/deepseek-chat-v3-0324:free"
    }
  }
}
```

#### GET /unified-settings/llm
**描述**: 获取LLM设置（从统一设置服务）  
**认证**: 需要

**响应**:
```json
{
  "success": true,
  "data": {
    "current_provider": "openai",
    "providers": {
      "openai": {
        "api_key": "sk-xxx",
        "model_name": "gpt-3.5-turbo",
        "base_url": "https://api.openai.com/v1",
        "use_custom_model": false,
        "updated_at": "2025-01-30T10:00:00.000Z"
      }
    }
  }
}
```

#### POST /unified-settings/llm
**描述**: 保存LLM设置  
**认证**: 需要  
**请求体**:
```json
{
  "provider": "openai",
  "settings": {
    "api_key": "sk-xxx",
    "model_name": "gpt-4",
    "base_url": "https://api.openai.com/v1",
    "use_custom_model": false
  }
}
```

#### GET /unified-settings/embedding
**描述**: 获取Embedding设置  
**认证**: 需要

**响应**:
```json
{
  "success": true,
  "data": {
    "provider": "openai",
    "model": "text-embedding-ada-002",
    "api_key": "sk-xxx",
    "base_url": "https://api.openai.com/v1"
  }
}
```

#### POST /unified-settings/embedding
**描述**: 保存Embedding设置  
**认证**: 需要  
**请求体**: Embedding配置对象

#### GET /unified-settings/reranking
**描述**: 获取Reranking设置  
**认证**: 需要

#### POST /unified-settings/reranking
**描述**: 保存Reranking设置  
**认证**: 需要

### 4. 文件夹管理 (/folders)

基于标准CRUD操作，包括：
- `GET /folders` - 获取文件夹列表
- `POST /folders` - 创建文件夹
- `GET /folders/:id` - 获取文件夹详情
- `PATCH /folders/:id` - 更新文件夹
- `DELETE /folders/:id` - 删除文件夹

### 5. 笔记管理 (/notes)

提供笔记的CRUD操作：
- `GET /notes` - 获取笔记列表
- `POST /notes` - 创建笔记
- `GET /notes/:id` - 获取笔记详情
- `PATCH /notes/:id` - 更新笔记
- `DELETE /notes/:id` - 删除笔记

### 6. 记事本功能 (/notepad)

简单的记事本功能，支持快速文本记录。

### 7. 备份管理 (/backup)

数据备份和恢复功能：
- 自动备份调度
- 手动备份触发
- 备份文件管理

### 8. 同步服务 (/sync)

数据同步功能：
- 跨设备数据同步
- 冲突解决机制

### 9. 文件上传 (/upload)

通用文件上传服务：
- 支持多种文件格式
- 文件大小限制
- 安全性验证

### 10. 代理服务 (/proxy)

为前端提供API代理服务，避免跨域问题。

## 客户端集成示例

### React Hook示例

```javascript
import { useState, useEffect } from 'react';
import axios from 'axios';

export function useNeuraLinkNotes() {
  const [token, setToken] = useState(localStorage.getItem('auth_token'));
  const [notebooks, setNotebooks] = useState([]);
  const [documents, setDocuments] = useState([]);

  const api = axios.create({
    baseURL: 'http://localhost:4000',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });

  // 获取笔记本列表
  const fetchNotebooks = async (folderId) => {
    try {
      const response = await api.get('/notebooks', {
        params: { folderId }
      });
      setNotebooks(response.data);
      return response.data;
    } catch (error) {
      console.error('获取笔记本失败:', error);
      throw error;
    }
  };

  // 创建笔记本
  const createNotebook = async (notebookData) => {
    try {
      const response = await api.post('/notebooks', notebookData);
      await fetchNotebooks(); // 刷新列表
      return response.data;
    } catch (error) {
      console.error('创建笔记本失败:', error);
      throw error;
    }
  };

  // 上传文档
  const uploadDocument = async (notebookId, file, originalName) => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      if (originalName) {
        formData.append('originalName', originalName);
      }

      const response = await api.post(`/documents/upload?notebookId=${notebookId}`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      return response.data;
    } catch (error) {
      console.error('上传文档失败:', error);
      throw error;
    }
  };

  // 获取文档列表
  const fetchDocuments = async (notebookId) => {
    try {
      const response = await api.get(`/documents/notebook/${notebookId}`);
      setDocuments(response.data);
      return response.data;
    } catch (error) {
      console.error('获取文档失败:', error);
      throw error;
    }
  };

  // 获取文档内容
  const fetchDocumentContent = async (documentId) => {
    try {
      const response = await api.get(`/documents/${documentId}/content`);
      return response.data;
    } catch (error) {
      console.error('获取文档内容失败:', error);
      throw error;
    }
  };

  // 获取LLM设置
  const fetchLLMSettings = async () => {
    try {
      const response = await api.get('/unified-settings/llm');
      return response.data;
    } catch (error) {
      console.error('获取LLM设置失败:', error);
      throw error;
    }
  };

  // 保存LLM设置
  const saveLLMSettings = async (provider, settings) => {
    try {
      const response = await api.post('/unified-settings/llm', {
        provider,
        settings
      });
      return response.data;
    } catch (error) {
      console.error('保存LLM设置失败:', error);
      throw error;
    }
  };

  return {
    notebooks,
    documents,
    fetchNotebooks,
    createNotebook,
    uploadDocument,
    fetchDocuments,
    fetchDocumentContent,
    fetchLLMSettings,
    saveLLMSettings
  };
}
```

### 使用示例

```javascript
function NotebookManager() {
  const {
    notebooks,
    fetchNotebooks,
    createNotebook,
    uploadDocument
  } = useNeuraLinkNotes();

  useEffect(() => {
    fetchNotebooks();
  }, []);

  const handleCreateNotebook = async () => {
    try {
      await createNotebook({
        title: '新笔记本',
        description: '这是一个新的笔记本',
        folderId: null
      });
      alert('笔记本创建成功！');
    } catch (error) {
      alert('创建失败：' + error.message);
    }
  };

  const handleFileUpload = async (notebookId, files) => {
    try {
      for (const file of files) {
        await uploadDocument(notebookId, file);
      }
      alert('文件上传成功！');
    } catch (error) {
      alert('上传失败：' + error.message);
    }
  };

  return (
    <div>
      <button onClick={handleCreateNotebook}>创建笔记本</button>
      {notebooks.map(notebook => (
        <div key={notebook.id}>
          <h3>{notebook.title}</h3>
          <input
            type="file"
            multiple
            onChange={(e) => handleFileUpload(notebook.id, e.target.files)}
          />
        </div>
      ))}
    </div>
  );
}
```

## 核心特性

### 智能文档处理
- **多格式支持**: PDF, DOC, TXT, MD等多种文档格式
- **自动文本提取**: 智能提取文档文本内容
- **异步处理**: 后台异步处理大文件，实时状态更新
- **重新处理**: 支持文档重新处理功能

### AI集成功能
- **统一LLM配置**: 集成多种AI模型提供商（OpenAI, Claude等）
- **向量化存储**: 文档向量化处理，支持语义搜索
- **智能重排序**: AI重排序提高搜索准确性
- **配置共享**: 与其他应用共享AI配置

### 用户体验
- **文件名处理**: 智能处理中文文件名编码问题
- **实时状态**: 文档处理状态实时更新
- **安全下载**: 安全的文件访问和下载机制
- **权限控制**: 基于用户的数据隔离

### 系统集成
- **统一认证**: 与统一设置服务无缝集成
- **自动用户同步**: 用户信息自动同步到本地数据库
- **配置共享**: 跨应用配置共享
- **缓存优化**: 5分钟token缓存提高性能

## 错误码说明

| 状态码 | 说明 |
|--------|------|
| 200 | 请求成功 |
| 201 | 创建成功 |
| 400 | 请求参数错误 |
| 401 | 未认证或Token无效 |
| 403 | 权限不足 |
| 404 | 资源不存在 |
| 413 | 文件过大 |
| 500 | 服务器内部错误 |

## 部署配置

### 环境变量
```env
PORT=4000
DATABASE_URL="file:./dev.db"
UNIFIED_SETTINGS_SERVICE_URL=http://localhost:3002
UPLOAD_PATH=./uploads
MAX_FILE_SIZE=104857600  # 100MB
```

### 数据库配置
- **ORM**: Prisma
- **数据库**: SQLite
- **迁移**: `npx prisma migrate dev`
- **生成客户端**: `npx prisma generate`

### 文件存储
- **上传目录**: `./uploads`
- **向量数据**: JSON文件存储
- **文档处理**: 异步队列处理

## 外网部署架构

### Cloudflare Tunnel配置

系统通过Cloudflare Tunnel提供外网访问，配置文件：`/home/jason/code/cloudflared-config.yml`

```yaml
tunnel: jason-notepads
ingress:
  # NeuraLink-Notes 灵枢笔记路由
  - hostname: www.cheman.top
    path: /notepads*
    service: http://localhost:8081
  
  # 向后兼容jason子域名
  - hostname: jason.cheman.top
    path: /notepads*
    service: http://localhost:8081
```

### Nginx反向代理配置

本地nginx监听8081端口，配置文件：`/home/jason/code/nginx.conf`

#### NeuraLink API代理
```nginx
# NeuraLink API - 处理 /notepads/api/ 路径
location ~ ^/notepads/api/ {
    rewrite ^/notepads/api/(.*) /api/$1 break;
    proxy_pass http://127.0.0.1:3001;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}

# NeuraLink API - 处理通用 /api/ 路径
location ~ ^/api/(notebooks|unified-settings|notes|folders|files|search|chat|documents|upload|richnotes|settings|proxy) {
    proxy_pass http://127.0.0.1:3001;
    # 文件上传支持
    client_max_body_size 100M;
}
```

#### NeuraLink前端代理（支持WebSocket）
```nginx
# NeuraLink 笔记 - 保持 /notepads 前缀，直接代理
location /notepads/ {
    proxy_pass http://127.0.0.1:3000;
    # WebSocket支持  
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
}

# NeuraLink 静态资源 - 处理 /notepads/_next/ 路径
location ~ ^/notepads/_next/ {
    proxy_pass http://127.0.0.1:3000;
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```

#### 特殊路由处理
```nginx
# NeuraLink 笔记本详情页面 - 处理 /folderName/notebookName 路径
location ~ ^/(?!calendars|notepads|unified-settings|auth|api|_next)[^/]+/[^/]+/?$ {
    proxy_pass http://127.0.0.1:3000;
    # WebSocket支持
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
}
```

### API地址映射 (最新架构)

| 环境 | 前端地址 | API地址 | 架构说明 |
|------|----------|---------|----------|
| 本地开发 | http://localhost:3001 | http://localhost:4000 | 本地开发环境 |
| **主域名访问** | https://www.cheman.top/notepads | https://www.cheman.top/notepads/api | **Cloudflare Tunnel + Nginx** |
| Legacy访问 | http://jason.cheman.top/notepads | http://jason.cheman.top/notepads/api | 向后兼容 |
| Docker端口 | http://jason.cheman.top/3001 | http://jason.cheman.top/4000 | Docker部署方式 |

### 最新部署架构访问流程

#### 主域名访问流程 (推荐)
1. **用户访问** → `https://www.cheman.top/notepads`
2. **Cloudflare Tunnel** → 转发到 `http://localhost:8081/notepads`
3. **Nginx主代理** → 根据路径转发：
   - `/notepads/api/*` → `http://127.0.0.1:4000/api/*` (后端API)
   - `/api/*` → `http://127.0.0.1:4000/*` (后端API - 通用路径)
   - `/notepads/*` → `http://127.0.0.1:3001/*` (前端应用)
   - `/folderName/notebookName` → `http://127.0.0.1:3001/*` (笔记本详情页)
4. **应用服务** → 处理请求并返回响应

#### Docker端口访问流程 (向后兼容)
1. **用户访问** → `http://jason.cheman.top/3001` 或 `http://jason.cheman.top/4000`
2. **Cloudflare Tunnel** → 转发到 `http://localhost:8081/3001`
3. **Nginx Docker代理** → 端口号路由：
   - `/(\d+)/(.*)` → `http://192.168.10.172:$1/$2` (内网Docker服务)
4. **Docker NestJS/React服务** → 处理请求并返回响应

#### 架构特点
- **统一入口**: 所有服务通过同一个Cloudflare Tunnel进入
- **智能路由**: Nginx根据域名和路径自动选择代理方式
- **多重兼容**: 支持主域名、Legacy域名、Docker端口三种访问方式
- **特殊路由**: 支持笔记本详情页的动态路由匹配

### 统一认证集成

系统通过统一设置服务进行认证，外网访问时的认证流程：

```javascript
// 统一认证服务API地址
const authServiceUrl = 'https://www.cheman.top/unified-settings/api/auth';

// 登录流程
async function login(email, password) {
  const response = await fetch(`${authServiceUrl}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  
  const result = await response.json();
  if (result.token) {
    localStorage.setItem('auth_token', result.token);
    // 后续API调用都会使用这个token
  }
}
```

---

**版本**: v1.0.0  
**更新时间**: 2025-01-30  
**作者**: Jason  
**服务地址**: http://localhost:4000