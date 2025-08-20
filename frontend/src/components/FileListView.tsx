import React from 'react';
import { Notebook } from '@/types';
import FileTypeIcon from './FileTypeIcon';
import { formatDate } from '@/utils/formatters';
import { PencilIcon, DocumentTextIcon } from '@heroicons/react/24/outline';

interface FileListViewProps {
  notebooks: Notebook[];
  onNotebookClick: (notebook: Notebook) => void;
  onDelete?: (id: string) => void;
  onRename?: (notebook: Notebook) => void;
}

export default function FileListView({ notebooks, onNotebookClick, onDelete, onRename }: FileListViewProps) {
  const handleDeleteClick = (e: React.MouseEvent, notebookId: string) => {
    e.stopPropagation();
    onDelete?.(notebookId);
  };

  const handleRenameClick = (e: React.MouseEvent, notebook: Notebook) => {
    e.stopPropagation();
    onRename?.(notebook);
  };

  const handleRowClick = (notebook: Notebook) => {
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
    <div className="bg-white rounded-lg border border-gray-200">
      {/* 表头 */}
      <div className="grid grid-cols-12 gap-4 px-4 py-3 bg-gray-50 rounded-t-lg border-b border-gray-200 text-sm font-medium text-gray-700">
        <div className="col-span-1"></div> {/* 图标列 */}
        <div className="col-span-7">名称</div>
        <div className="col-span-2">修改时间</div>
        <div className="col-span-2 text-right">操作</div>
      </div>

      {/* 文件列表 */}
      <div className="divide-y divide-gray-200">
        {notebooks.map((notebook) => (
          <div
            key={notebook.id}
            className="grid grid-cols-12 gap-4 px-4 py-3 hover:bg-gray-50 cursor-pointer transition-colors duration-150 group"
            onClick={() => handleRowClick(notebook)}
          >
            {/* 图标列 */}
            <div className="col-span-1 flex items-center">
              <FileTypeIcon
                fileType="notebook"
                size="md"
              />
            </div>

            {/* 名称列 */}
            <div className="col-span-7 flex items-center">
              <span className="text-sm text-gray-900 truncate" title={notebook.title}>
                {notebook.title}
              </span>
            </div>

            {/* 修改时间列 */}
            <div className="col-span-2 flex items-center">
              <span className="text-sm text-gray-500">
                {formatDate(notebook.updatedAt || notebook.createdAt || '')}
              </span>
            </div>

            {/* 操作列 */}
            <div className="col-span-2 flex items-center justify-end space-x-1">
              <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex space-x-1">
                {onRename && (
                  <button
                    onClick={(e) => handleRenameClick(e, notebook)}
                    className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-full"
                    title="重命名"
                  >
                    <PencilIcon className="h-4 w-4" />
                  </button>
                )}
                {onDelete && (
                  <button
                    onClick={(e) => handleDeleteClick(e, notebook.id)}
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full"
                    title="删除"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}