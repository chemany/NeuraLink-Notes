import React, { useEffect, useRef, useState } from 'react';
import type { Document } from '../types/shared_local';
import dynamic from 'next/dynamic';
import { toast } from 'react-hot-toast';
import apiClient from '@/services/apiClient';
import axios from 'axios';

// Dynamic import for FileViewer
const FileViewer = dynamic(() => import('react-file-viewer'), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center h-full w-full">
    <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full"></div>
  </div>
});

// Dynamic import for PptxViewer
const PptxViewer = dynamic(() => import('./PptxViewer'), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center h-full w-full">
    <div className="animate-spin h-10 w-10 border-4 border-blue-500 border-t-transparent rounded-full"></div>
    <span className="ml-3 text-gray-600">正在加载PPTX预览...</span>
  </div>
});

// Dynamic import for ExcelViewer
const ExcelViewer = dynamic(() => import('./ExcelViewer'), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center h-full w-full">
    <div className="animate-spin h-10 w-10 border-4 border-green-500 border-t-transparent rounded-full"></div>
    <span className="ml-3 text-gray-600">正在加载Excel预览...</span>
  </div>
});

interface DocumentPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  document: Document | null;
  content: string | ArrayBuffer | null;
  // Use fixed positioning relative to viewport
  position?: { top: number; left: number; width: number; height: number };
}

// PDF预览缓存 - 避免重复下载同一文件
const PDF_CACHE = new Map<string, string>();
const MAX_CACHE_SIZE = 10; // 最多缓存10个PDF预览URL

// Function to get file extension
const getFileExtension = (fileName: string): string => {
  return fileName.split('.').pop()?.toLowerCase() || '';
};

// Function to get MIME type (simplified)
const getMimeType = (extension: string): string => {
  const typeMap: Record<string, string> = {
    'pdf': 'application/pdf',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'txt': 'text/plain',
    'csv': 'text/csv',
    'md': 'text/markdown',
    // Add others if needed
  };
  return typeMap[extension] || 'application/octet-stream';
};


