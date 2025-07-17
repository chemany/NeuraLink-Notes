import { Document } from '@/types';
import { generateEmbeddings } from './aiService';
import { EmbeddingModelSettings } from '@/contexts/SettingsContext';
import { fetchDocumentById } from './documentService';
import { rerankChunks, RerankResult } from './aiService';
import apiClient from './apiClient';

// 后端 API 地址
import { getApiBaseUrl } from './apiClient';

// 添加API请求限流控制器
/**
 * API请求限流控制器
 * 基于令牌桶算法实现请求频率控制
 */
class ApiRateLimiter {
  private static instance: ApiRateLimiter;
  private requestQueue: Array<{resolve: () => void, reject: (error: Error) => void}> = [];
  private processing = false;
  private lastRequestTime = 0;
  
  // 控制参数
  private requestInterval = 500; // 毫秒，略大于1秒，以确保低于60 RPM
  private maxConcurrentRequests = 1; // *** 关键修改：确保全局只有一个并发请求 ***
  private activeRequests = 0;
  
  private constructor() {}
  
  public static getInstance(): ApiRateLimiter {
    if (!ApiRateLimiter.instance) {
      ApiRateLimiter.instance = new ApiRateLimiter();
    }
    return ApiRateLimiter.instance;
  }
  
  /**
   * 请求获取执行权限
   * @returns Promise 解析后表示可以执行请求
   */
  public async acquireToken(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.requestQueue.push({ resolve, reject });
      this.processQueue();
    });
  }
  
  /**
   * 释放令牌，表示请求已完成
   * @param failed 请求是否失败
   */
  public releaseToken(failed = false): void {
    this.activeRequests--;
    this.processQueue();
  }
  
  /**
   * 内部方法：处理请求队列
   */
  private async processQueue(): Promise<void> {
    if (this.processing) return;
    this.processing = true;
    
    while (this.requestQueue.length > 0 && this.activeRequests < this.maxConcurrentRequests) {
      const now = Date.now();
      const timeToWait = Math.max(0, this.lastRequestTime + this.requestInterval - now);
      
      if (timeToWait > 0) {
        await new Promise(resolve => setTimeout(resolve, timeToWait));
      }
      
      const { resolve } = this.requestQueue.shift()!;
      this.activeRequests++;
      this.lastRequestTime = Date.now();
      resolve();
    }
    
    this.processing = false;
  }
}

/**
 * 将文本内容分割成较小的文本块，优化语义边界的分割
 * @param text 要分割的文本内容
 * @param maxChunkSize 最大块大小（字符数）
 * @param overlapSize 重叠大小（字符数）
 * @returns 文本块数组
 */
