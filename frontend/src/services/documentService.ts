import { generateEmbeddings } from './aiService';
import { EmbeddingModelSettings } from '@/contexts/SettingsContext';
import { extractTextFromPDF, preprocessPDFText } from './pdfService';
import { extractTextFromWord, extractTextFromPPT } from './officeService';
import type { Document } from '@/types';
import { DocumentStatus } from '@/types/shared_local';
import axios from 'axios'; // FIX: Import global axios instead

// 检查是否在浏览器环境
const isBrowser = typeof window !== 'undefined';

// 后端 API 地址
const API_BASE_URL = 'http://localhost:3001';

// --- COMMENTED OUT: Old localStorage/IndexedDB Constants ---
/*
const DOCUMENTS_STORAGE_KEY = 'notebooklm_documents';
const DOCUMENT_IDS_STORAGE_KEY = 'notebooklm_document_ids';
const NOTEBOOK_DOCUMENTS_KEY_PREFIX = 'notebooklm_notebook_documents_';
const DOCUMENT_CONTENT_KEY_PREFIX = 'notebooklm_doc_content_';
const MAX_LOCALSTORAGE_DOCUMENT_SIZE = 1000000; // 约1MB，超过此大小使用IndexedDB存储文本内容
const NOTEBOOK_TO_DOCUMENTS_KEY = 'notebooklm_notebook_to_documents';
const DOCUMENTS_BY_NOTEBOOK_DISABLED = false; // 设置为true可禁用从所有文档中筛选的策略
const DOCUMENTS_IN_NOTEBOOK_DISABLED = false; // 设置为true可禁用从笔记本对象中获取文档的策略

const isIndexedDBSupported = isBrowser && 'indexedDB' in window;
*/

// --- COMMENTED OUT: IndexedDB Functions ---
/*
const openDB = (): Promise<IDBDatabase> => { ... };
const saveDocumentContentToIndexedDB = async (documentId: string, content: string): Promise<void> => { ... };
const getDocumentContentFromIndexedDB = async (documentId: string): Promise<string | null> => { ... };
const deleteDocumentContentFromIndexedDB = async (documentId: string): Promise<void> => { ... };
const saveDocumentMetadataToIndexedDB = async (document: Document): Promise<void> => { ... };
const getDocumentMetadataFromIndexedDB = async (documentId: string): Promise<Document | null> => { ... };
const getAllDocumentMetadataFromIndexedDB = async (): Promise<Document[]> => { ... };
const deleteDocumentMetadataFromIndexedDB = async (documentId: string): Promise<void> => { ... };
*/

// --- COMMENTED OUT: localStorage Helper Functions ---
/*
const saveDocumentIdsToLocalStorage = (documentIds: string[]): void => { ... };
const getDocumentIdsFromLocalStorage = (): string[] => { ... };
const decompressData = (compressedData: string): string => { ... };
const getAllDocumentsFromLocalStorage = (): Map<string, Document> => { ... };
const debugCheckLocalStorage = (notebookId: string): void => { ... };
const emergencyRecoverNotebookDocuments = (notebookId: string): Document[] => { ... };
*/

// --- COMMENTED OUT: Old Local Storage Based CRUD Functions ---
/*
export const getAllDocuments = async (): Promise<Document[]> => { ... };
export const getAllDocumentsSync = (): Document[] => { ... };
export const getDocumentById = async (id: string): Promise<Document | undefined> => { ... };
const getDocumentByIdSync = (id: string): Document | null => { ... };
export const getDocumentsByNotebookId = async (notebookId: string): Promise<Document[]> => { ... };
export const getDocumentsByNotebookIdSync = (notebookId: string, forceRefresh = false): Document[] => { ... };
const linkDocumentToNotebook = (documentId: string, notebookId: string): boolean => { ... };
const unlinkDocumentFromNotebook = (documentId: string, notebookId: string): void => { ... };
export const uploadDocument = async (file: File, notebookId: string): Promise<Document> => { ... };
export const deleteDocument = async (id: string): Promise<boolean> => { ... };
const saveDocument = async (document: Document): Promise<void> => { ... };
export const migrateDocumentsToIndexedDB = async (): Promise<void> => { ... };
export const cleanupInvalidDocument = async (documentId: string): Promise<void> => { ... };
export const updateDocumentStatus = async (documentId: string, status: DocumentStatus, statusMessage?: string): Promise<Document | undefined> => { ... };
export const updateDocumentEmbeddings = async (documentId: string, embeddings: number[][]): Promise<Document | undefined> => { ... };
const updateDocumentChunks = async (documentId: string, chunks: string[]): Promise<void> => { ... };
export const clearNotebookDocumentsCache = (notebookId: string): void => { ... };
const processFile = async (file: File, notebookId: string): Promise<Document> => { ... };
*/

