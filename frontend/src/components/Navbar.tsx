'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

/**
 * 导航栏组件
 * 显示应用标题及基本导航功能
 */
interface NavbarProps {
  title?: string;
  showBackButton?: boolean;
  openSettingsModal: () => void;
}

const Navbar: React.FC<NavbarProps> = ({ 
  title = '笔记本助手', 
  showBackButton = true, 
  openSettingsModal
}) => {
  const router = useRouter();

  return (
    <nav className="bg-white border-b border-gray-200 h-8 flex items-center px-1 sticky top-0 z-10">
      <div className="flex items-center space-x-2 max-w-screen-xl mx-auto w-full">
        {showBackButton && (
          <button
            onClick={() => router.back()}
            className="text-gray-600 hover:text-gray-900 p-1.5 rounded-full hover:bg-gray-100"
            aria-label="返回"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
        )}
        
        <Link href="/" className="flex items-center space-x-1.5">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <span className="text-lg font-semibold text-gray-800">{title}</span>
        </Link>
        
        <div className="flex-grow"></div>
        
        <div className="flex items-center space-x-1.5">
          <button
            className="p-1.5 text-gray-600 hover:text-gray-900 rounded-full hover:bg-gray-100"
            aria-label="帮助"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>
          
          <button
            onClick={openSettingsModal}
            className="p-1.5 text-gray-600 hover:text-gray-900 rounded-full hover:bg-gray-100"
            aria-label="设置"
            disabled={false}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        </div>
      </div>
    </nav>
  );
};

export default Navbar; 