export function splitTextIntoChunks(text: string, maxChunkSize: number = 2000, overlapSize: number = 200): string[] {
  if (!text || text.trim() === '') {
    return [];
  }

  // 利用特定标记作为语义分割点
  const semanticPatterns = [
    /##\s+(.*?)(?=\n|$)/g,  // Markdown 标题
    /\n\s*实验部分\s*\n/gi,  // 论文的实验部分
    /\n\s*结果与讨论\s*\n/gi,  // 结果与讨论部分
    /\n\s*结论\s*\n/gi,      // 结论部分
    /\n\s*参考文献\s*\n/gi,   // 参考文献
    /\n\s*表\s*\d+[\s.:]*/gi, // 表格标题
    /\n\s*图\s*\d+[\s.:]*/gi  // 图表标题
  ];

  // 首先尝试按语义边界分割
  let semanticPoints = [];
  for (const pattern of semanticPatterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      semanticPoints.push(match.index);
    }
  }
  semanticPoints.sort((a, b) => a - b);

  // 如果找到了语义分割点且数量合适
  if (semanticPoints.length > 1 && semanticPoints.length < 20) {
    const chunks = [];
    let startIdx = 0;
    
    for (let i = 0; i < semanticPoints.length; i++) {
      const endIdx = semanticPoints[i];
      // 如果当前块超过最大尺寸，则在最大尺寸处截断
      if (endIdx - startIdx > maxChunkSize) {
        // 按最大尺寸分块，保持重叠
        let chunkStart = startIdx;
        while (chunkStart < endIdx) {
          const chunkEnd = Math.min(chunkStart + maxChunkSize, endIdx);
          chunks.push(text.substring(chunkStart, chunkEnd));
          const nextStart = chunkEnd - overlapSize;
          // 防止无限循环：确保chunkStart至少前进1个字符
          chunkStart = Math.max(nextStart, chunkStart + 1);

          // 安全检查：如果chunks数组过大，停止处理
          if (chunks.length > 10000) {
            console.warn(`[VectorService] 文本块数量过多 (${chunks.length})，停止分块以防止内存溢出`);
            break;
          }
        }
      } else if (endIdx - startIdx > 0) {
        // 如果块大小合适，直接添加
        chunks.push(text.substring(startIdx, endIdx));
      }
      startIdx = endIdx;
    }
    
    // 处理最后一部分
    if (startIdx < text.length) {
      if (text.length - startIdx > maxChunkSize) {
        // 按最大尺寸分块，保持重叠
        let chunkStart = startIdx;
        while (chunkStart < text.length) {
          const chunkEnd = Math.min(chunkStart + maxChunkSize, text.length);
          chunks.push(text.substring(chunkStart, chunkEnd));
          const nextStart = chunkEnd - overlapSize;
          // 防止无限循环：确保chunkStart至少前进1个字符
          chunkStart = Math.max(nextStart, chunkStart + 1);

          // 安全检查：如果chunks数组过大，停止处理
          if (chunks.length > 10000) {
            console.warn(`[VectorService] 文本块数量过多 (${chunks.length})，停止分块以防止内存溢出`);
            break;
          }
        }
      } else {
        chunks.push(text.substring(startIdx));
      }
    }
    
    // 如果生成了合理数量的块，则返回
    if (chunks.length > 0) {
      console.log(`[VectorService] 基于语义边界分块成功，生成 ${chunks.length} 个块`);
      return chunks.filter(chunk => chunk.trim().length > 0);
    }
  }

  // 退回到段落分割
  const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim() !== '');
  
  // 如果段落很少且文本很长，尝试更细粒度的分割
  if (paragraphs.length < 3 && text.length > maxChunkSize) {
    // 按句子分割
    const sentences = text.split(/[.!?。！？]+\s*/).filter(s => s.trim() !== '');
    
    // 将句子组合成块，控制块大小
    const chunks: string[] = [];
    let currentChunk = '';
    
    for (const sentence of sentences) {
      if (currentChunk.length + sentence.length + 1 > maxChunkSize && currentChunk.length > 0) {
        chunks.push(currentChunk);
        // 保留一部分重叠内容，以维持上下文连贯性
        currentChunk = currentChunk.substring(Math.max(0, currentChunk.length - overlapSize));
      }
      currentChunk += (currentChunk ? ' ' : '') + sentence.trim() + '.';
    }
    
    if (currentChunk.length > 0) {
      chunks.push(currentChunk);
    }
    
    return chunks.filter(chunk => chunk.trim().length > 0);
  }
  
  // 按段落组合
  const chunks: string[] = [];
  let currentChunk = '';
  
  for (const paragraph of paragraphs) {
    if (currentChunk.length + paragraph.length + 2 > maxChunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk);
      // 保留一部分重叠内容
      currentChunk = currentChunk.substring(Math.max(0, currentChunk.length - overlapSize));
    }
    currentChunk += (currentChunk ? '\n\n' : '') + paragraph.trim();
  }
  
  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }
  
  return chunks.filter(chunk => chunk.trim().length > 0);
}

/**
 * 获取嵌入向量设置
 */
export function getEmbeddingSettings(): EmbeddingModelSettings {
  try {
    if (typeof window !== 'undefined') {
      const savedSettings = localStorage.getItem('embeddingSettings');
      if (savedSettings) {
        const settings = JSON.parse(savedSettings) as EmbeddingModelSettings;
        if (settings && settings.apiKey && settings.apiKey.trim() !== '') {
          console.log('成功从localStorage加载嵌入向量设置');
          
          // 确保模型名称格式正确
          let model = settings.model;
          if (model === 'bge-m3') {
            model = 'BAAI/bge-m3';
          } else if (model === 'bge-large-zh-v1.5' || model === 'bge-large-zh') {
            model = 'BAAI/bge-large-zh-v1.5';
          } else if (model === 'bge-large-en-v1.5' || model === 'bge-large-en') {
            model = 'BAAI/bge-large-en-v1.5';
          }
          
          return {
            ...settings,
            model: model,
          };
        }
      }
    }
  } catch (error) {
    console.error('从localStorage读取嵌入向量设置失败:', error);
  }
  
  // 默认设置
  return {
    provider: 'siliconflow',
    model: 'BAAI/bge-large-zh-v1.5',
    encodingFormat: 'float',
    apiKey: process.env.NEXT_PUBLIC_SILICONFLOW_API_KEY || ''
  };
}

/**
 * 计算两个向量之间的余弦相似度
 */
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) {
    throw new Error('向量维度不匹配');
  }
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += Math.pow(vecA[i], 2);
    normB += Math.pow(vecB[i], 2);
  }
  
  if (normA === 0 || normB === 0) {
    return 0;
  }
  
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * 文档块类型，包含内容、嵌入向量和元数据
 */
export interface DocumentChunk {
  id: string;
  content: string;
  embedding?: number[];
  metadata: {
    documentId: string;
    documentName: string;
    chunkIndex: number;
  };
}