// --- Utility Functions (Keep) ---
const readFileAsText = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (event) => {
      if (event.target && typeof event.target.result === 'string') {
        resolve(event.target.result);
      } else {
        reject(new Error('读取文件失败'));
      }
    };
    
    reader.onerror = () => {
      reject(new Error('读取文件时出错'));
    };
    
    reader.readAsText(file);
  });
};

const splitTextIntoChunks = (text: string, maxChunkSize: number = 1000): string[] => {
  // 简单分割成固定大小的块
  const chunks: string[] = [];
  let i = 0;
  
  while (i < text.length) {
    chunks.push(text.slice(i, i + maxChunkSize));
    i += maxChunkSize;
  }
  
  return chunks;
};

const generateChunks = (content: string): string[] => {
  if (!content || content.trim() === '') {
    return [];
  }
  
  // 简单实现：按段落分割，每个段落是一个文本块
  const paragraphs = content.split(/\n\s*\n/).filter(p => p.trim() !== '');
  
  // 如果段落太少，可能是PDF或其他格式，尝试按句子分割
  if (paragraphs.length < 3) {
    const sentences = content.split(/[.!?。！？]+/).filter(s => s.trim() !== '');
    return sentences;
  }
  
  return paragraphs;
};

const generateId = (): string => {
  return `doc_${Math.random().toString(36).substr(2, 9)}_${Date.now()}`;
};

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const getEmbeddingSettings = (): EmbeddingModelSettings => {
  // 这里需要从设置中获取实际配置，而不是使用默认值
  // 由于这是一个普通函数，不能直接使用React的useSettings钩子
  // 我们需要从localStorage直接读取保存的设置
  
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
            console.log('自动修正模型名称格式:', model);
          } else if (model === 'bge-large-zh-v1.5' || model === 'bge-large-zh') {
            model = 'BAAI/bge-large-zh-v1.5';
            console.log('自动修正模型名称格式:', model);
          } else if (model === 'bge-large-en-v1.5' || model === 'bge-large-en') {
            model = 'BAAI/bge-large-en-v1.5';
            console.log('自动修正模型名称格式:', model);
          }
          
          return {
            ...settings,
            model: model, // 使用修正后的模型名称
          };
        }
      }
    }
  } catch (error) {
    console.error('从localStorage读取嵌入向量设置失败:', error);
  }
  
  // 默认设置（如果无法从localStorage获取）
  console.warn('未找到或无效的嵌入向量设置，使用默认设置');
  return {
    provider: 'siliconflow',
    model: 'BAAI/bge-large-zh-v1.5',
    encodingFormat: 'float',
    apiKey: process.env.NEXT_PUBLIC_SILICONFLOW_API_KEY || ''
  };
};

// --- API Based Functions (Keep and Add) ---
export const fetchDocumentsByNotebookId = async (notebookId: string): Promise<Document[]> => {
  if (!notebookId) {
    console.error('获取笔记本文档失败: notebookId 不能为空');
    return []; // 或者抛出错误
  }

  // Corrected URL to match backend controller
  const url = `${API_BASE_URL}/api/documents/notebook/${notebookId}`; 
  console.log(`正在从以下地址获取文档: ${url}`);

  try {
    const response = await fetch(url);

    if (!response.ok) {
      // 尝试从响应体获取更多错误细节
      let errorBody = '无可用错误详情';
      try {
        errorBody = await response.text();
      } catch (e) {
        // 如果读取响应体失败则忽略
      }
      console.error(`API 错误 ${response.status}: ${response.statusText}. 响应体: ${errorBody}`);
      throw new Error(`获取文档失败: ${response.status} ${response.statusText}`);
    }

    // 假设后端返回 Document 对象数组
    const documents: Document[] = await response.json(); // 注意：这里会因为 Document 未正确导入而报错
    console.log(`成功获取笔记本 ${notebookId} 的 ${documents.length} 个文档`);
    return documents;

  } catch (error) {
    console.error(`调用 API 获取文档时出错 (${url}):`, error);
    // 重新抛出错误，以便调用方组件可以处理它（例如显示错误消息）
    throw error;
  }
};

