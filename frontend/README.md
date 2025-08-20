# 灵枢笔记 (NeuraLink Notes)

智能笔记系统 - 集文档编辑、AI助手、知识管理于一体的现代化笔记应用

🔗 在线体验：[https://www.cheman.top/notepads/](https://www.cheman.top/notepads/)

## 项目概述

灵枢笔记是一个功能强大的智能笔记应用，旨在为用户提供完整的个人知识管理解决方案。通过集成多种AI模型和可视化工具，帮助用户更高效地创建、组织和检索信息。

## 主要特性

### 多格式文档支持
- Markdown编辑器
- 富文本编辑器
- 代码编辑器（支持语法高亮）
- PDF文档查看和注释
- Word和Excel文档查看
- PPT文档查看

### AI智能助手
- 集成多种AI模型（OpenAI、Anthropic、DeepSeek等）
- 智能写作辅助
- 内容总结和提炼
- 多语言翻译
- 问答助手

### 可视化工具
- Excalidraw手绘白板
- Tldraw矢量绘图工具
- 简易白板工具

### 文件管理
- 完整的文件夹管理系统
- 笔记本组织结构
- 标签和分类功能
- 搜索和过滤功能

### 云端同步
- 通过统一设置服务实现跨设备数据同步
- 用户认证和权限管理
- 配置备份和恢复

## 技术栈

### 前端
- Next.js 14
- React 18
- TailwindCSS
- TypeScript
- CKEditor 5
- TipTap
- React Markdown
- React Syntax Highlighter

### 后端
- NestJS
- Express.js
- SQLite数据库
- Prisma ORM

### AI集成
- OpenAI API
- Anthropic API
- DeepSeek API
- Google Generative AI
- OpenRouter API

## 系统架构

```
┌─────────────────────┐
│     前端应用        │
│  (Next.js/React)    │
└─────────┬───────────┘
          │
┌─────────▼───────────┐
│    统一设置服务      │
│   (用户认证/配置)    │
└─────────┬───────────┘
          │
┌─────────▼───────────┐
│     后端服务        │
│    (NestJS/API)     │
└─────────┬───────────┘
          │
┌─────────▼───────────┐
│     数据存储        │
│     (SQLite)        │
└─────────────────────┘
```

## 依赖关系

灵枢笔记依赖统一设置服务进行用户认证和配置管理。所有用户数据和配置都通过统一设置服务进行管理，确保数据一致性和安全性。

## 部署说明

1. 前端服务运行在端口 3000
2. 后端服务运行在端口 3001
3. 通过Nginx反向代理对外提供服务
4. 使用PM2进行进程管理

## 开源许可

本项目采用MIT许可证，欢迎贡献和使用。

## 相关项目

- [统一设置服务](https://github.com/chemany/unified-settings-service) - 用户认证和配置管理中心
- [潮汐志](https://github.com/chemany/tidelog) - 智能日历系统

## 📞 联系方式

- 项目地址: https://github.com/chemany/NeuraLink-Notes
- 问题反馈: https://github.com/chemany/NeuraLink-Notes/issues