/**
 * 相似度搜索结果类型
 */
export interface SearchResult {
  chunk: DocumentChunk;
  similarity: number;
}

/**
 * 处理文档，生成分块和嵌入向量
 */
export async function processDocumentForRAG(document: Document, embeddingSettings?: EmbeddingModelSettings): Promise<DocumentChunk[]> {
  console.log(`[VectorService] 开始处理文档: ${document.fileName}`);
  
  if (!document.textContent || document.textContent.trim() === '') {
    console.warn(`[VectorService] 文档 ${document.id} 内容为空或无效`);
    return [];
  }
  
  // 分块
  const chunks = splitTextIntoChunks(document.textContent);
  console.log(`[VectorService] 文档 ${document.fileName} 分成 ${chunks.length} 个块`);
  
  // 如果没有分块成功，尝试使用备用方法
  if (chunks.length === 0) {
    console.log(`[VectorService] 尝试备用分块方法...`);
    // 使用简单的固定长度分割，不使用s标志
    const simpleSplit = [];
    let offset = 0;
    const chunkSize = 1500;
    while (offset < document.textContent.length) {
      simpleSplit.push(document.textContent.substr(offset, chunkSize));
      offset += chunkSize;
    }
    
    if (simpleSplit.length > 0) {
      console.log(`[VectorService] 备用分块方法生成了 ${simpleSplit.length} 个块`);
      const backupChunks = simpleSplit.map((content, index) => ({
        id: `${document.id}_chunk_${index}`,
        content,
        metadata: {
          documentId: document.id,
          documentName: document.fileName,
          chunkIndex: index
        }
      }));
      
      // 生成嵌入向量
      await processChunksWithRateLimit(backupChunks, embeddingSettings);
      return backupChunks;
    }
    
    console.warn(`[VectorService] 无法为文档 ${document.id} 生成有效文本块`);
    return [];
  }
  
  // 创建文档块
  const documentChunks: DocumentChunk[] = chunks.map((content, index) => ({
    id: `${document.id}_chunk_${index}`,
    content,
    metadata: {
      documentId: document.id,
      documentName: document.fileName,
      chunkIndex: index
    }
  }));
  
  // 生成嵌入向量
  await processChunksWithRateLimit(documentChunks, embeddingSettings);
  return documentChunks;
}

/**
 * 使用限流机制处理文档块
 */
async function processChunksWithRateLimit(documentChunks: DocumentChunk[], embeddingSettings?: EmbeddingModelSettings): Promise<void> {
  try {
    const settings = embeddingSettings || getEmbeddingSettings();
    const rateLimiter = ApiRateLimiter.getInstance();
    // 可以保留较大的BATCH_SIZE，因为现在是串行请求
    const MAX_BATCH_SIZE = 300; 
    
    // 分批处理
    for (let i = 0; i < documentChunks.length; i += MAX_BATCH_SIZE) {
      const batch = documentChunks.slice(i, i + MAX_BATCH_SIZE);
      const batchContents = batch.map(chunk => chunk.content);
      
      console.log(`[VectorService] 准备处理批次 ${Math.floor(i/MAX_BATCH_SIZE) + 1}/${Math.ceil(documentChunks.length/MAX_BATCH_SIZE)}, 大小: ${batch.length}`);
      
      // 获取API请求令牌 (现在会阻塞直到可以执行)
      console.log(`[VectorService] 请求API令牌... (队列长度: ${rateLimiter['requestQueue'].length}, 活动请求: ${rateLimiter['activeRequests']})`);
      await rateLimiter.acquireToken();
      console.log(`[VectorService] 已获取API令牌，开始处理批次 ${Math.floor(i/MAX_BATCH_SIZE) + 1}`);
      
      try {
        // *** 直接调用 generateEmbeddings，不再在此处处理 429 ***
        const embeddings = await generateEmbeddings(batchContents, settings); 
        
        // 将嵌入向量分配给对应的块
        if (embeddings.length === batch.length) {
            for (let j = 0; j < batch.length; j++) {
              batch[j].embedding = embeddings[j];
            }
        } else {
            console.error(`[VectorService] 批次 ${Math.floor(i/MAX_BATCH_SIZE) + 1} 返回的嵌入数量 (${embeddings.length}) 与预期 (${batch.length}) 不符`);
            // 可以选择标记这些块为失败，或抛出错误
        }

      } catch (error: any) {
        // *** 移除内部的 429 重试逻辑 ***
        // 任何错误都向上抛出，由 aiService 处理重试
        console.error(`[VectorService] 调用 generateEmbeddings 处理批次 ${Math.floor(i/MAX_BATCH_SIZE) + 1} 时出错:`, error);
        // 向上抛出错误，让调用者(processDocumentForRAG -> processNextInQueue)知道失败
        throw error; 
      } finally {
        // 确保令牌总是被释放
        console.log(`[VectorService] 处理批次 ${Math.floor(i/MAX_BATCH_SIZE) + 1} 完成，释放API令牌`);
        rateLimiter.releaseToken();
      }
      
      // 移除批次间延迟，由 ApiRateLimiter 控制
    }
  } catch (error) {
    // Log error only if it's not re-thrown, otherwise aiService will log it.
    // console.error(`[VectorService] 生成嵌入向量过程中出错:`, error);
    // 将错误向上抛出，以便DocumentsList可以捕获并更新UI状态
    throw error; 
  }
}

