'use client';

import React, { useState, useEffect, Suspense, useRef } from 'react';
import { Document } from '@/types';
import { toast } from 'react-hot-toast';
import dynamic from 'next/dynamic';

// Dynamically import FileViewer with SSR disabled
const FileViewer = dynamic(() => import('react-file-viewer'), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center h-full w-full">
    <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full"></div>
  </div>
});

// 动态导入PDF查看器组件
const PdfViewer = dynamic(() => import('./PdfViewer'), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center h-full w-full">
    <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full"></div>
  </div>
});

/**
 * 文档预览组件属性
 * @param document 要预览的文档
 * @param content 文档内容或URL
 * @param onClose 关闭预览的回调函数
 * @param inChat 是否在聊天界面中预览
 */
interface DocumentPreviewProps {
  document: Document;
  content: string;
  onClose: () => void;
  inChat?: boolean;
}

/**
 * 文档预览组件
 * 用于在聊天界面内或模态框中预览文档内容
 * @param document 要预览的文档对象
 * @param content 文档内容或URL
 * @param onClose 关闭预览的回调函数
 * @param inChat 是否在聊天界面中预览，默认为false
 * @returns DocumentPreview组件
 */
const DocumentPreview: React.FC<DocumentPreviewProps> = ({ 
  document, 
  content, 
  onClose,
  inChat = false
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const [pdfArrayBuffer, setPdfArrayBuffer] = useState<ArrayBuffer | null>(null);
  
  // 判断文件类型并设置适当的错误信息
  useEffect(() => {
    const extension = document.fileName.split('.').pop()?.toLowerCase() || '';
    const supportedTypes = ['pdf', 'txt', 'jpg', 'jpeg', 'png', 'gif', 'md', 'csv', 'json'];
    
    if (!supportedTypes.includes(extension)) {
      setPreviewError(`当前预览模式下无法预览 .${extension} 格式的文件，请尝试单击文档以通过AI聊天分析内容`);
    } else {
      setPreviewError(null);
    }
  }, [document.fileName]);
  
  // 获取文档类型，用于渲染不同类型的预览
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
  
  // 下载文档
  const handleDownload = () => {
    // 优先使用处理后的ArrayBuffer下载
    if (pdfArrayBuffer) {
      try {
        setIsLoading(true);
        console.log('[DocumentPreview] 使用ArrayBuffer下载PDF文档');
        
        // 创建blob和URL
        const blob = new Blob([pdfArrayBuffer], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        
        // 创建下载链接
        const a = window.document.createElement('a');
        a.href = url;
        a.download = document.fileName;
        window.document.body.appendChild(a);
        a.click();
        window.document.body.removeChild(a);
        
        // 延迟释放URL
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        
        toast.success('文档已下载');
        setIsLoading(false);
        return;
      } catch (error) {
        console.error('[DocumentPreview] 从ArrayBuffer下载PDF失败:', error);
        // 如果失败，继续使用其他方法尝试下载
      }
    }
  
    if (!content) return;
    
    try {
      setIsLoading(true);
      console.log('[DocumentPreview] 正在下载文档:', document.fileName);
      
      // 如果内容是blob URL，直接使用该URL进行下载
      if (content.startsWith('blob:')) {
        console.log('[DocumentPreview] 检测到blob URL，尝试获取blob数据进行下载');
        
        // 使用fetch获取blob数据
        fetch(content)
          .then(response => response.blob())
          .then(blob => {
            console.log('[DocumentPreview] 成功获取blob数据', blob.type, blob.size);
            
            // 检查blob的内容类型和大小
            if (blob.size === 0) {
              throw new Error('获取到的blob数据为空');
            }
            
            // 使用新的blob创建新的URL，确保类型正确
            const newBlob = new Blob([blob], { type: 'application/pdf' });
            const url = URL.createObjectURL(newBlob);
            
            // 创建下载链接
            const a = window.document.createElement('a');
            a.href = url;
            a.download = document.fileName;
            window.document.body.appendChild(a);
            a.click();
            window.document.body.removeChild(a);
            
            // 延迟释放URL
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            
            toast.success('文档已下载');
            setIsLoading(false);
          })
          .catch(error => {
            console.error('[DocumentPreview] 从blob URL获取数据失败:', error);
            toast.error(`下载失败: ${error.message}`);
            setIsLoading(false);
            
            // 尝试直接使用blob URL下载，作为后备方案
            console.log('[DocumentPreview] 尝试直接使用blob URL下载');
            const a = window.document.createElement('a');
            a.href = content;
            a.download = document.fileName;
            a.target = '_blank'; // 打开新窗口以避免导航问题
            window.document.body.appendChild(a);
            a.click();
            window.document.body.removeChild(a);
          });
        return;
      }
      
      // 创建文本内容的Blob
      const blob = new Blob([content], { type: getDocumentType(document.fileName) });
      
      // 检查blob大小
      if (blob.size === 0) {
        throw new Error('生成的blob数据为空');
      }
      
      console.log('[DocumentPreview] 创建blob成功，大小:', blob.size, '类型:', blob.type);
      
      // 创建临时链接并下载
      const url = URL.createObjectURL(blob);
      const a = window.document.createElement('a');
      a.href = url;
      a.download = document.fileName;
      window.document.body.appendChild(a);
      a.click();
      window.document.body.removeChild(a);
      
      // 延迟释放URL
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      
      toast.success('文档已下载');
    } catch (error) {
      console.error('[DocumentPreview] 下载文档失败:', error);
      toast.error(error instanceof Error ? `下载失败: ${error.message}` : '下载文档失败，请重试');
    } finally {
      setIsLoading(false);
    }
  };
  
  // 判断文件类型是否支持预览
  const isSupportedFileType = (extension: string): boolean => {
    const supportedTypes = ['txt', 'md', 'csv', 'json'];
    return supportedTypes.includes(extension);
  };
  
  // 处理关闭预览
  const handleClose = (e: React.MouseEvent) => {
    console.log('[DocumentPreview] 关闭按钮被点击');
    e.preventDefault();
    e.stopPropagation(); // 阻止事件冒泡
    onClose();
  };
  
  // 处理背景点击关闭
  const handleBackgroundClick = (e: React.MouseEvent) => {
    // 只有当点击的是背景层时才关闭
    if (e.target === e.currentTarget) {
      console.log('[DocumentPreview] 背景被点击，关闭预览');
      e.preventDefault();
      e.stopPropagation(); // 阻止事件冒泡
      onClose();
    }
  };
  
  // 处理内容区点击
  const handleContentClick = (e: React.MouseEvent) => {
    console.log('[DocumentPreview] 内容区被点击');
    e.stopPropagation(); // 阻止事件冒泡，防止触发背景点击
  };
  
  // 使用useEffect添加点击外部关闭功能
  useEffect(() => {
    console.log('[DocumentPreview] 组件已挂载');
    
    // 添加键盘事件监听，按ESC键关闭预览
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        console.log('[DocumentPreview] ESC键被按下，关闭预览');
        onClose();
      }
    };
    
    // 添加键盘事件
    window.document.addEventListener('keydown', handleKeyDown);
    
    return () => {
      console.log('[DocumentPreview] 组件将卸载');
      window.document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);
  
  // 在组件挂载后获取聊天界面的位置和尺寸
  useEffect(() => {
    if (inChat) {
      // 找到聊天界面容器元素
      const chatContainer = window.document.getElementById('chat-interface-container');
      const previewContainer = previewRef.current;
      
      if (chatContainer && previewContainer) {
        console.log('[DocumentPreview] 已将预览窗口添加到聊天界面');
      }
    }
  }, [inChat]);
  
  // 添加PDF文件直接转换功能
  const convertBlobToPdf = async (blobUrl: string) => {
    try {
      console.log('[DocumentPreview] convertBlobToPdf: Starting conversion for URL:', blobUrl);
      
      // Add a delay before fetching to see if timing is an issue
      // await new Promise(resolve => setTimeout(resolve, 100)); 

      console.log('[DocumentPreview] convertBlobToPdf: Attempting to fetch URL:', blobUrl);
      // 获取blob数据
      const response = await fetch(blobUrl);
      console.log('[DocumentPreview] convertBlobToPdf: Fetch response status:', response.status, response.statusText);
      
      if (!response.ok) {
        // Log more details on fetch failure
        console.error('[DocumentPreview] convertBlobToPdf: Fetch failed. Response:', response);
        throw new Error(`获取blob数据失败: ${response.status} ${response.statusText}`);
      }
      
      const blob = await response.blob();
      console.log('[DocumentPreview] convertBlobToPdf: Successfully fetched blob data. Type:', blob.type, 'Size:', blob.size);
      
      // 读取blob内容为ArrayBuffer (这样可以直接传递给PDF.js而不是通过URL)
      return new Promise<ArrayBuffer>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          if (reader.result) {
            const arrayBuffer = reader.result as ArrayBuffer;
            console.log('[DocumentPreview] 成功将blob转换为ArrayBuffer, 大小:', arrayBuffer.byteLength);
            resolve(arrayBuffer);
          } else {
            reject(new Error('读取blob数据失败'));
          }
        };
        reader.onerror = () => {
          reject(new Error('FileReader错误: ' + reader.error?.message));
        };
        reader.readAsArrayBuffer(blob);
      });
    } catch (error) {
      console.error('[DocumentPreview] 转换blob到PDF失败:', error);
      throw error;
    }
  };

  // 处理PDF预览失败
  const handlePdfPreviewError = (error: any) => {
    console.error('[DocumentPreview] PDF预览失败:', error);
    setPreviewError(`无法加载PDF内容，请尝试下载后查看。错误: ${error instanceof Error ? error.message : String(error)}`);
  };

  // 验证PDF数据是否有效
  const validatePdfData = (data: ArrayBuffer): boolean => {
    try {
      // 检查PDF文件头
      const view = new Uint8Array(data.slice(0, 8));
      const header = String.fromCharCode.apply(null, Array.from(view));
      console.log('[DocumentPreview] PDF头部数据:', header);
      
      // 检查PDF文件头是否符合规范 (%PDF-1.x)
      const isValidPdf = header.startsWith('%PDF-');
      if (isValidPdf) {
        console.log('[DocumentPreview] PDF数据验证成功');
      } else {
        console.error('[DocumentPreview] PDF数据无效，不是标准PDF格式');
      }
      
      return isValidPdf;
    } catch (e) {
      console.error('[DocumentPreview] PDF数据验证失败:', e);
      return false;
    }
  };

  // 创建一个模拟PDF数据的功能，用于测试
  const createEmptyPdf = (): ArrayBuffer => {
    // 一个最小的有效PDF文件内容
    const minimalPdf = `%PDF-1.7
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/MediaBox[0 0 595 842]/Parent 2 0 R/Resources<<>>>>endobj
xref
0 4
0000000000 65535 f
0000000010 00000 n
0000000053 00000 n
0000000102 00000 n
trailer<</Size 4/Root 1 0 R>>
startxref
180
%%EOF`;
    
    const encoder = new TextEncoder();
    const uint8Array = encoder.encode(minimalPdf);
    // 确保返回的是ArrayBuffer而不是ArrayBufferLike
    return uint8Array.buffer as ArrayBuffer;
  };

  // 渲染文档预览
  const renderPreview = () => {
    try {
      const extension = document.fileName.split('.').pop()?.toLowerCase() || '';
      
      console.log(`[DocumentPreview] 渲染预览内容, 文件类型: ${extension}, 内容长度: ${content?.length || 0}`);
      console.log(`[DocumentPreview] 内容开头:`, content?.substring(0, 100));
      
      // PDF预览 - 使用自定义的PdfViewer组件
      if (extension === 'pdf') {
        // 检查content是否是有效的URL
        const isPdfUrl = content.startsWith('http') || content.startsWith('blob:') || content.startsWith('data:');
        
        // 尝试解析内容并提取实际的PDF数据
        // 如果是blob URL，可能需要先获取其内容
        if (isPdfUrl && content.startsWith('blob:')) {
          console.log('[DocumentPreview] 尝试获取blob内容以直接传递给PdfViewer');
          
          // 创建一个异步函数来处理blob获取
          const fetchBlob = async () => {
            try {
              // Use ArrayBuffer instead of creating a new blob URL
              const arrayBuffer = await convertBlobToPdf(content);
              
              // Validate PDF data
              const isValid = validatePdfData(arrayBuffer);
              if (!isValid) {
                console.log('[DocumentPreview] PDF数据无效，尝试创建一个有效的空PDF');
                // If not valid PDF, create empty PDF data
                const emptyPdf = createEmptyPdf();
                setPdfArrayBuffer(emptyPdf);
                toast.error('PDF数据无效，已替换为空白页面');
              } else {
                setPdfArrayBuffer(arrayBuffer);
              }
            } catch (e) {
              console.error('[DocumentPreview] 获取blob内容失败:', e);
              // Explicitly log that the failure happened during blob conversion/fetch
              if (e instanceof Error && e.message.includes('获取blob数据失败')) {
                 console.error('[DocumentPreview] CRITICAL: Failed during fetch(blobUrl) inside convertBlobToPdf.');
              } else if (e instanceof Error && e.message.includes('FileReader')) {
                 console.error('[DocumentPreview] CRITICAL: Failed during FileReader process inside convertBlobToPdf.');
              } else {
                 console.error('[DocumentPreview] CRITICAL: An unexpected error occurred in convertBlobToPdf.');
              }
              handlePdfPreviewError(e);
            }
          };
          
          // Initialize fetch process and add cleanup for original blob URL
          useEffect(() => {
            // Reset state when content changes
            setPdfArrayBuffer(null);
            setPreviewError(null);
            
            fetchBlob();
            
            // Cleanup function: Revoke the original content blob URL if applicable
            return () => {
              if (content && content.startsWith('blob:')) {
                console.log('[DocumentPreview] Cleanup: Revoking original content blob URL:', content);
                try {
                   URL.revokeObjectURL(content);
                } catch (e) {
                   console.error('[DocumentPreview] Cleanup: Failed to revoke original content blob URL:', e);
                }
              }
            };
          // eslint-disable-next-line react-hooks/exhaustive-deps
          }, [content]);
          
          // Only render using ArrayBuffer if available
          if (pdfArrayBuffer) {
            return (
              <div className="h-full w-full overflow-auto bg-gray-100">
                <PdfViewer data={pdfArrayBuffer} />
              </div>
            );
          }
          
          // Show loading or error state
          if (previewError) {
             // Render error state if fetchBlob failed
             return (
              <div className="h-full w-full overflow-auto p-4 bg-gray-50 text-sm">
                <div className="max-w-2xl mx-auto">
                  <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-4">
                    <div className="flex">
                      <div className="flex-shrink-0">
                        <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v4a1 1 0 102 0V5zm-1 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div className="ml-3">
                        <p className="text-sm text-red-700">
                          {previewError}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          }
          
          // Default to loading state while pdfArrayBuffer is being prepared
          return (
            <div className="h-full w-full flex items-center justify-center">
              <div className="animate-spin h-10 w-10 border-4 border-blue-500 border-t-transparent rounded-full"></div>
              <span className="ml-3 text-gray-600">正在处理PDF文档...</span>
            </div>
          );
        }
        
        if (isPdfUrl) {
          console.log('[DocumentPreview] 使用PdfViewer渲染PDF URL:', content);
          
          return (
            <div className="h-full w-full overflow-auto bg-gray-100">
              <PdfViewer url={content} />
            </div>
          );
        } else if (content && content.length > 0) {
          // 如果内容不是URL但有内容，首先判断内容格式
          try {
            console.log('[DocumentPreview] 检测PDF内容格式，长度:', content.length);
            
            // 检查内容是否为base64编码
            const isBase64 = content.startsWith('JVBERi0') || content.includes('base64,JVBERi0');
            
            let blobUrl;
            if (isBase64) {
              // 处理base64编码的PDF
              console.log('[DocumentPreview] 检测到base64编码的PDF内容');
              let base64Content = content;
              if (content.includes('base64,')) {
                base64Content = content.split('base64,')[1];
              }
              
              const binaryString = window.atob(base64Content);
              const len = binaryString.length;
              const bytes = new Uint8Array(len);
              for (let i = 0; i < len; i++) {
                bytes[i] = binaryString.charCodeAt(i);
              }
              
              blobUrl = URL.createObjectURL(new Blob([bytes.buffer], { type: 'application/pdf' }));
            } else {
              // 处理二进制或文本格式的PDF
              console.log('[DocumentPreview] 创建PDF Blob URL (二进制/文本)');
              
              // 尝试多种方式
              try {
                // 首先尝试直接创建Blob
                blobUrl = URL.createObjectURL(new Blob([content], { type: 'application/pdf' }));
                console.log('[DocumentPreview] 创建的Blob URL:', blobUrl);
              } catch (e) {
                console.error('[DocumentPreview] 直接创建Blob失败，尝试ArrayBuffer:', e);
                
                // 如果直接创建失败，尝试通过ArrayBuffer创建
                const textEncoder = new TextEncoder();
                const uint8Array = textEncoder.encode(content);
                blobUrl = URL.createObjectURL(new Blob([uint8Array], { type: 'application/pdf' }));
                console.log('[DocumentPreview] 通过ArrayBuffer创建的Blob URL:', blobUrl);
              }
            }
            
            // 在组件卸载时清理Blob URL
            useEffect(() => {
              return () => {
                console.log('[DocumentPreview] 清理PDF Blob URL:', blobUrl);
                if (blobUrl) URL.revokeObjectURL(blobUrl);
              };
            }, []);
            
            return (
              <div className="h-full w-full overflow-auto bg-gray-100">
                <PdfViewer url={blobUrl} />
              </div>
            );
          } catch (error) {
            console.error('[DocumentPreview] 创建PDF Blob URL失败:', error);
            return (
              <div className="h-full w-full overflow-auto p-4 bg-gray-50 text-sm">
                <div className="max-w-2xl mx-auto">
                  <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4">
                    <div className="flex">
                      <div className="flex-shrink-0">
                        <svg className="h-5 w-5 text-yellow-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div className="ml-3">
                        <p className="text-sm text-yellow-700">
                          无法加载PDF内容，请尝试下载文件后查看
                        </p>
                        <p className="text-xs text-yellow-600 mt-1">
                          错误详情: {error instanceof Error ? error.message : String(error)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          }
        }
        
        // 如果不是URL或创建Blob失败，显示文本信息
        return (
          <div className="h-full w-full overflow-auto p-4 bg-gray-50 text-sm">
            <div className="max-w-2xl mx-auto">
              <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-yellow-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-yellow-700">
                      无法加载PDF内容，请尝试下载文件后查看
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      }
      
      // 图片预览
      if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(extension)) {
        const isImageUrl = content.startsWith('http') || content.startsWith('blob:') || content.startsWith('data:');
        
        if (isImageUrl) {
          return (
            <div className="flex items-center justify-center h-full">
              <img
                src={content}
                alt={document.fileName}
                className="max-w-full max-h-full object-contain"
              />
            </div>
          );
        } else {
          // 如果不是URL，显示文本信息
          return (
            <div className="h-full w-full overflow-auto p-4 bg-gray-50 text-sm">
              <div className="max-w-2xl mx-auto">
                <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5 text-yellow-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm text-yellow-700">
                        {content}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        }
      }
      
      // 文本预览 - 包括txt, md, csv, json, html, xml等文本文件
      if (['txt', 'md', 'csv', 'json', 'html', 'xml'].includes(extension)) {
        let formattedContent = content;
        
        // 对不同类型的文本进行格式化处理
        if (extension === 'json') {
          try {
            // 尝试格式化JSON
            const jsonObj = JSON.parse(content);
            formattedContent = JSON.stringify(jsonObj, null, 2);
          } catch (e) {
            console.warn('[DocumentPreview] JSON解析失败，显示原始内容');
          }
        }
        
        return (
          <div className="h-full w-full overflow-auto p-4 bg-gray-50">
            <pre className="whitespace-pre-wrap font-mono text-sm">{formattedContent}</pre>
          </div>
        );
      }
      
      // 不支持的文件类型
      return (
        <div className="flex flex-col items-center justify-center h-full p-6 text-center">
          <p className="text-lg font-medium text-red-500 mb-4">无法预览该文件格式</p>
          <p className="text-gray-500 mb-6">当前不支持预览 .{extension} 格式的文件</p>
          <button
            onClick={handleDownload}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 flex items-center"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            下载文件
          </button>
        </div>
      );
    } catch (error) {
      console.error('[DocumentPreview] 渲染预览失败:', error);
      return (
        <div className="p-4 text-center text-red-500">
          <p>无法预览此文件，请尝试下载后查看。</p>
          <p className="text-xs text-gray-500 mt-2">{error instanceof Error ? error.message : String(error)}</p>
        </div>
      );
    }
  };
  
  // 计算预览容器的样式 - 使其与聊天界面重合
  const getPreviewContainerStyles = () => {
    if (inChat) {
      // 在聊天界面中展示，相对于父容器定位
      return "absolute inset-0 z-50 bg-white";
    } else {
      // 单独展示，占满整个容器
      return "fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70";
    }
  };
  
  // 计算预览内容容器的样式
  const getContentContainerStyles = () => {
    if (inChat) {
      // 在聊天界面中，使用相对定位和100%尺寸
      return "relative w-full h-full bg-white flex flex-col overflow-hidden";
    } else {
      // 单独展示，使用较大的容器
      return "bg-white rounded-lg overflow-hidden flex flex-col h-[95%] w-[95%] max-w-[1200px]";
    }
  };
  
  // 如果在聊天界面中预览，使用悬浮样式
  if (inChat) {
    return (
      <div className={getPreviewContainerStyles()} onClick={handleBackgroundClick}>
        <div 
          ref={previewRef}
          className={getContentContainerStyles()}
          onClick={handleContentClick}
        >
          <div className="absolute top-2 right-2 z-10">
            <button
              onClick={handleClose}
              className="bg-gray-800 bg-opacity-50 hover:bg-opacity-70 text-white rounded-full p-2 transition-colors shadow-lg"
              aria-label="关闭预览"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          <div className="flex-grow overflow-hidden">
            {previewError ? (
              <div className="flex flex-col items-center justify-center h-full w-full p-6 text-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-yellow-500 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <p className="text-lg font-medium text-gray-700 mb-2">预览提示</p>
                <p className="text-gray-500 mb-4">{previewError}</p>
                <div className="flex space-x-3">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDownload();
                    }}
                    className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 flex items-center"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    下载文件
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onClose();
                      toast.success('请单击文档，将其添加到AI聊天中进行分析');
                    }}
                    className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 flex items-center"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                    </svg>
                    AI分析文档
                  </button>
                </div>
              </div>
            ) : (
              renderPreview()
            )}
          </div>
        </div>
      </div>
    );
  }
  
  // 如果不是在聊天界面中预览，使用模态框样式
  return (
    <div className={getPreviewContainerStyles()} onClick={handleBackgroundClick}>
      <div 
        ref={previewRef}
        className={getContentContainerStyles()}
        onClick={handleContentClick}
      >
        <div className="absolute top-2 right-2 z-10">
          <button
            onClick={handleClose}
            className="bg-gray-800 bg-opacity-50 hover:bg-opacity-70 text-white rounded-full p-2 transition-colors shadow-lg"
            aria-label="关闭预览"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="flex-grow overflow-hidden">
          {previewError ? (
            <div className="flex flex-col items-center justify-center h-64 w-full p-6 text-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-yellow-500 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <p className="text-lg font-medium text-gray-700 mb-2">预览提示</p>
              <p className="text-gray-500 mb-4">{previewError}</p>
              <div className="flex space-x-3">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDownload();
                  }}
                  className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 flex items-center"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  下载文件
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onClose();
                    toast.success('请单击文档，将其添加到AI聊天中进行分析');
                  }}
                  className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 flex items-center"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                  </svg>
                  AI分析文档
                </button>
              </div>
            </div>
          ) : (
            renderPreview()
          )}
        </div>
      </div>
    </div>
  );
};

export default DocumentPreview; 