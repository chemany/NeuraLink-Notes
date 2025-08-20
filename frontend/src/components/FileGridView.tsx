import React from 'react';
import { Notebook } from '@/types';
import FileTypeIcon from './FileTypeIcon';
import { formatDate } from '@/utils/formatters';
import { PencilIcon } from '@heroicons/react/24/outline';

interface FileGridViewProps {
  notebooks: Notebook[];
  onNotebookClick: (notebook: Notebook) => void;
  onDelete?: (id: string) => void;
  onRename?: (notebook: Notebook) => void;
}

export default function FileGridView({ notebooks, onNotebookClick, onDelete, onRename }: FileGridViewProps) {
  const handleDeleteClick = (e: React.MouseEvent, notebookId: string) => {
    e.stopPropagation();
    onDelete?.(notebookId);
  };

  const handleRenameClick = (e: React.MouseEvent, notebook: Notebook) => {
    e.stopPropagation();
    onRename?.(notebook);
  };

  const handleCardClick = (notebook: Notebook) => {
    onNotebookClick(notebook);
  };

  if (!notebooks || notebooks.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <DocumentTextIcon className="mx-auto h-12 w-12 text-gray-300 mb-4" />
        <p>暂无文档</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 p-4">
      {notebooks.map((notebook) => (
        <div
          key={notebook.id}
          className="group relative bg-white border border-gray-200 rounded-lg hover:shadow-lg transition-all duration-200 cursor-pointer p-4 min-h-[140px] flex flex-col"
          onClick={() => handleCardClick(notebook)}
        >
          {/* 操作按钮 */}
          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex space-x-1 z-10">
            {onRename && (
              <button
                onClick={(e) => handleRenameClick(e, notebook)}
                className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-full"
                title="重命名"
              >
                <PencilIcon className="h-3 w-3" />
              </button>
            )}
            {onDelete && (
              <button
                onClick={(e) => handleDeleteClick(e, notebook.id)}
                className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full"
                title="删除"
              >
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {/* 文件图标 */}
          <div className="flex justify-center mb-3">
            <FileTypeIcon
              fileType="notebook"
              size="xl"
              className="drop-shadow-sm"
            />
          </div>

          {/* 文件名 */}
          <div className="flex-grow flex flex-col justify-between">
            <h3 className="text-sm font-medium text-gray-900 text-center break-words leading-tight mb-2">
              {notebook.title}
            </h3>
            
            {/* 修改日期 */}
            <p className="text-xs text-gray-500 text-center">
              {formatDate(notebook.updatedAt || notebook.createdAt || '')}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

// 添加必要的图标导入
import { DocumentTextIcon } from '@heroicons/react/24/outline';