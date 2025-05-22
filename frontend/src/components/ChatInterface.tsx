'use client';

import React, { useState, useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import { useNotebook } from '@/contexts/NotebookContext';
import { useSettings } from '@/contexts/SettingsContext';
import { generateAIResponse, generateKeywords } from '@/services/aiService';
import { Message, Document } from '@/types';
import { DocumentStatus } from '@/types/shared_local';
import { formatDate } from '@/utils/formatters';
import ChatMessage from '@/components/ChatMessage';
// @ts-ignore 
import { toast } from 'react-hot-toast';
import { TldrawBoardRef } from '@/components/TldrawBoard';
import { ExcalidrawBoardRef } from './ExcalidrawBoard';
import { SimpleBoardRef } from './SimpleBoard';
import { MarkdownNotebookRef } from './MarkdownNotebook';
import DocumentPreview from './DocumentPreview';
import { useRouter } from 'next/navigation';
// 暂时注释掉ReactMarkdown导入，解决编译错误
// import ReactMarkdown from 'react-markdown';

// 聊天界面组件属性
interface ChatInterfaceProps {
  notebookId?: string;
  documents?: Document[];
  messages?: Message[];
  onSendMessage?: (message: Message) => void;
  tldrawBoardRef?: any;
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
  const { currentNotebook, saveWhiteboardContent, getWhiteboardContent, createNotebook, createNote } = useNotebook();
  const router = useRouter();
  
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

  const handleSaveToNotes = async (chatMessageContent: string, chatMessageTitle?: string) => {
    console.log('[ChatInterface] handleSaveToNotes called.');
    console.log('[ChatInterface] Initial chatMessageTitle (from ChatMessage):', chatMessageTitle); // This will likely be undefined now
    console.log('[ChatInterface] Initial chatMessageContent (from ChatMessage):', chatMessageContent.substring(0, 100));
    console.log('[ChatInterface] Initial chatMessageContent length:', chatMessageContent.length);

    if (!chatMessageContent.trim()) {
      toast.error('无法保存空内容。');
      return;
    }

    let noteTitle = chatMessageTitle; // Start with a possible explicit title
    let noteContentHtml = chatMessageContent; // Default to full content

    // New logic: Try to extract from "标题：" and "正文：" markers first
    const structuredResponseRegex = /^标题：\s*([\s\S]*?)\n正文：\s*([\s\S]*)$/im;
    const structuredMatch = chatMessageContent.match(structuredResponseRegex);

    if (structuredMatch && structuredMatch[1] && structuredMatch[2]) {
      noteTitle = structuredMatch[1].trim();
      noteContentHtml = structuredMatch[2].trim();
      console.log('[ChatInterface] Title and Content extracted using structured markers.');
      console.log('[ChatInterface] Structured Title:', noteTitle);
      console.log('[ChatInterface] Structured Content (first 100 chars):', noteContentHtml.substring(0, 100));
    } else {
      console.log('[ChatInterface] Structured markers not found. Falling back to previous logic.');
      // Fallback to existing logic if structured markers are not found
      if (!noteTitle) { // Only if chatMessageTitle was not initially provided
        const oldTitleRegex = /^以下是文档《(.*?)》(?:的关键点总结|的主要内容|的核心内容提炼|等)：/i;
        const oldMatch = chatMessageContent.match(oldTitleRegex);

        if (oldMatch && oldMatch[1]) {
          const extractedFilename = oldMatch[1];
          let suffix = "的关键点总结";
          if (oldMatch[0].includes("的主要内容")) {
            suffix = "的主要内容";
          } else if (oldMatch[0].includes("的核心内容提炼")) {
            suffix = "的核心内容提炼";
          }
          noteTitle = `《${extractedFilename}》${suffix}`;
          console.log('[ChatInterface] Title generated from OLD regex:', noteTitle);
          // When using old regex, assume the full chatMessageContent is the content
          // noteContentHtml is already set to chatMessageContent by default
        } else {
          console.log('[ChatInterface] OLD Regex did not match. Falling back to generateKeywords or default.');
          const keywordsTitle = generateKeywords(chatMessageContent); // chatMessageContent here is the full AI response
          console.log('[ChatInterface] Title from generateKeywords:', keywordsTitle);
          noteTitle = keywordsTitle || `聊天记录 ${formatDate(new Date().toISOString())}`;
          console.log('[ChatInterface] Title after fallback:', noteTitle);
          // noteContentHtml is already set to chatMessageContent
        }
      }
      // If noteTitle was provided by chatMessageTitle, and no structured markers, use it as is.
      // noteContentHtml remains chatMessageContent in this fallback path.
    }

    console.log('[ChatInterface] Final raw noteTitle (before truncation):', noteTitle);
    console.log('[ChatInterface] Final raw noteTitle length:', noteTitle?.length || 0); // Added null check

    // 确保标题长度不超过255个字符
    if (noteTitle && noteTitle.length > 255) { // Added null check for noteTitle
      noteTitle = noteTitle.substring(0, 252) + "..."; // 截断并添加省略号
    }
    console.log('[ChatInterface] noteTitle after truncation (if any):', noteTitle);

    console.log('[ChatInterface] Final noteContentHtml (first 100 chars):', noteContentHtml.substring(0, 100));
    console.log('[ChatInterface] Final noteContentHtml length:', noteContentHtml.length);

    try {
      let targetNotebookId: string | undefined = currentNotebook?.id;
      let newNotebookCreated = false;

      if (!targetNotebookId) {
        // 情况 2: 没有当前笔记本，需要创建新笔记本
        console.log('[ChatInterface] 没有当前笔记本，将创建新笔记本并保存笔记。');
        const autoGeneratedNotebookTitle = `聊天笔记 ${formatDate(new Date().toISOString())}`;
        const userNotebookTitle = window.prompt("请输入新笔记本的名称：", autoGeneratedNotebookTitle);
        
        if (!userNotebookTitle || !userNotebookTitle.trim()) {
            toast.error("未提供有效的笔记本名称，取消保存。");
            return;
        }

        const newNotebook = await createNotebook(userNotebookTitle.trim());
        if (newNotebook) {
          targetNotebookId = newNotebook.id;
          newNotebookCreated = true;
          toast.success(`新笔记本 "${newNotebook.title}" 已创建。`);
        } else {
          toast.error('创建新笔记本失败，无法保存笔记。');
          return;
        }
      }

      // 到这里，我们应该有一个 targetNotebookId
      if (!targetNotebookId) {
        toast.error('无法确定目标笔记本，保存笔记失败。');
        console.error('[ChatInterface] Logic error: targetNotebookId is still undefined after notebook creation/check.');
        return;
      }
      
      console.log(`[ChatInterface] 准备在笔记本 ID: ${targetNotebookId} 中创建笔记，标题: "${noteTitle}"`);
      const newNote = await createNote(targetNotebookId, {
        title: noteTitle,
        contentHtml: noteContentHtml, // 确保这是 Tiptap 可以处理的 HTML
      });

      if (newNote) {
        toast.success(`笔记 "${newNote.title}" 已成功保存!`);
        // 导航到新创建或已存在的笔记本，并尝试聚焦到新笔记
        // NotebookContext 中的 createNote 已经将新笔记添加到了 currentNotes
        // NotebookLayout 中的 useEffect 会监听 activeNote 和 currentNotes 来更新编辑器
        // 我们只需要导航到笔记本，并最好能让 NotebookLayout 知道哪个是新笔记。
        // 最简单的方式是直接导航到笔记本，让用户自己选择笔记，或者依赖 NotebookLayout 默认选择最新/第一个笔记。
        // 为了更好的用户体验，可以尝试导航并激活笔记。
        
        // 如果是新创建的笔记本，导航到它
        if (newNotebookCreated) {
          router.push(`/notebook/${targetNotebookId}`);
          //  当 NotebookLayout 加载时，它会获取 currentNotes。
          //  可以考虑在 NotebookLayout 中添加逻辑，如果 URL query param 中有 noteId，则自动设为 activeNote。
          //  或者，在这里调用一个方法（如果 NotebookContext 或 Layout 暴露的话）来设置 activeNote。
        } else if (currentNotebook?.id === targetNotebookId) {
          // 如果是保存到当前已打开的笔记本，可以尝试通过某种方式通知 NotebookLayout 更新 activeNote
          // 但 NotebookContext 的 createNote 已经更新了 currentNotes，
          // NotebookLayout 的 useEffect 应该会处理 activeNote 的选择（比如选择第一个，或者最新的）
          // 通常不需要强制导航，除非想确保新笔记被打开。
          console.log('[ChatInterface] 笔记已保存到当前笔记本。NotebookLayout应处理笔记列表的更新。');
        }
        // 如果希望总是导航到新笔记（即使在当前笔记本中创建）
        // router.push(`/notebook/${targetNotebookId}?note=${newNote.id}`); // 这需要NotebookLayout支持从query读取noteId
        
      } else {
        toast.error('在笔记本中创建笔记失败。');
      }

    } catch (error) {
      console.error('[ChatInterface] 保存笔记时出错:', error);
      toast.error(`保存笔记失败: ${error instanceof Error ? error.message : '未知错误'}`);
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
            onSaveToNotes={(content, title) => handleSaveToNotes(content, title)}
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