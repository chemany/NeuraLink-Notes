'use client';

import React from 'react';
import NotebookLayout from '@/components/NotebookLayout';
// import Navbar from '@/components/Navbar'; // REMOVED

/**
 * 笔记本内容组件
 * 客户端包装组件，确保NotebookLayout在正确的上下文中使用
 */
interface NotebookContentProps {
  notebookId: string;
  notebookTitle: string;
  isSettingsModalOpen: boolean;
  // openSettingsModal: () => void; // REMOVED
  closeSettingsModal: () => void;
}

export default function NotebookContent({ 
  notebookId, 
  notebookTitle, 
  isSettingsModalOpen,
  // openSettingsModal, // REMOVED
  closeSettingsModal
}: NotebookContentProps) {
  return (
    // Simplify the wrapper div - just pass full height
    <div className="h-full">
      <NotebookLayout 
        notebookId={notebookId} 
        notebookTitle={notebookTitle} 
        isSettingsModalOpen={isSettingsModalOpen}
        closeSettingsModal={closeSettingsModal}
      />
    </div>
  );
} 