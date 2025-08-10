import Link from 'next/link';
import { useState, useEffect, useRef } from 'react';
import SettingsDialog from './SettingsDialog';
import ConfirmModal from './ConfirmModal';
import { useNotebook } from '@/contexts/NotebookContext';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { CloudIcon } from 'lucide-react';
import Image from 'next/image';
import { navigateToHome } from '@/utils/navigation';

interface HeaderProps {
  showBackButton?: boolean;
  title?: string;
  showNewNotebookButton?: boolean;
  notebookId?: string;
  showSettingsIcon?: boolean;
  showBackupRestoreButtons?: boolean;
  onBackupClick?: () => void;
  onRestoreClick?: () => void;
  isBackingUp?: boolean;
  isRestoring?: boolean;
  showAddFolderButton?: boolean;
  onAddFolderClick?: () => void;
  showCalendarButton?: boolean;
  onCalendarClick?: () => void;
  showMainSettingsButton?: boolean;
  onMainSettingsClick?: () => void;
  showSyncButton?: boolean;
  onSyncClick?: () => void;
  onNewNotebookClick?: () => void;
}

export default function Header({ 
  showBackButton = false,
  title,
  showNewNotebookButton = true,
  notebookId,
  showSettingsIcon = true,
  showBackupRestoreButtons = false,
  onBackupClick,
  onRestoreClick,
  isBackingUp,
  isRestoring,
  showAddFolderButton = false,
  onAddFolderClick,
  showCalendarButton = false,
  onCalendarClick,
  showMainSettingsButton = false,
  onMainSettingsClick,
  showSyncButton = false,
  onSyncClick,
  onNewNotebookClick,
}: HeaderProps) {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState(title || '');
  const titleInputRef = useRef<HTMLInputElement>(null);
  const { deleteNotebook, updateNotebookTitle } = useNotebook();
  const router = useRouter();
  const { user, isAuthenticated, logout } = useAuth();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

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

  // Effect to handle clicks outside the user menu to close it
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    }
    // Bind the event listener
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      // Unbind the event listener on clean up
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [userMenuRef]);

  const handleDelete = () => {
    setShowDeleteConfirm(true);
  };

  const confirmDelete = () => {
    if (notebookId) {
      deleteNotebook(notebookId);
      navigateToHome(router);
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
    navigateToHome(router);
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
              <Link href="/" className="text-base font-bold text-gray-900 hover:text-blue-600 transition-colors flex items-center">
                <Image 
                  src="/notepads/favicon.svg" 
                  alt="灵枢笔记图标" 
                  width={24} 
                  height={24} 
                  className="mr-2"
                />
                灵枢笔记
              </Link>
            )}
          </div>
          
          <div className="flex items-center space-x-1.5">
            {title && notebookId && (
              <>
                <button 
                  className="text-gray-600 hover:bg-gray-100 hover:text-red-500 p-1 rounded-full transition-colors"
                  onClick={handleDelete}
                  title="删除笔记本"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
                
                {showSettingsIcon && (
                  <button 
                    className="text-gray-600 hover:bg-gray-100 p-1 rounded-full"
                    onClick={() => setIsSettingsOpen(true)}
                    title="笔记本设置"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </button>
                )}
              </>
            )}
            
            {showBackupRestoreButtons && onBackupClick && onRestoreClick && (
              <>
                <button
                  onClick={onBackupClick}
                  disabled={isBackingUp || isRestoring}
                  className={`bg-green-600 text-white px-3 py-1.5 rounded-md text-xs hover:bg-green-700 flex items-center ${isBackingUp ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {isBackingUp ? '备份中...' : '备份'}
                </button>
                <button
                  onClick={onRestoreClick}
                  disabled={isBackingUp || isRestoring}
                  className={`bg-yellow-500 text-white px-3 py-1.5 rounded-md text-xs hover:bg-yellow-600 flex items-center ${isRestoring ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {isRestoring ? '恢复中...' : '恢复'}
                </button>
              </>
            )}

            {showAddFolderButton && onAddFolderClick && (
              <button
                onClick={onAddFolderClick}
                className="bg-gray-200 text-gray-700 px-3 py-1.5 rounded-md text-xs font-medium hover:bg-gray-300 flex items-center"
              >
                +文件夹
              </button>
            )}

            {showNewNotebookButton && onNewNotebookClick && (
              <button 
                type="button" 
                onClick={onNewNotebookClick} 
                className="bg-blue-600 text-white px-3 py-1.5 rounded-md text-xs font-medium hover:bg-blue-700 transition-colors flex items-center"
              >
                新建笔记本
              </button>
            )}

            {showCalendarButton && (
                <a 
                    href={typeof window !== 'undefined' && window.location.hostname === 'localhost' 
                        ? 'http://localhost:11000/calendars/' 
                        : 'https://www.cheman.top/calendars/'
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-teal-600 text-white px-3 py-1.5 rounded-md text-xs font-medium hover:bg-teal-700 flex items-center" 
                    title="打开智能日历"
                >
                        智能日历
                    </a>
            )}

            {showMainSettingsButton && onMainSettingsClick && (
                 <button 
                    onClick={onMainSettingsClick}
                    className="bg-gray-100 text-gray-700 px-3 py-1.5 rounded-md text-xs hover:bg-gray-200 flex items-center"
                    title="应用设置"
                  >
                     <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 mr-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                     </svg>
                     设置
                   </button>
            )}

            {showSyncButton && onSyncClick && (
                <button onClick={onSyncClick} 
                  className="bg-purple-100 text-purple-700 px-3 py-1.5 rounded-md text-xs font-medium hover:bg-purple-200 flex items-center">
                   <CloudIcon className="h-3.5 w-3.5 mr-0.5" />
                   同步
                </button>
            )}
            
            {isAuthenticated && user ? (
              <div className="relative" ref={userMenuRef}>
                <button 
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                  className="bg-gray-200 text-gray-700 px-3 py-1.5 rounded-md text-xs font-medium hover:bg-gray-300 flex items-center justify-center transition-colors"
                  title="用户菜单"
                >
                  <span> 
                    {/* 优先显示完整用户名，然后是完整邮箱，最后是通用文本 '用户' */} 
                    {user.username || user.email || '用户'}
                  </span>
                </button>
                {isUserMenuOpen && (
                  <div className="absolute right-0 mt-2 w-auto min-w-[12rem] bg-white rounded-md shadow-lg py-1 z-50 border">
                    <div className="px-4 py-2 text-xs text-gray-700">
                      {/* 确保这里显示完整邮箱，如果存在的话 */} 
                      登录为: <strong>{user.email || 'N/A'}</strong>
                    </div>
                    <div className="border-t border-gray-100"></div>
                    <button
                      onClick={() => {
                        logout();
                        setIsUserMenuOpen(false); // 关闭菜单
                        router.push('/auth/login'); // 跳转到登录页
                      }}
                      className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-red-500 transition-colors"
                    >
                      退出登录
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <Link 
                href="/auth/login" 
                className="bg-blue-600 text-white px-3 py-1.5 rounded-md text-xs font-medium hover:bg-blue-700 transition-colors flex items-center"
              >
                登录
              </Link>
            )}
          </div>
        </div>
      </header>

      <SettingsDialog 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
      />

      <ConfirmModal
        isOpen={showDeleteConfirm}
        onClose={cancelDelete}
        onConfirm={confirmDelete}
        title="删除笔记本"
        message={`确定要删除笔记本 "${title}" 吗？此操作不可恢复，所有相关文档也将被删除。`}
      />
    </>
  );
} 