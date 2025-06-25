'use client';

import React, { useState, ReactNode, useCallback, useRef, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useSettings } from '@/contexts/SettingsContext';
import { useNotebook } from '@/contexts/NotebookContext';
import DocumentsList from '@/components/DocumentsList';
import ChatInterface, { ChatInterfaceRef } from '@/components/ChatInterface';
import FileUploader from '@/components/FileUploader';
import NoteEditor from '@/components/NoteEditor';
import NotePad from '@/components/NotePad';
import ExcalidrawBoard, { ExcalidrawBoardRef } from './ExcalidrawBoard';
import SettingsDialog from './SettingsDialog';
import { generateDocumentSummary, generateAudioOverview, generateStudyGuide, generateProjectBrief, importAllDocuments } from '@/services/aiService';
import { 
  fetchDocumentsByNotebookId,
  fetchDocumentById,
  getDocumentContent
} from '@/services/documentService';
// Correct imports
import { type Document, type NotePadNote, type Message, type Notebook, type Note, type WhiteboardContent } from '@/types'; 
import { DocumentStatus } from '@/types/shared_local'; // Correct import path
// import { emergencyRecoverNotebookDocuments } from '@/services/documentService';
// @ts-ignore
import { toast } from 'react-hot-toast';
import SimpleBoard, { SimpleBoardRef } from './SimpleBoard';
// import MarkdownNotebook, { MarkdownNotebookRef } from './MarkdownNotebook'; // 旧的
import dynamic from 'next/dynamic'; // 导入 dynamic
import type { TiptapNotebookApi } from './TiptapNotebook'; // 确保这里是 TiptapNotebookApi
// Import icons for collapse button
import { ChevronDoubleLeftIcon, ChevronDoubleRightIcon, HomeIcon, PencilIcon } from '@heroicons/react/24/outline';
import DocumentPreviewModal from './DocumentPreviewModal'; // Import the new modal
import RenameNotebookModal from './RenameNotebookModal'; // 导入重命名模态框
import ConfirmModal from './ConfirmModal'; // 导入通用确认模态框

// 动态导入 TiptapNotebook，并禁用SSR
const TiptapNotebook = dynamic(() => import('@/components/TiptapNotebook'), { // 使用正确的相对路径
  ssr: false,
  loading: () => <div style={{ padding: '1rem', color: 'gray' }}>编辑器加载中...</div>, // 可选的加载状态
});
//不再需要单独的 TiptapNotebookRef 类型导入

interface NotebookLayoutProps {
  children?: ReactNode;
  notebookId: string;
  notebookTitle: string;
  isSettingsModalOpen: boolean;
  closeSettingsModal: () => void;
}

