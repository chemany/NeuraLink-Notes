'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import type { Document } from '../types/shared_local';
import { DocumentStatus } from '../types/shared_local';
import * as documentService from '../services/documentService'; // 导入为命名空间
import { 
  deleteDocumentFromApi, 
  fetchDocumentById, 
  reprocessDocument, 
  getDocumentStatus,
  getDocumentContent as fetchDocumentContent
} from '../services/documentService';
import { formatFileSize, formatDate } from '@/utils/formatters';
import { toast } from 'react-hot-toast';
import dynamic from 'next/dynamic';
import { saveAs } from 'file-saver';
import { useNotebook } from '@/contexts/NotebookContext';
import axios from 'axios'; // 添加axios导入
import { processDocumentForRAG, storeDocumentChunks, getDocumentChunks } from '@/services/vectorService'; // 添加向量化处理函数

// 在文件顶部添加类型声明
declare module 'react-file-viewer';
declare module 'file-saver';

// Dynamically import FileViewer with SSR disabled
const FileViewer = dynamic(() => import('react-file-viewer'), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center h-full w-full">
    <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full"></div>
  </div>
});

// 使用内联SVG代替tabler图标
const FileIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);

// 数据库图标
const DatabaseIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-2.5 w-2.5 inline-block ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8-4" />
  </svg>
);

// 新增缺失的图标定义
const EyeIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-.274 1.006-.682 1.948-1.17 2.818M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const TrashIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);

const PlusCircleIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const MinusCircleIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

// 状态图标返回类型定义
interface StatusIconResult {
  icon: React.ReactNode;
  label: string;
  color: string;
}

interface DocumentsListProps {
  notebookId: string;
  onSelectDocument?: (document: Document) => void;
  onPreviewDocument?: (document: Document, content: string | ArrayBuffer, inChat: boolean) => void;
  selectedChatDocIds?: Set<string>;
  onToggleChatSelection?: (document: Document) => void;
}

// 定义后端基础 URL (理想情况下应来自环境变量)
const BACKEND_API_BASE = 'http://localhost:3001';

// 修改向量化状态和队列初始化，确保每个笔记本只处理一批文档
const VECTORIZE_TOAST_ID = 'vectorize-status-toast'; // 固定的toast ID用于状态更新

