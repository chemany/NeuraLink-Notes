'use client'; // <--- 添加 "use client" 指令

import React, { createContext, useState, useEffect, useContext, useCallback, useMemo, ReactNode } from 'react';
import { useRouter } from 'next/navigation'; // <--- 更改导入
import { Document, Notebook, Folder, WhiteboardContent, Note, NotePadNote } from '@/types'; // Use local types
import { DocumentStatus } from '@/types/shared_local';
import {
    fetchDocumentsByNotebookId,
    fetchDocumentById, // Ensure fetchDocumentById is imported if used by addDocumentToChat
    deleteDocumentFromApi,
} from '@/services/documentService';
import { createNotebook as createNotebookApi, getAllNotebooks as fetchNotebooksApi, updateNotebookTitle as updateNotebookApi, deleteNotebook as deleteNotebookApi, updateNotebook as updateNotebookGenericApi } from '@/services/notebookService'; // Import the new API function
import { getNotesByNotebookId as getNotePadNotesApi, createNoteInNotebook as createNotePadNoteApi, updateNote as updateNotePadNoteApi, deleteNote as deleteNotePadNoteApi } from '@/services/notePadService';
import { createFolderApi, getFoldersApi, updateFolderApi, deleteFolderApi } from '@/services/folderService';
import { toast } from 'react-hot-toast';
import {
    fetchRichNotesByNotebookId,
    createRichNoteApi,
    updateRichNoteApi,
    deleteRichNoteApi
} from '@/services/richNoteService';
import { useAuth } from './AuthContext'; // <--- 导入 useAuth

// Helper function to check if running in browser
const isBrowser = typeof window !== 'undefined';

// Define the shape of the context data
interface NotebookContextType {
  notebooks: Notebook[];
  currentNotebook: Notebook | null;
  folders: Folder[];
  whiteboardContents: Record<string, WhiteboardContent>;
  documents: Document[];
  currentDocuments: Document[];
  isLoadingDocuments: boolean;
  documentError: string | null;
  isLoadingNotebooks: boolean;
  notebooksError: string | null;
  isCreatingNotebook: boolean;
  createNotebookError: string | null;
  isInitialized: boolean;

  // Rich Text Note states
  currentNotes: Note[]; // Note type is now the rich text one
  isLoadingNotes: boolean;
  notesError: string | null;

  // Methods
  setCurrentNotebookById: (id: string | null) => void;
  setCurrentNotebookByName: (name: string | null) => void;
  setCurrentNotebookByFolderAndName: (folderName: string, notebookName: string) => void;
  createNotebook: (title: string, folderId?: string) => Promise<Notebook | null>;
  deleteNotebook: (id: string) => void;
  updateNotebookTitle: (id: string, newTitle: string) => Promise<Notebook>;
  addDocumentToChat: (docId: string) => Promise<Document | null>;
  deleteDocument: (docId: string) => Promise<void>;
  refetchDocuments: () => void;
  refreshAllNotebooksDocuments: () => void;
  refreshNotebooks: () => void;

  // Folder Methods
  createFolder: (name: string) => Promise<Folder>;
  deleteFolder: (id: string) => Promise<void>;
  updateFolder: (id: string, name: string) => Promise<void>;

  // Rich Text Note Methods - Updated signatures
  fetchNotesForNotebook: (notebookId: string) => Promise<void>;
  createNote: (
    notebookId: string,
    data: { title?: string | null; contentJson?: Record<string, any> | null; contentHtml?: string | null }
  ) => Promise<Note | null>;
  updateNote: (
    notebookId: string,
    noteId: string,
    updates: Partial<{ title?: string | null; contentJson?: Record<string, any> | null; contentHtml?: string | null }>
  ) => Promise<Note | null>;
  deleteNote: (notebookId: string, noteId: string) => Promise<void>;

  // NotePad Methods (Kept for simple notes if still used)
  createNotePadNote: (notebookId: string, note: Omit<NotePadNote, 'id' | 'createdAt'>) => Promise<NotePadNote>;
  updateNotePadNote: (notebookId: string, noteId: string, updates: Partial<NotePadNote>) => Promise<void>;
  deleteNotePadNote: (notebookId: string, noteId: string) => Promise<void>;
  getNotePadNotes: (notebookId: string) => Promise<NotePadNote[]>;

  // Whiteboard Methods
  saveWhiteboardContent: (notebookId: string, content: WhiteboardContent) => void;
  getWhiteboardContent: (notebookId: string) => WhiteboardContent | undefined;

  // New methods
  updateNotebookFolder: (notebookId: string, folderId: string | null) => Promise<Notebook | null>;
  updateNotebookNotes: (notebookId: string, notes: string) => Promise<Notebook | null>;
}

// Create the context
const NotebookContext = createContext<NotebookContextType | undefined>(undefined);