// 对多个文档进行批量处理 - 修改为串行处理以减轻API负担
export async function processDocumentsForRAG(documents: Document[], embeddingSettings?: EmbeddingModelSettings): Promise<DocumentChunk[]> {
  console.log(`[VectorService] 开始串行处理 ${documents.length} 个文档`);
  let allChunks: DocumentChunk[] = [];
  
  // 串行处理文档，而非并行
  for (const document of documents) {
    try {
      console.log(`[VectorService] 处理文档: ${document.fileName}`);
      const documentChunks = await processDocumentForRAG(document, embeddingSettings);
      allChunks = [...allChunks, ...documentChunks];
      
      // 文档处理完后等待一段时间，避免API压力过大
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error(`[VectorService] 处理文档 ${document.fileName} 失败:`, error);
    }
  }
  
  return allChunks;
}

/**
 * 使用后端API存储文档块和向量
 */
export async function storeDocumentChunks(chunks: DocumentChunk[]): Promise<void> {
  if (!chunks || chunks.length === 0) {
    console.warn('[VectorService] storeDocumentChunks called with empty or null chunks.');
    return;
  }

  // 假设所有块都来自同一个文档
  const documentId = chunks[0]?.metadata?.documentId;
  if (!documentId) {
    console.error('[VectorService] Cannot store chunks: Missing documentId in metadata.');
    throw new Error('无法存储块：元数据中缺少 documentId。');
  }

  console.log(`[VectorService] 开始将 ${chunks.length} 个文档块存储到后端 (文档 ID: ${documentId})`);

  // 修改为逐个文档块存储，以避免整体请求过大
  let successCount = 0;

  try {
    // 由于后端没有单个块存储API，我们将数组每次只取一个元素进行处理
    if (chunks.length > 1) {
      console.log(`[VectorService] 使用批量模式存储 ${chunks.length} 个文档块`);
      
      // 逐个或小批量存储文档块
      // 后端请求体限制已放宽，尝试增加 CHUNK_SIZE 以提高存储效率
      const CHUNK_SIZE = 200; // 尝试一次处理 200 个块
      
      for (let i = 0; i < chunks.length; i += CHUNK_SIZE) {
        const batch = chunks.slice(i, i + CHUNK_SIZE);
        const firstChunkIdInBatch = batch[0]?.id || 'unknown_chunk_id';
        try {
          console.log(`[VectorService] 存储批次，起始块ID: ${firstChunkIdInBatch}, 批次大小: ${batch.length}`);
          // 将 batch 包装在 { vectorData: batch } 中以匹配后端 DTO
          const response = await apiClient.post(`/documents/${documentId}/vector-data`, { vectorData: batch });
          // 检查响应状态，确保成功
          if (response.status === 201 || response.status === 200) {
            successCount += batch.length;
            console.log(`[VectorService] 批次 (起始块ID: ${firstChunkIdInBatch}) 存储成功，当前总成功数: ${successCount}`);
          } else {
            // 如果状态码不是成功状态，则记录错误并抛出
            const errorMessage = `[VectorService] Failed to store chunk batch for document ${documentId}. Status: ${response.status}`;
            console.error(errorMessage, response.data);
            throw new Error(errorMessage);
          }
        } catch (batchError: any) {
          console.error(`[VectorService] Error storing document chunks for ${documentId}, batch starting with chunk ID ${firstChunkIdInBatch}. Batch size: ${batch.length}. Error: ${batchError.message}`, batchError.response?.data || batchError);
          // 从批处理错误中重新抛出，以便中止整个存储过程
          throw new Error(`存储文档块批次失败 (文档ID: ${documentId}, 起始块ID: ${firstChunkIdInBatch}): ${batchError.message}`);
        }
      }
    } else if (chunks.length === 1) {
      // 单个块的逻辑保持不变，但也确保错误被抛出
      const chunk = chunks[0];
      console.log(`[VectorService] Storing single chunk (ID: ${chunk.id}) for document ${documentId}`);
      try {
        // 将 chunk 数组包装在 { vectorData: [chunk] } 中以匹配后端 DTO
        const response = await apiClient.post(`/documents/${documentId}/vector-data`, { vectorData: [chunk] });
        if (response.status === 201 || response.status === 200) {
          successCount = 1;
          console.log(`[VectorService] Single chunk (ID: ${chunk.id}) stored successfully.`);
        } else {
          const errorMessage = `[VectorService] Failed to store single chunk ${chunk.id} for document ${documentId}. Status: ${response.status}`;
          console.error(errorMessage, response.data);
          throw new Error(errorMessage);
        }
      } catch (singleChunkError: any) {
        console.error(`[VectorService] Error storing single chunk ${chunk.id} for document ${documentId}: ${singleChunkError.message}`, singleChunkError.response?.data || singleChunkError);
        throw new Error(`存储单个文档块失败 (文档ID: ${documentId}, 块ID: ${chunk.id}): ${singleChunkError.message}`);
      }
    }

    console.log(`[VectorService] 批量存储完成，成功率: ${successCount}/${chunks.length}`);
    if (successCount < chunks.length) {
       // 如果不是所有块都成功存储，也应该抛出错误
       const overallErrorMessage = `[VectorService] Not all chunks were stored successfully for document ${documentId}. Expected: ${chunks.length}, Succeeded: ${successCount}`;
       console.error(overallErrorMessage);
       throw new Error(overallErrorMessage);
    }

  } catch (error: any) { // Catches errors re-thrown from inner blocks or new errors from this scope, specified type as any
    // 确保最外层的 catch 也能将错误信息传递出去
    console.error(`[VectorService] Final error in storeDocumentChunks for document ${documentId}: ${error.message}`);
    // 如果错误不是 Error 实例，或者没有 message，创建一个新的 Error 对象
    if (error instanceof Error) {
      throw error; // Re-throw the original error
    } else {
      throw new Error(`存储文档块时发生未知错误 (文档ID: ${documentId})`);
    }
  }
}

