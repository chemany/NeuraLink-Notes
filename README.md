<p align="center">
  <img alt="灵枢笔记" src="assets/branding/ling-shu-icon-512.png" width="96">
</p>

<h1 align="center">灵枢笔记 · 智能知识中枢</h1>

<p align="center">
  自动向量化管理数据，将笔记、私有 AI 与知识工作流汇聚到一个可控空间
</p>

<p align="center">
  <a href="https://www.cheman.top">官网</a> ·
  <a href="https://www.cheman.top/notepads/">在线体验</a> ·
  <a href="https://github.com/chemany/neu-siyuan-note/issues">问题反馈</a>
</p>

<p align="center">
  <a href="https://www.gnu.org/licenses/agpl-3.0.txt"><img alt="License" src="https://img.shields.io/badge/license-AGPL--3.0-orange.svg?style=flat-square"></a>
  <img alt="Go" src="https://img.shields.io/badge/Go-1.21+-00ADD8.svg?style=flat-square">
  <img alt="Node" src="https://img.shields.io/badge/pnpm-10+-F69220.svg?style=flat-square">
</p>

## 项目定位

灵枢笔记基于 [思源笔记](https://github.com/siyuan-note/siyuan) 深度定制，面向需要自主管理知识、身份与 AI 能力的团队和个人。它保留思源笔记的块编辑、Markdown、文档树与本地优先体验，并围绕 Web 多用户场景补齐以下能力：

- 每个用户独立的工作空间、附件与配置目录；
- 通过统一认证服务实现登录态校验和跨应用身份协同；
- 以流式 AI 对话、RAG、附件解析和 OCR 为中心的知识工作流；
- 面向私有部署的本地模型与 OpenAI 兼容接口接入；
- 适合浏览器访问、反向代理和长期运维的 Web 部署模式。

本仓库是一个与上游思源笔记保持 AGPL-3.0 协议一致的定制分支，不是思源笔记官方发行版。生产环境中的统一认证、模型推理、OCR 和数据根目录由配套服务提供。

## 核心能力

| 能力 | 说明 |
| --- | --- |
| 多用户工作空间 | 请求进入内核后会建立 `WorkspaceContext`，让笔记、附件、配置、临时文件和用户身份在请求链路中保持一致。 |
| 身份与会话 | Web 模式支持 JWT、Cookie 与统一认证服务协同，适合与同一组织内的其他应用共用登录态。 |
| 私有 AI 对话 | 支持 OpenAI 兼容接口与流式 SSE 输出；默认模型配置可以由统一设置服务集中管理。 |
| RAG 与附件理解 | AI 对话可读取当前文档允许的附件、已向量化内容和文档上下文，避免把无关资料混入回答。 |
| 扫描件 OCR | 支持图片与扫描版 PDF 的 OCR，识别结果可供后续阅读、检索和 AI 分析使用。 |
| 会议与内容整理 | 内置会议纪要、摘要、概念关联、智能问答等面向知识整理的工作流。 |
| 思源编辑体验 | 延续块级编辑、文档树、Markdown、主题、快捷键和实时更新等核心体验。 |

## 适用场景

- 团队知识库、项目笔记和个人研究资料的统一管理；
- 需要数据留在自有环境中的文档问答与摘要生成；
- 需要从 PDF、图片、扫描资料中提取文本并沉淀为可检索知识；
- 已有内部账号体系，希望笔记应用与其他业务系统共享登录态；
- 希望使用本地模型，或按需接入任意 OpenAI 兼容模型服务的组织。

## 架构概览

灵枢笔记的核心是思源内核与前端应用。完整 Web 部署时，统一认证、模型推理和 OCR 服务作为独立组件运行，彼此通过清晰的 HTTP 接口协作：

```text
浏览器
  │
  ▼
Nginx / HTTPS 反向代理
  │
  ▼
灵枢笔记前端与内核
  ├── 统一设置服务：认证校验、用户设置、默认模型配置
  ├── OpenAI 兼容模型服务：流式对话、总结、RAG 生成
  ├── OCR 服务：图片与扫描版 PDF 文字提取
  └── 用户数据根目录：工作空间、附件、索引与配置
```

### 多用户隔离

Web 请求在认证后绑定用户工作空间。工作空间负责隔离用户的笔记数据、附件、配置、历史记录和临时文件；共享索引数据通过用户标识进行范围约束。AI、OCR 与附件读取均会沿用当前请求的工作空间上下文。

这种设计的重点不是把所有服务塞进一个进程，而是在共享基础设施上维持明确的用户边界和可追溯的请求上下文。

### AI 工作流

`/api/ai/chatStream` 由灵枢内核处理，而不是由通用配置服务直接代理。这样流式请求可以同时获得：

- 当前登录用户与工作空间；
- 当前文档及其允许附件的范围；
- RAG 检索或已构建的向量内容；
- 系统提示词、模型配置和 SSE 输出控制。

参考部署使用本地 `llama.cpp` 提供 OpenAI 兼容接口，并可按硬件资源选择上下文长度和并发槽位。模型服务是共享基础设施，调整其上下文或并发参数时应同时评估其他调用方的响应时间。

### OCR 与文档理解

OCR 服务地址由 [`config/ocr-config.json`](config/ocr-config.json) 配置。对于 PDF，系统优先读取可提取的文本；当文本不足或文件属于扫描件时，再调用 OCR。识别结果会作为附件内容的一部分进入后续的阅读、检索和 AI 分析流程。

## 组件说明

| 目录或服务 | 职责 |
| --- | --- |
| `app/` | TypeScript 前端、编辑器界面、AI 面板与交互逻辑。 |
| `kernel/` | Go 内核、Web API、认证中间件、工作空间上下文、AI/RAG/OCR 实现。 |
| `config/` | OCR 等运行期功能配置。 |
| `ecosystem.config.js` | PM2 进程定义参考；生产部署应以经验证的构建路径和进程配置为准。 |
| 统一设置服务 | 仓库外的配套服务，负责统一认证和共享模型配置。 |
| 模型与 OCR 服务 | 仓库外的可选推理服务，分别提供 OpenAI 兼容对话接口和 OCR 接口。 |

## 快速开始

### 前置条件

- Go 1.21 或更高版本；
- Node.js 与 Corepack；前端依赖由 `pnpm@10` 管理；
- 使用全文检索构建内核时需要启用 CGO 和 `fts5`；
- Web 多用户部署还需要准备用户数据根目录、统一认证服务，以及按需配置的模型和 OCR 服务。

### 获取代码与构建

```bash
git clone https://github.com/chemany/neu-siyuan-note.git
cd neu-siyuan-note

corepack enable
cd app
pnpm install
pnpm run build:desktop

cd ../kernel
CGO_ENABLED=1 go build -v -o ./siyuan-kernel -tags "fts5" -ldflags "-s -w" .
```

项目内的完整构建脚本会构建前端、同步 Web 产物、编译内核并重启服务：

```bash
bash rebuild-and-restart.sh
```

构建后的内核必须位于 `kernel/siyuan-kernel`。详细的构建、进程管理和故障排查说明请阅读 [构建与部署指南](BUILD_AND_DEPLOY.md)。

### 容器化运行

仓库提供 [`Dockerfile`](Dockerfile)，可用于构建基础镜像：

```bash
docker build -t lingshu-note .
docker run --rm -p 6806:6806 lingshu-note
```

容器镜像只覆盖核心应用。若启用多用户 Web 模式、统一认证、AI 或 OCR，需要在部署环境中另外提供对应服务与持久化数据卷。

## 配置要点

| 配置项 | 用途 |
| --- | --- |
| `SIYUAN_WEB_MODE=true` | 启用 Web 多用户认证与工作空间上下文。 |
| `SIYUAN_USER_DATA_ROOT` | 指定用户工作空间根目录。 |
| `SIYUAN_PORT` | 指定内核监听端口，默认参考值为 `6806`。 |
| `config/ocr-config.json` | 配置 OCR 服务地址及开关。 |
| 统一设置服务的模型配置 | 为内置 AI 提供模型地址、模型名、温度、输出长度和系统提示词等默认值。 |

部署时请将密钥、JWT 密钥、数据根目录和外部服务地址放在环境变量或受控配置中，不要提交到仓库。

## 开发与验证

- 前端源码位于 `app/src/`，后端源码位于 `kernel/`；
- 修改 Go 代码后，优先执行相应包的测试，再重新构建内核；
- 修改前端后，使用 `build:desktop` 生成 Web 所需产物；
- 修改 AI、认证或多用户逻辑时，应至少验证登录态、工作空间隔离、附件访问和流式对话；
- 运行时配置变更应先完成健康检查，再切换生产流量。

提交规范与社区协作说明见 [贡献指南](.github/CONTRIBUTING_zh_CN.md)。

## 相关文档

- [构建与部署指南](BUILD_AND_DEPLOY.md)
- [BlockTree 架构说明](BLOCKTREE_ARCHITECTURE.md)
- [子文档创建流程](SUBDOCUMENT_CREATION_FLOW.md)
- [贡献指南](.github/CONTRIBUTING_zh_CN.md)
- [安全策略](.github/SECURITY.md)

## 致谢与许可

灵枢笔记基于 [思源笔记](https://github.com/siyuan-note/siyuan) 构建，感谢思源笔记及其社区提供的编辑器、数据模型和开源生态。

本项目遵循 [AGPL-3.0](LICENSE) 协议。使用、部署或二次分发前，请确认你对上游项目和本仓库的开源义务均已满足。

---

<p align="center">
  <strong>灵枢笔记 · 智能知识中枢</strong><br>
  多用户知识管理 · 自动向量化 · 私有 AI · 可控数据边界
</p>
