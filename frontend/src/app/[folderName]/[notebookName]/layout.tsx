'use client';

import React, { useState, useEffect } from 'react';
import { useParams, usePathname } from 'next/navigation';
import NotebookLayoutComponent from '@/components/NotebookLayout'; // 重命名导入以避免与函数名冲突
import { useNotebook } from '@/contexts/NotebookContext'; // 用于获取笔记本标题等信息
import { useAuth } from '@/contexts/AuthContext'; // 用于检查认证状态

export default function NotebookDetailLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useParams();
  const pathname = usePathname();
  const { currentNotebook, setCurrentNotebookByFolderAndName, isLoadingNotebooks, notebooks } = useNotebook();
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth();

  const [folderName, setFolderName] = useState<string | null>(null);
  const [notebookName, setNotebookName] = useState<string | null>(null);
  const [notebookTitle, setNotebookTitle] = useState<string>('');

  // 从路由参数中提取 folderName 和 notebookName
  useEffect(() => {
    if (params && typeof params.folderName === 'string' && typeof params.notebookName === 'string') {
      setFolderName(decodeURIComponent(params.folderName));
      setNotebookName(decodeURIComponent(params.notebookName));
    } else {
      console.log('[NotebookDetailLayout] Not on a specific notebook detail page or params not found. Pathname:', pathname);
      setFolderName(null);
      setNotebookName(null);
    }
  }, [params, pathname]);

  // 当 folderName 和 notebookName 确定后，尝试设置当前笔记本并获取标题
  useEffect(() => {
    if (folderName && notebookName && isAuthenticated && !isLoadingNotebooks && !isAuthLoading) {
      console.log(`[NotebookDetailLayout] Attempting to set notebook by folder and name: ${folderName}/${notebookName}, notebooks.length: ${notebooks.length}`);
      setCurrentNotebookByFolderAndName(folderName, notebookName);
      const foundNotebook = notebooks.find(nb => nb.title === notebookName);
      if (foundNotebook) {
        setNotebookTitle(foundNotebook.title);
        console.log(`[NotebookDetailLayout] Found notebook: ${foundNotebook.title}`);
      } else if (currentNotebook && currentNotebook.title === notebookName) {
        setNotebookTitle(currentNotebook.title);
        console.log(`[NotebookDetailLayout] Using current notebook: ${currentNotebook.title}`);
      } else {
        setNotebookTitle('加载中...');
        console.log(`[NotebookDetailLayout] Notebook not found, setting title to loading...`);
      }
    } else if (!isAuthenticated && !isAuthLoading) {
        setNotebookTitle('需要登录');
        console.log(`[NotebookDetailLayout] User not authenticated`);
    } else {
        console.log(`[NotebookDetailLayout] Conditions not met - folderName: ${folderName}, notebookName: ${notebookName}, isAuthenticated: ${isAuthenticated}, isLoadingNotebooks: ${isLoadingNotebooks}, isAuthLoading: ${isAuthLoading}`);
    }
  }, [folderName, notebookName, isAuthenticated, isLoadingNotebooks, notebooks, currentNotebook, setCurrentNotebookByFolderAndName, isAuthLoading]);


  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const closeSettingsModal = () => setIsSettingsModalOpen(false);

  if (isAuthLoading || (folderName && notebookName && isLoadingNotebooks && !currentNotebook && notebooks.length === 0)) {
      return <div className="flex h-screen w-screen items-center justify-center">加载布局中...</div>;
  }

  if (folderName && notebookName) {
    return (
      <NotebookLayoutComponent
        notebookId={currentNotebook?.id || ''}
        notebookTitle={notebookTitle}
        isSettingsModalOpen={isSettingsModalOpen}
        closeSettingsModal={closeSettingsModal}
      >
        {children} 
      </NotebookLayoutComponent>
    );
  }

  // 如果没有 folderName 或 notebookName，重定向到首页
  // 因为现在使用 [folderName]/[notebookName] 动态路由，不应该有无参数的情况
  if (!folderName || !notebookName) {
    return (
      <div className="flex h-screen w-screen items-center justify-center">
        <p>请从主页选择一个笔记本，或 <a href="/" className="text-blue-500 hover:underline">返回首页</a> 创建新的笔记本。</p>
      </div>
    );
  }

  // 对于其他情况的处理
  if ((!folderName || !notebookName) && !isAuthLoading) {
     return (
      <div className="flex h-screen w-screen items-center justify-center">
        <p>无法确定文件夹或笔记本。请 <a href="/" className="text-blue-500 hover:underline">返回首页</a>。</p>
      </div>
    );
  }

  return <div className="flex h-screen w-screen items-center justify-center">正在准备笔记本界面...</div>;
} 