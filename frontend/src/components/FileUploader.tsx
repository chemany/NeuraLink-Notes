import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useSettings } from '@/contexts/SettingsContext';
import { useNotebook } from '@/contexts/NotebookContext';
import { formatFileSize } from '@/utils/formatters';
import { 
  uploadDocumentToApi, 
  processDocumentVectorization,
  fetchDocumentById
} from '@/services/documentService';
import { DocumentStatus, Document } from '@/types/shared_local';
import { FiUpload } from 'react-icons/fi';
import { toast } from 'react-hot-toast';

interface FileUploaderProps {
  notebookId: string;
  onUploadComplete?: (doc: Document) => void;
}

export default function FileUploader({ notebookId, onUploadComplete }: FileUploaderProps) {
  const { currentNotebook } = useNotebook();
  const { embeddingSettings } = useSettings();
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [processingFiles, setProcessingFiles] = useState<Document[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isMounted, setIsMounted] = useState(false);
  const notebookIdRef = useRef<string>(notebookId);

  useEffect(() => {
    setIsMounted(true);
    notebookIdRef.current = notebookId;
    console.log(`[FileUploader] 设置当前笔记本ID: ${notebookId}`);
  }, [notebookId]);

  // 添加文件到处理队列
  const addToProcessingQueue = (document: Document) => {
    setProcessingFiles(prev => [...prev, document]);
  };

  // 更新处理队列中文件的状态
  const updateFileInProcessingQueue = (documentId: string, status: DocumentStatus, message?: string) => {
    setProcessingFiles(prev => 
      prev.map(doc => 
        doc.id === documentId 
          ? { ...doc, status, statusMessage: message } 
          : doc
      )
    );
  };

  // 从处理队列中移除文件
  const removeFromProcessingQueue = (documentId: string) => {
    // 5秒后从队列中移除完成或失败的文件
    setTimeout(() => {
      setProcessingFiles(prev => prev.filter(doc => doc.id !== documentId));
    }, 5000);
  };

  // Define uploadSingleFile *before* handleDrop and handleFileInputChange
  const uploadSingleFile = useCallback(async (file: File, currentNotebookId: string) => {
    // Add to processing queue at the start
    const tempDocId = `temp_${Date.now()}_${file.name}`;
    const tempDoc: Document = {
      id: tempDocId,
      fileName: file.name,
      status: DocumentStatus.PENDING,
      fileSize: file.size,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      notebookId: currentNotebookId, // Ensure notebookId is set
      // Add other required fields from Document type with default/null values
      title: file.name,
      s3Key: '', 
      mimetype: file.type,
      fileType: file.type || file.name.split('.').pop() || '',
      uploadDate: new Date().toISOString(),
    };
    addToProcessingQueue(tempDoc);

    try {
      console.log(`[FileUploader] 开始上传文件: ${file.name} 到笔记本: ${currentNotebookId}`);
      updateFileInProcessingQueue(tempDocId, DocumentStatus.PROCESSING);
      setUploadProgress(50); // Simplified progress
      
      const result = await uploadDocumentToApi(file, currentNotebookId);
      console.log(`[FileUploader] 文件上传结果:`, result);
      
      if (!result || !result.id) { // Check for result.id
        throw new Error('文件上传失败：未获取到有效的上传结果 ID');
      }
      
      setUploadProgress(100);
      updateFileInProcessingQueue(tempDocId, DocumentStatus.COMPLETED, '上传成功');
      removeFromProcessingQueue(tempDocId); // Remove after delay
      
      // Remove temp doc and add actual doc to queue (briefly)
      setProcessingFiles(prev => prev.filter(doc => doc.id !== tempDocId));
      addToProcessingQueue({...result, status: DocumentStatus.COMPLETED}); // Add actual result
      removeFromProcessingQueue(result.id); // Schedule removal of actual result too
            
      // Callback *after* API success
      if (onUploadComplete) {
        onUploadComplete(result);
      }
      
    } catch (error: any) {
      console.error('[FileUploader] 文件上传失败:', error);
      updateFileInProcessingQueue(tempDocId, DocumentStatus.FAILED, error.message || '上传失败');
      removeFromProcessingQueue(tempDocId); // Remove after delay
      toast.error(`文件上传失败: ${error.message || '未知错误'}`, {
        duration: 3000,
        position: 'top-center',
      });
    } finally {
      // Reset overall progress after each file attempt? Or keep until loop ends?
      // Let's reset here for simplicity, parent loop handles overall isUploading.
      setUploadProgress(0); 
    }
  }, [onUploadComplete, addToProcessingQueue, updateFileInProcessingQueue, removeFromProcessingQueue]); // Added dependencies

  // 处理拖放文件
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const fileList = Array.from(e.dataTransfer.files);
      console.log(`通过拖放接收到 ${fileList.length} 个文件`);
      
      setIsUploading(true);
      setError(null);
      for (const file of fileList) {
        await uploadSingleFile(file, notebookIdRef.current);
      }
      setIsUploading(false);
    }
  }, [uploadSingleFile]); // Now dependency is valid

  // 点击触发文件选择器
  const handleClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  // 从文件选择器处理文件
  const handleFileInputChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    
    const fileList = Array.from(files);
    console.log(`通过文件选择器接收到 ${fileList.length} 个文件`);
    
    setIsUploading(true);
    setError(null);
    for (const file of fileList) {
        await uploadSingleFile(file, notebookIdRef.current);
    }
    setIsUploading(false);
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };
  
  // 获取文档状态图标
  const getStatusIcon = (status: DocumentStatus) => {
    switch (status) {
      case DocumentStatus.PENDING:
        return '⏳';
      case DocumentStatus.PROCESSING:
        return '🔄';
      case DocumentStatus.COMPLETED:
        return '✅';
      case DocumentStatus.FAILED:
        return '❌';
      default:
        return '❓';
    }
  };

  if (!isMounted) {
    return null; // 服务器端渲染不显示
  }

  return (
    <div className="space-y-2">
      {error && (
        <div className="text-red-500 text-sm">
          {error}
        </div>
      )}
      
      {/* 拖放及点击上传区域 */}
      <div 
        className={`border-2 border-dashed p-1.5 rounded-lg text-center cursor-pointer transition-colors duration-200 
        ${isDragging 
          ? 'border-blue-500 bg-blue-50' 
          : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'} 
        bg-gray-50 bg-opacity-50 shadow-sm`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
      >
        <input
          type="file"
          multiple
          className="hidden"
          onChange={handleFileInputChange}
          disabled={isUploading}
          ref={fileInputRef}
          accept=".pdf,.doc,.docx,.txt,.md,.csv,.json,.xlsx,.xls"
        />
        
        <div className="flex flex-col items-center justify-center text-gray-600">
          {isUploading ? (
            <p className="text-xs">正在上传，请稍候...</p>
          ) : (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-500 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <p className="text-xs font-medium">拖放文件到此处上传，或点击选择文件</p>
              <p className="text-xxs text-gray-500 mt-0.5">支持PDF、Word、Excel、TXT、Markdown、CSV、JSON</p>
            </>
          )}
        </div>
      </div>
      
      {uploadProgress > 0 && (
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
            style={{ width: `${uploadProgress}%` }}
          ></div>
        </div>
      )}
      
      {processingFiles.length > 0 && (
        <div className="mt-4">
          <h4 className="text-sm font-medium mb-2">处理队列:</h4>
          <ul className="text-sm space-y-1">
            {processingFiles.map(doc => (
              <li key={doc.id} className="flex items-center">
                <span className="mr-2">{getStatusIcon(doc.status)}</span>
                <span className="truncate">{doc.fileName}</span>
                {doc.statusMessage && (
                  <span className="ml-2 text-xs text-gray-500">{doc.statusMessage}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
} 