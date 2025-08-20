import React from 'react';
import { Document } from '@/types/shared_local';
import { DocumentStatus } from '@/types/shared_local';
import FileTypeIcon from './FileTypeIcon';
import { formatFileSize, formatDate } from '@/utils/formatters';

interface DocumentListViewProps {
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

export default function DocumentListView({
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
}: DocumentListViewProps) {

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
    <div className="bg-white rounded-lg border border-gray-200">
      {/* 表头 */}
      <div className="grid grid-cols-12 gap-4 px-4 py-3 bg-gray-50 rounded-t-lg border-b border-gray-200 text-sm font-medium text-gray-700">
        <div className="col-span-1"></div> {/* 图标列 */}
        <div className="col-span-5">名称</div>
        <div className="col-span-2">大小</div>
        <div className="col-span-2">状态</div>
        <div className="col-span-2 text-right">操作</div>
      </div>

      {/* 文档列表 */}
      <div className="divide-y divide-gray-200">
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
                grid grid-cols-12 gap-4 px-4 py-3 hover:bg-gray-50 cursor-pointer transition-colors duration-150 group
                ${isSelected ? 'bg-blue-50 border-l-4 border-blue-500' : ''}
              `}
            >
              {/* 图标列 */}
              <div className="col-span-1 flex items-center">
                <FileTypeIcon
                  fileName={doc.fileName}
                  size="md"
                />
              </div>

              {/* 名称列 */}
              <div className="col-span-5 flex items-center">
                <div>
                  <p className="text-sm text-gray-900 truncate font-medium" title={doc.fileName}>
                    {doc.fileName}
                  </p>
                  <p className="text-xs text-gray-500">
                    {formatDate(doc.createdAt)}
                  </p>
                </div>
              </div>

              {/* 大小列 */}
              <div className="col-span-2 flex items-center">
                <span className="text-sm text-gray-500">
                  {formatFileSize(doc.fileSize)}
                </span>
              </div>

              {/* 状态列 */}
              <div className="col-span-2 flex items-center">
                <div className={`flex items-center text-xs ${statusInfo.color}`}>
                  {statusInfo.icon}
                  <span className="ml-1">{statusInfo.label}</span>
                </div>
              </div>

              {/* 操作列 */}
              <div className="col-span-2 flex items-center justify-end space-x-1">
                <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex space-x-1">
                  <button
                    onClick={(e) => { e.stopPropagation(); onDocumentOpen(doc); }}
                    className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-full"
                    title="预览"
                  >
                    <EyeIcon />
                  </button>
                  <button
                    onClick={(e) => onDeleteDocument(e, doc.id)}
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full"
                    title="删除"
                  >
                    <TrashIcon />
                  </button>
                  {onToggleChatSelection && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleChatSelection(doc);
                      }}
                      className={`p-1.5 rounded-full transition-colors ${
                        isSelected 
                          ? 'bg-blue-500 text-white hover:bg-blue-600' 
                          : 'text-gray-400 hover:text-blue-600 hover:bg-blue-50'
                      }`}
                      title={isSelected ? "取消选择用于聊天" : "选择用于聊天"}
                    >
                      {isSelected ? <MinusCircleIcon /> : <PlusCircleIcon />}
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