/**
 * 从后端API获取指定文档的所有块
 */
export async function getDocumentChunks(documentId: string): Promise<DocumentChunk[]> {
  if (!documentId) {
    console.warn('[VectorService] getDocumentChunks called with null or empty documentId.');
    return [];
  }

  console.log(`[VectorService] 开始从后端获取文档块 (文档 ID: ${documentId})`);

  try {
    // 使用 apiClient 发起请求，它会自动处理 Authorization 头
    const response = await apiClient.get(`/documents/${documentId}/vector-data`);

    // Axios 的响应数据在 response.data 中
    const chunks = response.data;

    // if (!response.ok) { // Axios 会在非 2xx 状态时抛出错误，所以这里的检查方式不同
    //    // 如果后端返回 404，说明向量数据不存在，返回空数组是合理的
    //   if (response.status === 404) {
    //        console.log(`[VectorService] 文档 ${documentId} 的向量数据未找到 (404)。`);
    //        return [];
    //    }
    //   const errorData = await response.json().catch(() => ({ message: '无法解析错误响应' }));
    //   console.error(`[VectorService] 后端获取失败: ${response.status} ${response.statusText}`, errorData);
    //   throw new Error(`获取向量数据失败: ${errorData.message || response.statusText}`);
    // }

    // // 检查响应内容类型，确保是 JSON --- Axios 通常会处理好这个
    // const contentType = response.headers.get('content-type');
    // if (!contentType || !contentType.includes('application/json')) {
    //     // 如果响应为空 (例如 200 OK 但没有内容)，也视为未找到
    //     if (response.status === 200 && response.headers.get('content-length') === '0') {
    //          console.log(`[VectorService] 文档 ${documentId} 的向量数据为空 (后端返回空响应体)。`);
    //          return [];
    //     }
    //     // 如果不是 JSON，抛出错误
    //     console.error(`[VectorService] 响应类型错误: Expected application/json, got ${contentType}`);
    //     throw new Error('获取向量数据失败：响应格式不正确。');
    // }

    // const chunks = await response.json(); // Axios 已自动解析 JSON
    console.log(`[VectorService] 成功从后端获取了 ${chunks?.length ?? 0} 个文档块`);

    // 后端在找不到文件时可能返回 null，这里处理一下
    return chunks || [];

  } catch (error: any) { // 修改 error 类型为 any 或 unknown，以便访问其属性
    // Axios 错误对象通常包含 response 对象
    if (error.response && error.response.status === 404) {
      console.log(`[VectorService] 文档 ${documentId} 的向量数据未找到 (404，来自 Axios)。`);
      return [];
    }
    console.error(`[VectorService] 调用后端获取API时出错 (Axios):`, error.isAxiosError ? error.toJSON() : error);
    const message = error.response?.data?.message || error.message || '获取向量数据时出错';
    throw new Error(`获取向量数据时出错: ${message}`);
  }
}

