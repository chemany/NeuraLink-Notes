import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNotebook } from '@/contexts/NotebookContext';
import { Notebook, Folder } from '@/types';
import { formatDate } from '@/utils/formatters';
import { useRouter } from 'next/navigation';
import NotebookCard from './NotebookCard';
import FolderItem from './FolderItem';
import RootFolderItem from './RootFolderItem';
import ConfirmModal from './ConfirmModal';
import { toast } from 'react-hot-toast';

// ... (NOTEBOOK_STYLES can remain if used by NotebookCard, otherwise remove)

export default function NotebookList() {
  const {
    notebooks = [],
    deleteNotebook,
    createNotebook,
    folders = [],
    createFolder,
    deleteFolder,
    updateFolder,
    isInitialized
  } = useNotebook();

  const [newNotebookTitle, setNewNotebookTitle] = useState('');
  const [isCreatingNotebook, setIsCreatingNotebook] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [isRepairing, setIsRepairing] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editingFolderName, setEditingFolderName] = useState('');
  const [deletingFolderId, setDeletingFolderId] = useState<string | null>(null);
  const [folderToDelete, setFolderToDelete] = useState<Folder | null>(null);


  const router = useRouter();

  useEffect(() => {
    setIsClient(true);
  }, []);

  const notebooksByFolder = useMemo(() => {
    const grouped: { [key: string]: Notebook[] } = { 'root': [] };
    (notebooks || []).forEach(notebook => {
      if (!notebook || !notebook.id) return;
      const folderId = notebook.folderId || 'root';
      if (!grouped[folderId]) {
        grouped[folderId] = [];
      }
      grouped[folderId].push(notebook);
    });
    for (const key in grouped) {
        grouped[key].sort((a, b) => {
            const dateA = a?.updatedAt ? new Date(a.updatedAt).getTime() : 0;
            const dateB = b?.updatedAt ? new Date(b.updatedAt).getTime() : 0;
            return dateB - dateA;
        });
    }
    return grouped;
  }, [notebooks]);

  const handleCreateFolder = useCallback(async () => {
    if (newFolderName.trim() && createFolder) {
      setIsCreatingFolder(true);
      try {
        await createFolder(newFolderName.trim());
        setNewFolderName('');
      } catch (error) {
        console.error('Failed to create folder:', error);
        alert('创建文件夹失败');
      } finally {
        setIsCreatingFolder(false);
      }
    }
  }, [newFolderName, createFolder]);

  const handleToggleExpandFolder = useCallback((folderId: string) => {
    setExpandedFolders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(folderId)) {
        newSet.delete(folderId);
      } else {
        newSet.add(folderId);
      }
      return newSet;
    });
  }, []);

  const handleEditFolder = useCallback((folder: Folder) => {
      setEditingFolderId(folder.id);
      setEditingFolderName(folder.name);
  }, []);

  const handleCancelEditFolder = useCallback(() => {
      console.log('[NotebookList] handleCancelEditFolder called. Setting editingFolderId to null.');
      setEditingFolderId(null);
      setEditingFolderName('');
  }, []);

  const handleSaveFolder = useCallback(async () => {
      console.log('[NotebookList] handleSaveFolder called for folder:', editingFolderId);
      if (!editingFolderId || !editingFolderName.trim() || !updateFolder) return;
      try {
          await updateFolder(editingFolderId, editingFolderName.trim());
          console.log('[NotebookList] updateFolder API call successful.');
          handleCancelEditFolder();
      } catch (error) {
          console.error('Failed to update folder:', error);
          alert('更新文件夹失败');
      }
  }, [editingFolderId, editingFolderName, updateFolder, handleCancelEditFolder]);

  const handleDeleteFolderClick = useCallback((folder: Folder) => {
      setDeletingFolderId(folder.id);
      setFolderToDelete(folder);
  }, []);

  const confirmDeleteFolder = useCallback(async () => {
      if (!deletingFolderId || !deleteFolder) return;
      try {
          await deleteFolder(deletingFolderId);
          setExpandedFolders(prev => {
              const newSet = new Set(prev);
              newSet.delete(deletingFolderId);
              return newSet;
          });
          toast.success(`文件夹 "${folderToDelete?.name || '选中文件夹'}" 已删除。`);
      } catch (error) {
          console.error('Error in NotebookList confirmDeleteFolder catch:', error);
          if (error instanceof Error) {
            toast.error(error.message); 
          } else {
            toast.error('删除文件夹时发生未知错误。');
          }
      } finally {
          setDeletingFolderId(null);
          setFolderToDelete(null);
      }
  }, [deletingFolderId, deleteFolder, folderToDelete?.name]);


  const handleCreateNotebook = useCallback(async (folderId?: string) => {
    console.log('[NotebookList] handleCreateNotebook called. Title:', newNotebookTitle, 'createNotebook exists:', !!createNotebook);
    if (newNotebookTitle.trim() && createNotebook) {
      console.log(`[NotebookList] Creating notebook: ${newNotebookTitle} ${folderId ? `in folder ${folderId}`: ''}`);
      setIsCreatingNotebook(true);
      try {
        await createNotebook(newNotebookTitle, folderId);
        console.log(`[NotebookList] Notebook creation requested.`);
        setNewNotebookTitle('');
      } catch (error) {
        console.error('[NotebookList] Failed to create notebook:', error);
        toast.error('创建笔记本失败，请重试。详情请查看控制台。'); 
      } finally {
          setIsCreatingNotebook(false);
      }
    } else {
        console.log('[NotebookList] handleCreateNotebook: Condition not met. Title empty or createNotebook missing.');
        if (!newNotebookTitle.trim()) {
            toast.error('笔记本标题不能为空。');
        }
        if (!createNotebook) {
            console.error('[NotebookList] createNotebook function from context is missing!');
            toast.error('创建功能暂不可用，请稍后重试。');
        }
    }
  }, [newNotebookTitle, createNotebook]);

  const handleDeleteNotebookLocal = useCallback((id: string) => {
      if (!id || !deleteNotebook) return;
      console.log(`[NotebookList] Requesting delete for notebook: ${id}`);
      deleteNotebook(id);
  }, [deleteNotebook]);


  const handleRefresh = useCallback(() => {
     console.log('Triggering basic refresh by routing...');
     router.push('/');
  }, [router]);

  const renderNotebookCards = useCallback((notebookList: Notebook[]) => {
      if (!notebookList || notebookList.length === 0) {
          return <p className="text-sm text-gray-500 px-2 py-1">（空）</p>;
      }
      return (
          <div className="pl-6 mt-1 space-y-1">
              {(notebookList || []).map(notebook => (
                  notebook && notebook.id ? (
                      <NotebookCard
                          key={notebook.id}
                          notebookId={notebook.id}
                          onDelete={handleDeleteNotebookLocal}
                      />
                  ) : null
              ))}
          </div>
      );
  }, [handleDeleteNotebookLocal]);

  if (!isClient) {
      return <div className="p-4">加载列表中...</div>;
  }

  console.log('[NotebookList] Rendering - editingFolderId:', editingFolderId);

  return (
    <div className="p-4 flex flex-col h-full">
      <div className="mb-4 flex justify-between items-center">
        <h1 className="text-2xl font-bold">我的笔记本</h1>
        <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="p-2 text-gray-500 hover:text-gray-700 disabled:opacity-50"
            title="刷新列表"
        >
            <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 ${isRefreshing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m-15.357-2a8.001 8.001 0 0015.357 2m0 0H15" /></svg>
        </button>
      </div>

       <div className="mb-4 p-2 border rounded flex items-center">
           <input
               type="text"
               value={newNotebookTitle}
               onChange={(e) => setNewNotebookTitle(e.target.value)}
               placeholder="新笔记本标题..."
               className="flex-grow border-none focus:ring-0 text-sm p-1"
               disabled={isCreatingNotebook}
               onKeyDown={(e) => e.key === 'Enter' && handleCreateNotebook()}
           />
           <button
               type="button"
               onClick={() => handleCreateNotebook()}
               disabled={!newNotebookTitle.trim() || isCreatingNotebook}
               className="ml-2 px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600 disabled:opacity-50"
           >
               {isCreatingNotebook ? '创建中...' : '创建'}
           </button>
       </div>

       <div className="mb-4 p-2 border rounded flex items-center">
           <input
               type="text"
               value={newFolderName}
               onChange={(e) => setNewFolderName(e.target.value)}
               placeholder="新文件夹名称..."
               className="flex-grow border-none focus:ring-0 text-sm p-1"
               disabled={isCreatingFolder}
               onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
           />
           <button
               onClick={handleCreateFolder}
               disabled={!newFolderName.trim() || isCreatingFolder}
               className="ml-2 px-3 py-1 bg-green-500 text-white text-sm rounded hover:bg-green-600 disabled:opacity-50"
           >
               {isCreatingFolder ? '创建中...' : '创建'}
           </button>
       </div>


      <div 
        className="flex-grow overflow-y-auto pr-2 space-y-2"
      >

        <div 
        >
          <RootFolderItem />
          {renderNotebookCards(notebooksByFolder['root'] || [])}
        </div>

        {(folders || []).sort((a,b) => (a?.name || '').localeCompare(b?.name || '')).map(folder => {
          if (folder && folder.id) {
            // console.log(`[NotebookList] Preparing render for folder ${folder.name} - isEditing:`, editingFolderId === folder.id);
          }
          
          return folder && folder.id ? (
              <div 
                key={folder.id}
              >
                {editingFolderId === folder.id ? (
                    <div className="flex items-center p-2 border rounded">
                        <input
                            type="text"
                            value={editingFolderName}
                            onChange={(e) => setEditingFolderName(e.target.value)}
                            className="flex-grow border-blue-300 focus:ring-blue-500 focus:border-blue-500 rounded-md text-sm p-1 mr-2"
                            autoFocus
                            onKeyDown={(e) => e.key === 'Enter' && handleSaveFolder()}
                        />
                        <button onClick={handleSaveFolder} className="px-2 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600 mr-1">保存</button>
                        <button onClick={handleCancelEditFolder} className="px-2 py-1 bg-gray-300 text-gray-700 text-xs rounded hover:bg-gray-400">取消</button>
                    </div>
                ) : (
                    <FolderItem
                        folder={folder}
                        isSelected={false}
                        isExpanded={expandedFolders.has(folder.id)}
                        onToggleExpand={() => handleToggleExpandFolder(folder.id)}
                        onEditFolder={() => handleEditFolder(folder)}
                        onDeleteFolder={() => handleDeleteFolderClick(folder)}
                        onSelectFolder={() => {}}
                    />
                )}

                {expandedFolders.has(folder.id) && renderNotebookCards(notebooksByFolder[folder.id] || [])}
              </div>
          ) : null
        })}

      </div>

       {folderToDelete && (
            <ConfirmModal
                isOpen={!!deletingFolderId}
                title="确认删除文件夹"
                message={`确定要删除文件夹 "${folderToDelete.name}" 吗？文件夹内的笔记本将被移至根目录。此操作不可恢复。`}
                onConfirm={confirmDeleteFolder}
                onClose={() => { setDeletingFolderId(null); setFolderToDelete(null); }}
            />
        )}
    </div>
  );
}