export default function NotebookLayout({ 
  children, 
  notebookId, 
  notebookTitle: initialNotebookTitle,
  isSettingsModalOpen,
  closeSettingsModal
}: NotebookLayoutProps) {
  const [studioContent, setStudioContent] = useState<string | null>(null);
  const [generatingContent, setGeneratingContent] = useState<string | null>(null);
  const [studioContentTitle, setStudioContentTitle] = useState<string>('');
  const [activeNote, setActiveNote] = useState<string | null>(null);
  const [showStudio, setShowStudio] = useState(true);
  const [audioOverview, setAudioOverview] = useState<{url: string, title: string, duration: string} | null>(null);
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [selectedChatDocuments, setSelectedChatDocuments] = useState<Document[]>([]);
  const [useAllDocuments, setUseAllDocuments] = useState(true);
  const [showChat, setShowChat] = useState(true);
  const [notebookTitle, setNotebookTitle] = useState(initialNotebookTitle || '');
  const [isClient, setIsClient] = useState(false);
  const [tiptapApi, setTiptapApi] = useState<TiptapNotebookApi | null>(null);

  // 确认删除相关状态
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [noteToDelete, setNoteToDelete] = useState<{ id: string; title: string } | null>(null);

  // 使用 useCallback 包裹 onApiReady 回调
  const handleApiReady = useCallback((api: TiptapNotebookApi | null) => {
    console.log('[NotebookLayout] Tiptap API ready/changed:', api ? 'API object received' : 'API is null');
    setTiptapApi(api);
  }, []); // setTiptapApi 的引用是稳定的，所以依赖数组可以为空，或者明确写 [setTiptapApi]

  const { llmSettings, embeddingSettings } = useSettings();
  const { 
    currentNotebook,
    currentNotes,     // Get notes list from context
    isLoadingNotes,   // Get loading state from context
    notesError,       // Get error state from context
    createNote,       // Use createNote from context
    updateNote,       // Use updateNote from context
    deleteNote,       // Use deleteNote from context
    getNotePadNotes,
    saveWhiteboardContent,
    getWhiteboardContent,
    documents, // Use context state
    isLoadingDocuments, // Use context state
    refetchDocuments, // Use context function
    isLoadingNotebooks, // Need this from context
    isInitialized, // Need this from context
    setCurrentNotebookById, // Need this from context
    notebooks, // Added for notebook title fetching
  } = useNotebook();

  // Key for localStorage
  const lastActiveNoteStorageKey = useMemo(() => 
    currentNotebook && currentNotebook.id ? `lastActiveNote_${currentNotebook.id}` : null, 
    [currentNotebook]
  );

  useEffect(() => {
    setIsClient(true);
  }, []);
  
  // 调整大小相关状态 - 设置三栏均匀布局，每栏占1/3
  const [sourcesWidth, setSourcesWidth] = useState(33.33); // 左侧占比，百分比，设为1/3
  const [chatWidth, setChatWidth] = useState(33.33); // 右侧占比，百分比，设为1/3
  const [isResizingSources, setIsResizingSources] = useState(false);
  const [isResizingChat, setIsResizingChat] = useState(false);
  const [startX, setStartX] = useState(0);
  const [startWidths, setStartWidths] = useState({ sources: 0, chat: 0 });
  
  // 确保默认显示左右两侧面板
  useEffect(() => {
    // 初始化时强制显示左右两侧面板
    setShowStudio(true);
    setShowChat(true);
  }, []);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const chatPanelRef = useRef<HTMLDivElement>(null);
  
  const router = useRouter(); // Ensure router is available
  
  // 添加一个处理首页点击的方法
  const handleHomeClick = useCallback(() => {
    console.log('[NotebookLayout] 导航回首页');
    try {
      router.push('/');
    } catch (error) {
      console.error('[NotebookLayout] 导航错误:', error);
    }
  }, [router]);
  
  // Add logging here
  /* // Temporarily disable this high-frequency log
  console.log('[NotebookLayout Status]', { 
      isLoadingNotebooks, 
      isLoadingDocuments, 
      isInitialized, 
      currentNotebookExists: !!currentNotebook,
      documentsCount: documents?.length,
      routerInitialized: !!router
  });
  */
  
  // 在加载时记录笔记本状态 (Corrected)
  useEffect(() => {
    if (currentNotebook) {
      const allDocs = documents || []; 
      const completedDocs = allDocs.filter((doc: Document) => doc.status === DocumentStatus.COMPLETED);
      console.log('笔记本加载状态:', {
        id: currentNotebook.id,
        title: currentNotebook.title,
        totalDocs: allDocs.length, 
        completedDocs: completedDocs.length,
        documentsArray: !!allDocs, 
        documentsLength: allDocs.length 
      });
      // Removed potentially problematic recovery logic, relying on context
    }
  }, [currentNotebook, documents]); // Removed refetchDocuments dependency as it might cause loops if not stable
  
  // Add Effect to set the current notebook in the context based on the prop
  useEffect(() => {
    // Only set the current notebook if the context is initialized and we have an ID
    if (isInitialized && notebookId) { 
      console.log(`[NotebookLayout] Context initialized. Setting current notebook by ID: ${notebookId}`);
      setCurrentNotebookById(notebookId);
    } else if (!notebookId) {
       console.log(`[NotebookLayout] notebookId prop is missing, cannot set current notebook.`);
    } else if (!isInitialized) {
       console.log(`[NotebookLayout] Context not yet initialized. Waiting...`);
    }
    // Add isInitialized to dependencies
  }, [notebookId, setCurrentNotebookById, isInitialized]); 

  // Effect to load the last active note ID from localStorage
  // 这个 useEffect 只负责从 localStorage 恢复上次活动的笔记 ID
  useEffect(() => {
    if (isClient && currentNotebook && currentNotes && lastActiveNoteStorageKey && isInitialized) {
      const lastActiveNoteId = localStorage.getItem(lastActiveNoteStorageKey);
      if (lastActiveNoteId) {
        const noteExists = currentNotes.some(note => note.id === lastActiveNoteId);
        if (noteExists) {
          console.log(`[NotebookLayout] Found last active note ID in localStorage: ${lastActiveNoteId}. Setting as active.`);
          setActiveNote(lastActiveNoteId); // 设置活动笔记 ID
          setShowStudio(true); // 确保编辑器面板可见
        } else {
          console.log(`[NotebookLayout] Last active note ID ${lastActiveNoteId} from localStorage not found in current notes. Clearing from localStorage.`);
          localStorage.removeItem(lastActiveNoteStorageKey);
          setActiveNote(null); // 清除无效的活动笔记 ID
        }
      } else if (currentNotes.length > 0 && !activeNote) {
        // 没有上次活动的笔记 ID，但笔记列表不为空且当前没有活动笔记
        // 可选：默认选择第一个笔记
        console.log('[NotebookLayout] No last active note in localStorage, selecting first note.');
        setActiveNote(currentNotes[0].id);
        setShowStudio(true); // 确保编辑器面板可见
      }
    } else if (isClient && currentNotebook && (!currentNotes || currentNotes.length === 0) && isInitialized) {
        // 笔记本已加载，但没有笔记或笔记列表为空。确保 activeNote 为 null
        setActiveNote(null);
    }
  }, [isClient, currentNotebook, currentNotes, lastActiveNoteStorageKey, isInitialized]);


  // Effect to update editor content when activeNote changes or currentNotes updates
  useEffect(() => {
    if (!isClient) return;

    if (activeNote && currentNotes) {
      const noteData = currentNotes.find(note => note.id === activeNote);
      if (noteData) {
        // console.log(`[NotebookLayout] Active note is '${noteData.title || 'Untitled'}'. Updating editor title and content.`);
        setStudioContentTitle(noteData.title || '');
        setStudioContent(noteData.contentHtml || '');
        setShowStudio(true); // Ensure editor panel is visible
      } else {
        // Active note ID exists but not found in currentNotes (e.g., notes list updated and old activeNote is gone)
        // console.warn(`[NotebookLayout] Active note ID ${activeNote} not found in currentNotes. Attempting to clear active note.`);
        // setActiveNote(null); // <--- Temporarily comment out this line
      }
    } else if (activeNote === null) {
      // No active note selected, or activeNote was just cleared
      console.log('[NotebookLayout] No active note. Clearing editor title and content.');
      setStudioContentTitle('');
      setStudioContent('');
      // setShowStudio(true); // Keep editor area visible, but it will be empty or show a placeholder
    }
  }, [activeNote, currentNotes, isClient, isInitialized]);
  
  // 处理拖动开始
  
  // 处理拖动开始
  const handleResizeStart = (event: React.MouseEvent, type: 'sources' | 'chat') => {
    event.preventDefault();
    if (type === 'sources') {
      setIsResizingSources(true);
    } else {
      setIsResizingChat(true);
    }
    setStartX(event.clientX);
    setStartWidths({ sources: sourcesWidth, chat: chatWidth });
  };
  
  // 处理拖动过程
  useEffect(() => {
    const handleResize = (event: MouseEvent) => {
      if (!isResizingSources && !isResizingChat) return;
      if (!containerRef.current) return;
      
      const containerWidth = containerRef.current.clientWidth;
      const deltaX = event.clientX - startX;
      const deltaPercent = (deltaX / containerWidth) * 100;
      
      if (isResizingSources) {
        const newSourcesWidth = Math.min(Math.max(startWidths.sources + deltaPercent, 15), 40);
        setSourcesWidth(newSourcesWidth);
      } else if (isResizingChat) {
        const availableWidth = 100 - sourcesWidth;
        const newChatWidth = Math.min(Math.max(startWidths.chat - deltaPercent, availableWidth * 0.3), availableWidth * 0.7);
        setChatWidth(newChatWidth);
      }
    };
    
    const handleResizeEnd = () => {
      setIsResizingSources(false);
      setIsResizingChat(false);
    };
    
    if (isResizingSources || isResizingChat) {
      document.addEventListener('mousemove', handleResize);
      document.addEventListener('mouseup', handleResizeEnd);
    }
    
    return () => {
      document.removeEventListener('mousemove', handleResize);
      document.removeEventListener('mouseup', handleResizeEnd);
    };
  }, [isResizingSources, isResizingChat, startX, startWidths]);
  
  // 处理文档上传完成事件
  const handleUploadComplete = useCallback((uploadedDoc: Document) => {
    console.log(`文件上传完成: ${uploadedDoc.fileName}`);
    
    try {
      // 刷新文档列表
      refetchDocuments();
    } catch (error) {
      console.error('处理上传完成事件时出错:', error);
    }
  }, [refetchDocuments]);
  
  // 处理发送消息 - 改为 async 并移除 toast
  const handleSendMessage = async (message: Message) => {
    console.log("Sending message:", message);
    // TODO: Need to implement actual message sending logic, perhaps call an API
    // toast.error("消息发送功能暂不可用"); // REMOVED toast
    
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 1000)); 
    console.log("Simulated message send complete.");
    // In a real scenario, you'd handle the API response here
  };
  
  const handleGenerateDocumentSummary = async () => {
    if (!currentNotebook) return;
    // Correct: Operate on selectedDocument if available
    if (!selectedDocument) {
      toast.error('请先选择一个文档以生成摘要');
      return;
    }

    try {
      setGeneratingContent('summary');
      // Correct: Pass selectedDocument.id
      const summary = await generateDocumentSummary(selectedDocument.id); 
      setStudioContent(summary);
      setStudioContentTitle(`文档摘要: ${selectedDocument.fileName}`);
    } catch (error) {
      console.error('生成摘要时出错:', error);
      toast.error('生成摘要失败');
    } finally {
      setGeneratingContent(null);
    }
  };

  const handleGenerateAudioOverview = async () => {
    if (!currentNotebook) return;
    // Correct: Operate on selectedDocument if available
    if (!selectedDocument) {
      toast.error('请先选择一个文档以生成音频概述');
      return;
    }

    try {
      setGeneratingContent('audio');
      // Correct: Pass selectedDocument.id. Returns string (URL?)
      const audioResultUrl = await generateAudioOverview(selectedDocument.id);
      
      if (typeof audioResultUrl === 'string' && audioResultUrl) {
        setAudioOverview({ url: audioResultUrl, title: `音频概述: ${selectedDocument.fileName}`, duration: '未知' }); 
        toast.success('音频概述生成成功');
      } else {
         toast.error('音频概述生成失败或未返回有效链接');
         setAudioOverview(null);
      }

    } catch (error) {
      console.error('生成音频概述时出错:', error);
      toast.error('生成音频概述失败');
      setAudioOverview(null); // Clear on error
    } finally {
      setGeneratingContent(null);
    }
  };

  const handleGenerateStudyGuide = async () => {
    if (!currentNotebook) return;
    // Correct: Operate on selectedDocument if available
    if (!selectedDocument) {
      toast.error('请先选择一个文档以生成学习指南');
      return;
    }

    try {
      setGeneratingContent('guide');
      // Correct: Pass selectedDocument.id
      const guide = await generateStudyGuide(selectedDocument.id);
      setStudioContent(guide);
      setStudioContentTitle(`学习指南: ${selectedDocument.fileName}`);
    } catch (error) {
      console.error('生成学习指南时出错:', error);
       toast.error('生成学习指南失败');
    } finally {
      setGeneratingContent(null);
    }
  };

  const handleGenerateProjectBrief = async () => {
    if (!currentNotebook) return;
    // Correct: Operate on selectedDocument if available
    if (!selectedDocument) {
      toast.error('请先选择一个文档以生成项目简报');
      return;
    }

    try {
      setGeneratingContent('brief');
      // Correct: Pass selectedDocument.id
      const brief = await generateProjectBrief(selectedDocument.id);
      setStudioContent(brief);
      setStudioContentTitle(`项目简报: ${selectedDocument.fileName}`);
    } catch (error) {
      console.error('生成项目简报时出错:', error);
      toast.error('生成项目简报失败');
    } finally {
      setGeneratingContent(null);
    }
  };
  
  const handleCreateNewNote = async () => {
    if (!currentNotebook) return;
    console.log('创建新笔记...');
    try {
      const newNote = await createNote(currentNotebook.id, { title: '新笔记', contentHtml: '' }); 
      if (newNote) {
        setActiveNote(newNote.id); 
        setShowStudio(true);
        setStudioContentTitle(newNote.title || '新笔记'); 
        setStudioContent(newNote.contentHtml || ''); 
        if (lastActiveNoteStorageKey && isClient) {
          localStorage.setItem(lastActiveNoteStorageKey, newNote.id);
          console.log(`[NotebookLayout] Stored new active note ID: ${newNote.id}`);
        }
      } else {
        toast.error("创建新笔记失败。");
      }
    } catch (error) {
      console.error("创建笔记时出错:", error);
      toast.error("创建笔记时出错。");
    }
  };
  
  const handleEditNote = (noteId: string) => {
    if (!currentNotebook) return;
    const noteToEdit = currentNotes.find(note => note.id === noteId);
    if (!noteToEdit) {
      console.warn(`[NotebookLayout] Note with ID ${noteId} not found for editing.`);
      toast.error("无法找到要编辑的笔记。");
      return;
    }
    console.log(`编辑笔记: ${noteId}`);
    setActiveNote(noteId);
    setShowStudio(true);
    setStudioContentTitle(noteToEdit.title || `编辑笔记 ${noteId}`); 
    setStudioContent(noteToEdit.contentHtml || "// 加载笔记内容..."); 
    if (lastActiveNoteStorageKey && isClient) {
      localStorage.setItem(lastActiveNoteStorageKey, noteId);
      console.log(`[NotebookLayout] Stored active note ID on edit: ${noteId}`);
    }
  };
  
  // Function to handle saving changes from NoteEditor (Corrected)
  const handleSaveNoteContent = (noteId: string, newContent: string) => {
    if (!currentNotebook || !noteId) return; // Ensure noteId is valid
    console.log(`保存笔记 ${noteId} 内容...`);
    updateNote(currentNotebook.id, noteId, { contentHtml: newContent }); 
    toast.success("笔记已保存");
    // Optionally clear active note or close editor after save
    // setActiveNote(null); 
    // setShowStudio(false); 
  };
  
  // Handler for when DocumentsList signals a selection
  const handleSelectDocument = (document: Document) => {
    console.log('[NotebookLayout] Document selected via callback:', document.fileName);
    setSelectedDocument(document);
    setStudioContent(null);
    setStudioContentTitle('');
    setAudioOverview(null);
  };
  
  // Consolidated preview handler (used by DocumentsList and called by handleChatPreview)
  const onPreviewDocument = (document: Document, content: string | ArrayBuffer, inChat: boolean) => {
    console.log(`[NotebookLayout] Preview requested for: ${document.fileName}, inChat: ${inChat}`);
    if (inChat) {
      // Logic for chat preview
      toast(`预览 (聊天): ${document.fileName}`);
      // Potentially display content in chat if needed, handling ArrayBuffer case
    } else {
      // Logic for studio preview
      setStudioContent(typeof content === 'string' ? content : '二进制内容无法直接预览');
      setStudioContentTitle(`预览: ${document.fileName}`);
      setAudioOverview(null);
    }
  };
  
  // 切换到所有文档模式
  const switchToAllDocuments = () => {
    setUseAllDocuments(true);
    setMultiSelectMode(false); // 所有文档模式下禁用多选
    // 简化为只使用当前可用文档，不强制加载
    refetchDocuments();
  };
  
  // 切换到选定文档模式
  const switchToSelectedDocuments = () => {
    // 只有当有选定文档时才允许切换
    if (selectedChatDocuments.length > 0) {
      setUseAllDocuments(false);
      setMultiSelectMode(true); // 选定文档模式下启用多选
      // 确保使用已选择的文档
      refetchDocuments();
      console.log('切换到选定文档模式，使用已选文档：', selectedChatDocuments.map(d => d.fileName).join(', '));
    } else {
      // 如果没有选定文档，显示提示
      alert('请先在左侧文档列表中选择至少一个文档');
    }
  };

  // 移除已选择的文档
  const handleRemoveSelectedDocument = (documentId: string) => {
    const newSelectedDocuments = selectedChatDocuments.filter(doc => doc.id !== documentId);
    setSelectedChatDocuments(newSelectedDocuments);
    
    // 如果移除的是当前选中的文档，清空选中状态
    if (selectedDocument?.id === documentId) {
      setSelectedDocument(null);
    }
    
    // 如果没有选择的文档，自动切换到"所有文档"模式
    if (newSelectedDocuments.length === 0) {
      setUseAllDocuments(true);
      refetchDocuments();
    } else {
      // 更新文档列表为新的选择
      refetchDocuments();
    }
  };
  
  // 处理笔记板变更
  const handleNotePadChange = (notes: NotePadNote[]) => {
    if (!notebookId) return;
    // saveNotePadNotes(notebookId, notes); // Not provided by context
  };
  
  // 获取笔记板数据
  const notePadNotes = getNotePadNotes(notebookId);
  
  // 状态管理
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // 添加状态来保存面板是否最小化 - 默认显示左侧和右侧面板
  const [isSourcesMinimized, setIsSourcesMinimized] = useState(false);
  const [isChatMinimized, setIsChatMinimized] = useState(false);
  
  // 记录原始宽度，用于恢复
  const originalSourcesWidthRef = useRef<number>(sourcesWidth);
  const originalChatWidthRef = useRef<number>(chatWidth);
  
  // 最小化文档来源面板
  const toggleSourcesPanel = useCallback(() => {
    setIsSourcesMinimized(prev => {
      const nextMinimized = !prev;
      if (nextMinimized) {
        // Minimize
        originalSourcesWidthRef.current = sourcesWidth;
        setSourcesWidth(2); // 最小宽度从 4 改为 2
      } else {
        // Restore
        setSourcesWidth(originalSourcesWidthRef.current);
      }
      return nextMinimized;
    });
  }, [sourcesWidth]);
  
  // 最小化聊天面板
  const toggleChatPanel = useCallback(() => {
    setIsChatMinimized(prev => {
      const nextMinimized = !prev;
      if (nextMinimized) {
        // Minimize
        originalChatWidthRef.current = chatWidth;
        setChatWidth(2); // 最小宽度从 4 改为 2
      } else {
        // Restore
        setChatWidth(originalChatWidthRef.current);
      }
      return nextMinimized;
    });
  }, [chatWidth]);
  
  useEffect(() => {
    // 删除同步更新文档列表中显示的内容到AI聊天助手的逻辑
    // 这个功能已经由其他更新机制处理
  }, []);
  
  // 在组件内部添加新的状态，用于存储从 context 加载的白板内容
  const [initialWhiteboardData, setInitialWhiteboardData] = useState<WhiteboardContent | null>(null);
  
  // 在 useEffect 中加载白板内容 (Corrected)
  useEffect(() => {
    if (notebookId) {
      const loadedContent = getWhiteboardContent(notebookId);
      if (loadedContent) {
        // Store the whole object, not content.content
        setInitialWhiteboardData(loadedContent); 
      }
    }
  // Add getWhiteboardContent to dependencies if it's stable
  }, [notebookId, getWhiteboardContent]); 
  
  // 处理白板内容保存
  const handleWhiteboardSave = useCallback((content: any) => {
    // 这个函数忽略 savedContent 可能为空的警告，因为我们只关心有内容的情况
    if (content && notebookId) {
      console.log('保存白板内容，笔记本ID:', notebookId);
      console.log('白板内容对象:', Object.keys(content));
      
      if (content.content) {
        // 如果是嵌套的content结构，提取内部content
        saveWhiteboardContent(notebookId, content.content);
      } else {
        // 直接保存内容对象
        saveWhiteboardContent(notebookId, content);
      }
      
      toast.success('白板内容已保存');
    }
  }, [notebookId, saveWhiteboardContent]);
  
  // 添加 toggleUseAllDocuments 函数
  const toggleUseAllDocuments = () => {
    setUseAllDocuments(!useAllDocuments);
    if (!useAllDocuments) {
      // 如果切换到使用所有文档，加载所有文档
      refetchDocuments();
    } else {
      // 如果切换到使用选定文档，使用当前选定的文档
      if (selectedChatDocuments.length > 0) {
        refetchDocuments();
      }
    }
  };
  
  // const notebookRef = useRef<MarkdownNotebookRef>(null); // 旧的 Ref
  const notebookRef = useRef<TiptapNotebookApi>(null); // 新的 TiptapNotebook Ref
  // 添加聊天界面引用
  const chatRef = useRef<ChatInterfaceRef>(null);
  
  // Handle adding document content to chat input (if needed)
  const handleDocumentAddToChat = useCallback(async (document: Document) => {
    if (!document) return;

    console.log(`Adding document to chat: ${document.fileName}`);
    toast.success(`${document.fileName} 已添加到聊天上下文`);

    try {
      // Check if it's a whiteboard document based on a convention or type
      // This assumes whiteboard data might be stored differently and not have simple text content
      if (document.fileType === 'excalidraw' || document.fileName.endsWith('.excalidraw.json')) { 
        console.log('Document is a whiteboard, adding placeholder text.');
        // If needed, add a placeholder or summary to the chat context
        // addMessage({ role: 'user', content: `[Whiteboard: ${document.fileName}]` });
        return; // Avoid fetching text content for whiteboards
      }
      
      // Fetch text content for regular documents
      const content = await getDocumentContent(document.id);
      
      if (content) {
        // Decide how to add content to chat - maybe append to input, or add as a system message?
        // Example: Append to an input field (needs ref to input)
        // chatInputRef.current.value += `\n\n--- Document: ${document.fileName} ---\n${content.substring(0, 500)}...`;
        
        // Or add as a message (if context provides addMessage)
        // addMessage({ role: 'user', content: `Added content from: ${document.fileName}\n${content.substring(0, 500)}...` });
        console.log(`Content for ${document.fileName} loaded, length: ${content.length}`);
      } else {
        console.warn(`Could not fetch content for document: ${document.fileName}`);
        toast.error(`无法加载文档内容: ${document.fileName}`);
      }
    } catch (error) {
      console.error(`Error adding document ${document.fileName} to chat:`, error);
      toast.error(`添加文档到聊天时出错`);
    }
  }, [getDocumentContent]); // Add getDocumentContent dependency if used

  // 计算工作区宽度
  const workspaceWidth = 100 - sourcesWidth - chatWidth;
  
  // Minimal width for collapsed panels (adjust if needed)
  const MINIMIZED_WIDTH_PERCENT = 4; 
  
  // Derived state for the Set of selected IDs to pass to DocumentsList
  const selectedChatDocIds = useMemo(() => 
    new Set(selectedChatDocuments.map(doc => doc.id)), 
    [selectedChatDocuments]
  );

  // Handler to toggle document selection for chat
  const handleToggleChatSelection = useCallback((doc: Document) => {
    setSelectedChatDocuments(prevSelected => {
      const isAlreadySelected = prevSelected.some(d => d.id === doc.id);
      let newSelected;
      if (isAlreadySelected) {
        newSelected = prevSelected.filter(d => d.id !== doc.id);
      } else {
        newSelected = [...prevSelected, doc];
      }

      // If selection changes, automatically switch to 'Selected Documents' mode
      if (newSelected.length > 0) {
        setUseAllDocuments(false);
      } else {
        // If no documents are selected, switch back to 'All Documents' mode
        setUseAllDocuments(true);
      }
      
      console.log('[NotebookLayout] Toggled chat selection for:', doc.fileName, '. New selection:', newSelected.map(d=>d.fileName));
      return newSelected;
    });

    // Clear the main selected document (for studio) if it was the one toggled off
    // This prevents inconsistencies if the user toggles off the doc shown in studio
    setSelectedDocument(prev => {
      if (prev?.id === doc.id && selectedChatDocuments.some(d => d.id === doc.id)) {
        return null; // Clear studio selection if the *removed* doc was selected there
      }
      return prev;
    });

  }, [selectedChatDocuments]); // Dependency is correct

  // State for the preview modal
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [documentToPreview, setDocumentToPreview] = useState<Document | null>(null);
  const [previewModalContent, setPreviewModalContent] = useState<string | ArrayBuffer | null>(null);
  const [previewPosition, setPreviewPosition] = useState<{ top: number; left: number; width: number; height: number } | undefined>(undefined);

  // 新增 useEffect: 当聊天面板宽度变化且预览模态框打开时，更新预览位置
  useEffect(() => {
    if (isPreviewModalOpen && chatPanelRef.current) {
      console.log('[Layout Effect] Chat width changed while preview open. Updating preview position.');
      const rect = chatPanelRef.current.getBoundingClientRect();
      setPreviewPosition({
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height
      });
    }
    // Note: We don't need cleanup here as it just updates state based on existing refs/state
  }, [chatWidth, isPreviewModalOpen]); // Depend on chatWidth and modal open state

  // Add Effect to sync notebook title from context/props
  useEffect(() => {
    if (initialNotebookTitle) {
        setNotebookTitle(initialNotebookTitle); // Use setter
    } else if (notebookId) {
      const foundNotebook = notebooks.find(nb => nb.id === notebookId);
      if (foundNotebook) {
        setNotebookTitle(foundNotebook.title); // Use setter
      } else if (!isLoadingNotebooks) {
        console.warn(`Notebook with ID ${notebookId} not found in context.`);
        setNotebookTitle(`笔记本 ${notebookId.substring(0, 6)}`); // Use setter
      }
    } else {
      setNotebookTitle('未命名笔记本'); // Use setter
    }
  }, [notebookId, notebooks, isLoadingNotebooks, initialNotebookTitle]);

  // Preview Handlers
  const handlePreviewDocument = useCallback((doc: Document, contentOrUrl: string | ArrayBuffer, _inChat: boolean = false) => {
    console.log(`[NotebookLayout] handlePreviewDocument called for: ${doc.fileName}`);
    if (chatPanelRef.current) { 
      const rect = chatPanelRef.current.getBoundingClientRect();
      setPreviewPosition({
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height
      });
      setDocumentToPreview(doc);
      // Directly set the received content/URL to the modal content state
      setPreviewModalContent(contentOrUrl);
      setIsPreviewModalOpen(true);
      console.log(`[NotebookLayout] Preview modal opened for ${doc.fileName}. Content/URL type: ${typeof contentOrUrl}`);
    } else {
      console.error("[NotebookLayout] Chat panel ref is not available.");
      toast.error("无法定位预览窗口。请重试。");
    }
  }, []); 
  // Ensure handleChatPreview signature matches expectation and calls main handler
  const handleChatPreview = useCallback((doc: Document, contentOrUrl: string | ArrayBuffer) => { 
    handlePreviewDocument(doc, contentOrUrl, true); 
  }, [handlePreviewDocument]);
  const closePreviewModal = useCallback(() => {
    setIsPreviewModalOpen(false);
    setDocumentToPreview(null);
    setPreviewModalContent(null);
    console.log("[NotebookLayout] Preview modal closed.");
  }, []);

  // 添加重命名相关状态
  const [showRenameModal, setShowRenameModal] = useState(false);
  
  // 打开重命名模态框
  const handleRenameClick = useCallback(() => {
    if (currentNotebook) {
      setShowRenameModal(true);
    } else {
      toast.error("无法获取当前笔记本信息进行重命名");
    }
  }, [currentNotebook]);

  // 处理重命名成功
  const handleRenameSuccess = useCallback((updatedNotebook: Notebook) => {
    setNotebookTitle(updatedNotebook.title);
    toast.success("笔记本标题已更新");
  }, []);

  // Load content into editor state when activeNote changes based on context's currentNotes
  useEffect(() => {
    if (activeNote) {
      const note = currentNotes.find(n => n.id === activeNote);
      if (note) {
        setStudioContent(note.contentHtml || '');
        setStudioContentTitle(note.title || '');
      } else {
        // Note not found in context's list (might be stale ID after delete?)
        // Clear the editor and potentially reset activeNote if desired.
        // Context logic should handle selecting another note after deletion.
        setStudioContent('');
        setStudioContentTitle('');
        // Consider if setActiveNote(null) is needed here or handled by deleteNote logic
      }
    } else {
        // No active note selected
        setStudioContent('');
        setStudioContentTitle('');
    }
  }, [activeNote, currentNotes]); // Depend on context's notes

  // Handler passed to RichTextNotebook's onSave prop
  const handleSaveCurrentNoteCallback = useCallback(async (contentInput: string, title: string) => {
    let contentHtmlString: string;

    // Check if contentInput is a SyntheticBaseEvent or an object that might contain the HTML
    if (typeof contentInput === 'string') {
      contentHtmlString = contentInput;
    } else {
      toast.error('收到的笔记内容格式不正确。');
      console.error('[NotebookLayout] Received invalid contentHtml type:', typeof contentInput, contentInput);
      return; // Stop if type is unexpected
    }

    if (currentNotebook && activeNote) {
      try {
        // Ensure contentHtmlString is used here
        await updateNote(currentNotebook.id, activeNote, { contentHtml: contentHtmlString, title });
      } catch (error) {
        console.error("Error saving note via callback:", error);
        toast.error('保存笔记时出错。');
      }
    } else {
      toast.error('无法确定要保存的笔记。请确保已选择或创建笔记。');
    }
  }, [currentNotebook, activeNote, updateNote]); // <--- 添加 useCallback 和依赖项

  // Handler for the "New Note" button
  const handleCreateNewNoteClick = async () => {
    if (!currentNotebook) {
      toast.error("当前没有活动的笔记本");
      return;
    }
    try {
      // Pass initial title and contentHtml
      const newNote = await createNote(currentNotebook.id, { title: '新笔记', contentHtml: '' }); 
      if (newNote) { // Check if note creation was successful
        setActiveNote(newNote.id); 
      }
    } catch (error) {
      console.error("Error creating note via button:", error);
    }
  };

  // Handler for the "Delete Note" button
  const handleDeleteNoteClick = async (noteIdToDelete: string) => {
    if (!currentNotebook) return;
    const noteToDeleteObj = currentNotes.find(n => n.id === noteIdToDelete);
    if (noteToDeleteObj) {
      setNoteToDelete({
        id: noteIdToDelete,
        title: noteToDeleteObj.title || '未命名笔记'
      });
      setShowDeleteConfirm(true);
    } else {
      toast.error("找不到要删除的笔记");
    }
  };

  // 处理确认删除笔记
  const handleConfirmDeleteNote = async () => {
    if (!currentNotebook || !noteToDelete) return;
    
    try {
      const nextActiveNoteId = getNextActiveNoteId(currentNotes, noteToDelete.id);
      await deleteNote(currentNotebook.id, noteToDelete.id);
      setActiveNote(nextActiveNoteId);
      toast.success('笔记已删除');
    } catch (error) {
      console.error("Error deleting note via button:", error);
      toast.error('删除笔记时出错');
    } finally {
      setShowDeleteConfirm(false);
      setNoteToDelete(null);
    }
  };

  // 处理取消删除笔记
  const handleCancelDeleteNote = () => {
    setShowDeleteConfirm(false);
    setNoteToDelete(null);
  };

  // Helper to determine which note to select after deletion
  const getNextActiveNoteId = (notes: Note[], deletedNoteId: string): string | null => {
    const currentIndex = notes.findIndex(n => n.id === deletedNoteId);
    if (currentIndex === -1) return notes.length > 1 ? notes[0].id : null;
    
    const remainingNotes = notes.filter(n => n.id !== deletedNoteId);
    if (remainingNotes.length === 0) return null;
    // Try to select the note at the same index in the remaining list
    const nextIndex = Math.min(currentIndex, remainingNotes.length - 1);
    return remainingNotes[nextIndex].id;
  };

  const memoizedTiptapOnSave = useCallback(async (html: string, titleFromEditor: string): Promise<void> => {
    // Use the already memoized handleSaveCurrentNoteCallback
    // Pass studioContentTitle as the fallback title if titleFromEditor is empty
    await handleSaveCurrentNoteCallback(html, titleFromEditor || studioContentTitle);
  }, [handleSaveCurrentNoteCallback, studioContentTitle]);

  return (
    <>
      <div ref={containerRef} className="flex h-screen bg-white font-sans" style={{ padding: '0.3%' }}>
        {/* Left panel: Document Sources */}
        <div 
          className={`border shadow flex flex-col h-full flex-shrink-0 rounded-lg rounded-tr-lg bg-docs-panel border-primary ${isSourcesMinimized ? 'transition-all duration-300 ease-in-out' : ''}`} 
          style={{ 
            flexBasis: `${sourcesWidth}%`,
            maxWidth: '33.33%',
            minWidth: isSourcesMinimized ? '2%' : '10%'
          }}
        >
          <div className={`flex justify-between items-center p-1 ${isSourcesMinimized ? 'flex-col' : ''} bg-[#e8c29e]`}> {/* 更高饱和度的米橙色 */} 
            {!isSourcesMinimized && (
              <div className="flex items-center space-x-1 truncate pr-2">
                <button 
                  onClick={handleHomeClick}
                  className="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
                  title="返回首页"
                >
                  <HomeIcon className="h-4 w-4" />
                </button>
                <h2 className="font-medium text-lg truncate" title={currentNotebook?.title || notebookTitle}>{currentNotebook?.title || notebookTitle}</h2>
                <button
                  onClick={handleRenameClick}
                  className="p-0.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
                  title="重命名笔记本"
                >
                  <PencilIcon className="h-3 w-3" />
                </button>
              </div>
            )}
            <button
              className={`p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded ${isSourcesMinimized ? '' : ''}`}
              onClick={toggleSourcesPanel}
              title={isSourcesMinimized ? "展开资源面板" : "收起资源面板"}
            >
              {isSourcesMinimized ? (
                <ChevronDoubleRightIcon className="h-5 w-5 text-gray-600" />
              ) : (
                <ChevronDoubleLeftIcon className="h-4 w-4" />
              )}
            </button>
          </div>
          {!isSourcesMinimized && (
            <>
              <div className="flex-grow overflow-y-auto">
                <DocumentsList
                  notebookId={notebookId}
                  onSelectDocument={handleSelectDocument}
                  onPreviewDocument={handlePreviewDocument}
                  selectedChatDocIds={selectedChatDocIds}
                  onToggleChatSelection={handleToggleChatSelection}
                />
              </div>
              <div className="border-t p-2">
                <FileUploader notebookId={notebookId} onUploadComplete={handleUploadComplete} />
              </div>
            </>
          )}
        </div>

        {/* Resizer for Sources Panel */}
        {!isSourcesMinimized && (
           <div 
             className="w-0.5 cursor-col-resize bg-transparent hover:bg-primary-dark rounded flex-shrink-0"
             onMouseDown={(e) => handleResizeStart(e, 'sources')}
           />
         )}

        {/* Main Content Area - Editor + Notes List */}
        <div 
           className="flex-1 min-h-0 h-full flex flex-col max-h-full overflow-hidden rounded-lg shadow border bg-notes-panel border-primary relative"
         >
          {/* 统一的笔记工具栏：将笔记列表、新建笔记按钮、笔记标题和保存按钮放在同一行 */}
          <div className="flex items-center space-x-2 p-1 rounded-t-lg bg-[#a8d8cb]"> {/* 更高饱和度的薄荷绿 */}
            <div className="relative w-[120px]">
                {isLoadingNotes ? (
                    <div className="w-full p-1 border border-gray-300 rounded-md text-xs text-gray-500 bg-gray-100">加载中...</div>
                ) : (
                    <select 
                        value={activeNote || ''} 
                        onChange={(e) => setActiveNote(e.target.value || null)}
                        className="w-full p-1 border border-gray-300 rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                        disabled={currentNotes.length === 0}
                    >
                        {currentNotes.length === 0 && <option value="" disabled>无笔记</option>}
                        {currentNotes.map(note => (
                            <option key={note.id} value={note.id}>{note.title || '未命名笔记'}</option>
                        ))}
                    </select>
                )}
            </div>
            <button 
                onClick={handleCreateNewNoteClick}
                className="p-1 text-xs bg-green-500 hover:bg-green-600 text-white rounded shadow-sm transition-colors flex items-center justify-center w-6 h-6"
                disabled={isLoadingNotes}
                title="新建笔记"
            >
                +
            </button>
            {activeNote && (
                <button 
                    onClick={() => handleDeleteNoteClick(activeNote)}
                    className="p-1 text-xs bg-red-500 hover:bg-red-600 text-white rounded shadow-sm transition-colors flex items-center justify-center w-6 h-6"
                    disabled={isLoadingNotes}
                    title="删除笔记"
                >
                    ×
                </button>
            )}
            
            {/* 笔记标题输入框 */}
            <input
                type="text"
                value={studioContentTitle || ''}
                onChange={(e) => setStudioContentTitle(e.target.value)}
                placeholder="输入笔记标题"
                className="flex-grow p-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                disabled={!activeNote}
            />
            
            {/* 保存按钮 - 调整高度与其他按钮一致 */}
            <button
                onClick={async () => {
                  if (tiptapApi && typeof tiptapApi.saveNotebook === 'function') {
                    try {
                      console.log('[NotebookLayout] Calling tiptapApi.saveNotebook()');
                      const success = await tiptapApi.saveNotebook();
                      if (success) {
                        // console.log('[NotebookLayout] saveNotebook returned true.');
                      } else {
                        // console.warn('[NotebookLayout] saveNotebook returned false or did not run.');
                      }
                    } catch (error) {
                      toast.error('调用保存方法时发生错误。');
                      console.error('[NotebookLayout] Error calling saveNotebook from button:', error);
                    }
                  } else {
                    toast.error('编辑器API或保存方法不可用，无法保存。');
                    console.error('[NotebookLayout] tiptapApi is null or saveNotebook is not a function. Current API:', tiptapApi);
                  }
                }}
                className="px-3 py-0.5 text-sm bg-[#10b981] hover:bg-[#0d9668] text-white rounded shadow-sm transition-colors"
                disabled={!activeNote || !tiptapApi}
            >
                保存
            </button>
          </div>
          {/* 错误提示浮动在右上角 */}
          {notesError && (
            <div className="absolute top-4 right-4 z-20 p-2 text-red-600 bg-red-100 text-sm rounded shadow">加载笔记时出错: {notesError}</div>
          )} 

           {/* 编辑器区域最大化填充 - 优化空间利用 */}
           <div 
             className="flex-grow min-h-0 overflow-hidden flex flex-col justify-stretch"
             style={{ height: '100%', padding: '0', margin: '0' }}
           >
             {isLoadingNotes ? (
               <div className="h-full flex items-center justify-center text-gray-500">加载中...</div>
             ) : isClient && activeNote ? (
               <TiptapNotebook
                // ref={notebookRef} // <--- Temporarily comment this out
                notebookId={notebookId} 
                  key={activeNote}
                  initialContent={studioContent || ''}
                  initialTitle={studioContentTitle || ''}
                  onSave={memoizedTiptapOnSave} 
                  onApiReady={handleApiReady}
                  style={{ height: '100%', minHeight: 0 }}
             />
             ) : (
               <div className="h-full flex items-center justify-center text-gray-500">
                 {isClient ? '请选择或创建一个笔记' : '编辑器加载中...'}
                </div>
             )}
           </div>
         </div>

        {/* Resizer for Chat Panel */}
        {!isChatMinimized && (
            <div 
             className="w-0.5 cursor-col-resize bg-transparent hover:bg-primary-dark rounded flex-shrink-0"
             onMouseDown={(e) => handleResizeStart(e, 'chat')}
           />
         )}

        {/* Chat Panel */}
        <div
           ref={chatPanelRef}
           className={`rounded-lg rounded-tr-lg shadow border max-h-full overflow-hidden flex flex-col flex-shrink-0 bg-chat-panel border-primary ${isChatMinimized ? 'transition-all duration-300 ease-in-out' : ''}`}
           style={{ flexBasis: `${chatWidth}%` }}
         >
           <div className={`p-1 flex justify-between items-center ${isChatMinimized ? 'flex-col' : ''} bg-[#e8b9b9]`}> {/* 更高饱和度的淡粉色 */}
              {!isChatMinimized && (
               <h2 className="font-medium text-lg text-gray-800">
                 AI文档解析
               </h2>
             )}
             <div className="flex items-center space-x-1">
                {!isChatMinimized && (
                   <button 
                     onClick={toggleUseAllDocuments}
                     className={`px-2 py-0.5 text-xs rounded ${ 
                       useAllDocuments 
                         ? 'bg-purple-100 text-purple-700'
                         : 'bg-zinc-200 text-zinc-600'
                     }`}
                     title={useAllDocuments ? "使用所有文档" : "仅使用选中文档"}
                   >
                     {useAllDocuments ? "所有文档" : "选中文档"}
                   </button>
                )}
               <button 
                 onClick={toggleChatPanel}
                 className="p-1 rounded hover:bg-teal-100"
                 title={isChatMinimized ? "展开聊天面板" : "收起聊天面板"}
               >
                 {isChatMinimized ? (
                    <ChevronDoubleLeftIcon className="h-5 w-5 text-gray-600" />
                 ) : (
                    <ChevronDoubleRightIcon className="h-5 w-5 text-gray-600" />
                 )}
               </button>
             </div>
           </div>
           
           {!isChatMinimized && (
             <div className="flex-grow flex flex-col min-h-0 overflow-hidden">
               {!useAllDocuments && selectedChatDocuments.length > 0 && (
                 <div className="px-1 py-0.5 bg-[#f0c0c0]"> {/* 稍浅一点的淡粉色 */}
                   <div className="text-xs text-gray-500 mb-0.5">已选择的文档:</div>
                   <div className="flex flex-wrap gap-0.5">
                     {selectedChatDocuments.map(doc => (
                       <div 
                         key={doc.id}
                         className="flex items-center bg-purple-100 text-purple-600 text-xs px-1 py-0.5 rounded"
                       >
                         <span className="truncate max-w-[150px]">{doc.fileName}</span>
                         <button 
                           onClick={() => handleToggleChatSelection(doc)} 
                           className="ml-1 text-purple-400 hover:text-purple-600"
                           title="从聊天选择中移除"
                         >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3 h-3">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                         </button>
                       </div>
                     ))}
                   </div>
                 </div>
               )}
               
               <div className="flex-grow overflow-y-auto min-h-0 p-0.5">
                 <ChatInterface 
                   ref={chatRef}
                   notebookId={currentNotebook?.id || notebookId || ''}
                   documents={useAllDocuments ? (documents || []) : selectedChatDocuments}
                   messages={[]}
                   onSendMessage={handleSendMessage}
                   onPreviewDocument={handleChatPreview}
                   // tldrawBoardRef={notebookRef} // <--- Temporarily comment this out
                 />
               </div>
             </div>
           )}
         </div>

        {/* Render the Preview Modal Conditionally */}
        <DocumentPreviewModal 
          isOpen={isPreviewModalOpen}
          onClose={closePreviewModal}
          document={documentToPreview}
          content={previewModalContent}
          position={previewPosition}
        />

        {/* Settings Dialog */}
        <SettingsDialog 
          isOpen={isSettingsModalOpen}
          onClose={closeSettingsModal}
        />

        {/* Rename Notebook Modal */}
        {currentNotebook && (
          <RenameNotebookModal 
            isOpen={showRenameModal}
            onClose={() => setShowRenameModal(false)}
            notebook={currentNotebook}
            onRenameSuccess={handleRenameSuccess}
          />
        )}

        {/* Delete Note Confirm Modal */}
        <ConfirmModal
          isOpen={showDeleteConfirm}
          onConfirm={handleConfirmDeleteNote}
          onClose={handleCancelDeleteNote}
          title="删除笔记"
          message={`确定要删除笔记 "${noteToDelete?.title}" 吗？`}
        />
      </div>
    </>
  );
}