/**
 * 从后端获取所有文档块 - 注意：这可能会非常低效，谨慎使用！
 * 更好的方法是在后端实现聚合搜索。
 */
// export async function getAllDocumentChunks(): Promise<DocumentChunk[]> {
//   console.warn("[VectorService] getAllDocumentChunks is likely inefficient and currently disabled.");
//   console.warn("Consider implementing search logic on the backend.");
//   return []; 
   // 如果确实需要，需要后端提供一个获取所有文档ID的接口，
   // 然后循环调用 getDocumentChunks，但这非常慢。
   // 或者后端直接提供一个获取所有向量数据的接口（可能导致内存问题）。
// }

/**
 * 基于用户查询搜索相关内容，支持高级检索和组织功能
 * 注意：此实现现在依赖于从后端获取数据，可能需要调整以提高效率
 * @param query 用户查询
 * @param options 搜索选项 (增加了 reranking 相关参数)
 * @returns 搜索结果列表
 */
export async function searchRelevantContent(
  query: string, 
  options: { 
    limit?: number, // 向量搜索阶段的限制 (用于重排序前的候选集)
    threshold?: number,
    documentIds?: string[], // Filter by specific document IDs
    categoryFilter?: {
      docNumber?: string | number,
      catalystParams?: string[],
      reactionParams?: string[],
      resultParams?: string[]
    },
    maxContentLength?: number // 控制返回内容的最大长度
    // --- 新增 Reranking 相关选项 ---
    enableReranking?: boolean, // 是否启用重排序
    rerankModel?: string,      // 使用的重排序模型 (可选)
    initialCandidates?: number, // 初始向量检索数量 (默认 50)
    finalTopN?: number         // 重排序后最终返回的数量 (默认 5)
    embeddingSettings?: EmbeddingModelSettings // 新增：embedding设置
  } = {}
): Promise<SearchResult[]> {
  const { 
      threshold = 0.5, 
      documentIds, 
      enableReranking = false, // 默认不启用重排序
      rerankModel, 
      initialCandidates = 50, // 默认初始检索 50 个
      finalTopN = 5, // 默认最终返回 5 个
      embeddingSettings: passedEmbeddingSettings
  } = options;
  // limit 参数现在由 initialCandidates 控制
  const vectorSearchLimit = enableReranking ? initialCandidates : finalTopN; 
  
  console.log('[VectorService] 开始相关内容搜索...', { query, limit: vectorSearchLimit, threshold, documentIds, enableReranking, rerankModel, finalTopN });

  if (!query) return [];

  try {
    // 1. 获取查询向量
    const embeddingSettings = passedEmbeddingSettings || getEmbeddingSettings();
    console.log('[VectorService] 使用的embedding设置:', embeddingSettings);
    const [queryEmbedding] = await generateEmbeddings([query], embeddingSettings);
    if (!queryEmbedding) {
      console.error('[VectorService] 无法生成查询向量');
      return [];
    }

    // 2. 获取需要搜索的文档块
    let chunksToSearch: DocumentChunk[] = [];
    if (documentIds && documentIds.length > 0) {
      // 如果指定了文档ID，只获取这些文档的块
      console.log(`[VectorService] 获取指定文档的块: ${documentIds.join(', ')}`);
      const chunkPromises = documentIds.map(id => getDocumentChunks(id));
      const results = await Promise.allSettled(chunkPromises);
      results.forEach(result => {
        if (result.status === 'fulfilled' && result.value) {
          chunksToSearch.push(...result.value);
        }
         else if (result.status === 'rejected') {
           console.error("[VectorService] 获取部分文档块时出错:", result.reason);
           // 选择继续搜索剩下的，或者抛出错误
         }
      });
    } else {
      // 如果未指定文档ID，理论上应该获取所有块
      // **警告:** 这可能非常低效，需要后端支持或优化
      console.warn('[VectorService] 未指定文档ID，尝试获取所有文档块（可能非常低效！）');
       // 暂时禁用此功能，因为它需要一个新的后端接口或循环获取
       // chunksToSearch = await getAllDocumentChunks(); 
       throw new Error("搜索未指定文档的功能当前不可用，请提供 documentIds 过滤。")
    }

    console.log(`[VectorService] 获取到 ${chunksToSearch.length} 个文档块用于搜索`);

    // 3. 计算相似度并过滤
    const initialResults: SearchResult[] = [];
    for (const chunk of chunksToSearch) {
      if (chunk.embedding) {
        const similarity = cosineSimilarity(queryEmbedding, chunk.embedding);
        if (similarity >= threshold) {
          initialResults.push({ chunk, similarity });
        }
      }
    }

    console.log(`[VectorService] 找到 ${initialResults.length} 个初步匹配的块 (阈值: ${threshold})`);

    // 4. 排序和截断 (向量搜索结果)
    initialResults.sort((a, b) => b.similarity - a.similarity);
    // 截取足够的候选者用于重排序 (或最终结果，如果不重排)
    const candidateResults = initialResults.slice(0, vectorSearchLimit);

    // 5. 如果启用重排序
    if (enableReranking && candidateResults.length > 0) {
        console.log(`[VectorService] 开始对 ${candidateResults.length} 个候选块进行重排序...`);
        const candidateContents = candidateResults.map(r => r.chunk.content);

        try {
            // 调用 aiService 中的 rerankChunks
            const rerankedScores: RerankResult[] = await rerankChunks(
                query,
                candidateContents,
                embeddingSettings, // 传递包含 API Key 的设置
                rerankModel, // 传递模型名称 (可选)
                // topN 参数在这里不需要，因为我们需要所有候选者的分数来进行排序
            );

            // 将分数关联回原始候选结果
            // 创建一个 map 以便快速查找分数
            const scoreMap = new Map<number, number>();
            rerankedScores.forEach(rs => {
                scoreMap.set(rs.index, rs.score);
            });

            // 为每个候选结果添加 rerank_score 字段，如果找不到分数则设为极低值
            const resultsWithRerankScore = candidateResults.map((result, index) => ({
                ...result,
                rerank_score: scoreMap.get(index) ?? -Infinity 
            }));

            // 根据 rerank_score 降序排序
            resultsWithRerankScore.sort((a, b) => b.rerank_score - a.rerank_score);

            // 截取最终的 top N
            const finalResults = resultsWithRerankScore.slice(0, finalTopN);

            console.log(`[VectorService] 重排序完成，返回 ${finalResults.length} 个最相关的块`);
            return finalResults;

        } catch (rerankError) {
            console.error("[VectorService] 重排序过程中出错，将返回原始向量搜索结果:", rerankError);
            // 如果重排序失败，返回原始向量搜索的前 N 个结果作为备选
            const fallbackResults = candidateResults.slice(0, finalTopN);
            console.log(`[VectorService] 返回 ${fallbackResults.length} 个原始向量搜索结果作为备选`);
            return fallbackResults;
        }
    } else {
        // 不启用重排序，或没有候选结果，直接返回向量搜索结果
        const finalResults = candidateResults.slice(0, finalTopN); // 确保即使不重排也只返回 finalTopN 个
        console.log(`[VectorService] 未启用重排序或无候选块，返回 ${finalResults.length} 个向量搜索结果`);
        return finalResults;
    }

  } catch (error: any) {
    console.error('[VectorService] 搜索相关内容时出错:', error);
    // 返回空数组或重新抛出错误？返回空数组更安全
    return [];
  }
}