/**
 * Uploads a document file to the backend API.
 * 
 * @param file The file object to upload.
 * @param notebookId The ID of the notebook to associate the document with.
 * @returns The created document object from the backend.
 * @throws Throws an error if the upload fails.
 */
export const uploadDocumentToApi = async (file: File, notebookId: string): Promise<any> => {
  // Add detailed logging for parameters
  console.log(`[documentService] uploadDocumentToApi called with:`);
  console.log(`  - file:`, file);
  console.log(`  - notebookId: ${notebookId} (Type: ${typeof notebookId})`);

  if (!file || !notebookId) {
    // Improve error message for missing notebookId
    if (!notebookId) {
      console.error('[documentService] Missing notebookId for upload.');
      throw new Error('Notebook ID is required for upload.');
    }
    if (!file) {
      console.error('[documentService] Missing file for upload.');
      throw new Error('File is required for upload.');
    }
    // Fallback error (shouldn't be reached if above checks are exhaustive)
    throw new Error('File and Notebook ID are required for upload.');
  }

  // Add type check for notebookId
  if (typeof notebookId !== 'string' || notebookId.trim() === '') {
      console.error(`[documentService] Invalid notebookId provided: Type=${typeof notebookId}, Value=${notebookId}`);
      throw new Error(`Invalid Notebook ID provided. Expected a non-empty string, but received type ${typeof notebookId}.`);
  }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('originalName', file.name); 

  const uploadUrl = '/api/documents/upload'; // Matches the POST URL from logs

  console.log(`[documentService] Uploading '${file.name}' to ${uploadUrl} for notebook ${notebookId}`);

  try {
    // FIX: Use global axios instance
    const response = await axios.post(uploadUrl, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      params: {
        notebookId: notebookId
      }
    });

    console.log('[documentService] File uploaded successfully:', response.data);
    return response.data; // Return the created document data

  } catch (error: any) {
    console.error('[documentService] API Error:', error.response?.status, error.response?.statusText, '. Body:', error.response?.data);
    const message = error.response?.data?.message || error.message || '上传文件时出错';
    throw new Error(`上传文件失败: ${message}`);
  }
};

export const deleteDocumentFromApi = async (documentId: string): Promise<void> => {
  if (!documentId) {
    throw new Error('删除文档失败: 必须提供文档 ID');
  }

  const url = `${API_BASE_URL}/api/documents/${documentId}`;
  console.log(`Deleting document from: ${url}`);

  try {
    const response = await fetch(url, {
      method: 'DELETE',
    });

    // DELETE 请求成功通常返回 200 OK 或 204 No Content
    if (!response.ok) {
      let errorBody = 'No error details available';
      try {
        errorBody = await response.text();
      } catch (e) {}
      console.error(`API Error ${response.status}: ${response.statusText}. Body: ${errorBody}`);
       let errorMessage = `删除文档失败: ${response.status} ${response.statusText}`;
      try {
        const errorJson = JSON.parse(errorBody);
        if (errorJson.message) {
            errorMessage = `删除文档失败: ${errorJson.message}`;
        }
      } catch(e) {}
      throw new Error(errorMessage);
    }

    console.log(`文档 ${documentId} 删除成功`);
    // 不需要返回值

  } catch (error) {
    console.error(`调用 API 删除文档时出错 (${url}):`, error);
    throw error; // 重新抛出，让调用者处理
  }
};

export const fetchDocumentById = async (documentId: string): Promise<Document> => {
  // ... (Placeholder implementation as before) ...
    if (!documentId) {
    throw new Error('获取文档失败: 必须提供文档 ID');
  }
  const url = `${API_BASE_URL}/api/documents/${documentId}`;
  console.log(`Fetching document details from: ${url}`);
  try {
    const response = await fetch(url);
    if (!response.ok) {
      if (response.status === 404) { throw new Error(`文档未找到: ${documentId}`); }
      let errorBody = ''; try { errorBody = await response.text(); } catch (e) {}
      console.error(`API Error ${response.status}: ${response.statusText}. Body: ${errorBody}`);
      throw new Error(`获取文档详情失败: ${response.status} ${response.statusText}`);
    }
    const document: Document = await response.json();
    console.log(`成功获取文档详情: ${document.id}`);
    return document;
  } catch (error) { console.error(`调用 API 获取文档详情时出错 (${url}):`, error); throw error; }
};

