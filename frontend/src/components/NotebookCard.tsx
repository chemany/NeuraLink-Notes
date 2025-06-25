import React, { useState, useEffect, MouseEvent, useCallback } from 'react';
import Link from 'next/link';
import { formatDate } from '@/utils/formatters';
import { useNotebook } from '@/contexts/NotebookContext';
import { Notebook } from '@/types';
import ConfirmModal from './ConfirmModal'; // 导入自定义模态框组件
import { useRouter } from 'next/navigation';
import { PencilIcon } from '@heroicons/react/24/outline'; // 导入编辑图标
import { Trash2Icon, EditIcon } from 'lucide-react';

interface NotebookCardProps {
  notebookId: string;
  onDelete?: (id: string) => void;
  onRename?: (notebook: Notebook) => void; // 添加重命名回调
}

export default function NotebookCard({ notebookId, onDelete, onRename }: NotebookCardProps) {
  const { notebooks, deleteNotebook } = useNotebook();
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState<boolean>(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const router = useRouter();
  
  // 使用状态存储找到的笔记本数据
  const [notebook, setNotebook] = useState<Notebook | null>(null);

  // 从上下文中查找笔记本数据
  useEffect(() => {
    if (!notebookId) {
      console.warn(`[NotebookCard:${notebookId || 'undefined'}] Invalid notebookId`);
      setIsLoading(false);
      return;
    }
    const foundInContext = notebooks?.find(nb => nb?.id === notebookId);
    if (foundInContext) {
      setNotebook(foundInContext);
    } else {
      // 处理笔记本可能尚未在上下文中的情况（例如，初始加载）
      console.warn(`[NotebookCard:${notebookId}] Notebook not found in context.`);
      // 可选择如果需要，可以直接获取
      setNotebook(null); // 如果未找到，则设置为 null
    }
    setIsLoading(false); // 尝试后设置加载为 false
  }, [notebookId, notebooks]);

  // 处理删除按钮点击的函数
  const handleDeleteClick = (event: MouseEvent) => {
    event.stopPropagation(); // 防止点击删除按钮时导航
    setIsConfirmModalOpen(true); // 打开确认模态框
  };

  // 处理重命名按钮点击
  const handleRenameClick = (event: MouseEvent) => {
    event.stopPropagation(); // 防止点击重命名按钮时导航
    if (notebook && onRename) {
      onRename(notebook);
    }
  };

  // 确认删除
  const confirmDelete = async () => {
    if (!notebook) return;
    setIsDeleting(true); // 表示删除正在开始
    try {
      await deleteNotebook(notebook.id);
      // 如果需要父组件更新，可以在此处使用 onDelete 回调
      if (onDelete) {
        onDelete(notebook.id);
      }
      // 删除后，关闭模态框
      setIsConfirmModalOpen(false);
    } catch (error) { 
      // 错误处理在 deleteNotebook 上下文函数内完成(toast)
      console.error("Deletion failed in card:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  // 如果仍在加载或未找到笔记本，则显示占位符
  if (isLoading || !notebook) {
    return (
      <div className="border rounded-lg shadow-sm p-4 bg-gray-100 animate-pulse h-[130px]"> 
        <div className="h-4 bg-gray-300 rounded w-3/4 mb-2"></div>
        <div className="h-3 bg-gray-300 rounded w-1/2 mb-3"></div>
        <div className="h-3 bg-gray-300 rounded w-1/4 mt-auto"></div>
      </div>
    );
  }

  // 笔记本数据可用
  console.log(`[NotebookCard:${notebookId}] 渲染笔记本卡片: ${notebook.title}`);

  // 使用 updatedAt 显示日期
  const displayDate = notebook.updatedAt ? formatDate(notebook.updatedAt) : '未知日期';

  // 处理卡片点击进行导航
  const handleCardClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    router.push(`/${notebook.id}`);
  };

  // 拖拽事件处理
  const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
    if (!notebook) return;
    console.log(`[NotebookCard] DragStart event triggered for notebook: "${notebook.title}" (ID: ${notebook.id})`);
    setIsDragging(true);
    
    const dragData = {
      type: 'notebook',
      id: notebook.id,
      currentFolderId: notebook.folderId,
      title: notebook.title
    };
    
    try {
      const jsonString = JSON.stringify(dragData);
      console.log('[NotebookCard] Setting drag data:', jsonString);
      
      // 设置多种数据格式
      e.dataTransfer.setData('text/plain', jsonString);
      e.dataTransfer.setData('application/json', jsonString);
      
      // 设置拖拽效果
      e.dataTransfer.effectAllowed = 'move';
      
      // --- 恢复自定义拖拽图像 --- 
      // 创建自定义拖拽图像
      const dragPreview = document.createElement('div');
      dragPreview.className = 'bg-white shadow-md rounded-md p-2 text-sm';
      dragPreview.textContent = notebook.title;
      dragPreview.style.cssText = `
        position: absolute;
        top: -1000px;
        left: -1000px;
        background-color: white;
        padding: 8px;
        border-radius: 4px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        opacity: 0.8;
        pointer-events: none;
        z-index: 9999;
      `;
      document.body.appendChild(dragPreview);
      
      e.dataTransfer.setDragImage(dragPreview, 10, 10);
      
      // 使用 requestAnimationFrame 确保拖拽图像被设置后再移除
      requestAnimationFrame(() => {
        if (document.body.contains(dragPreview)) {
             document.body.removeChild(dragPreview);
        }
      });
      // --- 结束恢复 --- 

    } catch (error) {
      console.error('[NotebookCard] Failed to stringify or set drag data:', error);
      e.preventDefault(); 
      return;
    }
  };

  const handleDragEnd = (e: React.DragEvent<HTMLDivElement>) => {
    if (!notebook) return;
    console.log(`[NotebookCard] DragEnd event triggered for notebook: "${notebook.title}" (ID: ${notebook.id})`);
    setIsDragging(false);
  };

  return (
    <>
      {/* 卡片容器，移除固定高度 h-[70px] 和 justify-between */}
      <div 
        className={`relative border rounded-lg shadow-sm p-1 bg-white hover:shadow-md transition-shadow duration-200 flex flex-col ${isDragging ? 'opacity-50' : ''} cursor-pointer`} // 修改 p-2 为 p-1
        onClick={handleCardClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        draggable={!!notebook}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        data-notebook-id={notebook?.id}
      > 
        {/* 操作按钮组 - 重命名和删除 */}
        <div className="absolute top-1 right-1 flex space-x-1 z-20">
          {/* 重命名按钮 */}
          {onRename && notebook && (
            <button 
              onClick={handleRenameClick}
              className="p-0.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-full"
              aria-label="重命名笔记本"
              title="重命名笔记本"
            >
              <PencilIcon className="h-3 w-3" />
            </button>
          )}
          
          {/* 删除按钮 */}
          {onDelete && ( 
            <button 
              onClick={handleDeleteClick}
              className="p-0.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full"
              aria-label="删除笔记本"
              title="删除笔记本"
              disabled={isDeleting}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* 卡片内容 - 移除 overflow-hidden */}
        <div className="flex-grow mb-1"> {/* 使用 flex-grow 并添加下边距 */} 
          {/* 标题 - 移除 truncate，允许换行 */}
          <h3 className="text-sm font-semibold text-gray-800 pr-2 break-words" title={notebook?.title}> {/* 修改 pr-4 为 pr-2 */} 
            {notebook?.title}
          </h3>
        </div>

        {/* 日期 - 移除 mt-auto */}
        <div className="text-xs text-gray-400">
          {notebook && formatDate(notebook.updatedAt || notebook.createdAt || '')}
        </div>
      </div>

      {/* 确认删除模态框 */}
      <ConfirmModal
        isOpen={isConfirmModalOpen}
        onClose={() => setIsConfirmModalOpen(false)}
        onConfirm={confirmDelete}
        title="确认删除"
        message={`确定要删除笔记本 "${notebook?.title}" 吗？此操作不可恢复。`}
      />
    </>
  );
} 