'use client';

import React, { useState, useCallback, useMemo } from 'react';
import NotebookContent from '@/components/NotebookContent';
import { useNotebook } from '@/contexts/NotebookContext';

/**
 * 笔记本页面
 * 显示特定笔记本的内容，包括AI聊天界面和文档列表
 */
export default function NotebookPage({ params }: { params: { id: string } }) {
  console.log('[NotebookPage] 打开笔记本，ID:', params.id);
  
  const notebookId = params.id;
  const { notebooks, isLoadingNotebooks } = useNotebook();

  const notebookTitle = useMemo(() => {
    if (isLoadingNotebooks) {
      return '加载中...';
    }
    const currentNotebook = notebooks.find(nb => nb.id === notebookId);
    return currentNotebook ? currentNotebook.title : `笔记本 ${notebookId.substring(0, 8)}`;
  }, [notebookId, notebooks, isLoadingNotebooks]);
  
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

  const openSettingsModal = useCallback(() => {
    setIsSettingsModalOpen(true);
  }, []);

  const closeSettingsModal = useCallback(() => {
    setIsSettingsModalOpen(false);
  }, []);
  
  return (
    <div className="h-full">
      <NotebookContent 
        notebookId={notebookId} 
        notebookTitle={notebookTitle} 
        isSettingsModalOpen={isSettingsModalOpen} 
        closeSettingsModal={closeSettingsModal} 
      />
    </div>
  );
} 