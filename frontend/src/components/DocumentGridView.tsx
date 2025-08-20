import React from 'react';
import { Document } from '@/types/shared_local';
import { DocumentStatus } from '@/types/shared_local';
import FileTypeIcon from './FileTypeIcon';
import { formatFileSize, formatDate } from '@/utils/formatters';

interface DocumentGridViewProps {
  documents: Document[];
  selectedChatDocIds: Set<string>;
  vectorizedDocIds: Set<string>;
  failedVectorizationIds: Set<string>;
  processingQueue: string[];
  isProcessing: boolean;
  onDocumentClick: (doc: Document) => void;
  onDocumentOpen: (doc: Document) => void;
  onDeleteDocument: (e: React.MouseEvent, docId: string) => void;
  onToggleChatSelection?: (doc: Document) => void;
  onDragStart: (e: React.DragEvent, doc: Document) => void;
}

// 图标组件
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

const DatabaseIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-2.5 w-2.5 inline-block ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8-4" />
  </svg>
);

export default function DocumentGridView({
  documents,
  selectedChatDocIds,
  vectorizedDocIds,
  failedVectorizationIds,
  processingQueue,
  isProcessing,
  onDocumentClick,
  onDocumentOpen,
  onDeleteDocument,
  onToggleChatSelection,
  onDragStart
}: DocumentGridViewProps) {

  const getStatusInfo = (doc: Document) => {
    const isVectorized = vectorizedDocIds.has(doc.id);
    const hasFailedVectorization = failedVectorizationIds.has(doc.id);

    if (isVectorized) {
      return { icon: <DatabaseIcon />, label: '已就绪', color: 'text-green-500' };
    } else if (processingQueue.includes(doc.id) || isProcessing) {
      return { 
        icon: <div className="animate-spin h-3 w-3 border-2 border-blue-400 border-t-transparent rounded-full"></div>, 
        label: '队列中', 
        color: 'text-blue-500' 
      };
    }

    switch (doc.status) {
      case DocumentStatus.PENDING:
        return { icon: '⏳', label: '等待处理', color: 'text-yellow-600' };
      case DocumentStatus.PROCESSING:
        return { icon: '🔄', label: '处理中', color: 'text-blue-600' };
      case DocumentStatus.COMPLETED:
        return { icon: '✅', label: '已完成', color: 'text-green-600' };
      case DocumentStatus.FAILED:
        return { icon: '❌', label: '失败', color: 'text-red-600' };
      default:
        return { icon: '❓', label: '未知', color: 'text-gray-600' };
    }
  };

  if (!documents || documents.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <svg className="mx-auto h-12 w-12 text-gray-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <p>暂无文档</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-4 gap-3 p-3">
      {documents.map((doc) => {
        const statusInfo = getStatusInfo(doc);
        const isSelected = selectedChatDocIds.has(doc.id);

        return (
          <div
            key={doc.id}
            draggable
            onDragStart={(e) => onDragStart(e, doc)}
            onClick={() => onDocumentClick(doc)}
            onDoubleClick={() => onDocumentOpen(doc)}
            className={`
              group relative bg-white border border-gray-200 rounded-lg p-1.5 hover:shadow-md transition-all duration-200 cursor-pointer
              ${isSelected ? 'ring-2 ring-blue-500 bg-blue-50' : 'hover:bg-gray-50'}
            `}
            title={`${doc.fileName} - ${statusInfo.label}`}
          >
            {/* 文件图标 */}
            <div className="flex justify-center mb-1.5">
              <FileTypeIcon 
                fileName={doc.fileName}
                size="md"
              />
            </div>

            {/* 文件名 */}
            <div className="text-center h-7 flex items-center justify-center">
              <p 
                className="text-xs font-medium text-gray-900 leading-tight break-words"
                style={{
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                  wordBreak: 'break-all',
                  lineHeight: '1.2'
                }}
                title={doc.fileName}
              >
                {doc.fileName}
              </p>
            </div>

            {/* 悬停操作按钮 */}
            <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="flex space-x-0.5">
                <button
                  onClick={(e) => { e.stopPropagation(); onDocumentOpen(doc); }}
                  className="p-1 bg-white border border-gray-200 rounded-full hover:bg-gray-100 shadow-sm"
                  title="预览文档"
                >
                  <EyeIcon />
                </button>
                <button
                  onClick={(e) => onDeleteDocument(e, doc.id)}
                  className="p-1 bg-white border border-gray-200 rounded-full hover:bg-red-100 hover:text-red-600 shadow-sm"
                  title="删除文档"
                >
                  <TrashIcon />
                </button>
              </div>
            </div>

            {/* 聊天选择指示器 */}
            {onToggleChatSelection && (
              <div className="absolute top-1 left-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleChatSelection(doc);
                  }}
                  className={`p-1 rounded-full transition-colors shadow-sm ${
                    isSelected 
                      ? 'bg-blue-500 text-white' 
                      : 'bg-white border border-gray-200 opacity-0 group-hover:opacity-100 hover:bg-gray-100'
                  }`}
                  title={isSelected ? "取消选择用于聊天" : "选择用于聊天"}
                >
                  {isSelected ? <MinusCircleIcon /> : <PlusCircleIcon />}
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}