/**
 * 从文档内容中提取关键参数
 * @param document 文档对象
 * @returns 提取的参数
 */
export async function extractDocumentParameters(document: Document): Promise<{
  catalystParams: string[];
  reactionParams: string[];
  resultParams: string[];
}> {
  console.log(`[VectorService] 开始从文档提取参数: ${document.fileName}`);
  
  if (!document.textContent) {
    console.warn(`[VectorService] 文档 ${document.id} 内容为空，无法提取参数`);
    return {
      catalystParams: [],
      reactionParams: [],
      resultParams: []
    };
  }
  
  // 定义关键词模式
  const catalystPatterns = [
    /(?:催化剂|catalyst)[\s:：]+([^,.。，\n]+)/gi,
    /([A-Z][a-z]?\d*(?:\/[A-Z][a-z]?\d*)+)/g, // 例如: Ag/Al2O3, Pt/SiO2
    /([A-Z][a-z]?(?:-[A-Z][a-z]?)+)/g, // 例如: Ag-Pt
    /([A-Z][a-z]?[0-9]*(?:O[0-9]*)?)/g // 例如: Ag, Pt, TiO2, Al2O3
  ];
  
  const reactionPatterns = [
    /(?:温度|temperature)[\s:：]*(\d+(?:\.\d+)?)\s*(?:°C|K|℃)/gi,
    /(?:压力|pressure)[\s:：]*(\d+(?:\.\d+)?)\s*(?:MPa|bar|kPa|Pa|atm)/gi,
    /(?:时间|time)[\s:：]*(\d+(?:\.\d+)?)\s*(?:min|h|hour|分钟|小时)/gi,
    /(?:pH值|pH)[\s:：]*(\d+(?:\.\d+)?)/gi,
    /(?:溶剂|solvent)[\s:：]+([^,.。，\n]+)/gi,
    /(?:比例|ratio)[\s:：]*(\d+(?:\.\d+)?:\d+(?:\.\d+)?)/gi,
  ];
  
  const resultPatterns = [
    /(?:转化率|conversion)[\s:：]*(\d+(?:\.\d+)?)\s*%/gi,
    /(?:选择性|selectivity)[\s:：]*(\d+(?:\.\d+)?)\s*%/gi,
    /(?:产率|yield)[\s:：]*(\d+(?:\.\d+)?)\s*%/gi,
    /(?:TOF|转换频率)[\s:：]*(\d+(?:\.\d+)?)/gi,
    /(?:稳定性|stability)[\s:：]+([^,.。，\n]+)/gi,
  ];
  
  // 存储提取的参数
  const extractedParams = {
    catalystParams: new Set<string>(),
    reactionParams: new Set<string>(),
    resultParams: new Set<string>()
  };
  
  // 提取催化剂参数
  for (const pattern of catalystPatterns) {
    let match;
    while ((match = pattern.exec(document.textContent)) !== null) {
      if (match[1]) {
        // 过滤常见词，避免错误提取
        const param = match[1].trim();
        if (
          param.length > 1 && 
          !['the', 'and', 'or', 'in', 'on', 'at', 'by', 'for', 'with', 'to', 'a', 'an'].includes(param.toLowerCase()) &&
          !/^\d+$/.test(param) // 排除纯数字
        ) {
          extractedParams.catalystParams.add(param);
        }
      }
    }
  }
  
  // 提取反应参数
  for (const pattern of reactionPatterns) {
    let match;
    while ((match = pattern.exec(document.textContent)) !== null) {
      if (match[0]) {
        // 提取整个匹配项，包括参数名和值
        const param = match[0].trim();
        if (param.length > 2) {
          extractedParams.reactionParams.add(param);
        }
      }
    }
  }
  
  // 提取结果参数
  for (const pattern of resultPatterns) {
    let match;
    while ((match = pattern.exec(document.textContent)) !== null) {
      if (match[0]) {
        const param = match[0].trim();
        if (param.length > 2) {
          extractedParams.resultParams.add(param);
        }
      }
    }
  }
  
  // 转换Set为数组
  return {
    catalystParams: Array.from(extractedParams.catalystParams),
    reactionParams: Array.from(extractedParams.reactionParams),
    resultParams: Array.from(extractedParams.resultParams)
  };
}

