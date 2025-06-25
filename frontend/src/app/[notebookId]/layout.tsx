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
  const { currentNotebook, setCurrentNotebookById, isLoadingNotebooks, notebooks } = useNotebook();
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth();

  const [notebookId, setNotebookId] = useState<string | null>(null);
  const [notebookTitle, setNotebookTitle] = useState<string>('');
  
  // 从路由参数中提取 notebookId
  useEffect(() => {
    if (params && typeof params.notebookId === 'string') {
      setNotebookId(params.notebookId);
    } else {
      console.log('[NotebookDetailLayout] Not on a specific notebook detail page or notebookId not found in params. Pathname:', pathname);
      setNotebookId(null); 
    }
  }, [params, pathname]);

  // 当 notebookId 确定后，尝试设置当前笔记本并获取标题
  useEffect(() => {
    if (notebookId && isAuthenticated && !isLoadingNotebooks && !isAuthLoading) {
      setCurrentNotebookById(notebookId); 
      const foundNotebook = notebooks.find(nb => nb.id === notebookId);
      if (foundNotebook) {
        setNotebookTitle(foundNotebook.title);
      } else if (currentNotebook && currentNotebook.id === notebookId) {
        setNotebookTitle(currentNotebook.title);
      } else {
        setNotebookTitle('加载中...');
      }
    } else if (!isAuthenticated && !isAuthLoading) {
        setNotebookTitle('需要登录');
    }
  }, [notebookId, isAuthenticated, isLoadingNotebooks, notebooks, currentNotebook, setCurrentNotebookById, isAuthLoading]);


  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const closeSettingsModal = () => setIsSettingsModalOpen(false);

  if (isAuthLoading || (notebookId && isLoadingNotebooks && !currentNotebook && notebooks.length === 0)) {
      return <div className="flex h-screen w-screen items-center justify-center">加载布局中...</div>;
  }
  
  if (notebookId) {
    return (
      <NotebookLayoutComponent
        notebookId={notebookId}
        notebookTitle={notebookTitle}
        isSettingsModalOpen={isSettingsModalOpen}
        closeSettingsModal={closeSettingsModal}
      >
        {children} 
      </NotebookLayoutComponent>
    );
  }

  // 如果没有 notebookId，重定向到首页
  // 因为现在使用 [notebookId] 动态路由，不应该有无notebookId的情况
  if (!notebookId) {
    return (
      <div className="flex h-screen w-screen items-center justify-center">
        <p>请从主页选择一个笔记本，或 <a href="/" className="text-blue-500 hover:underline">返回首页</a> 创建新的笔记本。</p>
      </div>
    );
  }
  
  // 对于其他情况的处理
  if (!notebookId && !isAuthLoading) { 
     return (
      <div className="flex h-screen w-screen items-center justify-center">
        <p>无法确定笔记本。请 <a href="/" className="text-blue-500 hover:underline">返回首页</a>。</p>
      </div>
    );
  }

  return <div className="flex h-screen w-screen items-center justify-center">正在准备笔记本界面...</div>;
} 