export const updateDocumentApi = async (documentId: string, data: Partial<Document>): Promise<Document> => {
  // ... (Placeholder implementation as before) ...
   if (!documentId) { throw new Error('更新文档失败: 必须提供文档 ID'); }
   if (!data || Object.keys(data).length === 0) { throw new Error('更新文档失败: 未提供更新数据'); }
   const url = `${API_BASE_URL}/api/documents/${documentId}`;
   console.log(`Updating document ${documentId} at: ${url}`);
   try {
    const response = await fetch(url, { method: 'PATCH', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(data) });
    if (!response.ok) {
      let errorBody = ''; try { errorBody = await response.text(); } catch (e) {}
      console.error(`API Error ${response.status}: ${response.statusText}. Body: ${errorBody}`);
      let errorMessage = `更新文档失败: ${response.status} ${response.statusText}`; try { const errorJson = JSON.parse(errorBody); if (errorJson.message) { errorMessage = `更新文档失败: ${errorJson.message}`; } } catch(e) {}
      throw new Error(errorMessage);
    }
    const updatedDocument: Document = await response.json();
    console.log(`文档 ${documentId} 更新成功`);
    return updatedDocument;
   } catch (error) { console.error(`调用 API 更新文档时出错 (${url}):`, error); throw error; }
};

// --- Client-Side Vectorization Logic (Keep but needs adaptation) ---
export const processDocumentVectorization = async (document: Document): Promise<Document> => {
  if (!isBrowser) return document; // Or throw error?

  console.log(`[Vectorization] 开始处理文档: ${document.fileName} (ID: ${document.id})`);

  // --- TODO: Step 1: Ensure textContent is available ---
  // ... (Existing TODO comments remain) ...

  const textContent = document.textContent || '';
  if (!textContent) {
      console.warn(`[Vectorization] 文档 ${document.id} 内容为空，无法进行向量化。`);
      try {
          // Replace updateDocumentStatus with updateDocumentApi
          return await updateDocumentApi(document.id, { status: DocumentStatus.FAILED, statusMessage: "内容为空无法向量化" });
      } catch (updateError) {
          console.error(`[Vectorization] 更新文档状态为失败时出错:`, updateError);
          return { ...document, status: DocumentStatus.FAILED, statusMessage: "内容为空无法向量化" };
      }
  }

  try {
    // Optional: Replace potential updateDocumentStatus call
    // await updateDocumentApi(document.id, { status: DocumentStatus.PROCESSING });

    // Check for existing embeddings
    let existingEmbeddings: number[][] | null = null;
    if (document.embeddings && Array.isArray(document.embeddings) && document.embeddings.length > 0) {
        existingEmbeddings = document.embeddings as number[][];
    }

    if (existingEmbeddings && existingEmbeddings.length > 0) {
      console.log(`[Vectorization] 文档 ${document.fileName} 已有嵌入向量，跳过。`);
      if (document.status !== DocumentStatus.COMPLETED) {
          try {
              // Replace updateDocumentStatus with updateDocumentApi
              return await updateDocumentApi(document.id, { status: DocumentStatus.COMPLETED, statusMessage: "已有向量" });
          } catch (updateError) {
              console.error(`[Vectorization] 更新文档状态为完成时出错:`, updateError);
              return { ...document, status: DocumentStatus.COMPLETED, statusMessage: "已有向量" };
          }
      }
      return document;
    }

    // Generate chunks
    let chunks = generateChunks(textContent);
    const stringifiedChunks = JSON.stringify(chunks);

    // Get embedding settings
    const embeddingSettings = getEmbeddingSettings();

    if (chunks.length === 0) {
      const errorMessage = "文档内容为空或无法生成有效的文本块";
      console.error(`[Vectorization] ${errorMessage}`);
      try {
          // Replace updateDocumentStatus with updateDocumentApi
          return await updateDocumentApi(document.id, { status: DocumentStatus.FAILED, statusMessage: errorMessage, textChunks: stringifiedChunks });
      } catch (updateError) {
           console.error(`[Vectorization] 更新文档状态为失败时出错:`, updateError);
           return { ...document, status: DocumentStatus.FAILED, statusMessage: errorMessage, textChunks: stringifiedChunks };
      }
    }

    // Batch processing for embeddings
    const MAX_BATCH_SIZE = 64;
    const batches = [];
    for (let i = 0; i < chunks.length; i += MAX_BATCH_SIZE) { batches.push(chunks.slice(i, i + MAX_BATCH_SIZE)); }
    console.log(`[Vectorization] 文档 ${document.fileName} 分成 ${batches.length} 个批次`);

    let allEmbeddings: number[][] = [];
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      console.log(`[Vectorization] 处理批次 ${i+1}/${batches.length} (${batch.length} 块)`);
      try {
        const batchEmbeddings = await generateEmbeddings(batch, embeddingSettings);
        allEmbeddings = [...allEmbeddings, ...batchEmbeddings];
      } catch (error) {
        console.error(`[Vectorization] 批次 ${i+1} 处理失败:`, error);
        const errorMessage = `向量化处理失败 (批次 ${i+1}): ${error instanceof Error ? error.message : '未知错误'}`;
        try {
            // Replace updateDocumentStatus with updateDocumentApi
            await updateDocumentApi(document.id, { status: DocumentStatus.FAILED, statusMessage: errorMessage });
        } catch (updateError) {
            console.error(`[Vectorization] 更新文档状态为失败时也出错:`, updateError);
        }
        throw new Error(errorMessage);
      }
    }

    // Ensure consistency if some batches failed but we didn't rethrow immediately (logic adjusted above to rethrow)
    if (allEmbeddings.length !== chunks.length) {
        // This part should ideally not be reached if batch failures rethrow
        console.warn(`[Vectorization] 嵌入向量数量(${allEmbeddings.length})与文本块数量(${chunks.length})不匹配. 可能有批次处理失败.`);
        // Decide how to handle partial success - e.g., fail or save partial results?
        // Forcing fail state for simplicity if counts don't match
        const errorMessage = "未能为所有文本块生成嵌入向量";
         try {
            // Replace updateDocumentStatus with updateDocumentApi
            return await updateDocumentApi(document.id, { status: DocumentStatus.FAILED, statusMessage: errorMessage });
        } catch (updateError) {
             console.error(`[Vectorization] 更新文档状态为失败时出错:`, updateError);
             return { ...document, status: DocumentStatus.FAILED, statusMessage: errorMessage };
        }
    }

    // --- Step 2: Save results via API ---
    console.log(`[Vectorization] 向量化完成，共生成 ${allEmbeddings.length} 个向量。正在通过 API 更新文档...`);
    const updateData: Partial<Document> = {
        embeddings: allEmbeddings, // Assumes backend accepts this structure (Json?)
        status: DocumentStatus.COMPLETED,
        textChunks: stringifiedChunks, // Save the stringified chunks used for embedding
        statusMessage: '向量化完成'
    };
    // This already correctly calls updateDocumentApi
    const updatedDocument = await updateDocumentApi(document.id, updateData);
    console.log(`[Vectorization] 文档 ${document.id} 通过 API 更新成功。`);
    return updatedDocument; // Return the final document state from the API

  } catch (error) {
    console.error(`[Vectorization] 处理文档 ${document.fileName} 时发生最终错误:`, error);
    const errorMessage = `向量化处理失败: ${error instanceof Error ? error.message : '未知错误'}`;
    try {
        // Replace updateDocumentStatus with updateDocumentApi
        return await updateDocumentApi(document.id, { status: DocumentStatus.FAILED, statusMessage: errorMessage });
    } catch (updateError) {
        console.error(`[Vectorization] 更新文档状态为失败时也出错:`, updateError);
        return { ...document, status: DocumentStatus.FAILED, statusMessage: errorMessage };
    }
  }
};

