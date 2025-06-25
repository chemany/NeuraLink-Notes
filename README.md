# 🧠 灵枢笔记 (Notebook LM Clone)

基于AI的智能笔记管理系统，支持多种编辑器、文档解析和智能对话。

## ✨ 功能特性

### 📝 多编辑器支持
- **Tiptap编辑器** - 现代化富文本编辑
- **CKEditor** - 传统富文本编辑
- **Markdown编辑器** - 原生Markdown支持
- **NotePad** - 简洁文本编辑

### 🤖 AI功能
- **智能文档解析** - 支持PDF、Word、Excel等多种格式
- **AI对话** - 基于文档内容的智能问答
- **内容总结** - 自动生成文档摘要
- **学习指南** - AI生成的学习建议

### 📚 文档管理
- **多格式支持** - PDF、DOCX、XLSX、TXT、Markdown
- **文档预览** - 实时预览文档内容
- **版本控制** - 文档历史记录
- **搜索功能** - 全文搜索和语义搜索

### 🎨 界面特性
- **响应式设计** - 适配各种屏幕尺寸
- **主题切换** - 明暗主题支持
- **可调整布局** - 三栏布局可自由调整

## 🏗️ 技术架构

### 前端技术栈
- **Next.js 14** - React全栈框架
- **TypeScript** - 类型安全
- **Tailwind CSS** - 原子化CSS框架
- **Tiptap** - 现代富文本编辑器
- **Zustand** - 状态管理

### 后端技术栈
- **NestJS** - Node.js企业级框架
- **TypeScript** - 类型安全的后端开发
- **SQLite** - 轻量级数据库
- **JWT** - 身份认证
- **Multer** - 文件上传处理

### AI集成
- **OpenAI GPT** - 智能对话和内容生成
- **本地LLM支持** - Ollama等本地模型
- **向量数据库** - 文档语义搜索
- **文档解析** - PDF.js、XLSX等

## 🚀 快速开始

### 环境要求
- Node.js 18+
- npm或yarn
- Git

### 安装步骤

1. **克隆项目**
   ```bash
   git clone https://github.com/你的用户名/notebook-lm-clone.git
   cd notebook-lm-clone
   ```

2. **安装依赖**
   ```bash
   # 安装后端依赖
   cd backend
   npm install
   
   # 安装前端依赖
   cd ../frontend
   npm install
   ```

3. **环境配置**
   ```bash
   # 复制环境变量文件
   cp backend/.env.example backend/.env
   cp frontend/.env.example frontend/.env.local
   
   # 编辑环境变量文件，配置API密钥等
   ```

4. **启动服务**
   ```bash
   # 启动后端服务 (端口3001)
   cd backend
   npm run start:dev
   
   # 启动前端服务 (端口3000)
   cd ../frontend
   npm run dev
   ```

5. **访问应用**
   - 前端: http://localhost:3000
   - 后端API: http://localhost:3001

## ⚙️ 配置说明

### 后端配置 (backend/.env)
```env
# 数据库配置
DATABASE_URL="./data/notebook.db"

# JWT配置
JWT_SECRET="your-jwt-secret"
JWT_EXPIRES_IN="24h"

# AI模型配置
OPENAI_API_KEY="your-openai-api-key"
OPENAI_BASE_URL="https://api.openai.com/v1"

# 文件上传配置
UPLOAD_PATH="./uploads"
MAX_FILE_SIZE="50MB"
```

### 前端配置 (frontend/.env.local)
```env
# API配置
NEXT_PUBLIC_API_BASE_URL="http://localhost:3001"

# 应用配置
NEXT_PUBLIC_APP_NAME="灵枢笔记"
NEXT_PUBLIC_APP_VERSION="1.0.0"
```

## 📖 使用指南

### 基本操作
1. **创建笔记本** - 点击"新建笔记本"开始
2. **上传文档** - 支持拖拽上传多种格式文件
3. **智能对话** - 基于文档内容进行AI问答
4. **编辑笔记** - 使用多种编辑器记录想法

### 高级功能
- **文档搜索** - 支持关键词和语义搜索
- **AI总结** - 自动生成文档摘要
- **学习模式** - AI生成学习计划和测试题
- **导出功能** - 支持多种格式导出

## 🛠️ 开发指南

### 项目结构
```
notebook-lm-clone/
├── backend/                 # 后端服务
│   ├── src/
│   │   ├── modules/        # 功能模块
│   │   ├── common/         # 公共组件
│   │   └── main.ts         # 入口文件
│   └── uploads/            # 文件上传目录
├── frontend/               # 前端应用
│   ├── src/
│   │   ├── app/           # Next.js应用路由
│   │   ├── components/    # React组件
│   │   ├── contexts/      # React上下文
│   │   ├── services/      # API服务
│   │   └── types/         # TypeScript类型
│   └── public/            # 静态资源
└── docs/                  # 项目文档
```

### 贡献指南
1. Fork项目
2. 创建功能分支: `git checkout -b feature/new-feature`
3. 提交更改: `git commit -m 'Add new feature'`
4. 推送分支: `git push origin feature/new-feature`
5. 提交Pull Request

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 🙏 致谢

- [Next.js](https://nextjs.org/) - 优秀的React框架
- [NestJS](https://nestjs.com/) - 企业级Node.js框架
- [Tiptap](https://tiptap.dev/) - 现代化编辑器
- [OpenAI](https://openai.com/) - AI技术支持

## 📞 联系方式

- 项目地址: https://github.com/你的用户名/notebook-lm-clone
- 问题反馈: https://github.com/你的用户名/notebook-lm-clone/issues

---

⭐ 如果这个项目对您有帮助，请给它一个星标！ 