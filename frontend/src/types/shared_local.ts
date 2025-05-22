// 这个文件用于定义前端使用的类型

// 文档状态枚举
export enum DocumentStatus {
  PENDING = 'PENDING',      // 待处理
  PROCESSING = 'PROCESSING', // 处理中
  COMPLETED = 'COMPLETED',   // 处理完成
  FAILED = 'FAILED',          // 处理失败
  VECTORIZATION_SKIPPED = 'VECTORIZATION_SKIPPED', // 新增：向量化跳过
  VECTORIZATION_FAILED = 'VECTORIZATION_FAILED'   // 新增：向量化失败
}

// 文档类型定义
export interface Document {
  id: string;
  title: string;
  fileName: string;
  s3Key: string;
  mimetype: string;
  fileType: string;
  fileSize: number;
  uploadDate: string;
  status: DocumentStatus;
  statusMessage?: string;
  notebookId: string | null;
  textContent?: string;
  isVectorized?: boolean; // 新增：文档是否已向量化
  embeddings?: number[][];
  textChunks?: string;
  createdAt: string;
  updatedAt: string;
}

// 如果将来有其他需要共享的类型（例如 Notebook），也可以在这里添加导出
// export interface Notebook { ... }