/**
 * 获取文档内容的函数
 * @param documentId - 文档ID
 * @returns Promise<string> - 返回文档内容的Promise
 */
export const getDocumentContent = async (documentId: string): Promise<string> => {
  if (!documentId) {
    throw new Error('获取文档内容失败: 必须提供文档 ID');
  }

  const url = `${API_BASE_URL}/api/documents/${documentId}/content`;
  console.log(`正在从 ${url} 获取文档内容`);

  try {
    const response = await fetch(url);
    
    if (!response.ok) {
      let errorBody = '无可用错误详情';
      let errorJson = null;
      
      try {
        errorBody = await response.text();
        try {
          errorJson = JSON.parse(errorBody);
        } catch (e) {
          // 如果不是JSON则忽略
        }
      } catch (e) {
        // 如果读取响应体失败则忽略
      }
      
      console.error(`API 错误 ${response.status}: ${response.statusText}. 响应体:`, errorBody);
      
      // 首先检查是否是因为文档状态问题
      if (response.status === 500) {
        // 获取文档状态详情
        try {
          const docStatus = await getDocumentStatus(documentId);
          
          if (docStatus.status === 'FAILED') {
            // 如果文档处理失败，提供更具体的错误信息
            console.log('文档处理失败，查询失败原因:', docStatus);
            
            let errorMessage = `文档处理失败: ${docStatus.statusMessage || '未知原因'}`;
            
            // 抛出带有附加信息的错误
            const error = new Error(errorMessage) as Error & { isDocumentProcessingError?: boolean, docId?: string, canReprocess?: boolean };
            error.isDocumentProcessingError = true;
            error.docId = documentId;
            error.canReprocess = true;
            throw error;
          } else if (docStatus.status === 'PENDING' || docStatus.status === 'PROCESSING') {
            // 如果文档仍在处理中
            const error = new Error(`文档仍在处理中 (状态: ${docStatus.status})，请稍后再试`) as Error & { isDocumentProcessingError?: boolean, docId?: string };
            error.isDocumentProcessingError = true;
            error.docId = documentId;
            throw error;
          } else if (!docStatus.textContentExists && docStatus.fileExists) {
            // 文件存在但没有提取文本内容
            const error = new Error('文档文件存在但未能成功提取文本内容，请尝试重新处理') as Error & { isDocumentProcessingError?: boolean, docId?: string, canReprocess?: boolean };
            error.isDocumentProcessingError = true;
            error.docId = documentId;
            error.canReprocess = true;
            throw error;
          } else if (!docStatus.fileExists) {
            // 文件不存在
            throw new Error('文档文件不存在或已被删除');
          }
        } catch (statusError) {
          if ((statusError as Error).isDocumentProcessingError) {
            throw statusError;
          }
          // 如果获取状态本身失败，则抛出原始错误
        }
      }
      
      // 如果无法确定具体原因，则使用通用错误信息
      let errorMessage = errorJson?.message || `获取文档内容失败: ${response.status} ${response.statusText}`;
      throw new Error(errorMessage);
    }

    const content = await response.text();
    console.log(`成功获取文档 ${documentId} 的内容, 长度: ${content.length}`);
    return content;

  } catch (error) {
    console.error(`调用 API 获取文档内容时出错 (${url}):`, error);
    throw error;
  }
};