// Provider component
export const NotebookProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [currentNotebook, setCurrentNotebookState] = useState<Notebook | null>(null);
  const [folders, setFolders] = useState<Folder[]>([]); // Keep if used
  const [whiteboardContents, setWhiteboardContents] = useState<Record<string, WhiteboardContent>>({}); // Keep if used
  const [documents, setDocuments] = useState<Document[]>([]); // All docs for current notebook
  const [currentDocuments, setCurrentDocuments] = useState<Document[]>([]); // Specific docs used in chat?
  const [isLoadingDocuments, setIsLoadingDocuments] = useState<boolean>(false);
  const [documentError, setDocumentError] = useState<string | null>(null);
  const [isLoadingNotebooks, setIsLoadingNotebooks] = useState<boolean>(false); // 修改初始值为 false，由 Auth 状态驱动
  const [notebooksError, setNotebooksError] = useState<string | null>(null);
  const [isCreatingNotebook, setIsCreatingNotebook] = useState<boolean>(false); // Init new state
  const [createNotebookError, setCreateNotebookError] = useState<string | null>(null); // Init new state
  const [isDeletingNotebook, setIsDeletingNotebook] = useState<string | null>(null);
  const [deletedNotebooks, setDeletedNotebooks] = useState<Set<string>>(new Set()); // 已删除的笔记本ID缓存 // 记录正在删除的笔记本ID
  const [isInitialized, setIsInitialized] = useState<boolean>(false); // Keep if used

  // Rich Text Note states
  const [currentNotes, setCurrentNotes] = useState<Note[]>([]);
  const [isLoadingNotes, setIsLoadingNotes] = useState<boolean>(false);
  const [notesError, setNotesError] = useState<string | null>(null);

  const router = useRouter();
  const { isAuthenticated, isLoading: isAuthLoading, token, user } = useAuth(); // <--- 使用 AuthContext

    // Effect for initial loading, dependent on authentication status
  useEffect(() => {
    const loadInitialData = async () => {
      // 只在 AuthContext 加载完毕且用户已认证的情况下加载数据
      if (isBrowser && !isAuthLoading && isAuthenticated && token) {
        // console.log('[NotebookContext] Auth confirmed with token, starting initial data load...');
        setIsLoadingNotebooks(true);
        setNotebooksError(null);
        try {
          // 延迟一小段时间确保 apiClient 拦截器能获取到最新的 token
          await new Promise(resolve => setTimeout(resolve, 100));
          
          const initialNotebooks = await fetchNotebooksApi();
          // console.log(`[NotebookContext] Fetched notebooks data from API:`, initialNotebooks);
          setNotebooks(initialNotebooks);

          const initialFolders = await getFoldersApi();
          setFolders(initialFolders);
          // console.log(`[NotebookContext] Initial folders loaded from API: ${initialFolders.length}`);

          setIsInitialized(true);
          // console.log('[NotebookContext] Initial load complete from API.');
        } catch (error) {
          console.error('[NotebookContext] Error during initial API load:', error);
          const message = error instanceof Error ? error.message : 'Failed to load initial data from server.';
          setNotebooksError(message);
          // 清空数据以避免显示过时或错误的数据
          setNotebooks([]);
          setFolders([]);
          setIsInitialized(false);
        } finally {
          setIsLoadingNotebooks(false);
        }
      } else if (isBrowser && !isAuthLoading && !isAuthenticated) {
        // 用户未认证 (且 AuthContext 已加载完毕)
        // console.log('[NotebookContext] User not authenticated. Clearing notebooks and folders.');
        setNotebooks([]);
        setFolders([]);
        setCurrentNotebookState(null);
        setDocuments([]);
        setCurrentNotes([]);
        setIsInitialized(true); // 设置为 true，表示"已初始化，但用户未认证，无数据"
        setIsLoadingNotebooks(false); // 确保 loading 状态被重置
      }
    };

    loadInitialData();
  }, [isAuthenticated, isAuthLoading, token]); // <--- 依赖于 AuthContext 的状态，token 也加入以确保 apiClient 使用最新的 token

  const fetchDocsForNotebook = useCallback(async (notebookId: string | null) => {
    console.log(`[NotebookContext] fetchDocsForNotebook called with notebookId: ${notebookId}, isAuthenticated: ${isAuthenticated}`);
    if (!notebookId) {
          setDocuments([]);
          setCurrentDocuments([]);
          console.log('[NotebookContext] Cleared documents because notebookId is null.');
      return;
    }
      console.log(`[NotebookContext] Fetching documents for notebook: ${notebookId}...`);
      setIsLoadingDocuments(true);
      setDocumentError(null);
      try {
          console.log(`[NotebookContext] Calling fetchDocumentsByNotebookId(${notebookId})`);
          const fetchedDocs = await fetchDocumentsByNotebookId(notebookId);
          console.log(`[NotebookContext] fetchDocumentsByNotebookId returned:`, fetchedDocs);
          setDocuments(fetchedDocs);
          console.log(`[NotebookContext] Successfully fetched and set ${fetchedDocs.length} documents.`);
    } catch (error) {
          console.error(`[NotebookContext] Error fetching documents for notebook ${notebookId}:`, error);
          const message = error instanceof Error ? error.message : 'Failed to load documents';
          setDocumentError(message);
      } finally {
          console.log(`[NotebookContext] Setting isLoadingDocuments to false for notebook ${notebookId}.`);
          setIsLoadingDocuments(false);
      }
  }, []); // 移除所有依赖项，避免无限循环

  useEffect(() => {
      if (currentNotebook?.id && currentNotebook.id.trim() !== '') {
        console.log(`[NotebookContext] useEffect triggering fetchDocsForNotebook for: ${currentNotebook.id}`);
        fetchDocsForNotebook(currentNotebook.id);
      } else {
        console.log(`[NotebookContext] Invalid currentNotebook.id: ${currentNotebook?.id}, skipping fetchDocsForNotebook`);
      }
  }, [currentNotebook?.id, fetchDocsForNotebook]); // 保持必要的依赖项


  const fetchNotesForNotebook = useCallback(async (notebookId: string | null) => {
    console.log(`[NotebookContext] fetchNotesForNotebook called with notebookId: ${notebookId}, isAuthenticated: ${isAuthenticated}`);
    if (!notebookId) {
      setCurrentNotes([]);
      console.log('[NotebookContext] Cleared notes because notebookId is null.');
      return;
    }
    console.log(`[NotebookContext] Fetching notes for notebook: ${notebookId}...`);
    setIsLoadingNotes(true);
    setNotesError(null);
    try {
      const fetchedNotes = await fetchRichNotesByNotebookId(notebookId);
      fetchedNotes.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      setCurrentNotes(fetchedNotes);
      console.log(`[NotebookContext] Successfully fetched and set ${fetchedNotes.length} rich notes.`);
    } catch (error) {
      console.error(`[NotebookContext] Error fetching rich notes for notebook ${notebookId}:`, error);
      const message = error instanceof Error ? error.message : 'Failed to load rich notes';
      setNotesError(message);
      setCurrentNotes([]);
    } finally {
      setIsLoadingNotes(false);
    }
  }, []); // 移除所有依赖项，避免无限循环

  useEffect(() => {
    if (currentNotebook?.id && currentNotebook.id.trim() !== '') {
      console.log(`[NotebookContext] useEffect triggering fetchNotesForNotebook for: ${currentNotebook.id}`);
      fetchNotesForNotebook(currentNotebook.id);
    } else {
      console.log(`[NotebookContext] Invalid currentNotebook.id: ${currentNotebook?.id}, skipping fetchNotesForNotebook`);
    }
  }, [currentNotebook?.id, fetchNotesForNotebook]); // 保持必要的依赖项


  const createNotebook = useCallback(async (title: string, folderId?: string): Promise<Notebook | null> => {
      if (!isAuthenticated) { 
        // setCreateNotebookError("User not authenticated."); // This state's utility might need review
        toast.error("请登录后创建笔记本。"); 
        return null;
      }
      if (!title.trim()) {
        // setCreateNotebookError("Notebook title cannot be empty."); // This state's utility might need review
        toast.error("笔记本标题不能为空。"); // <--- Ensured toast for empty title
        return null;
      }
    // console.log(`[NotebookContext] Attempting to create notebook: \"${title}\" ${folderId ? `in folder ${folderId}` : ''}`);
    setIsCreatingNotebook(true);
    // setCreateNotebookError(null); // If the above states are not directly displayed, no need to clear here

    try {
      const newNotebook = await createNotebookApi(title, folderId || undefined, token || '');
      setNotebooks((prevNotebooks) => [newNotebook, ...prevNotebooks]);
      setCurrentNotebookState(newNotebook);
      // router.push(`/notebooks/${newNotebook.id}`); // Navigation can be handled by the caller if needed, or kept here
      // console.log('[NotebookContext] Successfully created notebook via API:', newNotebook);
      return newNotebook;
    } catch (error) {
      console.error('[NotebookContext] Error creating notebook via API:', error);
      const message = error instanceof Error ? error.message : 'Failed to create notebook.';
      // setCreateNotebookError(message); // This state's utility might need review
      toast.error(`创建笔记本失败: ${message}`);
      return null;
    } finally {
      setIsCreatingNotebook(false);
    }
  }, [isAuthenticated, token]); // Removed router from dependencies as it was not used

  const deleteNotebook = useCallback(async (id: string) => {
    if (!isAuthenticated || !token) {
      toast.error("请登录后删除笔记本。");
      return;
    }

    // 防止重复删除 - 更严格的检查
    if (isDeletingNotebook === id) {
      console.log(`[NotebookContext] Already deleting notebook: ${id}, ignoring duplicate request`);
      return;
    }

    // 检查是否已经删除过
    if (deletedNotebooks.has(id)) {
      console.log(`[NotebookContext] Notebook ${id} already deleted, ignoring request`);
      toast.error("笔记本已被删除");
      return;
    }

    // 检查笔记本是否还存在于本地状态中
    const notebookToDelete = notebooks.find(nb => nb.id === id);
    if (!notebookToDelete) {
      console.log(`[NotebookContext] Notebook ${id} not found in local state, may already be deleted`);
      toast.error("笔记本不存在或已被删除");
      return;
    }

    console.log(`[NotebookContext] 开始删除笔记本: ${notebookToDelete.displayPath || notebookToDelete.title} (ID: ${id})`);
    setIsDeletingNotebook(id); // 设置删除状态

    const titleToDelete = notebookToDelete?.title || id;

    // 构建更友好的显示路径
    let displayPath = titleToDelete;
    if (notebookToDelete?.displayPath) {
      displayPath = notebookToDelete.displayPath;
    } else {
      // 如果没有displayPath，手动构建一个友好的路径
      const ownerName = notebookToDelete?.ownerName || user?.email?.split('@')[0] || '用户';

      // 尝试获取文件夹名称
      let folderName = 'default';
      if (notebookToDelete?.folderId && folders) {
        const folder = folders.find(f => f.id === notebookToDelete.folderId);
        folderName = folder?.name || 'default';
      }

      displayPath = `${ownerName}/${folderName}/${titleToDelete}`;
    }

    toast.loading(`正在删除笔记本 "${displayPath}"...`, { id: 'delete-notebook-toast' });

    try {
      // 使用我们的 deleteNotebook API 函数，传递正确的参数
      await deleteNotebookApi(id, token);

      // 立即从本地状态中移除，防止重复删除
      setNotebooks(prev => {
        const filtered = prev.filter(n => n.id !== id);
        console.log(`[NotebookContext] 从本地状态移除笔记本，剩余 ${filtered.length} 个`);
        return filtered;
      });

      // 添加到已删除缓存
      setDeletedNotebooks(prev => new Set([...prev, id]));

      // 立即重置删除状态，防止重复请求
      setIsDeletingNotebook(null);

      toast.success(`笔记本 "${displayPath}" 已删除`, { id: 'delete-notebook-toast' });

      // If the deleted notebook was the current one, reset and navigate home
      if (currentNotebook?.id === id) {
        setCurrentNotebookState(null);
        router.push('/');
      }
      console.log(`[NotebookContext] 成功删除笔记本: ${displayPath}`);
    } catch (error) {
      console.error(`[NotebookContext] 删除笔记本失败 ${displayPath}:`, error);
      toast.error(`删除笔记本 "${displayPath}" 失败: ${error instanceof Error ? error.message : '未知错误'}`, { id: 'delete-notebook-toast' });
      // 只有在失败时才重置删除状态
      setIsDeletingNotebook(null);
    }
  }, [notebooks, currentNotebook, router, isAuthenticated, token, isDeletingNotebook]); // Add dependencies

  const updateNotebookTitle = useCallback(async (id: string, newTitle: string): Promise<Notebook> => {
    if (!isAuthenticated || !token) {
      toast.error("请登录后更新笔记本。");
      throw new Error("User not authenticated.");
    }
    console.log(`[NotebookContext] 更新笔记本 ${id} 的标题为: ${newTitle}`);
    try {
      // 修复API调用，传递正确的参数
      const updatedNotebook = await updateNotebookApi(id, newTitle, token);
      // 更新本地状态
      setNotebooks(prev => prev.map(n => n.id === id ? { ...n, title: newTitle, updatedAt: new Date().toISOString() } : n));
      // 如果当前笔记本就是被修改的笔记本，也要更新当前笔记本状态
      if (currentNotebook?.id === id) {
        setCurrentNotebookState(prev => prev ? { ...prev, title: newTitle, updatedAt: new Date().toISOString() } : null);
      }
      toast.success(`笔记本标题已更新为"${newTitle}"`);
      return updatedNotebook;
    } catch (error) {
      console.error('[NotebookContext] 更新笔记本标题失败:', error);
      toast.error('更新笔记本标题失败: ' + (error instanceof Error ? error.message : '未知错误'));
      throw error;
    }
  }, [currentNotebook?.id, isAuthenticated, token]);

  const setCurrentNotebookById = useCallback((id: string | null) => {
    console.log(`[NotebookContext] Setting current notebook by ID: ${id}`);
    if (id === null) {
        setCurrentNotebookState(null);
        router.push('/'); // Navigate home if notebook is deselected
    } else {
        // Log the IDs currently in the state *before* trying to find
        console.log(`[NotebookContext] Notebooks currently in state:`, notebooks.map(n => n.id)); 
        const notebookToSet = notebooks.find(n => n.id === id);
        if (notebookToSet) {
            setCurrentNotebookState(notebookToSet);
            // REMOVED: fetchDocsForNotebook(id); // Let the useEffect handle this
            // Optionally navigate here too, though often navigation triggers this call
            // router.push(`/notebooks/${id}`);
        } else {
            console.warn(`[NotebookContext] Notebook with ID ${id} not found in state.`);
            // Optionally navigate away or show an error
            // router.push('/');
        }
    }
  }, [notebooks, router]); // Dependencies: notebooks list and router

  const setCurrentNotebookByName = useCallback((name: string | null) => {
    console.log(`[NotebookContext] Setting current notebook by name: ${name}, isAuthenticated: ${isAuthenticated}, notebooks.length: ${notebooks.length}`);
    if (name === null) {
        setCurrentNotebookState(null);
        router.push('/'); // Navigate home if notebook is deselected
    } else {
        // 如果用户未认证，不要尝试设置笔记本
        if (!isAuthenticated) {
            console.log(`[NotebookContext] User not authenticated, cannot set notebook by name`);
            return;
        }

        // Log the names currently in the state *before* trying to find
        console.log(`[NotebookContext] Notebooks currently in state:`, notebooks.map(n => n.title));
        const notebookToSet = notebooks.find(n => n.title === name);
        if (notebookToSet) {
            console.log(`[NotebookContext] Found notebook by name "${name}":`, notebookToSet);
            setCurrentNotebookState(notebookToSet);
        } else {
            console.warn(`[NotebookContext] Notebook with name "${name}" not found in current state.`);
            console.log(`[NotebookContext] Available notebooks:`, notebooks.map(n => ({ id: n.id, title: n.title })));
            // 如果笔记本列表为空，可能还在加载中，不要立即导航走
            if (notebooks.length === 0) {
                console.log(`[NotebookContext] Notebooks list is empty, might still be loading...`);
            }
        }
    }
  }, [notebooks, router, isAuthenticated]); // Dependencies: notebooks list, router, and authentication

  const setCurrentNotebookByFolderAndName = useCallback((folderName: string, notebookName: string) => {
    console.log(`[NotebookContext] Setting current notebook by folder and name: ${folderName}/${notebookName}, isAuthenticated: ${isAuthenticated}, notebooks.length: ${notebooks.length}`);

    // 如果用户未认证，不要尝试设置笔记本
    if (!isAuthenticated) {
        console.log(`[NotebookContext] User not authenticated, cannot set notebook by folder and name`);
        return;
    }

    // 根据文件夹名称和笔记本名称查找笔记本
    // 首先需要找到对应的文件夹ID
    let targetFolderId: string | null = null;

    if (folderName === 'default') {
        // 默认文件夹，folderId 为 null
        targetFolderId = null;
    } else {
        // 查找对应的文件夹
        const folder = folders.find(f => f.name === folderName);
        if (folder) {
            targetFolderId = folder.id;
        } else {
            console.warn(`[NotebookContext] Folder with name "${folderName}" not found`);
            return;
        }
    }

    // 查找在指定文件夹中的笔记本
    const notebookToSet = notebooks.find(nb =>
        nb.title === notebookName &&
        (nb.folderId === targetFolderId || (targetFolderId === null && !nb.folderId))
    );

    if (notebookToSet) {
        console.log(`[NotebookContext] Found notebook by folder and name "${folderName}/${notebookName}":`, notebookToSet);
        setCurrentNotebookState(notebookToSet);
    } else {
        console.warn(`[NotebookContext] Notebook with name "${notebookName}" not found in folder "${folderName}"`);
        console.log(`[NotebookContext] Available notebooks:`, notebooks.map(n => ({
            id: n.id,
            title: n.title,
            folderId: n.folderId
        })));
        console.log(`[NotebookContext] Available folders:`, folders.map(f => ({
            id: f.id,
            name: f.name
        })));
    }
  }, [notebooks, folders, isAuthenticated]); // Dependencies: notebooks list, folders list, and authentication

  // --- Existing API-Integrated Document Functions (Keep as is) ---
  const addDocumentToChat = useCallback(async (docId: string): Promise<Document | null> => {
    console.log(`[NotebookContext] Adding document ${docId} to chat context.`);
    // Existing logic likely uses fetchDocumentById or similar
    try {
        const doc = await fetchDocumentById(docId); // Assuming this service function exists and works
        if (doc) {
            // Logic to handle the fetched document (e.g., add to a 'current documents' state)
            console.log("[NotebookContext] Fetched document details:", doc);
            // Example: Add to currentDocuments if not already present
            setCurrentDocuments(prev => {
                if (prev.find(d => d.id === docId)) return prev;
                return [...prev, doc];
            });
            return doc;
        }
    } catch (error) {
        console.error(`[NotebookContext] Error fetching document ${docId} details:`, error);
    }
    return null;
  }, []); // Add dependencies if needed

  const deleteDocument = useCallback(async (docId: string): Promise<void> => {
    if (!currentNotebook) {
        console.error("[NotebookContext] Cannot delete document without a current notebook.");
        return;
    }
    console.log(`[NotebookContext] Attempting to delete document: ${docId} from notebook ${currentNotebook.id}`);
    try {
        await deleteDocumentFromApi(docId); // Uses service call
        console.log(`[NotebookContext] Successfully deleted document ${docId} via API.`);
        // Update documents state for the current notebook
        setDocuments(prevDocs => prevDocs.filter(doc => doc.id !== docId));
        // Also update currentDocuments if the deleted doc was there
        setCurrentDocuments(prev => prev.filter(d => d.id !== docId));

        // 添加删除后同步到云端的操作
        // const configs = await syncService.getAllConfigs();
        // const activeConfig = configs.find(c => c.isActive);
        // if (activeConfig?.id) {
        //     toast.loading("正在同步文档删除操作到云端...", { id: 'sync-doc-delete-toast' });
        //     const syncResult = await syncService.syncToCloud(activeConfig.id);
        //     if (syncResult.success) {
        //         toast.success("文档删除操作已同步到云端", { id: 'sync-doc-delete-toast' });
        //     } else {
        //         toast.error(`同步文档删除操作失败: ${syncResult.message}`, { id: 'sync-doc-delete-toast' });
        //     }
        // } catch (syncError) {
        //     console.error('[NotebookContext] Error syncing document deletion to cloud:', syncError);
        //     toast.error("同步文档删除操作到云端失败", { id: 'sync-doc-delete-toast' });
        // }
    } catch (error) {
        console.error(`[NotebookContext] Failed to delete document ${docId}:`, error);
        // Optionally set an error state or show a toast
    }
}, [currentNotebook]); // Dependency on currentNotebook

   // --- Placeholder Folder/Note/Whiteboard Methods (Keep structure, TODO: API calls) ---
    const createFolder = useCallback(async (name: string): Promise<Folder> => {
        if (!isAuthenticated) {
          toast.error("Please login to create a folder.");
          throw new Error("User not authenticated.");
        }
        if (!name.trim()) {
          throw new Error("Folder name cannot be empty.");
        }
        console.log(`[NotebookContext] Creating folder: "${name}"`);
        // 对于会抛出错误的操作，可以不设置 loading/error state 在 context 中，让调用组件处理
        try {
          const newFolder = await createFolderApi(name);
          setFolders((prevFolders) => [newFolder, ...prevFolders]);
          toast.success(`Folder "${name}" created!`);
          return newFolder;
        } catch (error) {
          console.error('[NotebookContext] Failed to create folder:', error);
          const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
          toast.error(`Failed to create folder: ${errorMessage}`);
          throw error; // Re-throw để调用方可以处理
        }
    }, [isAuthenticated, token]); // <--- 增加 isAuthenticated, token 依赖

    const deleteFolder = useCallback(async (id: string): Promise<void> => {
        if (!isAuthenticated) { // <--- 增加 isAuthenticated 检查
          toast.error("Please login to delete a folder.");
          return;
        }
        // console.log(`[NotebookContext] Attempting to delete folder: ${id}`);
        try {
          await deleteFolderApi(id);
          setFolders(prevFolders => prevFolders.filter(folder => folder.id !== id));
          // If the deleted folder was associated with the current notebook, clear that association
          if (currentNotebook?.folderId === id) {
            setCurrentNotebookState(prev => prev ? { ...prev, folderId: null } : null);
            // Optionally, you might want to update the notebook on the backend too if it's open
            // updateNotebookApi(currentNotebook.id, { folderId: null }); // Example
          }
          // console.log(`[NotebookContext] Successfully deleted folder ${id}`);
        } catch (error) {
          console.error('[NotebookContext] Error deleting folder:', error);
          if (error instanceof Error) {
            const specificApiErrorPrefix = "API Error in deleteFolderApi: ";
            const specificApiErrorSuffix = " (Status: 400)"; // Assuming 400 for this specific error
            const coreUserMessage = "文件夹包含笔记本，无法删除。请先移动或删除其中的笔记本。";

            if (error.message.startsWith(specificApiErrorPrefix) && 
                error.message.endsWith(specificApiErrorSuffix) && 
                error.message.includes(coreUserMessage)) {
              
              const startIndex = specificApiErrorPrefix.length;
              const endIndex = error.message.length - specificApiErrorSuffix.length;
              const extractedMessage = error.message.substring(startIndex, endIndex).trim();
              toast.error(extractedMessage); // Display the extracted user-friendly message
              // This specific error is now handled, so we don't re-throw it.
            } else if (error.message.includes(coreUserMessage)) {
                // Fallback if the exact prefix/suffix doesn't match but core message is there
                toast.error(coreUserMessage);
            } else {
              // For other types of errors, keep the alert and re-throw for now.
              // This alert can be removed if other errors are expected to be caught by NotebookList or a global handler.
              alert(`Error in NotebookContext (will re-throw): ${error.message}`); 
              throw error; 
            }
          } else {
            // For non-Error instances (should be rare with how apiClient is structured)
            alert('Unknown error in NotebookContext (will re-throw).'); 
            throw error;
          }
        }
    }, [isAuthenticated, token, currentNotebook?.folderId, currentNotebook?.id]); // <--- 增加 isAuthenticated, token, currentNotebook dependencies

     const updateFolder = useCallback(async (id: string, name: string): Promise<void> => {
        console.log(`[NotebookContext] Updating folder ${id} with name: ${name}`);
        try {
            const updatedFolder = await updateFolderApi(id, name);
            setFolders(prev => prev.map(f => f.id === id ? updatedFolder : f));
        } catch (error) {
            console.error('[NotebookContext] Error updating folder:', error);
            throw error;
        }
    }, []);

    // --- Placeholder Note Methods ---
    const createNote = useCallback(async (
      notebookId: string,
      data: { title?: string | null; contentJson?: Record<string, any> | null; contentHtml?: string | null }
    ): Promise<Note | null> => {
        console.log(`[NotebookContext] Creating rich note in notebook ${notebookId}`);
        if (!notebookId) {
            toast.error("Notebook ID is missing for creating a note.");
            return null;
        }
        if (!isAuthenticated) {
            toast.error("Please login to create a note.");
            return null;
        }
        try {
          // 直接将 data (包含对象类型的 contentJson) 传递给 API 函数
          const newNote = await createRichNoteApi(notebookId, data);
          setCurrentNotes(prev => [newNote, ...prev].sort((a,b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()));
          toast.success(`笔记 "${newNote.title || '未命名'}" 已创建!`);
         return newNote;
        } catch (error) {
          console.error('[NotebookContext] Failed to create rich note:', error);
          toast.error(`创建笔记失败: ${error instanceof Error ? error.message : '未知错误'}`);
          return null;
        }
    }, [isAuthenticated, token]);

    const updateNote = useCallback(async (
      notebookId: string,
      noteId: string,
      updates: Partial<{ title?: string | null; contentJson?: Record<string, any> | null; contentHtml?: string | null }>
    ): Promise<Note | null> => {
        console.log(`[NotebookContext] Updating rich note ${noteId} in notebook ${notebookId}`);
        if (!isAuthenticated) {
            toast.error("Please login to update a note.");
            return null;
        }
        
        // 调试日志，可以保留或移除
        if (updates && typeof updates.contentJson === 'object' && updates.contentJson !== null) {
            console.log('[NotebookContext] updates.contentJson is an object. Keys:', Object.keys(updates.contentJson));
        } else {
            console.log('[NotebookContext] updates.contentJson is not an object or is undefined/null. Value:', updates.contentJson);
        }

        try {
          // 直接将 updates (包含对象类型的 contentJson) 传递给 API 函数
          // API 服务函数 (updateRichNoteApi) 内部会处理 stringify
          const updatedNote = await updateRichNoteApi(notebookId, noteId, updates);
          setCurrentNotes(prev => prev.map(n => n.id === noteId ? updatedNote : n)
                                      .sort((a,b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()));
          return updatedNote;
        } catch (error) {
          console.error(`[NotebookContext] Failed to update rich note ${noteId}:`, error);
          toast.error(`更新笔记失败: ${error instanceof Error ? error.message : '未知错误'}`);
          return null;
        }
    }, [isAuthenticated, token]);

    const deleteNote = useCallback(async (notebookId: string, noteId: string): Promise<void> => {
        console.log(`[NotebookContext] Deleting rich note ${noteId} from notebook ${notebookId}`);
        const noteToDelete = currentNotes.find(n => n.id === noteId);
        const titleToDelete = noteToDelete?.title || '未命名笔记';

        setCurrentNotes(prev => prev.filter(n => n.id !== noteId));
        toast.loading(`正在删除笔记 "${titleToDelete}"...`, { id: `delete-note-${noteId}`});

        try {
          await deleteRichNoteApi(notebookId, noteId);
          toast.success(`笔记 "${titleToDelete}" 已删除!`, { id: `delete-note-${noteId}`});
        } catch (error) {
          console.error(`[NotebookContext] Failed to delete rich note ${noteId}:`, error);
          toast.error(`删除笔记 "${titleToDelete}" 失败: ${error instanceof Error ? error.message : '未知错误'}`, { id: `delete-note-${noteId}`});
          if (noteToDelete) { // Rollback optimistic update
            setCurrentNotes(prev => [...prev, noteToDelete].sort((a,b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()));
          }
        }
    }, [currentNotes]);

    // --- Placeholder NotePad Methods ---
    const createNotePadNote = useCallback(async (notebookId: string, note: Omit<NotePadNote, 'id' | 'createdAt'>): Promise<NotePadNote> => {
        console.log(`[NotebookContext] Creating simple note in notebook ${notebookId}`);
        if (!isAuthenticated || !token) {
            toast.error("请登录后创建便签。");
            throw new Error("User not authenticated.");
        }
        try {
            // NotePadNote不包含title字段，使用content作为内容
            const newNote = await createNotePadNoteApi(notebookId, '', note.content || '', token);
            // Potentially update a separate list for NotePadNotes if displayed
            return newNote;
        } catch (error) {
            console.error('[NotebookContext] Error creating simple note:', error);
            toast.error(`创建便签失败: ${error instanceof Error ? error.message : '未知错误'}`);
            throw error; // Or return null
        }
    }, [isAuthenticated, token]);

    const updateNotePadNote = useCallback(async (notebookId: string, noteId: string, updates: Partial<NotePadNote>): Promise<void> => {
        console.log(`[NotebookContext] Updating simple note ${noteId} in notebook ${notebookId}`);
        if (!isAuthenticated || !token) {
            toast.error("请登录后更新便签。");
            return;
        }
        try {
            // NotePadNote不包含title字段，使用空字符串作为title，content作为内容
            await updateNotePadNoteApi(notebookId, noteId, '', updates.content || '', token);
            // Potentially update a separate list for NotePadNotes
        } catch (error) {
            console.error('[NotebookContext] Error updating simple note:', error);
            toast.error(`更新便签失败: ${error instanceof Error ? error.message : '未知错误'}`);
            // throw error;
        }
    }, [isAuthenticated, token]);

    const deleteNotePadNote = useCallback(async (notebookId: string, noteId: string): Promise<void> => {
        console.log(`[NotebookContext] Deleting simple note ${noteId} from notebook ${notebookId}`);
        if (!isAuthenticated || !token) {
            toast.error("请登录后删除便签。");
            return;
        }
        try {
            await deleteNotePadNoteApi(notebookId, noteId, token);
             // Potentially update a separate list for NotePadNotes
        } catch (error) {
            console.error('[NotebookContext] Error deleting simple note:', error);
            toast.error(`删除便签失败: ${error instanceof Error ? error.message : '未知错误'}`);
            // throw error;
        }
    }, [isAuthenticated, token]);

    const getNotePadNotes = useCallback(async (notebookId: string): Promise<NotePadNote[]> => {
        console.log(`[NotebookContext] Fetching simple notes for notebook: "${notebookId}"`);

        // 更严格的检查
        if (!notebookId || notebookId.trim() === '' || notebookId === 'undefined' || notebookId === 'null') {
            console.warn(`[NotebookContext] getNotePadNotes: Invalid notebookId: "${notebookId}". Skipping fetch.`);
            return [];
        }

        if (!isAuthenticated || !token) {
            console.warn('[NotebookContext] getNotePadNotes: User not authenticated. Skipping fetch.');
            toast.error('用户未认证，无法获取便签列表。');
            return [];
        }

        try {
            // 再次验证 notebookId 在调用 API 之前
            if (!notebookId || notebookId.trim() === '') {
                console.error('[NotebookContext] getNotePadNotes: notebookId became empty before API call!');
                return [];
            }

            console.log(`[NotebookContext] Calling getNotePadNotesApi with notebookId: "${notebookId}" and token: ${token ? 'present' : 'missing'}`);
            const notes = await getNotePadNotesApi(notebookId, token);
            return notes;
        } catch (error) {
            console.error(`[NotebookContext] Error fetching simple notes for notebook "${notebookId}":`, error);
            toast.error(`获取便签列表失败: ${error instanceof Error ? error.message : '未知错误'}`);
            return [];
        }
    }, [isAuthenticated, token]);


    // --- Placeholder Whiteboard Methods ---
     const saveWhiteboardContent = useCallback((notebookId: string, content: WhiteboardContent) => {
        // TODO: Implement API call if whiteboard is stored server-side
        console.warn("saveWhiteboardContent called (placeholder)");
        // TODO: Update state after API call or keep localStorage logic
        setWhiteboardContents(prev => ({ ...prev, [notebookId]: content }));
        // saveWhiteboardToStorage({ ...whiteboardContents, [notebookId]: content }); // Keep if using localStorage
    }, [/* whiteboardContents */]); // Add dependencies

     const getWhiteboardContent = useCallback((notebookId: string): WhiteboardContent | undefined => {
        return whiteboardContents[notebookId];
  }, [whiteboardContents]);


    // --- Refetching Logic (Keep if used) ---
    const refetchDocuments = useCallback(() => {
        if (currentNotebook?.id) {
          fetchDocsForNotebook(currentNotebook.id);
        }
    }, [currentNotebook?.id, fetchDocsForNotebook]);

    const refreshAllNotebooksDocuments = useCallback(() => {
        refetchDocuments();
    }, [refetchDocuments]);
    
    // 添加刷新笔记本列表的方法
    const refreshNotebooks = useCallback(async () => {
        if (!isAuthenticated || !token) {
          console.log("[NotebookContext] 用户未认证，跳过刷新笔记本列表");
          return;
        }
        console.log("[NotebookContext] 刷新笔记本列表");
        try {
            const updatedNotebooks = await fetchNotebooksApi();
            setNotebooks(updatedNotebooks);
            console.log(`[NotebookContext] 成功获取 ${updatedNotebooks.length} 个笔记本`);
        } catch (error) {
            console.error("[NotebookContext] 刷新笔记本列表失败:", error);
            toast.error("刷新笔记本列表失败");
        }
    }, [isAuthenticated, token]);

  // 将updateNotebookFolder移到这里，在useMemo之前定义
  const updateNotebookFolder = useCallback(async (notebookId: string, folderId: string | null): Promise<Notebook | null> => {
    if (!isAuthenticated || !token) {
      toast.error("请登录后移动笔记本。");
      return null;
    }
    console.log(`[NotebookContext] Updating notebook ${notebookId} to folder ${folderId || 'root'}`);
    try {
      const updatedNotebook = await updateNotebookGenericApi(notebookId, { folderId }, token);
      
      // 更新状态
      setNotebooks((prev: Notebook[]) => prev.map((n: Notebook) => 
        n.id === notebookId ? { ...n, folderId } : n
      ));
      
      console.log(`[NotebookContext] Successfully updated notebook folder`, updatedNotebook);
      toast.success('笔记本已移动到新文件夹');
      return updatedNotebook;
    } catch (error) {
      console.error(`[NotebookContext] Failed to update notebook folder:`, error);
      toast.error('移动笔记本失败: ' + (error instanceof Error ? error.message : '未知错误'));
      return null;
    }
  }, [isAuthenticated, token]);

  const updateNotebookNotes = useCallback(async (notebookId: string, notes: string): Promise<Notebook | null> => {
    if (!isAuthenticated || !token) {
      toast.error("请登录后保存笔记。");
      return null;
    }
    console.log(`[NotebookContext] Saving notes for notebook ${notebookId}`);
    try {
      const updatedNotebook = await updateNotebookGenericApi(notebookId, { notes }, token);
      
      // 更新状态
      setNotebooks(prev => prev.map(n => n.id === notebookId ? { ...n, updatedAt: new Date().toISOString() } : n));
      if (currentNotebook?.id === notebookId) {
        setCurrentNotebookState(prev => prev ? { ...prev, updatedAt: new Date().toISOString() } : null);
      }
      
      console.log(`[NotebookContext] Successfully updated notebook notes`);
      toast.success('笔记已保存');
      return updatedNotebook;
    } catch (error) {
      console.error(`[NotebookContext] Failed to update notebook notes for ${notebookId}:`, error);
      toast.error('保存笔记失败: ' + (error instanceof Error ? error.message : '未知错误'));
      return null;
    }
  }, [notebooks, currentNotebook?.id, isAuthenticated, token]); // Dependencies
  // --- END NEW FUNCTION ---

  // Memoize the context value
  const value = useMemo<NotebookContextType>(
    () => ({
      notebooks,
      currentNotebook,
      folders,
      whiteboardContents,
      documents,
      currentDocuments,
      isLoadingDocuments,
      documentError,
      isLoadingNotebooks,
      notebooksError,
      isCreatingNotebook,
      createNotebookError,
      isInitialized,
      
      // Rich Text Note states
      currentNotes,
      isLoadingNotes,
      notesError,
      
      // Core methods
      setCurrentNotebookById,
      setCurrentNotebookByName,
      setCurrentNotebookByFolderAndName,
      createNotebook,
      deleteNotebook,
      updateNotebookTitle,
      addDocumentToChat,
      deleteDocument,
      refetchDocuments,
      refreshAllNotebooksDocuments,
      refreshNotebooks,
      
      // Folder methods
      createFolder,
      deleteFolder,
      updateFolder,
      
      // Note methods
      fetchNotesForNotebook,
      createNote,
      updateNote,
      deleteNote,
      
      // NotePad methods
      createNotePadNote,
      updateNotePadNote,
      deleteNotePadNote,
      getNotePadNotes,
      
      // Whiteboard methods
      saveWhiteboardContent,
      getWhiteboardContent,
      
      // 新增方法
      updateNotebookFolder,
      updateNotebookNotes,
    }),
    [
      notebooks,
      currentNotebook,
      folders,
      whiteboardContents,
      documents, 
      currentDocuments,
      isLoadingDocuments, 
      documentError,
      isLoadingNotebooks,
      notebooksError,
      isCreatingNotebook,
      createNotebookError,
      isInitialized,
      
      // Rich Text Note states
      currentNotes,
      isLoadingNotes,
      notesError,
      
      // Methods
      setCurrentNotebookById,
      createNotebook,
      deleteNotebook,
      updateNotebookTitle,
      addDocumentToChat,
      deleteDocument,
      refetchDocuments,
      refreshAllNotebooksDocuments,
      refreshNotebooks,
      
      // Folder methods
      createFolder,
      deleteFolder, 
      updateFolder,
      
      // Note methods
      fetchNotesForNotebook,
      createNote,
      updateNote,
      deleteNote,
      
      // NotePad methods
      createNotePadNote,
      updateNotePadNote,
      deleteNotePadNote,
      getNotePadNotes,
      
      // Whiteboard methods
      saveWhiteboardContent,
      getWhiteboardContent,
      
      // 新增方法
      updateNotebookFolder,
      updateNotebookNotes,
    ]
  );

  return (
    <NotebookContext.Provider value={value}>
      {children}
    </NotebookContext.Provider>
  );
};

// Custom hook to use the context
export const useNotebook = (): NotebookContextType => {
  const context = useContext(NotebookContext);
  if (!context) {
    throw new Error('useNotebook must be used within a NotebookProvider');
  }
  return context;
};

// Keep helper if needed elsewhere
// const ensureISODateFormat = ...
