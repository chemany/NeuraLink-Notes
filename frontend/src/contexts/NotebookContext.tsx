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
import { createNotebookApi, fetchNotebooksApi, updateNotebookApi } from '@/services/notebookService'; // Import the new API function
import { getNotePadNotesApi, createNotePadNoteApi, updateNotePadNoteApi, deleteNotePadNoteApi } from '@/services/notePadService';
import { createFolderApi, getFoldersApi, updateFolderApi, deleteFolderApi } from '@/services/folderService';
import { toast } from 'react-hot-toast';
import syncService from '@/services/syncService'; // 新增导入
import {
    fetchRichNotesByNotebookId,
    createRichNoteApi,
    updateRichNoteApi,
    deleteRichNoteApi
} from '@/services/richNoteService';
import { useAuth } from './AuthContext'; // <--- 导入 useAuth

// Helper function to check if running in browser
const isBrowser = typeof window !== 'undefined';

// Define backend base URL (adjust if necessary)
const BACKEND_API_BASE = process.env.NEXT_PUBLIC_BACKEND_API_BASE || 'http://localhost:3001';

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
  const [isInitialized, setIsInitialized] = useState<boolean>(false); // Keep if used

  // Rich Text Note states
  const [currentNotes, setCurrentNotes] = useState<Note[]>([]);
  const [isLoadingNotes, setIsLoadingNotes] = useState<boolean>(false);
  const [notesError, setNotesError] = useState<string | null>(null);

  const router = useRouter();
  const { isAuthenticated, isLoading: isAuthLoading, token } = useAuth(); // <--- 使用 AuthContext

  // Effect for initial loading, dependent on authentication status
  useEffect(() => {
    const loadInitialData = async () => {
      // 只在 AuthContext 加载完毕且用户已认证的情况下加载数据
      if (isBrowser && !isAuthLoading && isAuthenticated) {
        // console.log('[NotebookContext] Auth confirmed, starting initial data load...');
        setIsLoadingNotebooks(true);
        setNotebooksError(null);
        try {
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
        setIsInitialized(false); // 或 true，表示"已初始化但无数据"
        setIsLoadingNotebooks(false); // 确保 loading 状态被重置
      }
    };

    loadInitialData();
  }, [isAuthenticated, isAuthLoading, token]); // <--- 依赖于 AuthContext 的状态，token 也加入以确保 apiClient 使用最新的 token

  const fetchDocsForNotebook = useCallback(async (notebookId: string | null) => {
    if (!notebookId || !isAuthenticated) { // <--- 增加 isAuthenticated 检查
          setDocuments([]);
          setCurrentDocuments([]);
          // console.log('[NotebookContext] Cleared documents because notebookId is null or user not authenticated.');
      return;
    }
      // console.log(`[NotebookContext] Fetching documents for notebook: ${notebookId}...`);
      setIsLoadingDocuments(true);
      setDocumentError(null);
      try {
          // console.log(`[NotebookContext] Calling fetchDocumentsByNotebookId(${notebookId})`);
          const fetchedDocs = await fetchDocumentsByNotebookId(notebookId);
          // console.log(`[NotebookContext] fetchDocumentsByNotebookId returned:`, fetchedDocs);
          setDocuments(fetchedDocs);
          // console.log(`[NotebookContext] Successfully fetched and set ${fetchedDocs.length} documents.`);
    } catch (error) {
          console.error(`[NotebookContext] Error fetching documents for notebook ${notebookId}:`, error);
          const message = error instanceof Error ? error.message : 'Failed to load documents';
          setDocumentError(message);
      } finally {
          // console.log(`[NotebookContext] Setting isLoadingDocuments to false for notebook ${notebookId}.`);
          setIsLoadingDocuments(false);
      }
  }, [isAuthenticated, token]); // <--- 增加 isAuthenticated, token 依赖

  useEffect(() => {
      fetchDocsForNotebook(currentNotebook?.id ?? null);
  }, [currentNotebook, fetchDocsForNotebook]);


  const fetchNotesForNotebook = useCallback(async (notebookId: string | null) => {
    if (!notebookId || !isAuthenticated) { // <--- 增加 isAuthenticated 检查
      setCurrentNotes([]);
      // console.log('[NotebookContext] Cleared notes because notebookId is null or user not authenticated.');
      return;
    }
    // console.log(`[NotebookContext] Fetching notes for notebook: ${notebookId}...`);
    setIsLoadingNotes(true);
    setNotesError(null);
    try {
      const fetchedNotes = await fetchRichNotesByNotebookId(notebookId);
      fetchedNotes.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      setCurrentNotes(fetchedNotes);
      // console.log(`[NotebookContext] Successfully fetched and set ${fetchedNotes.length} rich notes.`);
    } catch (error) {
      console.error(`[NotebookContext] Error fetching rich notes for notebook ${notebookId}:`, error);
      const message = error instanceof Error ? error.message : 'Failed to load rich notes';
      setNotesError(message);
      setCurrentNotes([]);
    } finally {
      setIsLoadingNotes(false);
    }
  }, [isAuthenticated, token]); // <--- 增加 isAuthenticated, token 依赖

  useEffect(() => {
    fetchNotesForNotebook(currentNotebook?.id ?? null);
  }, [currentNotebook, fetchNotesForNotebook]);


  const createNotebook = useCallback(async (title: string, folderId?: string): Promise<Notebook | null> => {
      if (!isAuthenticated) { // <--- 增加 isAuthenticated 检查
        setCreateNotebookError("User not authenticated.");
        toast.error("Please login to create a notebook.");
        return null;
      }
      if (!title.trim()) {
        setCreateNotebookError("Notebook title cannot be empty.");
        return null;
      }
    // console.log(`[NotebookContext] Attempting to create notebook: \"${title}\" ${folderId ? `in folder ${folderId}` : ''}`);
    setIsCreatingNotebook(true);
    setCreateNotebookError(null);

    try {
      const newNotebook = await createNotebookApi(title, folderId);
      setNotebooks((prevNotebooks) => [newNotebook, ...prevNotebooks]);
      setCurrentNotebookState(newNotebook);
      // router.push(`/notebook/${newNotebook.id}`); // Navigation can be handled by the caller if needed, or kept here
      // console.log('[NotebookContext] Successfully created notebook via API:', newNotebook);
      return newNotebook;
    } catch (error) {
      console.error('[NotebookContext] Error creating notebook via API:', error);
      const message = error instanceof Error ? error.message : 'Failed to create notebook.';
      setCreateNotebookError(message);
      toast.error(`创建笔记本失败: ${message}`);
      return null;
    } finally {
      setIsCreatingNotebook(false);
    }
  }, [isAuthenticated, token]); // MODIFIED HERE - removed router from deps if navigation is removed

  const deleteNotebook = useCallback(async (id: string) => {
    console.log(`[NotebookContext] Attempting to delete notebook: ${id}`);
    // Optionally add a loading state specific to deletion if needed

    const notebookToDelete = notebooks.find(nb => nb.id === id);
    const titleToDelete = notebookToDelete?.title || id;

    toast.loading(`正在删除笔记本 "${titleToDelete}"...`, { id: 'delete-notebook-toast' });

    try {
      const response = await fetch(`${BACKEND_API_BASE}/api/notebooks/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) { // Check for successful status codes (like 204 No Content)
        setNotebooks(prev => prev.filter(n => n.id !== id));
        toast.success(`笔记本 "${titleToDelete}" 已删除`, { id: 'delete-notebook-toast' });

        // If the deleted notebook was the current one, reset and navigate home
        if (currentNotebook?.id === id) {
          setCurrentNotebookState(null);
          // Maybe clear documents too?
          // setDocuments([]); 
          router.push('/'); 
        }
        console.log(`[NotebookContext] Successfully deleted notebook: ${id}`);
        
        // 添加删除后同步到云端的操作
        try {
          const configs = await syncService.getAllConfigs();
          const activeConfig = configs.find(c => c.isActive);
          if (activeConfig?.id) {
            toast.loading("正在同步删除操作到云端...", { id: 'sync-delete-toast' });
            const syncResult = await syncService.syncToCloud(activeConfig.id);
            if (syncResult.success) {
              toast.success("删除操作已同步到云端", { id: 'sync-delete-toast' });
            } else {
              toast.error(`同步删除操作失败: ${syncResult.message}`, { id: 'sync-delete-toast' });
            }
          }
        } catch (syncError) {
          console.error('[NotebookContext] Error syncing deletion to cloud:', syncError);
          toast.error("同步删除操作到云端失败", { id: 'sync-delete-toast' });
        }
      } else if (response.status === 404) {
        // 笔记本在后端找不到，但还显示在前端列表中
        // 从前端状态中将其移除，因为实际上已经不存在了
        setNotebooks(prev => prev.filter(n => n.id !== id));
        toast.success(`笔记本 "${titleToDelete}" 已从列表中移除`, { id: 'delete-notebook-toast' });
        
        // 如果当前打开的是这个笔记本，则重置并回到主页
        if (currentNotebook?.id === id) {
          setCurrentNotebookState(null);
          router.push('/');
        }
        
        console.log(`[NotebookContext] Notebook ${id} not found in backend but removed from frontend state.`);
      } else {
        // Handle API errors (like 500 Internal Server Error)
        let errorMsg = '删除失败。';
        try {
          const errorData = await response.json();
          errorMsg = errorData.message || errorMsg;
        } catch (e) {
          // Ignore if response is not JSON
        }
        console.error(`[NotebookContext] Failed to delete notebook ${id}. Status: ${response.status}, Message: ${errorMsg}`);
        toast.error(`删除笔记本 "${titleToDelete}" 失败: ${errorMsg}`, { id: 'delete-notebook-toast' });
      }
    } catch (error) {
      console.error(`[NotebookContext] Error during notebook deletion fetch for ${id}:`, error);
      toast.error(`删除笔记本 "${titleToDelete}" 时发生网络错误: ${error instanceof Error ? error.message : '未知错误'}`, { id: 'delete-notebook-toast' });
    }
    // Optionally reset loading state here
  }, [notebooks, currentNotebook, router]); // Add dependencies

  const updateNotebookTitle = useCallback(async (id: string, newTitle: string): Promise<Notebook> => {
    console.log(`[NotebookContext] 更新笔记本 ${id} 的标题为: ${newTitle}`);
    try {
      const updatedNotebook = await updateNotebookApi(id, { title: newTitle });
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
  }, [currentNotebook?.id]);

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
            // router.push(`/notebook/${id}`);
        } else {
            console.warn(`[NotebookContext] Notebook with ID ${id} not found in state.`);
            // Optionally navigate away or show an error
            // router.push('/');
        }
    }
  }, [notebooks, router]); // Dependencies: notebooks list and router


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
        try {
            const configs = await syncService.getAllConfigs();
            const activeConfig = configs.find(c => c.isActive);
            if (activeConfig?.id) {
                toast.loading("正在同步文档删除操作到云端...", { id: 'sync-doc-delete-toast' });
                const syncResult = await syncService.syncToCloud(activeConfig.id);
                if (syncResult.success) {
                    toast.success("文档删除操作已同步到云端", { id: 'sync-doc-delete-toast' });
                } else {
                    toast.error(`同步文档删除操作失败: ${syncResult.message}`, { id: 'sync-doc-delete-toast' });
                }
            }
        } catch (syncError) {
            console.error('[NotebookContext] Error syncing document deletion to cloud:', syncError);
            toast.error("同步文档删除操作到云端失败", { id: 'sync-doc-delete-toast' });
        }
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
        console.log(`[NotebookContext] Deleting folder ${id}`);
        try {
            await deleteFolderApi(id);
            setFolders(prev => prev.filter(f => f.id !== id));
            // 将该文件夹下的笔记本移动到根目录
            setNotebooks(prev => prev.map(n => n.folderId === id ? { ...n, folderId: null } : n));
            
            // 添加删除后同步到云端的操作
            try {
                const configs = await syncService.getAllConfigs();
                const activeConfig = configs.find(c => c.isActive);
                if (activeConfig?.id) {
                    toast.loading("正在同步文件夹删除操作到云端...", { id: 'sync-folder-delete-toast' });
                    const syncResult = await syncService.syncToCloud(activeConfig.id);
                    if (syncResult.success) {
                        toast.success("文件夹删除操作已同步到云端", { id: 'sync-folder-delete-toast' });
                    } else {
                        toast.error(`同步文件夹删除操作失败: ${syncResult.message}`, { id: 'sync-folder-delete-toast' });
                    }
                }
            } catch (syncError) {
                console.error('[NotebookContext] Error syncing folder deletion to cloud:', syncError);
                toast.error("同步文件夹删除操作到云端失败", { id: 'sync-folder-delete-toast' });
            }
        } catch (error) {
            console.error('[NotebookContext] Error deleting folder:', error);
            throw error;
        }
    }, []);

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
        console.log(`[NotebookContext] Creating simple note for notebook ${notebookId}`);
        try {
            const newNote = await createNotePadNoteApi(notebookId, note);
            // Potentially update a separate list for NotePadNotes if displayed
            return newNote;
        } catch (error) {
            console.error('[NotebookContext] Error creating simple note:', error);
            toast.error(`创建便签失败: ${error instanceof Error ? error.message : '未知错误'}`);
            throw error; // Or return null
        }
    }, []);

    const updateNotePadNote = useCallback(async (notebookId: string, noteId: string, updates: Partial<NotePadNote>): Promise<void> => {
        console.log(`[NotebookContext] Updating simple note ${noteId} in notebook ${notebookId}`);
        try {
            await updateNotePadNoteApi(notebookId, noteId, updates);
            // Potentially update a separate list for NotePadNotes
        } catch (error) {
            console.error('[NotebookContext] Error updating simple note:', error);
            toast.error(`更新便签失败: ${error instanceof Error ? error.message : '未知错误'}`);
            // throw error;
        }
    }, []);

    const deleteNotePadNote = useCallback(async (notebookId: string, noteId: string): Promise<void> => {
        console.log(`[NotebookContext] Deleting simple note ${noteId} from notebook ${notebookId}`);
        try {
            await deleteNotePadNoteApi(notebookId, noteId);
             // Potentially update a separate list for NotePadNotes
        } catch (error) {
            console.error('[NotebookContext] Error deleting simple note:', error);
            toast.error(`删除便签失败: ${error instanceof Error ? error.message : '未知错误'}`);
            // throw error;
        }
    }, []);

    const getNotePadNotes = useCallback(async (notebookId: string): Promise<NotePadNote[]> => {
        console.log(`[NotebookContext] Fetching simple notes for notebook ${notebookId}`);
        if (!isAuthenticated) { // <--- 添加认证检查
            console.warn('[NotebookContext] getNotePadNotes: User not authenticated. Skipping fetch.');
            toast.error('用户未认证，无法获取便签列表。');
            return [];
        }
        try {
            // getNotePadNotesApi 内部会从 localStorage 获取 token，但依赖 isAuthenticated 和 token 确保此回调在它们变化时更新
            const notes = await getNotePadNotesApi(notebookId);
            return notes;
        } catch (error) {
            console.error(`[NotebookContext] Error fetching simple notes for notebook ${notebookId}:`, error);
            toast.error(`获取便签列表失败: ${error instanceof Error ? error.message : '未知错误'}`);
            return [];
        }
    }, [isAuthenticated, token]); // <--- 添加 isAuthenticated 和 token 作为依赖项


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
        fetchDocsForNotebook(currentNotebook?.id ?? null);
    }, [currentNotebook, fetchDocsForNotebook]);

    const refreshAllNotebooksDocuments = useCallback(() => {
        // This might need rethinking with API. Fetching all docs for all notebooks could be heavy.
        console.warn("refreshAllNotebooksDocuments needs review for API integration");
        // Maybe just refetch for the current notebook?
        refetchDocuments();
    }, [refetchDocuments]);
    
    // 添加刷新笔记本列表的方法
    const refreshNotebooks = useCallback(async () => {
        console.log("[NotebookContext] 刷新笔记本列表");
        try {
            const updatedNotebooks = await fetchNotebooksApi();
            setNotebooks(updatedNotebooks);
            console.log(`[NotebookContext] 成功获取 ${updatedNotebooks.length} 个笔记本`);
        } catch (error) {
            console.error("[NotebookContext] 刷新笔记本列表失败:", error);
            toast.error("刷新笔记本列表失败");
        }
    }, []);

  // 将updateNotebookFolder移到这里，在useMemo之前定义
  const updateNotebookFolder = useCallback(async (notebookId: string, folderId: string | null): Promise<Notebook | null> => {
    console.log(`[NotebookContext] Updating notebook ${notebookId} to folder ${folderId || 'root'}`);
    try {
      const updatedNotebook = await updateNotebookApi(notebookId, { folderId });
      
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
  }, []);

  // --- NEW: Function to update notebook notes --- 
  const updateNotebookNotes = useCallback(async (notebookId: string, notes: string): Promise<Notebook | null> => {
      console.log(`[NotebookContext] Updating notes for notebook ${notebookId}`);
      // Find the current notebook in state to potentially update it optimistically
      const currentNotebookInState = notebooks.find(n => n.id === notebookId);
      if (!currentNotebookInState) {
          console.error(`[NotebookContext] Notebook ${notebookId} not found in state for notes update.`);
          toast.error('找不到要更新的笔记本。');
          return null;
      }

      // Optional: Optimistic update (update local state first)
      // setCurrentNotebookState(prev => prev ? { ...prev, notes } : null); // Need notes field in Notebook type
      // setNotebooks(prev => prev.map(n => n.id === notebookId ? { ...n, notes } : n)); // Need notes field
      // Note: Adding a 'notes' field to the local Notebook type might be needed for this

      try {
          // Call the service API function (which now accepts notes)
          const updatedNotebook = await updateNotebookApi(notebookId, { notes });

          // Update local state with the response from the server
          setNotebooks(prev => prev.map(n => 
              n.id === notebookId ? { ...n, updatedAt: updatedNotebook.updatedAt /* Add notes here if needed */ } : n
          ));
          if (currentNotebook?.id === notebookId) {
              setCurrentNotebookState(prev => prev ? { ...prev, updatedAt: updatedNotebook.updatedAt /* Add notes here if needed */ } : null);
          }

          console.log(`[NotebookContext] Successfully updated notes for notebook ${notebookId}`);
          toast.success('笔记已保存。');
          return updatedNotebook;

      } catch (error) {
          console.error(`[NotebookContext] Failed to update notebook notes for ${notebookId}:`, error);
          toast.error('保存笔记失败: ' + (error instanceof Error ? error.message : '未知错误'));
          // Optional: Revert optimistic update if it was implemented
          // setNotebooks(prev => prev.map(n => n.id === notebookId ? currentNotebookInState : n));
          // if (currentNotebook?.id === notebookId) setCurrentNotebookState(currentNotebookInState);
          return null;
      }
  }, [notebooks, currentNotebook?.id]); // Dependencies
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