/**
 * 获取文档详细状态信息
 * @param documentId - 文档ID
 * @returns Promise<object> - 返回文档状态详情
 */
export const getDocumentStatus = async (documentId: string): Promise<{
  id: string;
  status: string | null;
  statusMessage: string | null;
  filePath?: string | null;
  textContentExists: boolean;
  fileExists: boolean;
}> => {
  if (!documentId) {
    throw new Error('获取文档状态失败: 必须提供文档 ID');
  }

  const url = `${API_BASE_URL}/api/documents/${documentId}/status`;
  console.log(`正在从 ${url} 获取文档状态`);

  try {
    const response = await fetch(url);
    
    if (!response.ok) {
      let errorBody = '无可用错误详情';
      try {
        errorBody = await response.text();
      } catch (e) {
        // 如果读取响应体失败则忽略
      }
      console.error(`API 错误 ${response.status}: ${response.statusText}. 响应体: ${errorBody}`);
      throw new Error(`获取文档状态失败: ${response.status} ${response.statusText}`);
    }

    const status = await response.json();
    console.log(`成功获取文档 ${documentId} 的状态:`, status);
    return status;

  } catch (error) {
    console.error(`调用 API 获取文档状态时出错 (${url}):`, error);
    throw error;
  }
};

/**
 * 请求重新处理文档
 * @param documentId - 文档ID
 * @returns Promise<Document> - 返回更新后的文档对象
 */
export const reprocessDocument = async (documentId: string): Promise<Document> => {
  if (!documentId) {
    throw new Error('重新处理文档失败: 必须提供文档 ID');
  }

  const url = `${API_BASE_URL}/api/documents/${documentId}/reprocess`;
  console.log(`正在请求重新处理文档: ${url}`);

  try {
    const response = await fetch(url, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      }
    });
    
    if (!response.ok) {
      let errorBody = '无可用错误详情';
      try {
        errorBody = await response.text();
      } catch (e) {
        // 如果读取响应体失败则忽略
      }
      console.error(`API 错误 ${response.status}: ${response.statusText}. 响应体: ${errorBody}`);
      throw new Error(`重新处理文档失败: ${response.status} ${response.statusText}`);
    }

    const document = await response.json();
    console.log(`成功请求重新处理文档 ${documentId}`);
    return document;

  } catch (error) {
    console.error(`调用 API 重新处理文档时出错 (${url}):`, error);
    throw error;
  }
};

// End of file or other remaining code 