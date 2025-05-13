// backend/src/types/shared.ts
// 这个文件用于重新导出后端类型，以便前端可以安全地导入它们。

import type { Document as PrismaDocument } from '@prisma/client';

// 重新导出 Document 类型，前端可以导入这个 Document
export type Document = PrismaDocument;

// 如果将来有其他需要共享的类型（例如 Notebook），也可以在这里添加导出
// export type { Notebook } from '@prisma/client';
