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

interface DocumentPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  document: Document | null;
  content: string | ArrayBuffer | null;
  // Use fixed positioning relative to viewport
  position?: { top: number; left: number; width: number; height: number };
}

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

        if (typeof content === 'string') {
          if (['txt', 'md', 'csv', 'json'].includes(extension)) {
          } 
          else {
            if (content.startsWith('http') || content.startsWith('/api/documents')) {
                const response = await apiClient.get(content, { responseType: 'blob' });
                const blob = response.data as Blob;
                finalUrl = URL.createObjectURL(blob);
                currentObjectUrl = finalUrl; 
            } else {
            }
          }
        } else if (content instanceof ArrayBuffer) {
           const mimeType = getMimeType(extension);
           const blob = new Blob([content], { type: mimeType });
           finalUrl = URL.createObjectURL(blob);
           currentObjectUrl = finalUrl; 
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
        URL.revokeObjectURL(currentObjectUrl);
      }
      setObjectUrl(null); // Clear state on cleanup
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
      const knownUnsupportedPreview = ['pptx', 'ppt', 'doc']; 

      if (imageSupported.includes(extension)) {
         return <img src={objectUrl} alt={document.fileName} className="max-w-full max-h-full object-contain mx-auto" />;
      } else if (extension === 'pdf') {
         return <iframe src={objectUrl} className="w-full h-full border-0" title={document.fileName} />;
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
