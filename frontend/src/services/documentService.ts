import { generateEmbeddings } from './aiService';
import { EmbeddingModelSettings } from '@/contexts/SettingsContext';
// import { extractTextFromPDF, preprocessPDFText } from './pdfService';
// import { extractTextFromWord, extractTextFromPPT } from './officeService';
import type { Document } from '@/types';
import { DocumentStatus } from '@/types/shared_local';
import axios from 'axios'; // 保持 axios 导入，因为 handleApiError 在 apiClient.ts 中，但 isAxiosError 可能在此文件其他地方使用
import apiClient, { handleApiError } from './apiClient';

// const isBrowser = typeof window !== 'undefined'; // 已移除
// const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001'; // 已移除

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
  
  const paragraphs = content.split(/\n\s*\n/).filter(p => p.trim() !== '');
  
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
  try {
    if (typeof window !== 'undefined') {
      const savedSettings = localStorage.getItem('embeddingSettings');
      if (savedSettings) {
        const settings = JSON.parse(savedSettings) as EmbeddingModelSettings;
        if (settings && settings.apiKey && settings.apiKey.trim() !== '') {
          console.log('成功从localStorage加载嵌入向量设置');
          
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
            model: model,
          };
        }
      }
    }
  } catch (error) {
    console.error('从localStorage读取嵌入向量设置失败:', error);
  }
  
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
    return [];
  }
      const url = `/documents/notebook/${notebookId}`;
  console.log(`正在从以下地址获取文档: ${apiClient.defaults.baseURL}${url}`);
  try {
    const response = await apiClient.get<Document[]>(url);
    console.log(`成功获取笔记本 ${notebookId} 的 ${response.data.length} 个文档`);
    return response.data;
  } catch (error) {
    console.error(`调用 API 获取文档时出错 (${url}):`, error);
    throw handleApiError(error, 'fetchDocumentsByNotebookId');
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
export const uploadDocumentToApi = async (file: File, notebookId: string, originalName?: string): Promise<Document> => {
  console.log(`[documentService] uploadDocumentToApi called with:`, { fileName: file.name, notebookId, originalName });
  if (!file || !notebookId) {
    throw new Error('File and Notebook ID are required for upload.');
  }

  const formData = new FormData();
  formData.append('file', file);
  if (originalName) {
    formData.append('originalName', originalName);
  }

      const url = `/documents/upload?notebookId=${encodeURIComponent(notebookId)}`;
  console.log(`Uploading to: ${apiClient.defaults.baseURL}${url}`);

  try {
    const response = await apiClient.post<Document>(url, formData, {
      timeout: 300000, // 5分钟超时，支持大文件上传
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    console.log('文档上传成功:', response.data);
    return response.data;
  } catch (error) {
    console.error('文档上传API调用失败:', error);
    throw handleApiError(error, 'uploadDocumentToApi');
  }
};

export const deleteDocumentFromApi = async (documentId: string): Promise<void> => {
  if (!documentId) {
    throw new Error('Document ID is required for deletion.');
  }
  const url = `/documents/${documentId}`;
  try {
    await apiClient.delete(url);
    console.log(`Document ${documentId} deleted successfully from API.`);
  } catch (error) {
    throw handleApiError(error, 'deleteDocumentFromApi');
  }
};

export const fetchDocumentById = async (documentId: string): Promise<Document | null> => {
  if (!documentId) return null;
  const url = `/documents/${documentId}`;
  try {
    const response = await apiClient.get<Document>(url);
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response && error.response.status === 404) {
      return null;
    }
    throw handleApiError(error, 'fetchDocumentById');
  }
};

export const updateDocumentApi = async (documentId: string, data: Partial<Document>): Promise<Document> => {
  if (!documentId) throw new Error('Document ID is required for update.');
  const url = `/documents/${documentId}`;
  try {
    const response = await apiClient.patch<Document>(url, data);
    return response.data;
  } catch (error) {
    throw handleApiError(error, 'updateDocumentApi');
  }
};

/**
 * 获取文档内容的函数
 * @param documentId - 文档ID
 * @returns Promise<string> - 返回文档内容的Promise
 */
export const getDocumentContent = async (documentId: string): Promise<string | null> => {
  if (!documentId) return null;
  const url = `/documents/${documentId}/content`;
  try {
    const response = await apiClient.get<string>(url, { responseType: 'text' });
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response && error.response.status === 404) {
      return null;
    }
    throw handleApiError(error, 'getDocumentContent');
  }
};

/**
 * 获取文档详细状态信息
 * @param documentId - 文档ID
 * @returns Promise<object> - 返回文档状态详情
 */
export const getDocumentStatus = async (documentId: string): Promise<any | null> => {
  if (!documentId) return null;
  const url = `/documents/${documentId}/status`;
  try {
    const response = await apiClient.get<any>(url);
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response && error.response.status === 404) {
      return null;
    }
    throw handleApiError(error, 'getDocumentStatus');
  }
};

