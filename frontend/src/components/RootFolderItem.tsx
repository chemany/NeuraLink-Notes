import React, { useState } from 'react';
import { useNotebook } from '@/contexts/NotebookContext';

interface RootFolderItemProps {
  onSelectFolder?: () => void;
  isSelected?: boolean;
}

const RootFolderItem: React.FC<RootFolderItemProps> = ({ onSelectFolder, isSelected }) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const { updateNotebookFolder } = useNotebook();

  // 处理点击根文件夹
  const handleClick = () => {
    if (onSelectFolder) {
      onSelectFolder();
    }
  };

  // 处理拖放事件
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    // 必须总是调用 preventDefault 来允许放置
    e.preventDefault(); 
    e.stopPropagation();
    
    // 根据类型决定是否允许放置并显示视觉效果
    if (e.dataTransfer.types.includes('application/json')) {
      e.dataTransfer.dropEffect = 'move';
      setIsDragOver(true);
    } else {
      e.dataTransfer.dropEffect = 'none';
      setIsDragOver(false);
    }
  };

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    // 只有在拖拽的是笔记本时才显示高亮
    if (e.dataTransfer.types.includes('application/json')) {
      // console.log('[RootFolderItem] DragEnter: Setting isDragOver true');
      setIsDragOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    // 确保相关目标不是当前元素或其子元素
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      // console.log('[RootFolderItem] DragLeave: Setting isDragOver false');
      setIsDragOver(false);
    }
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    // !! 添加日志确认 Drop 事件触发 !!
    console.log('[RootFolderItem] Drop event triggered');
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    
    try {
      const dataText = e.dataTransfer.getData('application/json'); // 尝试获取我们设置的json格式
      if (!dataText) {
        console.error('[RootFolderItem] Failed to get application/json data on drop');
        return;
      }
      console.log('[RootFolderItem] Drop data received (application/json):', dataText);
      
      const data = JSON.parse(dataText);
      console.log('[RootFolderItem] Parsed drop data:', data);

      // 确保是笔记本类型，且不是已经在根目录
      if (data.type === 'notebook' && data.id && data.currentFolderId !== null) {
        console.log(`[RootFolderItem] Attempting to move notebook ${data.id} to root folder`);
        await updateNotebookFolder(data.id, null);
        console.log(`[RootFolderItem] Successfully called updateNotebookFolder for ${data.id}`);
      } else {
        console.log(`[RootFolderItem] Drop condition not met or invalid data: type=${data.type}, id=${data.id}, currentFolderId=${data.currentFolderId}, targetFolderId=null`);
      }
    } catch (error) {
      console.error('[RootFolderItem] Error processing drop:', error);
    }
  };

  return (
    <div 
      className={`
        flex items-center p-2 rounded-md transition-colors duration-200 cursor-pointer
        ${isSelected ? 'bg-blue-100' : 'hover:bg-gray-100'} 
        ${isDragOver ? 'bg-green-100 border-2 border-dashed border-green-500' : ''}
      `}
      onClick={handleClick}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      data-folder-id="root"
      draggable={false}
    >
      <div className="mr-2 text-gray-500">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path d="M2 4a1 1 0 011-1h14a1 1 0 011 1v10a1 1 0 01-1 1H3a1 1 0 01-1-1V4z" />
        </svg>
      </div>
      <span className="text-sm font-medium">全部笔记本</span>
    </div>
  );
};

export default RootFolderItem; 