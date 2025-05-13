import Link from 'next/link';
import { useState, useEffect, useRef } from 'react';
import SettingsDialog from './SettingsDialog';
import { useNotebook } from '@/contexts/NotebookContext';
import { useRouter } from 'next/navigation';

interface HeaderProps {
  showBackButton?: boolean;
  title?: string;
  showNewNotebookButton?: boolean;
  notebookId?: string;
}

export default function Header({ 
  showBackButton = false,
  title,
  showNewNotebookButton = true,
  notebookId
}: HeaderProps) {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState(title || '');
  const titleInputRef = useRef<HTMLInputElement>(null);
  const { deleteNotebook, updateNotebookTitle } = useNotebook();
  const router = useRouter();

  useEffect(() => {
    setEditedTitle(title || '');
  }, [title]);

  // 当编辑模式激活时，自动聚焦输入框
  useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [isEditingTitle]);

  const handleDelete = () => {
    setShowDeleteConfirm(true);
  };

  const confirmDelete = () => {
    if (notebookId) {
      deleteNotebook(notebookId);
      router.push('/');
    }
    setShowDeleteConfirm(false);
  };

  const cancelDelete = () => {
    setShowDeleteConfirm(false);
  };

  const handleTitleDoubleClick = () => {
    if (notebookId) {
      setIsEditingTitle(true);
    }
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEditedTitle(e.target.value);
  };

  const handleTitleBlur = () => {
    saveTitleChanges();
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      saveTitleChanges();
    } else if (e.key === 'Escape') {
      setIsEditingTitle(false);
      setEditedTitle(title || '');
    }
  };

  const saveTitleChanges = () => {
    if (notebookId && editedTitle.trim() !== '') {
      updateNotebookTitle(notebookId, editedTitle.trim());
    } else {
      setEditedTitle(title || '');
    }
    setIsEditingTitle(false);
  };

  // 处理返回主页
  const handleBackToHome = (e: React.MouseEvent) => {
    e.preventDefault();
    console.log('返回主页按钮被点击');
    router.push('/');
  };

  return (
    <>
      <header className="bg-white shadow-sm py-0.5 px-4 border-b h-10 flex items-center">
        <div className="container mx-auto flex items-center justify-between w-full">
          <div className="flex items-center">
            {showBackButton && (
              <button 
                onClick={handleBackToHome}
                className="mr-3 flex items-center bg-blue-50 hover:bg-blue-100 text-blue-600 hover:text-blue-700 px-2 py-0.5 rounded-md transition-colors shadow-sm border border-blue-200"
                title="返回笔记本列表"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                <span className="font-medium text-sm">返回</span>
              </button>
            )}
            
            {title ? (
              isEditingTitle ? (
                <div className="relative">
                  <input
                    ref={titleInputRef}
                    type="text"
                    value={editedTitle}
                    onChange={handleTitleChange}
                    onBlur={handleTitleBlur}
                    onKeyDown={handleTitleKeyDown}
                    className="text-sm font-medium text-gray-900 border-b border-blue-400 focus:outline-none focus:border-blue-600 px-1 py-0 bg-blue-50 rounded"
                    placeholder="笔记本名称"
                    autoFocus
                  />
                  <div className="absolute -bottom-4 left-0 text-xs text-gray-500">
                    按回车保存，ESC取消
                  </div>
                </div>
              ) : (
                <h1 
                  className="text-sm font-medium text-gray-900 flex items-center cursor-pointer hover:text-blue-600 transition-colors"
                  onDoubleClick={handleTitleDoubleClick}
                  title="双击修改笔记本名称"
                >
                  {title}
                </h1>
              )
            ) : (
              <Link href="/" className="text-base font-bold text-gray-900 hover:text-blue-600 transition-colors">
                NotebookLM 克隆
              </Link>
            )}
          </div>
          
          <div className="flex items-center space-x-1.5">
            {title && (
              <>
                <button className="text-gray-600 hover:bg-gray-100 p-1 rounded-full">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                  </svg>
                </button>
                
                {notebookId && (
                  <button 
                    className="text-gray-600 hover:bg-gray-100 hover:text-red-500 p-1 rounded-full transition-colors"
                    onClick={handleDelete}
                    title="删除笔记本"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}
                
                <button 
                  className="text-gray-600 hover:bg-gray-100 p-1 rounded-full"
                  onClick={() => setIsSettingsOpen(true)}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </button>
              </>
            )}
            
            {showNewNotebookButton && (
              <Link 
                href="/"
                className="btn-primary px-2 py-0.5 text-xs"
              >
                新建笔记本
              </Link>
            )}
            
            <div className="w-5 h-5 rounded-full bg-gray-300 flex items-center justify-center text-gray-700 cursor-pointer">
              <span className="text-xs font-medium">用户</span>
            </div>
          </div>
        </div>
      </header>

      <SettingsDialog 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
      />

      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-medium mb-4">删除笔记本</h3>
            <p className="mb-4">确定要删除笔记本 <strong>{title}</strong> 吗？此操作不可恢复，所有相关文档也将被删除。</p>
            <div className="flex justify-end space-x-2">
              <button 
                className="px-4 py-2 border rounded-lg hover:bg-gray-100"
                onClick={cancelDelete}
              >
                取消
              </button>
              <button 
                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
                onClick={confirmDelete}
              >
                删除
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
} 