/**
 * 请求重新处理文档
 * @param documentId - 文档ID
 * @returns Promise<Document> - 返回更新后的文档对象
 */
export const reprocessDocument = async (documentId: string): Promise<Document | null> => {
  if (!documentId) return null;
  const url = `/documents/${documentId}/reprocess`;
  try {
    const response = await apiClient.patch<Document>(url);
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response && error.response.status === 404) {
      return null;
    }
    throw handleApiError(error, 'reprocessDocument');
  }
};

// --- Client-Side Vectorization Logic (Keep but needs adaptation) ---
export const processDocumentVectorization = async (document: Document): Promise<Document> => {
  if (!document || !document.textContent) {
    console.warn('文档或文档内容为空，跳过向量化处理。');
    return {
      ...document,
      status: DocumentStatus.VECTORIZATION_SKIPPED,
      statusMessage: '文档内容为空'
    };
  }

  try {
    const embeddingSettings = getEmbeddingSettings();
    if (!embeddingSettings.apiKey) {
      console.error('API Key 未配置，无法进行向量化。');
      console.log(`文档 ${document.fileName} 有文本内容但向量化失败，仍可用于AI分析`);
      return {
        ...document,
        status: DocumentStatus.VECTORIZATION_FAILED,
        statusMessage: 'API Key未配置，向量化失败，但文档仍可用于AI分析'
      };
    }

    console.log(`开始处理文档 ${document.id} 的向量化，使用模型: ${embeddingSettings.model}`);
    const chunks = generateChunks(document.textContent);
    if (chunks.length === 0) {
      console.warn('文档内容分块为0，跳过向量化。');
      return {
        ...document,
        status: DocumentStatus.VECTORIZATION_SKIPPED,
        statusMessage: 'No content chunks to vectorize'
      };
    }

    const embeddings = await generateEmbeddings(chunks, embeddingSettings);
    console.log(`文档 ${document.id} 向量化完成，生成了 ${embeddings.length} 个向量。`);

    const vectorDataUrl = `/documents/${document.id}/vector-data`;
    await apiClient.post(vectorDataUrl, { vectorData: embeddings });
    console.log(`文档 ${document.id} 的向量数据已保存到后端。`);

    return {
      ...document,
      status: DocumentStatus.COMPLETED,
      statusMessage: '文档处理和向量化完成',
    };
  } catch (error) {
    console.error(`处理文档 ${document.id} 向量化时出错:`, error);
    const message = error instanceof Error ? error.message : '向量化失败';
    
    console.log(`文档 ${document.fileName} 向量化失败但有文本内容，仍可用于AI分析`);
    return {
      ...document,
      status: DocumentStatus.VECTORIZATION_FAILED,
      statusMessage: `${message}，但文档仍可用于AI分析`,
    };
  }
};

// End of file or other remaining code 