/**
 * 从多个文档中提取并合并参数
 * @param documents 文档列表
 * @returns 合并后的参数
 */
export async function extractParametersFromDocuments(documents: Document[]): Promise<{
  catalystParams: string[];
  reactionParams: string[];
  resultParams: string[];
}> {
  const allParams = {
    catalystParams: new Set<string>(),
    reactionParams: new Set<string>(),
    resultParams: new Set<string>()
  };
  
  // 并行处理所有文档
  const paramPromises = documents.map(doc => extractDocumentParameters(doc));
  const results = await Promise.all(paramPromises);
  
  // 合并结果
  for (const result of results) {
    for (const param of result.catalystParams) {
      allParams.catalystParams.add(param);
    }
    for (const param of result.reactionParams) {
      allParams.reactionParams.add(param);
    }
    for (const param of result.resultParams) {
      allParams.resultParams.add(param);
    }
  }
  
  return {
    catalystParams: Array.from(allParams.catalystParams),
    reactionParams: Array.from(allParams.reactionParams),
    resultParams: Array.from(allParams.resultParams)
  };
}

/**
 * 向量化处理单个文档的内容
 * @param documentId 文档ID
 * @param documentTitle 可选的文档标题，用于日志记录
 * @returns 处理结果Promise
 */
export const vectorizeDocument = async (
  documentId: string,
  documentTitle?: string
): Promise<boolean> => {
  try {
    // 申请获取API执行令牌
    await ApiRateLimiter.getInstance().acquireToken();
    
    console.log(`开始向量化处理文档: ${documentId}${documentTitle ? ` (${documentTitle})` : ''}`);
    
    try {
      // 获取文档内容
      const document = await fetchDocumentById(documentId);
      if (!document) {
        console.error(`无法获取文档: ${documentId}`);
        ApiRateLimiter.getInstance().releaseToken();
        return false;
      }
      
      // 调用现有的RAG处理函数
      const documentChunks = await processDocumentForRAG(document);
      
      // 存储生成的块
      if (documentChunks.length > 0) {
        await storeDocumentChunks(documentChunks);
      } else {
        console.warn(`文档 ${documentId} 未生成任何向量数据块`);
      }
      
      // 释放API令牌
      ApiRateLimiter.getInstance().releaseToken();
      
      console.log(`文档向量化处理成功: ${documentId}`);
      return true;
    } catch (error) {
      // 处理具体执行错误
      console.error(`文档向量化处理失败: ${documentId}`, error);
      ApiRateLimiter.getInstance().releaseToken();
      return false;
    }
  } catch (error) {
    // 处理API令牌获取失败
    console.warn(`无法获取API令牌: ${documentId}`, error);
    return false;
  }
}; 