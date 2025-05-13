'use client';

import React, { useState, useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import { useNotebook } from '@/contexts/NotebookContext';
import { useSettings } from '@/contexts/SettingsContext';
import { generateAIResponse, generateKeywords } from '@/services/aiService';
import { Message, Document } from '@/types';
import { DocumentStatus } from '@/types/shared_local';
import { formatDate } from '@/utils/formatters';
import ChatMessage from '@/components/ChatMessage';
import { toast } from 'react-hot-toast';
import { TldrawBoardRef } from '@/components/TldrawBoard';
import { ExcalidrawBoardRef } from './ExcalidrawBoard';
import { SimpleBoardRef } from './SimpleBoard';
import { MarkdownNotebookRef } from './MarkdownNotebook';
import DocumentPreview from './DocumentPreview';
// 暂时注释掉ReactMarkdown导入，解决编译错误
// import ReactMarkdown from 'react-markdown';

// 聊天界面组件属性
interface ChatInterfaceProps {
  notebookId?: string;
  documents?: Document[];
  messages?: Message[];
  onSendMessage?: (message: Message) => void;
  tldrawBoardRef: React.RefObject<MarkdownNotebookRef>;
  onAddDocumentToChat?: (document: Document) => void;
  onPreviewDocument?: (document: Document, content: string) => void;
}

// 聊天界面引用类型
export interface ChatInterfaceRef {
  handleAddDocumentToChat: (document: Document) => void;
  handlePreviewDocument: (document: Document, content: string) => void;
}

// 聊天界面组件
const ChatInterface = forwardRef<ChatInterfaceRef, ChatInterfaceProps>(({ 
  notebookId, 
  documents = [], 
  messages = [], 
  onSendMessage,
  tldrawBoardRef,
  onAddDocumentToChat,
  onPreviewDocument
}, ref) => {
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [localMessages, setLocalMessages] = useState<Message[]>(messages);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { llmSettings } = useSettings();
  const { currentNotebook, saveWhiteboardContent, getWhiteboardContent } = useNotebook();
  
  // 添加文档预览状态
  const [previewDocument, setPreviewDocument] = useState<Document | null>(null);
  const [previewContent, setPreviewContent] = useState<string>('');
  const [showPreview, setShowPreview] = useState<boolean>(false);
  
  // 在组件内部添加处理中文档的状态跟踪
  const [processingDocuments, setProcessingDocuments] = useState<Document[]>([]);

  // 使用useEffect跟踪处理中的文档
  useEffect(() => {
    if (!documents) return;
    
    // 过滤出所有非已完成状态的文档
    const docsInProcess = documents.filter(
      doc => doc.status !== DocumentStatus.COMPLETED
    );
    
    setProcessingDocuments(docsInProcess);
  }, [documents]);
  
  // 确保组件只在客户端渲染后处理document
  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [localMessages]);
  
  // 检查是否有已处理完成的文档
  const hasCompletedDocuments = React.useMemo(() => {
    const completedDocuments = documents?.filter(doc => doc.status === DocumentStatus.COMPLETED) || [];
    
    console.log(`[hasCompletedDocuments] 检查已完成文档: 总文档数=${documents?.length || 0}, 已完成文档数=${completedDocuments.length}`);
    
    // 如果没有文档，而此时使用"所有文档"模式，应该返回true而不是false
    if (!documents || documents.length === 0) {
      console.log('[hasCompletedDocuments] 没有任何文档，不阻止聊天');
      return true; // 没有文档不应阻止聊天
    }
    
    return completedDocuments.length > 0;
  }, [documents]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isLoading) return;

    try {
      // 检查是否有已处理完成的文档
      const completedDocuments = documents?.filter(doc => doc.status === DocumentStatus.COMPLETED) || [];
      
      console.log(`提交查询时检查文档: 总数=${documents?.length || 0}, 已完成=${completedDocuments.length}`);
      
      // 如果有文档但都未处理完成时才阻止发送
      if (documents && documents.length > 0 && completedDocuments.length === 0) {
        console.warn('没有已处理完成的文档，无法发送消息');
        alert('请等待文档处理完成后再发送消息');
        return;
      }

      setIsLoading(true);
      console.log('提交查询:', inputValue);
      
      if (documents) {
        console.log('文档ID:', documents.map(doc => doc.id).join(', '));
        console.log('文档文件名:', documents.map(doc => doc.fileName).join(', '));
      }
      console.log('当前LLM设置:', JSON.stringify(llmSettings));
      
      // 创建用户消息
      const userMessage: Message = {
        id: Date.now().toString(),
        role: 'user',
        content: inputValue,
        timestamp: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        status: 'sent'
      };

      // 创建临时AI消息，显示加载状态
      const tempAiMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: '',
        timestamp: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        status: 'sending'
      };

      // 添加消息到状态
      const updatedMessages = [...localMessages, userMessage, tempAiMessage];
      setLocalMessages(updatedMessages);
      
      // 调用onSendMessage回调，如果存在 - Make it async
      if (onSendMessage) {
        await onSendMessage(userMessage);
      }

      // 重置输入框
      setInputValue('');

      // 滚动到底部
      setTimeout(() => {
        scrollToBottom();
      }, 100);

      try {
        // 定义流式输出的回调函数
        const handleStreamingResponse = (partialResponse: string) => {
          // 更新AI消息内容，但保持loading状态
          setLocalMessages(prevMessages => {
            const newMessages = [...prevMessages];
            const aiMessageIndex = newMessages.length - 1;
            
            newMessages[aiMessageIndex] = {
              ...newMessages[aiMessageIndex],
              content: partialResponse
            };
            
            return newMessages;
          });
          
          // 在内容更新时滚动到底部
          setTimeout(() => scrollToBottom(), 10);
        };
        
        // 生成AI响应，传入流式输出回调
        console.log('开始生成AI响应...');
        
        console.log(`检查完成文档状态: 总文档数=${documents?.length || 0}, 已完成文档数=${completedDocuments.length}`);
        
        let aiResponse;
        if (completedDocuments.length === 0) {
          console.warn('没有已处理完成的文档');
          // 如果没有已完成的文档，返回提示信息而不是生成响应
          aiResponse = "请先上传并等待文档处理完成后再提问。";
        } else {
          // 调用支持流式输出的AI服务生成响应
          aiResponse = await generateAIResponse(
            inputValue,
            completedDocuments,
            handleStreamingResponse
          );
        }
        
        // 检查响应是否为空
        if (!aiResponse || aiResponse.trim() === '') {
          console.error('AI返回了空响应');
          throw new Error('AI返回了空响应');
        }
        
        // 最终更新AI消息内容并设置为成功状态
        setLocalMessages(prevMessages => {
          const newMessages = [...prevMessages];
          const aiMessageIndex = newMessages.length - 1;
          
          newMessages[aiMessageIndex] = {
            ...newMessages[aiMessageIndex],
            content: aiResponse,
            status: 'sent'
          };
          
          return newMessages;
        });
        
        console.log('AI响应生成完成');
      } catch (error) {
        console.error('生成AI响应时出错:', error);
        
        // 设置AI消息为错误状态
        setLocalMessages(prevMessages => {
          const newMessages = [...prevMessages];
          const aiMessageIndex = newMessages.length - 1;
          
          newMessages[aiMessageIndex] = {
            ...newMessages[aiMessageIndex],
            content: `生成回复时出错: ${error instanceof Error ? error.message : '未知错误'}`,
            status: 'error'
          };
          
          return newMessages;
        });
      } finally {
        setIsLoading(false);
        
        // 生成完成后滚动到底部
        setTimeout(() => {
          scrollToBottom();
        }, 100);
      }
    } catch (error) {
      console.error('提交查询时出错:', error);
      setIsLoading(false);
      
      toast.error(`发送消息失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  };

  // 添加到白板
  const handleAddToWhiteboard = (content: string) => {
    if (!tldrawBoardRef.current) {
      console.warn('[handleAddToWhiteboard] 白板引用不存在');
      toast.error('无法添加到白板：白板未初始化');
      return;
    }
    
    // 尝试添加到白板
    try {
      console.log('[handleAddToWhiteboard] 添加内容到白板:', content.substring(0, 50) + (content.length > 50 ? '...' : ''));
      
      // 检查内容是否有效
      if (!content || content.trim() === '') {
        console.warn('[handleAddToWhiteboard] 内容为空，不添加到白板');
        toast.error('无法添加到白板：内容为空');
        return;
      }
      
      // 使用白板引用的方法添加内容
      tldrawBoardRef.current.addTextToNotebook(content);
      
      // 显示成功提示
      toast.success('内容已添加到白板');
    } catch (error) {
      console.error('[handleAddToWhiteboard] 添加内容到白板时出错:', error);
      toast.error('添加到白板时出错，请重试');
    }
  };

  // 添加保存到笔记功能
  const handleSaveToNotes = (title: string, content: string) => {
    if (!tldrawBoardRef.current) {
      console.warn('[handleSaveToNotes] 笔记本引用不存在');
      toast.error('无法保存到笔记：笔记本未初始化');
      return;
    }
    
    // 尝试添加到笔记本
    try {
      console.log('[handleSaveToNotes] 保存内容到笔记:', content.substring(0, 50) + (content.length > 50 ? '...' : ''));
      
      // 检查内容是否有效
      if (!content || content.trim() === '') {
        console.warn('[handleSaveToNotes] 内容为空，不保存到笔记');
        toast.error('无法保存到笔记：内容为空');
        return;
      }
      
      // 使用笔记本引用的方法添加内容
      tldrawBoardRef.current.addTextToNotebook(content);
      
      // 显示成功提示
      toast.success('内容已保存到笔记');
    } catch (error) {
      console.error('[handleSaveToNotes] 保存内容到笔记时出错:', error);
      toast.error('保存到笔记时出错，请重试');
    }
  };

  // 添加处理添加文档到聊天的函数
  const handleAddDocumentToChat = (document: Document) => {
    if (onAddDocumentToChat) {
      onAddDocumentToChat(document);
    } else {
      // 如果没有提供回调，则默认行为是添加文档链接到当前消息
      const documentLink = `[${document.fileName}](document://${document.id})`;
      
      // 创建新的用户消息
      const newMessage: Message = {
        id: Date.now().toString(),
        role: 'user',
        content: documentLink,
        timestamp: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        status: 'sent'
      };
      
      // 添加到本地消息数组
      setLocalMessages(prev => [...prev, newMessage]);
      
      // 如果有onSendMessage回调，也调用它
      if (onSendMessage) {
        onSendMessage(newMessage);
      }
      
      toast.success(`已将文档 "${document.fileName}" 添加到聊天`);
    }
  };

  // 处理文档预览
  const handlePreviewDocument = (doc: Document, content: string, inChat: boolean = true) => {
    console.log(`[ChatInterface] 处理文档预览: ID=${doc.id}, 文件名=${doc.fileName}, 内容长度=${content.length}, inChat=${inChat}`);
    
    // 如果已经显示预览，先关闭它再打开新预览
    if (showPreview) {
      setShowPreview(false);
      setTimeout(() => {
        setPreviewDocument(doc);
        setPreviewContent(content);
        setShowPreview(true);
        console.log(`[ChatInterface] 重新打开预览: ID=${doc.id}`);
      }, 100);
    } else {
      // 直接设置预览状态
      setPreviewDocument(doc);
      setPreviewContent(content);
      setShowPreview(true);
    }
    
    // 在状态更新后检查状态
    setTimeout(() => {
      console.log(`[ChatInterface] 预览状态检查: showPreview=${showPreview}, 文档ID=${previewDocument?.id}, 内容长度=${previewContent?.length || 0}`);
    }, 200);
    
    toast.success(`正在预览文档: ${doc.fileName}`, { 
      id: `preview-${doc.id}`,
      duration: 2000
    });
  };
  
  // 关闭预览
  const handleClosePreview = () => {
    console.log('[ChatInterface] 关闭文档预览');
    
    try {
      // 先设置状态为false，确保UI更新
      setShowPreview(false);
      
      // 清理资源
      if (previewContent && previewContent.startsWith('blob:')) {
        try {
          URL.revokeObjectURL(previewContent);
          console.log('[ChatInterface] 已释放blob URL');
        } catch (err) {
          console.error('[ChatInterface] 释放blob URL时出错:', err);
        }
      }
      
      // 延迟清除文档和内容，确保先隐藏UI
      setTimeout(() => {
        setPreviewDocument(null);
        setPreviewContent('');
        console.log('[ChatInterface] 已清除预览文档和内容');
      }, 100);
      
      console.log('[ChatInterface] 文档预览已关闭');
    } catch (error) {
      console.error('[ChatInterface] 关闭预览时出错:', error);
    }
  };
  
  // 暴露方法给父组件
  useImperativeHandle(ref, () => ({
    handleAddDocumentToChat,
    handlePreviewDocument
  }));

  // 服务器端渲染时的占位组件
  if (!isMounted) {
    return (
      <div className="flex flex-col h-full bg-white">
        <div className="flex-grow flex items-center justify-center">
          <div className="text-center text-gray-400">加载聊天界面...</div>
        </div>
      </div>
    );
  }

  // 单独封装空状态UI
  const renderEmptyState = () => (
    <div className="text-center py-10">
      <h3 className="text-lg font-medium mb-2">开始与文档对话</h3>
      
      {/* 只有当有文档且没有已完成的文档时才显示警告 */}
      {!hasCompletedDocuments && documents && documents.length > 0 && (
        <div className="mb-4 p-3 bg-yellow-50 text-yellow-700 rounded-lg border border-yellow-200">
          <div className="flex items-center mb-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <span className="font-semibold">等待文档处理</span>
          </div>
          <p className="text-sm">
            您的文档正在处理中，请等待处理完成后再开始对话。文档处理可能需要几分钟时间，具体取决于文档大小。
          </p>
        </div>
      )}
      
      <p className="text-gray-600 mb-6">
        {documents && documents.length > 0 
          ? `您可以询问关于"${documents[0].fileName}"${documents.length > 1 ? '等文档' : ''}的任何问题，AI会帮助您理解和分析内容。`
          : '您可以询问任何问题，AI会基于您的知识库提供帮助。'}
      </p>
      <div className="flex flex-col space-y-2 max-w-md mx-auto">
        {[
          "这篇文档的主要内容是什么？",
          "总结一下文档中的关键点",
          "解释一下文档中的复杂概念"
        ].map((suggestion, index) => (
          <button
            key={index}
            className={`py-2 px-4 ${hasCompletedDocuments ? 'bg-gray-100 hover:bg-gray-200' : 'bg-gray-100 opacity-50 cursor-not-allowed'} rounded-lg text-left`}
            onClick={() => {
              if (hasCompletedDocuments) {
                setInputValue(suggestion);
                handleSubmit(new Event('submit') as any);
              } else {
                alert('请等待文档处理完成后再发送消息');
              }
            }}
            disabled={!hasCompletedDocuments}
          >
            {suggestion}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full w-full bg-transparent">
      <div className="flex-grow overflow-y-auto p-4 space-y-4 bg-transparent">
        {localMessages.length === 0 && !isLoading && renderEmptyState()}
        {localMessages.map((message) => (
          <ChatMessage
            key={message.id}
            message={message}
            onSaveToNotes={handleSaveToNotes}
          />
        ))}
        <div ref={messagesEndRef} />
      </div>
      
      <form onSubmit={handleSubmit} className="p-4 border-t border-[#FFE3B0] bg-transparent flex-shrink-0">
        <div className="flex space-x-2 max-w-4xl mx-auto">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={hasCompletedDocuments ? "输入您的问题..." : "请等待文档处理完成..."}
            className="flex-grow px-4 py-3 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
            disabled={isLoading || !hasCompletedDocuments}
          />
          <button
            type="submit"
            disabled={isLoading || !hasCompletedDocuments}
            className={`px-4 py-2 rounded-full ${
              isLoading || !hasCompletedDocuments
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-green-600 text-white hover:bg-green-700'
            } focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2`}
          >
            {isLoading ? (
              <div className="flex items-center">
                <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2"></div>
                处理中...
              </div>
            ) : (
              '发送'
            )}
          </button>
        </div>
      </form>
      
      {/* 文档预览 */}
      {showPreview && previewDocument && (
        <DocumentPreview
          document={previewDocument}
          content={previewContent}
          onClose={handleClosePreview}
          inChat={true}
        />
      )}
    </div>
  );
});

export default ChatInterface; 