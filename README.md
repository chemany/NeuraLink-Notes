# 🧠 灵枢笔记 (NeuraLink-Notes)

基于AI的智能笔记管理系统，支持多种编辑器、文档解析和智能对话。集成统一设置服务，提供无缝的用户体验。

## ✨ 功能特性

### 📝 多编辑器支持
- **Tiptap编辑器** - 现代化富文本编辑，支持实时协作
- **CKEditor** - 传统富文本编辑，功能完整
- **Markdown编辑器** - 原生Markdown支持，程序员友好
- **NotePad** - 简洁文本编辑，快速记录

### 🤖 AI功能
- **智能文档解析** - 支持PDF、Word、Excel、PPT等多种格式
- **AI对话** - 基于文档内容的智能问答，支持多轮对话
- **内容总结** - 自动生成文档摘要和关键点提取
- **学习指南** - AI生成的个性化学习建议和测试题

### 📚 文档管理
- **多格式支持** - PDF、DOCX、XLSX、PPTX、TXT、Markdown
- **文档预览** - 实时预览文档内容，支持同步滚动
- **版本控制** - 文档历史记录和变更追踪
- **搜索功能** - 全文搜索、语义搜索和向量检索
- **文件系统存储** - 自动保存笔记到本地文件系统

### 🎨 界面特性
- **响应式设计** - 完美适配桌面、平板和移动设备
- **主题切换** - 明暗主题支持，护眼模式
- **可调整布局** - 三栏布局可自由调整，个性化工作空间
- **拖拽上传** - 支持拖拽上传文档和图片

### 🔐 统一认证
- **统一账号系统** - 集成统一设置服务认证
- **用户数据隔离** - 每个用户独立的数据存储空间
- **安全存储** - 加密存储敏感信息和用户数据

## 🏗️ 技术架构

### 前端技术栈
- **Next.js 14** - React全栈框架，支持SSR和SSG
- **TypeScript** - 类型安全的开发体验
- **Tailwind CSS** - 原子化CSS框架，快速样式开发
- **Tiptap** - 现代富文本编辑器，可扩展性强
- **Zustand** - 轻量级状态管理，简单易用

### 后端技术栈
- **NestJS** - Node.js企业级框架，模块化架构
- **TypeScript** - 类型安全的后端开发
- **Prisma** - 现代化ORM，类型安全的数据库操作
- **SQLite** - 轻量级嵌入式数据库
- **JWT** - 安全的身份认证机制
- **Multer** - 文件上传中间件

### AI集成
- **多LLM支持** - OpenAI GPT、Claude、本地模型等
- **统一设置服务** - 集中管理AI模型配置
- **向量化服务** - 文档语义搜索和相似度匹配
- **重排序服务** - 搜索结果智能排序
- **文档解析引擎** - PDF.js、Mammoth、XLSX等多格式支持

### 服务集成
- **统一设置服务** - 用户认证和配置管理
- **文件系统存储** - 自动保存笔记到本地文件
- **用户数据隔离** - 基于用户名的文件夹隔离

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

4. **启动统一设置服务**
   ```bash
   # 需要先启动统一设置服务
   cd ../unified-settings-service
   npm start
   ```

5. **启动灵枢笔记服务**
   ```bash
   # 启动后端服务 (端口3001)
   cd ../NeuraLink-Notes/backend
   npm run start:dev

   # 启动前端服务 (端口3000)
   cd ../frontend
   npm run dev
   ```

6. **访问应用**
   - 前端: http://localhost:3000
   - 后端API: http://localhost:3001
   - 统一设置服务: http://localhost:3002

## ⚙️ 配置说明

### 后端配置 (backend/.env)
```env
# 数据库配置
DATABASE_URL="./data/notebook.db"

# 统一设置服务配置
UNIFIED_SETTINGS_URL="http://localhost:3002"

# 文件上传配置
UPLOAD_PATH="./uploads"
MAX_FILE_SIZE="50MB"

# 服务配置
PORT=3001
NODE_ENV=development

# 文件系统存储配置
ENABLE_FILE_STORAGE=true
FILE_STORAGE_PATH="./uploads"
```

### 前端配置 (frontend/.env.local)
```env
# API配置
NEXT_PUBLIC_API_BASE_URL="http://localhost:3001"
NEXT_PUBLIC_UNIFIED_SETTINGS_URL="http://localhost:3002"

# 应用配置
NEXT_PUBLIC_APP_NAME="灵枢笔记"
NEXT_PUBLIC_APP_VERSION="2.0.0"

# 功能开关
NEXT_PUBLIC_ENABLE_AI_CHAT=true
NEXT_PUBLIC_ENABLE_DOCUMENT_PREVIEW=true
NEXT_PUBLIC_ENABLE_FILE_STORAGE=true
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