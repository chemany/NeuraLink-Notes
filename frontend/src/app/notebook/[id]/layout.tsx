'use client';

import React from 'react';
import { SettingsProvider } from '@/contexts/SettingsContext';
import { NotebookProvider } from '@/contexts/NotebookContext';
import { Toaster } from 'react-hot-toast';

/**
 * 笔记本页面布局
 * 提供必要的上下文提供者
 */
export default function NotebookLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SettingsProvider>
      <NotebookProvider>
        <div className="h-full w-full">
          {children}
        </div>
        <Toaster position="bottom-right" />
      </NotebookProvider>
    </SettingsProvider>
  );
} 