export default function DocumentsList({ 
  notebookId, 
  onSelectDocument, 
  onPreviewDocument,
  selectedChatDocIds = new Set<string>(),
  onToggleChatSelection
}: DocumentsListProps) {
  const { 
    documents,
    isLoadingDocuments,
    documentError,
    refetchDocuments,
    currentNotebook
  } = useNotebook();

  // Log the correct state variable
  console.log("[DocumentsList] Rendering with documents:", documents);

  const [isMounted, setIsMounted] = useState(false);
  const [selectedDocIds, setSelectedDocIds] = useState<Set<string>>(new Set());
  const [clickTimer, setClickTimer] = useState<NodeJS.Timeout | null>(null);

  // Ref to store the polling interval ID
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const POLLING_INTERVAL_MS = 5000; // Poll every 5 seconds

  // 在现有状态钩子下添加一个用于自动刷新的状态和useEffect
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
  const [autoRefreshInterval, setAutoRefreshInterval] = useState(5000); // 5秒
  const autoRefreshTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 添加已向量化文档的集合状态
  const [vectorizedDocIds, setVectorizedDocIds] = useState<Set<string>>(() => {
    // 从localStorage加载已处理文档ID
    if (typeof window !== 'undefined') {
      try {
        const savedIds = localStorage.getItem(`vectorized_docs_${notebookId}`);
        if (savedIds) {
          return new Set<string>(JSON.parse(savedIds));
        }
      } catch (e) {
        console.error('从localStorage加载向量化状态失败:', e);
      }
    }
    return new Set<string>();
  });
  
  // *** 新增：添加处理失败文档的集合状态 ***
  const [failedVectorizationIds, setFailedVectorizationIds] = useState<Set<string>>(() => {
    // 从localStorage加载处理失败的文档ID
    if (typeof window !== 'undefined') {
      try {
        const savedFailedIds = localStorage.getItem(`failed_vectorized_docs_${notebookId}`);
        if (savedFailedIds) {
          return new Set<string>(JSON.parse(savedFailedIds));
        }
      } catch (e) {
        console.error('从localStorage加载失败向量化状态失败:', e);
      }
    }
    return new Set<string>();
  });

  // 保存向量化状态到localStorage
  useEffect(() => {
    // 确保有notebookId且vectorizedDocIds不为空
    if (notebookId && vectorizedDocIds.size > 0) {
      try {
        localStorage.setItem(
          `vectorized_docs_${notebookId}`, 
          JSON.stringify(Array.from(vectorizedDocIds))
        );
      } catch (e) {
        console.error('保存向量化状态到localStorage失败:', e);
      }
    }
  }, [vectorizedDocIds, notebookId]);

  // *** 新增：保存处理失败状态到localStorage ***
  useEffect(() => {
    if (notebookId && failedVectorizationIds.size > 0) {
      try {
        localStorage.setItem(
          `failed_vectorized_docs_${notebookId}`,
          JSON.stringify(Array.from(failedVectorizationIds))
        );
      } catch (e) {
        console.error('保存失败向量化状态到localStorage失败:', e);
      }
    }
    // 如果集合为空，可以考虑从localStorage中移除该项
    else if (notebookId && failedVectorizationIds.size === 0) {
       try {
         localStorage.removeItem(`failed_vectorized_docs_${notebookId}`);
       } catch (e) {
          console.error('移除失败向量化状态localStorage项失败:', e);
       }
    }
  }, [failedVectorizationIds, notebookId]);

  // 在组件顶部添加处理队列状态
  const [processingQueue, setProcessingQueue] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const processingQueueRef = useRef<string[]>([]);
  const processingLockRef = useRef(false); // 互斥锁，确保同一时间只有一个文档在处理
  const currentlyProcessingDocIdsRef = useRef(new Set<string>()); // 新增 Ref 来跟踪实际已启动处理的文档
  
  // 添加统计计数器
  const [processedCount, setProcessedCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [totalToProcess, setTotalToProcess] = useState(0);
  
  // 全局向量化状态保存，确保即使组件重新渲染也不会重启处理
  const [globalProcessingStarted, setGlobalProcessingStarted] = useState(false);
  
  // *** 新增：控制并发处理数量 ***
  const MAX_CONCURRENT_VECTORIZATIONS = 1; // *** 关键修改：确保同一时间只有一个文档在处理，避免本地资源耗尽 ***
  const activeVectorizationsRef = useRef(0);
  
  // 添加最大队列长度限制
  const MAX_QUEUE_SIZE = 50; // 大幅增加队列大小
  
  // 添加对文档状态变化的检测，自动触发向量化
  const prevDocumentsRef = useRef<Document[] | null>(null);
  
  // 在组件顶部添加 isProcessingRef
  const isProcessingRef = useRef(isProcessing); // 创建 ref

  // 更新 ref 当 state 改变时
  useEffect(() => {
    isProcessingRef.current = isProcessing;
  }, [isProcessing]);
  
  // 删除重复定义的互斥锁
  // const processingLockRef = useRef(false);
  
  // 修改全局状态toast更新函数
  const updateVectorizeStatus = () => {
    const inQueue = processingQueue.length;
    const done = processedCount;
    const failed = failedCount;
    const total = totalToProcess;
    
    if (total > 0) {
      // 只保留一个toast用于状态更新
      toast.dismiss(VECTORIZE_TOAST_ID);
      
      if (inQueue === 0 && done + failed === total) {
        // 全部处理完成
        if (done > 0) {
          // 成功处理了文档，显示静默成功提示
          toast.success(
            `${done}个文档已准备好用于AI查询`, 
            { id: VECTORIZE_TOAST_ID, duration: 3000 }
          );

        }
        
        if (failed > 0) {
          // 有处理失败的情况
          toast.error(
            `${failed}个文档向量化失败，请重试`, 
            { id: VECTORIZE_TOAST_ID, duration: 3000 }
          );

        }
      } else if (inQueue > 0) {
        // 处理中，隐藏loading状态，减少界面干扰
        // 只在开始和结束时显示toast
        if (done + failed === 0) {
          toast.loading(
            `正在准备文档...`, 
            { id: VECTORIZE_TOAST_ID, duration: 3000 }
          );

        }
      }
    }
  };
  
  // 添加全局速率限制变量
  const RATE_LIMIT_MS = 1000; // 单个文档处理最少间隔30秒
  const lastProcessedTimeRef = useRef<number>(0);
  
  // 添加对文档状态变化的检测，自动触发向量化
  useEffect(() => {
    // 如果文档列表为空或未变化，直接返回
    if (!documents || documents.length === 0) return;
    
    // 强制清除localStorage中的向量化状态，确保每次重新加载时都会重新检测
    if (typeof window !== 'undefined' && notebookId) {
      try {
        // 仅在开发环境下启用自动清除，生产环境可以注释掉这段代码
        // localStorage.removeItem(`vectorized_docs_${notebookId}`);
        // localStorage.removeItem(`failed_vectorized_docs_${notebookId}`);
        // console.log(`[DocumentsList] 已清除本地存储的向量化状态，确保重新检测`);
        
        // 重置状态 - 如果需要强制重处理，取消下面的注释
        // if (vectorizedDocIds.size > 0) {
        //   setVectorizedDocIds(new Set());
        // }
        // if (failedVectorizationIds.size > 0) {
        //   setFailedVectorizationIds(new Set());
        // }
      } catch (e) {
        console.error('清除localStorage向量化状态失败:', e);
      }
    }

    // 查找状态为 COMPLETED 且需要向量化的文档
    const newlyCompletedDocs = documents.filter(doc => {
      const isCompleted = doc.status === DocumentStatus.COMPLETED;
      const needsVectorizing = !vectorizedDocIds.has(doc.id) &&
                             !processingQueue.includes(doc.id) && // 确保不在等待队列中（虽然 vectorizeDocument 也会检查锁）
                             !failedVectorizationIds.has(doc.id) &&
                             !currentlyProcessingDocIdsRef.current.has(doc.id); // <--- 新增检查，确保没有正在被 vectorizeDocument 函数处理
      
      return isCompleted && needsVectorizing;
    });

    if (newlyCompletedDocs.length > 0) {
      console.log(`[DocumentsList useEffect] 检测到 ${newlyCompletedDocs.length} 个新完成且待向量化的文档，准备自动处理`);

      toast.dismiss(VECTORIZE_TOAST_ID);
      toast.loading(
        `正在为AI查询准备 ${newlyCompletedDocs.length} 个新文档...`,
        { id: VECTORIZE_TOAST_ID, duration: 3000 }
      );

      newlyCompletedDocs.forEach(doc => {
        if (!currentlyProcessingDocIdsRef.current.has(doc.id)) {
          console.log(`[DocumentsList useEffect] 将文档 ${doc.id} (${doc.fileName}) 加入 currentlyProcessingDocIdsRef 并调用 vectorizeDocument`);
          currentlyProcessingDocIdsRef.current.add(doc.id); // 在调用前加入，标记为即将处理
          vectorizeDocument(doc.id);
        } else {
          console.log(`[DocumentsList useEffect] 文档 ${doc.id} (${doc.fileName}) 已在 currentlyProcessingDocIdsRef 中，跳过重复调用 vectorizeDocument`);
        }
      });
    } else {
      // console.log(`[DocumentsList useEffect] 没有检测到需要向量化的新文档`);
    }

    prevDocumentsRef.current = documents;
  }, [documents, vectorizedDocIds, processingQueue, failedVectorizationIds, notebookId]);

  // 修改向量化文档的函数，实现队列处理机制并减少提示
  const vectorizeDocument = async (docId: string) => {
    const documentObject = documents.find(d => d.id === docId);
    const docNameForToast = documentObject?.fileName || docId;

    // 检查 processingLockRef，这是主要的并发控制
    if (processingLockRef.current) {
      // 如果锁被占用，检查是否是当前文档正在被处理
      if (processingQueueRef.current[0] === docId && currentlyProcessingDocIdsRef.current.has(docId)) {
        console.log(`[vectorizeDocument] 文档 ${docId} (${docNameForToast}) 已由另一个流程启动处理 (锁被占用，且ID在处理中)，此调用实例跳过。`);
      } else {
        console.warn(`[vectorizeDocument] 向量化处理函数被调用，但处理锁 (processingLockRef) 已被文档 ${processingQueueRef.current[0] || '未知'} 占用。文档 ${docId} (${docNameForToast}) 的此次调用将跳过。稍后useEffect或队列机制会处理。`);
      }
      // 即使跳过，如果是由useEffect错误地加入的，也应该从 currentlyProcessingDocIdsRef 中移除，因为它没有实际启动此实例
      // 但要注意，如果是队列的正常轮询，不应移除。
      // 此处逻辑简化：如果锁被占用，此实例不处理，依赖useEffect和队列的下一轮。由useEffect添加的标记，在finally中统一移除。
      return;
    }
    
    // 确保此ID确实在待处理集合中，如果不是（例如，直接调用或其他逻辑错误），则不应锁定
    if (!currentlyProcessingDocIdsRef.current.has(docId)) {
        console.warn(`[vectorizeDocument] 文档 ${docId} (${docNameForToast}) 不在 currentlyProcessingDocIdsRef 中，但尝试启动向量化。可能是一个过时的调用或逻辑问题。为安全起见，跳过此次执行。`);
        return;
    }

    processingLockRef.current = true; // 设置主处理锁
    activeVectorizationsRef.current += 1;
    // 将当前处理的文档ID移到队列头部（如果它不在那里的话），确保队列处理顺序的明确性
    // 这主要针对 vectorizeDocument 可能由 useEffect 直接调用的情况
    setProcessingQueue(prev => {
        const newQueue = [docId, ...prev.filter(id => id !== docId)];
        processingQueueRef.current = newQueue;
        return newQueue;
    });

    const startTime = Date.now();
    console.log(`[vectorizeDocument] 开始向量化文档 (主流程): ${docId} (${docNameForToast})`);

    try {
      // toast.loading(`正在处理文档 ${docNameForToast}...`, { id: `vectorize-${docId}` }); // 移到 processNextInQueue 或根据UI/UX调整

      if (!documentObject) {
        console.error(`[vectorizeDocument] 未找到文档对象: ${docId}`);
        throw new Error(`未找到文档对象: ${docId}`);
      }

      if (vectorizedDocIds.has(docId)) {
        console.log(`[vectorizeDocument] 文档 ${docId} (${docNameForToast}) 已在本地标记为向量化，跳过实际处理。`);
        setProcessedCount(prev => prev + 1);
        // toast.success(`文档 ${docNameForToast} 已处理。`, { id: `vectorize-${docId}`, duration: 2000 }); // toast由processNextInQueue管理
        // taskSuccess = true; // 移至 processNextInQueue
        return; // 直接返回，finally会处理清理和队列
      }

      const now = Date.now();
      const timeSinceLastProcess = now - lastProcessedTimeRef.current;
      if (lastProcessedTimeRef.current > 0 && timeSinceLastProcess < RATE_LIMIT_MS) {
        const delay = RATE_LIMIT_MS - timeSinceLastProcess;
        console.log(`[vectorizeDocument] 速率限制：等待 ${delay}ms 后再处理文档 ${docId} (${docNameForToast})`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
      lastProcessedTimeRef.current = Date.now();
      
      console.log(`[vectorizeDocument] 开始为RAG处理文档 ${docId} (${docNameForToast})`);
      const chunks = await processDocumentForRAG(documentObject); 
      console.log(`[vectorizeDocument] 文档 ${docId} (${docNameForToast}) RAG处理完成，生成 ${chunks.length} 个块`);

      if (chunks.length > 0) {
        console.log(`[vectorizeDocument] 开始存储文档 ${docId} (${docNameForToast}) 的 ${chunks.length} 个块`);
        await storeDocumentChunks(chunks); 
        console.log(`[vectorizeDocument] 文档 ${docId} (${docNameForToast}) 的块存储完成`);

        setVectorizedDocIds(prev => new Set(prev).add(docId));
        setProcessedCount(prev => prev + 1);
        setFailedVectorizationIds(prev => {
          const newSet = new Set(prev);
          newSet.delete(docId);
          return newSet;
        });
        // toast.success(`文档 ${docNameForToast} 处理完成!`, { id: `vectorize-${docId}`, duration: 2000 });
      } else {
        console.warn(`[vectorizeDocument] 文档 ${docId} (${docNameForToast}) 未生成任何块，跳过存储。`);
        // toast(`文档 ${docNameForToast} 未生成有效内容块。`, { icon: '⚠️', id: `vectorize-${docId}` });
        // 标记为失败，因为它没有有效块可供使用
        setFailedCount(prev => prev + 1);
        setFailedVectorizationIds(prev => new Set(prev).add(docId));
      }

      try {
        const storedChunks = await getDocumentChunks(docId); 
        if (storedChunks && storedChunks.length > 0) {
          console.log(`[vectorizeDocument] 验证成功：文档 ${docId} (${docNameForToast}) 的块已存储 (${storedChunks.length} 个块)`);
        } else if (chunks.length > 0) {
          console.warn(`[vectorizeDocument] 验证警告：文档 ${docId} (${docNameForToast}) 的块未找到或数量为0，尽管刚处理生成了 ${chunks.length} 个块。`);
        } else {
          console.log(`[vectorizeDocument] 验证信息：文档 ${docId} (${docNameForToast}) 处理后未生成块，验证时也未找到块。`);
        }
      } catch (getChunksError: any) { 
        console.error(`[vectorizeDocument] 获取文档 ${docId} (${docNameForToast}) 的块以进行验证时出错:`, getChunksError.message);
      }

    } catch (error: any) {
      console.error(`[vectorizeDocument] 向量化文档 ${docId} (${docNameForToast}) 过程中发生严重错误:`, error.message, error.stack);
      // toast.error(`处理文档 ${docNameForToast} 失败: ${error.message || '未知错误'}`, { id: `vectorize-${docId}` });
      setFailedCount(prev => prev + 1);
      setFailedVectorizationIds(prev => new Set(prev).add(docId));
    } finally {
      console.log(`[vectorizeDocument] 向量化文档 ${docId} (${docNameForToast}) 完成处理流程 (finally), 用时: ${(Date.now() - startTime) / 1000}s`);
      processingLockRef.current = false; // 释放主处理锁
      activeVectorizationsRef.current -=1;
      currentlyProcessingDocIdsRef.current.delete(docId); // <--- 从正在处理集合中移除
      
      // 从队列中移除当前已处理的 docId (无论成功失败，此实例已结束)
      setProcessingQueue(prev => prev.filter(id => id !== docId));
      // 更新队列引用，因为 processNextInQueue 会用到它
      processingQueueRef.current = processingQueueRef.current.filter(id => id !== docId);

      processNextInQueue(); // 触发下一个（如果队列中还有）
    }
  }; 

  const processNextInQueue = async () => {
    if (processingLockRef.current) {
      console.log(`[processNextInQueue] 互斥锁 (processingLockRef) 已被占用，processNextInQueue 本次跳过`);
      return;
    }

    const queue = processingQueueRef.current;
    if (queue.length === 0) {
      if (isProcessingRef.current) {
        setIsProcessing(false);
        isProcessingRef.current = false;
        setGlobalProcessingStarted(false);
        console.log("[processNextInQueue] 队列为空，停止所有处理活动。");
        // 可以在此处显示一个总完成的toast，汇总成功和失败
        updateVectorizeStatus(); 
      }
      return;
    }

    const docIdToProcess = queue[0];
    const documentObject = documents.find(d => d.id === docIdToProcess);
    const docNameForToast = documentObject?.fileName || docIdToProcess;

    console.log(`[processNextInQueue] 队列非空，准备处理下一个: ${docIdToProcess} (${docNameForToast})`);

    // 检查是否已在 vectorizeDocument 的控制之下
    if (currentlyProcessingDocIdsRef.current.has(docIdToProcess) && processingLockRef.current) {
        console.log(`[processNextInQueue] 文档 ${docIdToProcess} (${docNameForToast}) 已被 vectorizeDocument 锁定并标记为正在处理，processNextInQueue 等待其完成。`);
        return;
    }
    
    // 如果ถึงตรงนี้，表示锁是空闲的，并且下一个队列项目没有被标记为"正在处理"
    // （或者标记了，但之前的 vectorizeDocument 实例因某种原因提前退出未锁定）
    // 那么，由此函数实例接管处理
    console.log(`[processNextInQueue] 接管处理文档: ${docIdToProcess} (${docNameForToast})`);
    currentlyProcessingDocIdsRef.current.add(docIdToProcess); // 标记为由此实例处理
    // 调用 vectorizeDocument，它会设置锁并处理
    // 注意： vectorizeDocument 内部的 finally 会从 currentlyProcessingDocIdsRef 中移除并再次调用 processNextInQueue
    vectorizeDocument(docIdToProcess); 

    // 旧的 processNextInQueue 内部的 try...finally 逻辑已移至 vectorizeDocument
    // processNextInQueue 现在主要负责调度和检查是否调用 vectorizeDocument
  };
  
  useEffect(() => {
    setIsMounted(true);
  }, []);
  
  useEffect(() => {
    if (!isMounted) return;
    
    const handleDocumentUploaded = (event: CustomEvent) => {
      console.log('[DocumentsList] Received document-uploaded event');
      if (currentNotebook?.id === notebookId) {
        refetchDocuments();
      }
    };
    
    window.addEventListener('document-uploaded', handleDocumentUploaded as EventListener);

    const handleForceRefresh = (event: Event) => {
      const customEvent = event as CustomEvent;
      if (customEvent.detail?.notebookId === notebookId || !customEvent.detail?.notebookId) {
        console.log('[DocumentsList] Received force-documents-refresh event');
        refetchDocuments();
      }
    };
    
    window.addEventListener('force-documents-refresh', handleForceRefresh as EventListener);
    
    return () => {
      window.removeEventListener('document-uploaded', handleDocumentUploaded as EventListener);
      window.removeEventListener('force-documents-refresh', handleForceRefresh as EventListener);
    };
  }, [isMounted, notebookId, refetchDocuments, currentNotebook?.id]);
  
  // useEffect for status polling
  useEffect(() => {
    // Function to check if polling is needed
    const shouldPoll = documents.some(doc => 
      doc.status === DocumentStatus.PENDING || doc.status === DocumentStatus.PROCESSING
    );

    console.log(`[Polling Effect] Should poll: ${shouldPoll}. Current interval ID: ${pollingIntervalRef.current}`);

    if (shouldPoll) {
      // If polling is needed and not already running, start it
      if (pollingIntervalRef.current === null) {
        console.log(`[Polling Effect] Starting polling interval (${POLLING_INTERVAL_MS}ms)`);
        pollingIntervalRef.current = setInterval(() => {
          console.log('[Polling Interval] Refetching documents due to polling.');
          refetchDocuments(); 
        }, POLLING_INTERVAL_MS);
      } else {
         console.log(`[Polling Effect] Polling already active.`);
      }
    } else {
      // If polling is not needed and is currently running, stop it
      if (pollingIntervalRef.current !== null) {
        console.log(`[Polling Effect] Stopping polling interval ID: ${pollingIntervalRef.current}`);
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      } else {
         console.log(`[Polling Effect] Polling not needed and already stopped.`);
      }
    }

    // Cleanup function: Clear interval when component unmounts or dependencies change
    return () => {
      if (pollingIntervalRef.current !== null) {
        console.log(`[Polling Cleanup] Clearing interval ID: ${pollingIntervalRef.current}`);
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [documents, refetchDocuments]); // Rerun when documents list or refetch function changes
  
  // 自动刷新效果
  useEffect(() => {
    // 检查是否有文档正在处理
    const hasProcessingDocs = documents.some(
      doc => doc.status === DocumentStatus.PENDING || doc.status === DocumentStatus.PROCESSING
    );
    
    // 如果启用了自动刷新且有文档正在处理，则设置定时器
    if (autoRefreshEnabled && hasProcessingDocs && !isLoadingDocuments) {
      // 清除现有的定时器
      if (autoRefreshTimerRef.current) {
        clearTimeout(autoRefreshTimerRef.current);
      }
      
      // 设置新的定时器
      autoRefreshTimerRef.current = setTimeout(() => {
        console.log(`[DocumentsList] 自动刷新文档列表 (${autoRefreshInterval}ms)`);
        refetchDocuments();
      }, autoRefreshInterval);
    }
    
    // 清理函数
    return () => {
      if (autoRefreshTimerRef.current) {
        clearTimeout(autoRefreshTimerRef.current);
        autoRefreshTimerRef.current = null;
      }
    };
  }, [documents, autoRefreshEnabled, autoRefreshInterval, isLoadingDocuments, refetchDocuments]); // 添加 refetchDocuments

  // 在组件将要卸载时清除定时器
  useEffect(() => {
    return () => {
      if (autoRefreshTimerRef.current) {
        clearTimeout(autoRefreshTimerRef.current);
      }
    };
  }, []);
  
  // 获取文档状态图标和标签
  const getStatusIcon = (status: DocumentStatus): StatusIconResult => {
    switch (status) {
      case DocumentStatus.PENDING:
        return {
          icon: '⏳',
          label: '等待处理',
          color: 'bg-yellow-100 text-yellow-800'
        };
      case DocumentStatus.PROCESSING:
        return {
          icon: '🔄',
          label: '处理中',
          color: 'bg-blue-100 text-blue-800'
        };
      case DocumentStatus.COMPLETED:
        return {
          icon: '✅',
          label: '已完成',
          color: 'bg-green-100 text-green-800'
        };
      case DocumentStatus.FAILED:
        return {
          icon: '❌',
          label: '失败',
          color: 'bg-red-100 text-red-800'
        };
      default:
        return {
          icon: '❓',
          label: '未知',
          color: 'bg-gray-100 text-gray-800'
        };
    }
  };
  
  // 修改点击处理函数
  const handleDocumentClick = (doc: Document) => {
    if (doc.status !== DocumentStatus.COMPLETED) {
      console.log('文档尚未处理完成，无法选择:', doc.fileName, doc.status);
      toast.error(`文档"${doc.fileName}"尚未处理完成，请等待处理完成后再选择。`);
      return;
    }

    console.log(`[DocumentsList] 单击文档: ID=${doc.id}, FileName=${doc.fileName}`);
    
    // Call the new toggle function if provided
    if (onToggleChatSelection) {
      onToggleChatSelection(doc);
    } else {
      // Fallback or alternative behavior if needed (e.g., studio preview)
      console.warn("[DocumentsList] onToggleChatSelection not provided.");
      if (onSelectDocument) {
        onSelectDocument(doc); // Keep studio preview functionality?
      }
    }
  };
  
  // 获取文档内容的函数 - 处理增强错误类型
  const getDocumentContent = async (id: string): Promise<string | null> => {
    console.log(`[getDocumentContent] Fetching content for doc: ${id}`);
    try {
      // 使用导入的服务函数
      const content = await documentService.getDocumentContent(id);
      console.log(`[getDocumentContent] Content fetched successfully, length: ${content.length}`);
      return content;
      
    }
    catch (error: any) {
      console.error(`获取文档 ${id} 内容失败:`, error);
      
      // 检查是否是文档处理错误
      if (error.isDocumentProcessingError) {
        // 根据错误类型显示不同的提示
        if (error.canReprocess) {
          toast((t) => (
            <div>
              <p className="font-medium">{error.message}</p>
              <div className="flex justify-end mt-2">
                <button
                  onClick={() => toast.dismiss(t.id)}
                  className="px-2 py-1 bg-gray-100 rounded text-xs"
                >
                  关闭
                </button>
                <button
                  onClick={() => {
                    toast.dismiss(t.id);
                    handleReprocessDocument({ stopPropagation: () => {} } as React.MouseEvent, error.docId);
                  }}
                  className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs ml-2"
                >
                  重新处理
                </button>
              </div>
            </div>
          ), { duration: 8000 });
        } else {
          toast.error(error.message);
        }
      } else {
        // 一般错误处理
        toast.error(`获取文档内容失败: ${error.message || '未知错误'}`);
      }
      
      return null; // 返回空值
    }
  };

  /**
   * 处理文档双击预览 - 根据文件类型传递文本内容或完整后端 URL
   * @param doc 文档对象
   */
  const handleDocumentOpen = async (doc: Document) => {
    try {
      if (doc.status !== DocumentStatus.COMPLETED) {
        toast.error('文档尚未处理完成，无法预览');
        return;
      }
      
      const KNOWN_TEXT_EXTENSIONS = ['txt', 'md', 'markdown', 'csv', 'json'];
      const extension = doc.fileName.split('.').pop()?.toLowerCase() || '';
      
      let contentToPreview: string | ArrayBuffer | null = null;
      
      if (KNOWN_TEXT_EXTENSIONS.includes(extension)) {
        // 对于已知文本类型，获取实际文本内容
        console.log(`[DocumentsList] Fetching text content for .${extension} file: ${doc.fileName}`);
        contentToPreview = await getDocumentContent(doc.id);
        if (contentToPreview === null) {
            toast.error("无法获取文本文件内容进行预览");
            return;
        }
      } else {
        // 对于其他类型，构建后端 URL - 添加 /api 前缀
        let previewUrl: string | null = null;
        if ('url' in doc && typeof doc.url === 'string' && doc.url.startsWith('http')) {
            previewUrl = doc.url;
            console.log(`[DocumentsList] Using direct URL from doc object: ${previewUrl}`);
        } else {
            previewUrl = `${BACKEND_API_BASE}/api/documents/${doc.id}/raw`; 
            console.log(`[DocumentsList] Constructed backend URL for preview: ${previewUrl}`);
        }
        contentToPreview = previewUrl; // 将 URL 作为内容传递
      }

      // Call the prop with the Document and the appropriate content/URL
      if (onPreviewDocument && contentToPreview !== null) {
         console.log(`[DocumentsList] Calling onPreviewDocument for: ${doc.fileName} with content type: ${typeof contentToPreview}`);
         onPreviewDocument(doc, contentToPreview, false); 
      } else if (!onPreviewDocument) {
        console.warn("[DocumentsList] onPreviewDocument prop not provided.");
      } else {
         // Handle case where contentToPreview remained null (should have been caught earlier)
         toast.error("无法准备预览内容"); 
      }

    } catch (error) {
      console.error(`[DocumentsList] 打开文档预览失败: ${doc.id}`, error);
      toast.error('打开文档预览失败，请重试');
    }
  };
  
  // 添加删除文档的函数
  const handleDeleteDocument = async (e: React.MouseEvent, docId: string) => {
    e.stopPropagation(); // Prevent triggering select/preview

    toast.loading(`正在删除文档 ${docId}...`, { id: 'delete-doc' });

    try {
      // Call the API delete function
      await deleteDocumentFromApi(docId);

      toast.success(`文档 ${docId} 已删除`, { id: 'delete-doc' });

      // Refetch the document list from the context AFTER successful deletion
      refetchDocuments();

      // Clear selection if the deleted doc was selected
      setSelectedDocIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(docId);
        return newSet;
      });

    } catch (error) {
      console.error('删除文档时出错:', error);
      toast.error(`删除文档失败: ${error instanceof Error ? error.message : '未知错误'}`, { id: 'delete-doc' });
    }
  };

  // 添加拖拽开始处理函数
  const handleDragStart = (e: React.DragEvent, doc: Document) => {
    if (doc.status !== DocumentStatus.COMPLETED) {
      e.preventDefault();
      return;
    }
    
    // 设置拖拽的数据
    e.dataTransfer.setData('text/plain', doc.fileName);
    
    // 设置markdown链接格式
    const markdownLink = `[${doc.fileName}](document://${doc.id})`;
    e.dataTransfer.setData('text/markdown', markdownLink);
    
    // 设置HTML链接格式
    const htmlLink = `<a href="document://${doc.id}" data-doc-id="${doc.id}">${doc.fileName}</a>`;
    e.dataTransfer.setData('text/html', htmlLink);
    
    // 设置自定义格式，用于识别这是文档拖拽
    e.dataTransfer.setData('application/document', JSON.stringify({
      id: doc.id,
      fileName: doc.fileName,
      fileSize: doc.fileSize,
      type: 'document'
    }));
    
    // 设置拖拽效果
    e.dataTransfer.effectAllowed = 'copy';
    
    console.log(`[DocumentsList] 开始拖拽文档: ${doc.id}, ${doc.fileName}`);
  };
  
  // 添加文档类型识别和处理函数
  const getDocumentType = (fileName: string): string => {
    const extension = fileName.split('.').pop()?.toLowerCase() || '';
    const typeMap: Record<string, string> = {
      'pdf': 'application/pdf',
      'doc': 'application/msword',
      'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'ppt': 'application/vnd.ms-powerpoint',
      'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'xls': 'application/vnd.ms-excel',
      'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'txt': 'text/plain',
      'csv': 'text/csv',
      'json': 'application/json',
      'md': 'text/markdown'
    };
    
    return typeMap[extension] || 'application/octet-stream';
  };
  
  // 自定义双击处理函数
  const handleDoubleClick = (doc: Document) => {
    console.log(`[DEBUG] 双击事件被触发: ${doc.id}, ${doc.fileName}`);
    // No toast here
    setTimeout(() => { 
      handleDocumentOpen(doc);
    }, 50); // Reduced timeout
  };
  
  // 处理文档重新处理请求
  const handleReprocessDocument = async (e: React.MouseEvent, docId: string) => {
    e.stopPropagation(); // 阻止事件冒泡，避免触发文档点击事件
    
    try {
      toast.loading(`正在请求重新处理文档...`);
      const updatedDoc = await reprocessDocument(docId);
      toast.dismiss();
      toast.success(`文档已重新提交处理，稍后刷新查看结果`);
      console.log(`[DocumentsList] 文档 ${docId} 已重新提交处理：`, updatedDoc);
      
      // 在此处添加刷新功能
      refetchDocuments();
      
      // 确保自动刷新已启用
      setAutoRefreshEnabled(true);
      
    } catch (error) {
      toast.dismiss();
      toast.error(error instanceof Error ? error.message : '重新处理文档时出错');
      console.error(`[DocumentsList] 重新处理文档 ${docId} 时出错:`, error);
    }
  };

  // 查看文档详细状态
  const handleViewDocumentStatus = async (e: React.MouseEvent, docId: string) => {
    e.stopPropagation(); // 阻止事件冒泡
    
    try {
      const status = await getDocumentStatus(docId);
      console.log(`[DocumentsList] 文档 ${docId} 的详细状态:`, status);
      
      // 使用toast显示状态信息
      toast((t) => (
        <div>
          <h3 className="font-medium mb-1">文档状态详情</h3>
          <p><strong>状态:</strong> {status.status || '未知'}</p>
          <p><strong>消息:</strong> {status.statusMessage || '无'}</p>
          <p><strong>文本内容:</strong> {status.textContentExists ? '已提取' : '未提取'}</p>
          <p><strong>文件存在:</strong> {status.fileExists ? '是' : '否'}</p>
          <div className="flex justify-end mt-2">
            <button 
              onClick={() => toast.dismiss(t.id)}
              className="px-2 py-1 bg-gray-100 rounded text-xs"
            >
              关闭
            </button>
            <button 
              onClick={() => {
                toast.dismiss(t.id);
                handleReprocessDocument({ stopPropagation: () => {} } as React.MouseEvent, docId);
              }}
              className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs ml-2"
            >
              重新处理
            </button>
          </div>
        </div>
      ), { duration: 5000 });
      
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '获取文档状态时出错');
      console.error(`[DocumentsList] 获取文档 ${docId} 状态时出错:`, error);
    }
  };
  
  if (!isMounted) {
    return null; // 服务器端渲染不显示
  }
  
  if (isLoadingDocuments) {
    return (
      <div className="p-4 text-center text-gray-500">
        加载文档中...
        <div className="mt-2">
          <div className="animate-spin h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full mx-auto"></div>
        </div>
      </div>
    );
  }
  
  if (documentError) {
    return (
      <div className="p-4 text-center text-red-500">
        <div className="mb-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        {documentError}
        <button 
          className="mt-3 px-3 py-1 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200"
          onClick={() => window.location.reload()}
        >
          刷新页面
        </button>
      </div>
    );
  }
  
  if (!documents || documents.length === 0) {
    return (
      <div className="p-4 text-center text-gray-500">
        <p>没有文档。上传一些文档开始吧！</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <div className="text-sm font-medium text-gray-500">
          {documents.some(doc => doc.status !== DocumentStatus.COMPLETED) && (
            <div className="mb-2 text-xs text-blue-600">
              有文档正在处理中
              {autoRefreshEnabled && <span>，列表将自动更新</span>}
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {/* 自动刷新开关 */}
          <button 
            onClick={() => setAutoRefreshEnabled(!autoRefreshEnabled)}
            className={`px-2 py-1 rounded-md flex items-center text-xs ${
              autoRefreshEnabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
            }`}
            title={autoRefreshEnabled ? "自动刷新已启用" : "自动刷新已禁用"}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className={`h-3 w-3 mr-1 ${autoRefreshEnabled ? 'text-green-500' : 'text-gray-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
            </svg>
            {autoRefreshEnabled ? '自动更新' : '手动刷新'}
          </button>
          
          {/* 手动刷新按钮 */}
        <button 
            onClick={refetchDocuments}
          disabled={isLoadingDocuments}
          className="px-2 py-1 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 flex items-center text-xs"
          title="刷新文档列表"
        >
          {isLoadingDocuments ? (
            <>
              <div className="animate-spin h-3 w-3 mr-1 border border-blue-700 border-t-transparent rounded-full"></div>
              刷新中
            </>
          ) : (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              刷新
            </>
          )}
        </button>
        </div>
      </div>
      
      <div className="divide-y divide-gray-200">
        {documents.map((doc) => {
          // Log the status and filename for each document being rendered
          console.log(`[DocumentsList Item] ID: ${doc.id}, FileName: ${doc.fileName}, Status: ${doc.status}`);
          
          // 获取文档状态图标和标签
          const statusInfo = getStatusIcon(doc.status);
          const isVectorized = vectorizedDocIds.has(doc.id);
          const hasFailedVectorization = failedVectorizationIds.has(doc.id);

          let displayStatusInfo = statusInfo;
          let displayLabel = statusInfo.label;

          if (isVectorized) {
            displayStatusInfo = { icon: <DatabaseIcon />, label: '已处理', color: 'text-green-500' };
            displayLabel = '已就绪';
          } else if (processingQueue.includes(doc.id) || (isProcessing && processingQueueRef.current.includes(doc.id))) {
            displayStatusInfo = { icon: <div className="animate-spin h-3 w-3 border-2 border-blue-400 border-t-transparent rounded-full"></div>, label: '队列中', color: 'text-blue-500' };
            displayLabel = '队列中';
          }
          
          return (
            <div
              key={doc.id}
              draggable
              onDragStart={(e) => handleDragStart(e, doc)}
              onClick={() => handleDocumentClick(doc)}
              onDoubleClick={() => handleDoubleClick(doc)}
              className={`
                group px-2.5 py-1 mb-0.5 rounded-lg cursor-pointer transition-all duration-150 ease-in-out
                border 
                ${selectedChatDocIds.has(doc.id) ? 'bg-blue-100 dark:bg-blue-800 border-blue-400 dark:border-blue-600 shadow-md' : 'bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 border-gray-200 dark:border-gray-700'}
                ${selectedChatDocIds.has(doc.id) ? 'ring-2 ring-offset-1 ring-offset-gray-100 dark:ring-offset-gray-800 ring-purple-500 dark:ring-purple-400' : ''}
              `}
              title={`名称: ${doc.fileName}
类型: ${doc.fileType}
大小: ${formatFileSize(doc.fileSize)}
上传于: ${formatDate(doc.createdAt)}
状态: ${displayLabel}`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center overflow-hidden mr-2">
                  <span className="mr-2 text-gray-500 dark:text-gray-400">
                    <FileIcon />
                  </span>
                  <span className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate group-hover:underline" style={{ maxWidth: 'calc(100% - 20px)' }}>
                    {doc.fileName}
                  </span>
                </div>
                <div className="flex items-center space-x-1.5">
                  <span className={`text-xs flex items-center ${displayStatusInfo.color}`}>
                    {displayStatusInfo.icon}
                    <span className="ml-1 hidden sm:inline whitespace-nowrap">{displayLabel}</span>
                  </span>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDocumentOpen(doc); }}
                    className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600 opacity-0 group-hover:opacity-100 transition-opacity text-gray-500 dark:text-gray-400"
                    title="预览文档"
                  >
                    <EyeIcon />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeleteDocument(e, doc.id); }}
                    className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-700 opacity-0 group-hover:opacity-100 transition-opacity text-red-500 dark:text-red-400"
                    title="删除文档"
                  >
                    <TrashIcon />
                  </button>
                  {onToggleChatSelection && (
                     <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleChatSelection(doc);
                        }}
                        className={`p-1 rounded transition-colors
                          ${selectedChatDocIds.has(doc.id) 
                            ? 'bg-purple-500 text-white hover:bg-purple-600' 
                            : 'hover:bg-gray-200 dark:hover:bg-gray-600 opacity-0 group-hover:opacity-100 text-gray-500 dark:text-gray-400'
                          }`}
                        title={selectedChatDocIds.has(doc.id) ? "取消选择用于聊天" : "选择用于聊天"}
                      >
                       {selectedChatDocIds.has(doc.id) ? <MinusCircleIcon /> : <PlusCircleIcon />}
                      </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
