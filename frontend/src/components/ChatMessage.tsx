import React, { useEffect, useState } from 'react';
import { Message } from '@/types';
import { generateKeywords } from '@/services/aiService';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { tomorrow } from 'react-syntax-highlighter/dist/cjs/styles/prism';

// 添加类型声明文件帮助解决类型问题
declare module 'react-markdown' {
  interface CodeProps {
    node: any;
    inline?: boolean;
    className?: string;
    children: React.ReactNode;
  }
}

interface ChatMessageProps {
  message: Message;
  isLastMessage?: boolean;
  onAddToWhiteboard?: (content: string) => void;
  onSaveToNotes?: (title: string, content: string) => void;
}

export default function ChatMessage({ 
  message, 
  isLastMessage = false,
  onAddToWhiteboard,
  onSaveToNotes
}: ChatMessageProps) {
  const isUser = message.role === 'user';
  const [displayContent, setDisplayContent] = useState(message.content || '');
  const [showCursor, setShowCursor] = useState(true);
  const [showActions, setShowActions] = useState(false);
  
  // 确保消息内容始终从props更新
  useEffect(() => {
    // 如果消息内容发生变化，更新显示内容
    if (message.status !== 'sending') {
      setDisplayContent(message.content || '');
      return;
    }

    // 对于正在发送的消息，也需要保持内容同步
    setDisplayContent(message.content || '');
  }, [message.content, message.status]);
  
  // 动态添加打字机效果
  useEffect(() => {
    // 只有助手消息且状态为sending时显示光标
    if (!isUser && message.status === 'sending') {
      const cursorInterval = setInterval(() => {
        setShowCursor(prev => !prev);
      }, 500);
      
      return () => clearInterval(cursorInterval);
    }
  }, [isUser, message.status]);

  const handleSaveToNotes = () => {
    if (onSaveToNotes && message.content) {
      // 提取最终答案部分
      let finalContent = message.content;
      if (finalContent.includes('## 最终答案')) {
        finalContent = finalContent.split('## 最终答案')[1].trim();
      } else if (finalContent.includes('##最终答案')) {
        finalContent = finalContent.split('##最终答案')[1].trim();
      } else if (finalContent.includes('最终答案')) {
        finalContent = finalContent.split('最终答案')[1].trim();
      }
      
      // 自动生成标题
      const title = generateKeywords(finalContent);
      onSaveToNotes(title, finalContent);
    }
  };
  
  // 渲染Markdown内容的函数
  const renderContent = () => {
    if (!displayContent) return null;
    
    // 对于加载中的消息显示Markdown
    return (
      <ReactMarkdown
        components={{
          // @ts-ignore - 不完全兼容的类型，但实际使用没问题
          code({node, inline, className, children, ...props}) {
            const match = /language-(\w+)/.exec(className || '');
            return !inline && match ? (
              // @ts-ignore - SyntaxHighlighter 类型问题
              <SyntaxHighlighter
                {...props}
                style={tomorrow}
                language={match[1]}
                PreTag="div"
              >
                {String(children).replace(/\n$/, '')}
              </SyntaxHighlighter>
            ) : (
              <code {...props} className={className}>
                {children}
              </code>
            );
          },
          // 确保强调的样式
          em: ({node, ...props}) => <em {...props} className="text-blue-600" />,
          // 确保标题样式
          h1: ({node, ...props}) => <h1 {...props} className="text-xl font-bold mt-4 mb-2" />,
          h2: ({node, ...props}) => <h2 {...props} className="text-lg font-bold mt-3 mb-2 border-b pb-1" />,
          h3: ({node, ...props}) => <h3 {...props} className="text-md font-bold mt-3 mb-1" />,
          // 给段落添加合适的间距
          p: ({node, ...props}) => <p {...props} className="mb-2" />,
        }}
      >
        {displayContent}
      </ReactMarkdown>
    );
  };
  
  return (
    <div 
      className="mb-6 relative"
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
        {/* 显示头像 - 非用户消息时 */}
        {!isUser && (
          <div className="w-10 h-10 rounded-full bg-blue-500 flex-shrink-0 mr-2 overflow-hidden flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" className="w-6 h-6">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
            </svg>
          </div>
        )}
        
        <div className={`${isUser ? 'bg-green-50 border border-green-100' : 'bg-white border border-gray-200'} p-3 rounded-lg shadow-sm max-w-[85%]`}>
          {isUser ? (
            <div className="whitespace-pre-wrap break-words">
              {displayContent}
            </div>
          ) : (
            <div className="markdown-body prose max-w-none">
              {renderContent()}
              {/* 显示光标 */}
              {!isUser && message.status === 'sending' && showCursor && (
                <span className="inline-block w-2 h-4 ml-0.5 bg-blue-500 animate-pulse"></span>
              )}
            </div>
          )}
          
          {!isUser && message.status === 'error' && (
            <div className="mt-2 text-sm text-red-500">
              <p className="font-medium">出错了</p>
              <p>生成回复时发生错误，请重试</p>
            </div>
          )}
          
          {!isUser && message.status === 'sending' && !message.content && (
            <div className="flex items-center mt-1">
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
              </div>
              <span className="ml-2 text-xs text-gray-500">思考中...</span>
            </div>
          )}
          
          {/* 调试信息，帮助排查问题 */}
          {process.env.NODE_ENV === 'development' && (
            <div className="mt-1 text-xs text-gray-400">
              ID: {message.id}, 状态: {message.status}, 长度: {message.content?.length || 0}
            </div>
          )}
        </div>
        
        {/* 显示头像 - 用户消息时 */}
        {isUser && (
          <div className="w-10 h-10 rounded-full bg-green-600 flex-shrink-0 ml-2 overflow-hidden flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" className="w-6 h-6">
              <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
            </svg>
          </div>
        )}
      </div>
      
      {/* 只显示保存到笔记按钮，移除添加到白板按钮 */}
      {!isUser && message.status === 'sent' && message.content && (showActions || isLastMessage) && (
        <div className="flex justify-end mt-1 mr-3">
          <button 
            onClick={handleSaveToNotes}
            className="bg-green-500 text-white text-xs py-1 px-2 rounded hover:bg-green-600 transition-colors flex items-center shadow-sm"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" viewBox="0 0 20 20" fill="currentColor">
              <path d="M7.707 10.293a1 1 0 100 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 12.586V5a1 1 0 10-2 0v7.586l-1.293-1.293a1 1 0 00-1.414 0z" />
            </svg>
            保存到笔记
          </button>
        </div>
      )}
    </div>
  );
} 