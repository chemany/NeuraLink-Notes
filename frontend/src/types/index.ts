import { DocumentStatus } from './shared_local';

export interface Notebook {
  id: string;
  title: string;
  folderId: string | null; // 确保与 Prisma schema 类型匹配
  createdAt: string;     // API 返回的是 ISO 字符串格式
  updatedAt: string;     // API 返回的是 ISO 字符串格式
  // 可以根据需要添加其他从后端接收的字段
}

// 从 shared_local 重新导出 Document 和 DocumentStatus 类型
export type { Document } from './shared_local';
export { DocumentStatus } from './shared_local';

export interface Folder {
  id: string;
  name: string;
  createdAt: string;
  // Add other fields as needed
}

export interface WhiteboardContent {
  // Define structure based on actual usage (e.g., Excalidraw data?)
  elements?: any[];
  appState?: any;
  // Add other fields as needed
}

/**
 * 富文本笔记类型定义
 * @property id 笔记ID，字符串
 * @property notebookId 所属笔记本ID，字符串
 * @property title 笔记标题，字符串或 null
 * @property contentJson 富文本内容的 JSON 对象，前端内部用对象，和后端交互时需序列化为字符串
 * @property contentHtml 富文本内容的 HTML 字符串
 * @property createdAt 创建时间，ISO 字符串
 * @property updatedAt 更新时间，ISO 字符串
 */
export interface Note {
  id: string;
  notebookId: string;
  title?: string | null;
  contentJson?: Record<string, any> | null;
  contentHtml?: string | null;
  createdAt: string;
  updatedAt: string;
  // 可根据需要添加其他字段
}

export interface NotePadNote {
  id: string;
  notebookId: string;
  content: string;
  position?: { x: number; y: number };
  size?: { width: number; height: number };
  color?: string;
  createdAt: string;
  updatedAt?: string;
  // Add other fields as needed
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  documentId?: string;
  timestamp?: string;
  status?: 'sending' | 'sent' | 'error';
  // Add other fields as needed
}

// ... 其他共享类型 ...