const DocumentPreviewModal: React.FC<DocumentPreviewModalProps> = ({
  isOpen,
  onClose,
  document,
  content,
  position
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  // State to hold the Object URL for iframe/img src
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  // State for loading status during fetch
  const [isLoadingPreview, setIsLoadingPreview] = useState<boolean>(false);
  // State for potential errors during fetch
  const [previewError, setPreviewError] = useState<string | null>(null);

  // Effect to fetch content and create/revoke Object URL when modal opens or content changes
  useEffect(() => {
    // Ensure we clean up previous URL if component is open and content/doc changes
    let currentObjectUrl: string | null = null; 

    const loadPreview = async () => {
      if (!isOpen || !document || !content) {
         setObjectUrl(null);
         setPreviewError(null);
         setIsLoadingPreview(false);
         console.log('[PreviewModal] loadPreview returned early due to missing isOpen, document, or content.', { isOpen, docExists: !!document, contentExists: !!content }); 
         return;
      }

      const extension = getFileExtension(document.fileName);

      // Reset state
      setObjectUrl(null);
      setPreviewError(null);
      setIsLoadingPreview(true);

      try {
        let finalUrl = null;

        // 🚀 优化1: 检查缓存，避免重复下载相同PDF
        const cacheKey = `${document.fileName}_${document.id}`;
        if (PDF_CACHE.has(cacheKey)) {
          console.log(`[PreviewModal] Using cached PDF URL for ${document.fileName}`);
          finalUrl = PDF_CACHE.get(cacheKey)!;
          setObjectUrl(finalUrl);
          return;
        }

        if (typeof content === 'string') {
          if (['txt', 'md', 'csv', 'json'].includes(extension)) {
            // 对于文本文件，content应该已经是文本内容，直接使用
          } 
          else {
            // 对于非文本文件，content应该是URL路径
            if (content.startsWith('http')) {
              // 如果是完整URL，直接使用
              const response = await apiClient.get(content, { responseType: 'blob' });
              const blob = response.data as Blob;
              finalUrl = URL.createObjectURL(blob);
              currentObjectUrl = finalUrl; 
            } else if (content.startsWith('/api/documents')) {
              // 如果是相对路径，需要判断环境
              let fullUrl = content;
              if (typeof window !== 'undefined') {
                const currentHost = window.location.hostname;
                const currentPort = window.location.port;
                console.log('[PreviewModal] Current host:', currentHost);
                console.log('[PreviewModal] Current port:', currentPort);
                console.log('[PreviewModal] Original content:', content);

                // 检查是否是局域网IP直接访问
                const isPrivateIP = /^192\.168\.\d{1,3}\.\d{1,3}$/.test(currentHost) ||
                                   /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(currentHost) ||
                                   /^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/.test(currentHost);

                if (currentHost !== 'localhost' && currentHost !== '127.0.0.1') {
                  if (isPrivateIP && currentPort === '3000') {
                    // 局域网IP直接访问：使用后端端口3001
                    fullUrl = `${window.location.protocol}//${currentHost}:3001${content}`;
                    console.log('[PreviewModal] Private IP direct access, constructed URL:', fullUrl);
                  } else {
                    // 代理访问：使用nginx代理路径
                    fullUrl = `${window.location.protocol}//${window.location.host}${content}`;
                    console.log('[PreviewModal] Proxy access, constructed URL:', fullUrl);
                  }
                  // 外网环境使用axios直接请求，因为apiClient可能有基础URL冲突
                  const token = localStorage.getItem('calendar_unified_token');
                  const headers: any = {};
                  if (token) {
                    headers['Authorization'] = `Bearer ${token}`;
                  }
                  // 🚀 优化2: 使用流式响应和进度提示
                  console.log(`[PreviewModal] Starting PDF download for ${document.fileName}`);
                  const response = await axios.get(fullUrl, { 
                    responseType: 'blob',
                    headers,
                    timeout: 15000, // 增加超时时间
                    onDownloadProgress: (progressEvent) => {
                      if (progressEvent.total) {
                        const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                        console.log(`[PreviewModal] Download progress: ${percent}% (${(progressEvent.loaded/1024/1024).toFixed(2)}MB/${(progressEvent.total/1024/1024).toFixed(2)}MB)`);
                      }
                    }
                  });
                  
                  // 🚀 优化3: 异步处理Blob转换，避免阻塞UI
                  const blob = response.data as Blob;
                  finalUrl = await new Promise<string>((resolve) => {
                    requestAnimationFrame(() => {
                      const objectUrl = URL.createObjectURL(blob);
                      resolve(objectUrl);
                    });
                  });
                  
                  currentObjectUrl = finalUrl;
                  
                  // 🚀 优化4: 缓存预览URL，避免重复处理
                  if (PDF_CACHE.size >= MAX_CACHE_SIZE) {
                    // 清理最旧的缓存项
                    const firstKey = PDF_CACHE.keys().next().value;
                    if (firstKey) {
                      const oldUrl = PDF_CACHE.get(firstKey);
                      if (oldUrl) URL.revokeObjectURL(oldUrl);
                      PDF_CACHE.delete(firstKey);
                    }
                  }
                  PDF_CACHE.set(cacheKey, finalUrl);
                  console.log(`[PreviewModal] PDF cached for future use: ${document.fileName}`);
                } else {
                  console.log('[PreviewModal] Local environment, using apiClient');
                  // 本地环境使用apiClient - 同样应用优化
                  console.log(`[PreviewModal] Starting local PDF download for ${document.fileName}`);
                  const response = await apiClient.get(content, { 
                    responseType: 'blob',
                    timeout: 15000
                  });
                  
                  const blob = response.data as Blob;
                  // 异步处理Blob转换
                  finalUrl = await new Promise<string>((resolve) => {
                    requestAnimationFrame(() => {
                      const objectUrl = URL.createObjectURL(blob);
                      resolve(objectUrl);
                    });
                  });
                  
                  currentObjectUrl = finalUrl;
                  
                  // 缓存本地预览URL
                  if (PDF_CACHE.size >= MAX_CACHE_SIZE) {
                    const firstKey = PDF_CACHE.keys().next().value;
                    if (firstKey) {
                      const oldUrl = PDF_CACHE.get(firstKey);
                      if (oldUrl) URL.revokeObjectURL(oldUrl);
                      PDF_CACHE.delete(firstKey);
                    }
                  }
                  PDF_CACHE.set(cacheKey, finalUrl);
                }
              } else {
                // 服务端渲染环境
                const response = await apiClient.get(content, { responseType: 'blob' });
                const blob = response.data as Blob;
                finalUrl = URL.createObjectURL(blob);
                currentObjectUrl = finalUrl;
              }
            } else {
              // 其他情况，可能是Base64或其他格式
              console.warn('[PreviewModal] Unknown content format:', content.substring(0, 100));
            }
          }
        } else if (content instanceof ArrayBuffer) {
           const mimeType = getMimeType(extension);
           const blob = new Blob([content], { type: mimeType });
           
           // 异步处理ArrayBuffer转换
           finalUrl = await new Promise<string>((resolve) => {
             requestAnimationFrame(() => {
               const objectUrl = URL.createObjectURL(blob);
               resolve(objectUrl);
             });
           });
           
           currentObjectUrl = finalUrl;
           
           // 缓存ArrayBuffer预览URL
           if (PDF_CACHE.size >= MAX_CACHE_SIZE) {
             const firstKey = PDF_CACHE.keys().next().value;
             if (firstKey) {
               const oldUrl = PDF_CACHE.get(firstKey);
               if (oldUrl) URL.revokeObjectURL(oldUrl);
               PDF_CACHE.delete(firstKey);
             }
           }
           PDF_CACHE.set(cacheKey, finalUrl); 
        } else {
           throw new Error('不支持的预览内容类型');
        }

        setObjectUrl(finalUrl);

      } catch (error) {
         console.error('[PreviewModal] Error loading preview content:', error);
         if (axios.isAxiosError(error) && error.response) {
           setPreviewError(`无法加载预览 (${error.response.status} ${error.response.statusText || error.message})`);
         } else {
           setPreviewError(error instanceof Error ? error.message : '加载预览失败');
         }
      } finally {
          setIsLoadingPreview(false);
      }
    };

    loadPreview();

    // Cleanup function: Revoke the Object URL when the modal closes,
    // the content changes, or the component unmounts.
    return () => {
      if (currentObjectUrl) {
        console.log(`[PreviewModal] Revoking Object URL: ${currentObjectUrl}`);
        // 🚀 优化5: 延迟清理URL，避免重复文档快速打开时的闪烁
        setTimeout(() => {
          URL.revokeObjectURL(currentObjectUrl!);
        }, 1000);
      }
      setObjectUrl(null);
      setPreviewError(null);
      setIsLoadingPreview(false);
    };
  }, [isOpen, document, content]); // Re-run effect if modal opens/closes or content changes

  if (!isOpen || !document || !position) {
    return null;
  }

  const renderActualContent = () => {
    // Content rendering logic moved here, relies on objectUrl state
    if (isLoadingPreview) {
      return <div className="flex items-center justify-center h-full w-full">
               <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full"></div>
             </div>;
    }
    // Use the previewError state for displaying fetch/load errors first
    if (previewError) {
       return (
          <div className="p-4 text-center text-red-500 flex flex-col items-center justify-center h-full">
              <span>{previewError.includes('无法加载预览') ? previewError : `预览失败: ${previewError}`}</span>
              {/* Offer download even if preview failed, if we have the URL */}
              {objectUrl && (
                   <button
                       onClick={() => window.open(objectUrl, '_blank')}
                       className="mt-4 px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
                   >
                       下载文件
                   </button>
               )}
          </div>
       );
    }

    const extension = getFileExtension(document.fileName);
    
    // Handle direct text rendering first
    if (typeof content === 'string' && ['txt', 'md', 'csv', 'json'].includes(extension)) {
        return <pre className="text-xs whitespace-pre-wrap break-words p-2">{content}</pre>;
    }

    // If we have an objectUrl, proceed with other types
    if (objectUrl) {
      const imageSupported = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'];
      // Define types known to be generally unsupported for direct preview
      const knownUnsupportedPreview = ['ppt', 'doc'];

      if (imageSupported.includes(extension)) {
         return <img src={objectUrl} alt={document.fileName} className="max-w-full max-h-full object-contain mx-auto" />;
      } else if (extension === 'pdf') {
         return <iframe src={objectUrl} className="w-full h-full border-0" title={document.fileName} />;
      } else if (extension === 'pptx') {
         return <PptxViewer url={objectUrl} className="h-full w-full" />;
      } else if (['xlsx', 'xls'].includes(extension)) {
         return <ExcelViewer url={objectUrl} className="h-full w-full" />;
      } else if (knownUnsupportedPreview.includes(extension)) {
          // --- Directly show fallback for known unsupported types ---
          return (
             <div className="p-4 text-center text-gray-500 flex flex-col items-center justify-center h-full">
                 <span>无法直接预览此文件类型 ({extension})。</span>
                 <button
                     onClick={() => window.open(objectUrl, '_blank')}
                     className="mt-4 px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
                 >
                     下载文件
                 </button>
             </div>
          );
      } else {
          // --- Attempt FileViewer for other types (like xlsx, xls) ---
          return (
            <div className="h-full w-full react-file-viewer-container">
              <FileViewer
                key={document.id + '-preview-' + extension} // More specific key
                fileType={extension}
                filePath={objectUrl}
                onError={(e: any) => {
                  console.error(`[PreviewModal] FileViewer failed for .${extension}:`, e);
                  // Set the error state, which will be caught above on re-render
                  setPreviewError(`无法预览 (${extension})`); 
                  // Important: Return null to prevent FileViewer rendering default error UI
                  return null; 
                }}
              />
            </div>
          );
       }
    }
    
    // Final fallback if objectUrl is null or other conditions not met
    return <div className="p-4 text-center text-gray-500">无法准备预览内容。</div>;
  };

  return (
    <div
      ref={modalRef}
      className="fixed bg-white rounded-lg shadow-xl border border-gray-300 flex flex-col z-40 overflow-hidden" // Use fixed, add overflow-hidden
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
        width: `${position.width}px`,
        height: `${position.height}px`,
      }}
    >
      {/* Header */}
      <div className="flex justify-between items-center p-2 border-b border-gray-200 bg-gray-50 rounded-t-lg flex-shrink-0">
        <h3 className="text-sm font-medium text-gray-700 truncate pr-2" title={document.fileName}>
          预览: {document.fileName}
        </h3>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-200"
          aria-label="关闭预览"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Content Area */}
      <div className="flex-grow overflow-auto bg-white"> {/* Ensure content area scrolls and has white bg */}
        {renderActualContent()} {/* Call the new render function */}
      </div>
    </div>
  );
};

export default DocumentPreviewModal;
