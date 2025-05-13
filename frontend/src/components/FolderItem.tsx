import React, { useState } from 'react';
import { useNotebook } from '@/contexts/NotebookContext';
import { Folder } from '@/types';

interface FolderItemProps {
  folder: Folder;
  onSelectFolder: () => void;
  isSelected: boolean;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onEditFolder: () => void;
  onDeleteFolder: () => void;
}

const FolderItem: React.FC<FolderItemProps> = ({
  folder,
  onSelectFolder,
  isSelected,
  isExpanded,
  onToggleExpand,
  onEditFolder,
  onDeleteFolder
}) => {
  // const [isDragOver, setIsDragOver] = useState(false); // 状态移到父组件
  // const { updateNotebookFolder } = useNotebook(); // 拖拽逻辑移到父组件

  // !! Log the received folder prop on every render !!
  // console.log(`[FolderItem] Rendering with folder prop:`, JSON.stringify(folder));

  // 处理点击文件夹
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelectFolder();
  };

  // 处理展开/折叠
  const handleToggleExpand = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleExpand();
  };

  // 拖拽事件处理 - 全部移除，移到父组件
  /*
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    // ...
  };
  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    // ...
  };
  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    // ...
  };
  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    // ...
  };
  */

  // 处理编辑按钮点击
  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onEditFolder();
  };

  // 处理删除按钮点击
  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDeleteFolder();
  };

  return (
    <div
      className={`
        flex items-center p-2 rounded-md transition-colors duration-200 cursor-pointer relative
        ${isSelected ? 'bg-blue-100' : 'hover:bg-gray-100'} 
      `}
      onClick={handleClick}
      // 移除 onDragOver, onDragEnter, onDragLeave, onDrop
      data-folder-id={folder.id}
      draggable={false}
    >
      {/* 折叠/展开图标 */}
      <div 
        className="mr-2 text-gray-500 cursor-pointer" 
        onClick={handleToggleExpand}
      >
        <svg 
          xmlns="http://www.w3.org/2000/svg" 
          className={`h-4 w-4 transition-transform ${isExpanded ? 'transform rotate-90' : ''}`} 
          fill="none" 
          viewBox="0 0 24 24" 
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
      
      {/* 文件夹图标 */}
      <div className="mr-2 text-gray-500">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M2 6a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1H8a3 3 0 00-3 3v1.5a1.5 1.5 0 01-3 0V6z" clipRule="evenodd" />
          <path d="M6 12a2 2 0 012-2h8a2 2 0 012 2v2a2 2 0 01-2 2H2h2a2 2 0 002-2v-2z" />
        </svg>
      </div>
      
      {/* 文件夹名称 */}
      <span className="text-sm font-medium flex-grow truncate">{folder.name}</span>
      
      {/* 编辑和删除按钮 */}
      <div className="flex space-x-1 ml-2">
        <button
          onClick={handleEditClick}
          className="p-1 text-gray-400 hover:text-blue-600 rounded-full"
          title="编辑文件夹"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
        </button>
        <button
          onClick={handleDeleteClick}
          className="p-1 text-gray-400 hover:text-red-600 rounded-full"
          title="删除文件夹"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default FolderItem; 