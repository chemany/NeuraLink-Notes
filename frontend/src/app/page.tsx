'use client';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Link from 'next/link';
import NotebookCard from '@/components/NotebookCard';
import { useNotebook } from '@/contexts/NotebookContext';
import { useAuth } from '@/contexts/AuthContext';
import { Folder, Notebook } from '@/types';
import { toast } from 'react-hot-toast';
import dynamic from 'next/dynamic';
import { CloudIcon } from 'lucide-react';
import FolderItem from '@/components/FolderItem';
import RootFolderItem from '@/components/RootFolderItem';
import ConfirmModal from '@/components/ConfirmModal';
import SettingsDialog from '@/components/SettingsDialog';
import RenameNotebookModal from '@/components/RenameNotebookModal';
import Header from '@/components/Header';

// 动态导入SyncSettings组件
const SyncSettings = dynamic(() => import('@/components/settings/SyncSettings'), {
  loading: () => <p>加载中...</p>,
  ssr: false,
});

// Define backend base URL (adjust if necessary)
const BACKEND_API_BASE = process.env.NEXT_PUBLIC_BACKEND_API_BASE || 'http://localhost:3001';

// 莫兰迪色系 (示例)
const MORANDI_COLORS = [
  'bg-gray-200', // 更柔和的灰色系
  'bg-stone-200',
  'bg-red-200', 
  'bg-orange-200',
  'bg-amber-200',
  'bg-yellow-100', // 较浅的黄色
  'bg-lime-100',
  'bg-green-200',
  'bg-emerald-100',
  'bg-teal-100',
  'bg-cyan-100',
  'bg-sky-100',
  'bg-blue-200',
  'bg-indigo-200',
  'bg-violet-200',
  'bg-purple-200',
  'bg-fuchsia-100',
  'bg-pink-200',
  'bg-rose-200',
];

export default function Home() {
  const { 
    notebooks, 
    createNotebook, 
    folders, 
    createFolder, 
    deleteFolder, 
    updateFolder, 
    deleteNotebook, 
    isInitialized,
    refreshNotebooks,
    updateNotebookFolder,
    isLoadingNotebooks,
    notebooksError
  } = useNotebook();
  
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth();
  
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [newNotebookTitle, setNewNotebookTitle] = useState('');
  const [newFolderName, setNewFolderName] = useState('');
  const [folderIdForNewNotebook, setFolderIdForNewNotebook] = useState<string | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});
  const [editingFolder, setEditingFolder] = useState<Folder | null>(null);
  const [deletingFolder, setDeletingFolder] = useState<Folder | null>(null);
  const [currentlySelectedItemId, setCurrentlySelectedItemId] = useState<string | null>(null);

  // State for backup/restore loading
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  // Rename state for clarity
  const [showCloudSyncModal, setShowCloudSyncModal] = useState(false);
  // NEW state for the main settings dialog
  const [showMainSettingsModal, setShowMainSettingsModal] = useState(false);
  // Ref for the hidden file input
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 添加重命名相关的状态
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [renamingNotebook, setRenamingNotebook] = useState<Notebook | null>(null);

  // 拖拽相关的状态
  const [draggedOverFolderId, setDraggedOverFolderId] = useState<string | null>(null);

  const [isClient, setIsClient] = useState(false);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);

  // Initial setup: Expand all folders and select root by default
  useEffect(() => {
    if (isInitialized) {
      const initialExpandState: Record<string, boolean> = {};
      folders.forEach(folder => {
        initialExpandState[folder.id] = true;
      });
      setExpandedFolders(initialExpandState);
      setCurrentlySelectedItemId(null);
    }
  }, [folders, isInitialized]);

  // Group notebooks by folder ID for efficient rendering
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

  const handleCreateNotebook = () => {
    if (newNotebookTitle.trim()) {
      createNotebook(newNotebookTitle.trim(), folderIdForNewNotebook || undefined);
      setNewNotebookTitle('');
      setShowCreateModal(false);
      setFolderIdForNewNotebook(null);
    }
  };

  // New function for the Header button
  const handleNewNotebookFromHeader = () => {
    setFolderIdForNewNotebook(null); // Ensure creation at root
    setNewNotebookTitle('');       // Clear title for a fresh modal
    setShowCreateModal(true);      // Open the create modal
  };

  const handleCreateFolder = () => {
    if (newFolderName.trim()) {
      createFolder(newFolderName.trim());
      setNewFolderName('');
      setShowFolderModal(false);
    }
  };

  const openEditFolderModal = useCallback((folder: Folder) => {
      setEditingFolder(folder);
      setNewFolderName(folder.name);
      setShowFolderModal(true);
  }, []);

  const handleSaveFolder = () => {
    if (editingFolder && newFolderName.trim()) {
      updateFolder(editingFolder.id, newFolderName.trim());
      setNewFolderName('');
      setEditingFolder(null);
      setShowFolderModal(false);
    }
  };

  const openDeleteFolderModal = useCallback((folder: Folder) => {
      setDeletingFolder(folder);
  }, []);

  const confirmDeleteFolder = () => {
      if (deletingFolder) {
          deleteFolder(deletingFolder.id);
          setExpandedFolders(prev => {
              const newState = {...prev};
              delete newState[deletingFolder.id];
              return newState;
          });
          setDeletingFolder(null);
      }
  };

  const toggleFolderExpansion = useCallback((folderId: string) => {
    setExpandedFolders(prev => ({
      ...prev,
      [folderId]: !prev[folderId]
    }));
  }, []);

  const handleSelectItem = useCallback((id: string | null) => {
      setCurrentlySelectedItemId(id);
      console.log("Selected item:", id === null ? "Root" : `Folder ${id}`);
  }, []);

  const handleBackup = async () => {
    if (!notebooks || notebooks.length === 0) {
      toast.error("没有笔记本可备份。");
      return;
    }

    setIsBackingUp(true);
    toast.loading("正在准备备份文件...", { id: 'backup-toast' });

    try {
      const backupPayload = notebooks.map(notebook => {
        const notesKey = `markdown_notebook_${notebook.id}`;
        const notesJsonString = localStorage.getItem(notesKey) || '{"notes":[]}';
        return {
          id: notebook.id,
          notesJsonString: notesJsonString 
        };
      });

      const response = await fetch(`${BACKEND_API_BASE}/api/backup/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ notebooks: backupPayload }),
      });

      if (response.ok) {
        toast.loading("正在下载备份文件...", { id: 'backup-toast' });
        
        const disposition = response.headers.get('content-disposition');
        let filename = `notebook_backup_${new Date().toISOString().replace(/[:.]/g, '-')}.zip`;
        if (disposition && disposition.indexOf('attachment') !== -1) {
          const filenameRegex = /filename[^;=\n]*=((['"])(.*?)['"]|[^;\n]*)/;
          const matches = filenameRegex.exec(disposition);
          if (matches != null && matches[3]) { 
            filename = matches[3];
          } else if (matches != null && matches[1] && !matches[2]) {
            filename = matches[1].trim();
          }
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = filename; 
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        toast.success("备份文件已开始下载！", { id: 'backup-toast' });
      } else {
        let errorMsg = '备份失败。';
        try {
          const errorData = await response.json();
          errorMsg = errorData.message || errorMsg;
        } catch (e) {}
        console.error('Backup failed:', response.status, errorMsg);
        toast.error(`备份失败: ${errorMsg}`, { id: 'backup-toast' });
      }
    } catch (error) {
      console.error('Error during backup process:', error);
      toast.error(`备份过程中发生错误: ${error instanceof Error ? error.message : '未知错误'}`, { id: 'backup-toast' });
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleRestoreClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    console.log("Restore file selected:", file.name);

    if (event.target) {
      event.target.value = '';
    }

    setIsRestoring(true);
    toast.loading("正在恢复备份...", { id: 'restore-toast' });

    const formData = new FormData();
    formData.append('backupFile', file);

    try {
      const response = await fetch(`${BACKEND_API_BASE}/api/backup/restore`, {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const result = await response.json();
        
        if (result.restoredNotes && Array.isArray(result.restoredNotes)) {
          result.restoredNotes.forEach((noteData: { notebookId: string; notesJsonString: string }) => {
            const notesKey = `markdown_notebook_${noteData.notebookId}`;
            localStorage.setItem(notesKey, noteData.notesJsonString);
            console.log(`Restored notes for notebook ${noteData.notebookId} to localStorage.`);
          });
        }

        toast.success(result.message || '备份恢复成功！请刷新页面查看结果。', { id: 'restore-toast', duration: 4000 });
        
        setTimeout(() => {
            window.location.reload(); 
        }, 1500);

      } else {
        let errorMsg = '恢复失败。';
        try {
          const errorData = await response.json();
          errorMsg = errorData.message || errorMsg;
        } catch (e) {}
        console.error('Restore failed:', response.status, errorMsg);
        toast.error(`恢复失败: ${errorMsg}`, { id: 'restore-toast' });
      }

    } catch (error) {
      console.error('Error during restore process:', error);
      toast.error(`恢复过程中发生错误: ${error instanceof Error ? error.message : '未知错误'}`, { id: 'restore-toast' });
    } finally {
      setIsRestoring(false);
    }
  };

  // 添加处理重命名点击的函数
  const handleRenameNotebookClick = useCallback((notebook: Notebook) => {
    console.log('重命名笔记本:', notebook.title);
    setRenamingNotebook(notebook);
    setShowRenameModal(true);
  }, []);

  // 添加重命名成功的处理函数
  const handleRenameSuccess = useCallback((updatedNotebook: Notebook) => {
    console.log('笔记本重命名成功:', updatedNotebook.title);
    // 使用Context中的方法刷新笔记本列表
    refreshNotebooks();
  }, [refreshNotebooks]);

  // 修改 renderNotebookCards 添加 onRename prop
  const renderNotebookCards = useCallback((notebookList: Notebook[], columns: 3 | 6 = 6) => {
    if (!notebookList || notebookList.length === 0) {
      return <p className="pl-8 text-xs text-gray-500 py-2 col-span-full">（空）</p>;
    }
    // 根据列数选择不同的 card wrapper 样式
    let cardWrapperClass = '';
    if (columns === 3) { // 文件夹内部笔记本
      cardWrapperClass = 'w-full sm:w-1/2 md:w-1/3'; // 保持3列响应式
    } else { // 根目录笔记本
      cardWrapperClass = 'w-1/8'; // 固定8列
    }

    return (
      <div className="pl-2 flex flex-wrap gap-3 py-2"> {/* 修改 pl-6 为 pl-2 */}
        {(notebookList).map(notebook => (
          notebook && notebook.id ? (
            <div key={`${notebook.id}-wrapper`} className={cardWrapperClass}> {/* 包裹 NotebookCard 并应用宽度 */}
              <NotebookCard
                notebookId={notebook.id}
                onDelete={deleteNotebook}
                onRename={handleRenameNotebookClick}
              />
            </div>
          ) : null
        ))}
      </div>
    );
  }, [deleteNotebook, handleRenameNotebookClick]);

  // 拖拽事件处理
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>, folderId: string) => {
    e.preventDefault(); 
    e.stopPropagation();
    if (e.dataTransfer.types.includes('application/json')) {
      e.dataTransfer.dropEffect = 'move';
      if (draggedOverFolderId !== folderId) {
        setDraggedOverFolderId(folderId);
      }
    } else {
      e.dataTransfer.dropEffect = 'none';
    }
  };

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>, folderId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.types.includes('application/json')) {
      setDraggedOverFolderId(folderId);
    }
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const relatedTarget = e.relatedTarget as Node;
    // 确保相关目标不是当前元素或其子元素
    if (!e.currentTarget.contains(relatedTarget)) {
      setDraggedOverFolderId(null);
    }
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>, folderId: string | null) => {
    console.log(`[index] Drop event triggered on target: ${folderId === null ? 'root' : folderId}`);
    e.preventDefault();
    e.stopPropagation();
    setDraggedOverFolderId(null);
    
    try {
      const dataText = e.dataTransfer.getData('application/json');
      if (!dataText) {
        console.error('[index] Failed to get application/json data on drop');
        return;
      }
      const data = JSON.parse(dataText);
      
      if (data.type === 'notebook' && data.id && data.currentFolderId !== folderId) {
        console.log(`[index] In handleDrop, about to call updateNotebookFolder with notebookId: ${data.id}, targetFolderId: ${folderId}`);
        await updateNotebookFolder(data.id, folderId);
        console.log(`[index] Successfully called updateNotebookFolder for ${data.id}`);
      } else {
        console.log(`[index] Drop condition not met or invalid data: type=${data.type}, id=${data.id}, currentFolderId=${data.currentFolderId}, targetFolderId=${folderId}`);
      }
    } catch (error) {
      console.error('[index] Error processing drop:', error);
    }
  };

  return (
    <>     
      <div className="min-h-screen flex flex-col bg-gray-100"> {/* 主背景色稍暗 */}
        <Header 
          showBackButton={false} 
          showNewNotebookButton={true} 
          // title="灵枢笔记" // 可以选择覆盖默认标题
          
          // Pass props for Home page specific buttons
          showBackupRestoreButtons={true}
          onBackupClick={handleBackup}
          onRestoreClick={handleRestoreClick} // This will trigger fileInputRef.current.click()
          isBackingUp={isBackingUp}
          isRestoring={isRestoring}
          showAddFolderButton={true}
          onAddFolderClick={() => { setEditingFolder(null); setNewFolderName(''); setShowFolderModal(true); }}
          showCalendarButton={true}
          // onCalendarClick is handled by Link component within Header now
          showMainSettingsButton={true}
          onMainSettingsClick={() => setShowMainSettingsModal(true)}
          showSyncButton={true}
          onSyncClick={() => setShowCloudSyncModal(true)}
          showSettingsIcon={false} // Hide the generic notebook settings cog on the main page
          onNewNotebookClick={handleNewNotebookFromHeader} // <--- Pass the new handler
        />
        
        <main className="flex-grow p-2"> {/* Reduced padding from p-4 */}
          {/* The hidden file input for restore remains here */}
          <input 
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".zip"
            style={{ display: 'none' }} 
          />
          <div className="space-y-2">
            {/* Section for Root/Unclassified notebooks - Full Width */}
            <div 
              className={`mb-6 p-2 border border-gray-300 rounded-lg bg-gray-50 shadow-sm min-h-[150px] transition-colors duration-150 ${draggedOverFolderId === 'root-drop-target' ? 'bg-green-100 border-2 border-dashed border-green-500' : ''}`}
              onDragOver={(e) => handleDragOver(e, 'root-drop-target')}
              onDragEnter={(e) => handleDragEnter(e, 'root-drop-target')}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, null)}
            >
              <RootFolderItem
                isSelected={currentlySelectedItemId === null}
                onSelectFolder={() => handleSelectItem(null)}
              />
              {renderNotebookCards(notebooksByFolder['root'] || [], 6)}
            </div>

            {/* Section for Folders - Target 4 Columns Grid */}
            <div className="flex flex-wrap gap-4"> {/* 使用 flex flex-wrap */}
              {folders.sort((a, b) => a.name.localeCompare(b.name)).map((folder, index) => {
                const folderColorClass = MORANDI_COLORS[index % MORANDI_COLORS.length];
                const isDraggingOver = draggedOverFolderId === folder.id;
                return (
                  <div 
                    key={folder.id} 
                    // 应用文件夹宽度，并保留原有样式 - 固定4列
                    className={`w-1/4 flex flex-col border border-gray-300 rounded-lg shadow-sm overflow-hidden transition-colors duration-150 ${folderColorClass} ${isDraggingOver ? 'bg-green-100 border-2 border-dashed border-green-500' : ''}`} 
                    onDragOver={(e) => handleDragOver(e, folder.id)}
                    onDragEnter={(e) => handleDragEnter(e, folder.id)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, folder.id)}
                  >
                    <div className="p-1 bg-white bg-opacity-50 flex-shrink-0"> {/* Add flex-shrink-0 to header */}
                      <FolderItem
                        folder={folder}
                        isSelected={currentlySelectedItemId === folder.id}
                        isExpanded={!!expandedFolders[folder.id]}
                        onSelectFolder={() => handleSelectItem(folder.id)}
                        onToggleExpand={() => toggleFolderExpansion(folder.id)}
                        onEditFolder={() => openEditFolderModal(folder)}
                        onDeleteFolder={() => openDeleteFolderModal(folder)}
                      />
                    </div>
                    {expandedFolders[folder.id] && (
                      <div className="p-3 bg-white flex-grow"> {/* Add flex-grow */}
                       {renderNotebookCards(notebooksByFolder[folder.id] || [], 3)} 
                        <div className="mt-2 pt-2 border-t border-gray-200">
                          <button
                            onClick={() => {
                              setFolderIdForNewNotebook(folder.id);
                              setShowCreateModal(true);
                              setNewNotebookTitle('');
                            }}
                            className="w-full text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-100 px-2 py-1 rounded flex items-center justify-center transition-colors duration-150"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                            </svg>
                            在此文件夹中添加笔记本
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
            
            {isAuthLoading && (
              <p className="text-center py-10 text-gray-500">正在验证身份...</p>
            )}
            {!isAuthLoading && !isAuthenticated && (
              <div className="text-center py-12 text-gray-500">
                <p className="mb-4">请先登录以查看您的笔记本</p>
                <Link 
                  href="/auth/login"
                  className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 inline-block"
                >
                  前往登录
                </Link>
              </div>
            )}
            {!isAuthLoading && isAuthenticated && !isInitialized && (
              <p className="text-center py-10 text-gray-500">加载笔记本和文件夹...</p>
            )}
            {!isAuthLoading && isAuthenticated && isInitialized && notebooksError && (
              <div className="text-center py-12 text-red-500">
                <p className="mb-4">加载数据时出错：{notebooksError}</p>
                <button 
                  onClick={refreshNotebooks}
                  className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600"
                >
                  重试
                </button>
              </div>
            )}
            {!isAuthLoading && isAuthenticated && isInitialized && !notebooksError && folders.length === 0 && notebooks.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                <p className="mb-4">您还没有创建任何笔记本或文件夹</p>
                <button 
                  onClick={() => { setFolderIdForNewNotebook(null); setShowCreateModal(true); }}
                  className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600"
                >
                  创建一个笔记本
                </button>
              </div>
            )}

          </div>
        </main>
      </div>
      
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96 max-w-full mx-4">
            <h2 className="text-xl font-medium mb-4">创建新笔记本</h2>
            <input
              type="text"
              placeholder="笔记本标题"
              className="w-full border border-gray-300 rounded px-3 py-2 mb-4"
              value={newNotebookTitle}
              onChange={(e) => setNewNotebookTitle(e.target.value)}
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleCreateNotebook()}
            />
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                文件夹 (可选)
              </label>
              <select
                className="w-full border border-gray-300 rounded px-3 py-2 bg-white"
                value={folderIdForNewNotebook || ''}
                onChange={(e) => setFolderIdForNewNotebook(e.target.value || null)}
              >
                <option value="">根目录 (无文件夹)</option>
                {folders.map((folder) => (
                  <option key={folder.id} value={folder.id}>
                    {folder.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setNewNotebookTitle('');
                  setFolderIdForNewNotebook(null);
                }}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                取消
              </button>
              <button
                onClick={handleCreateNotebook}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
                disabled={!newNotebookTitle.trim()}
              >
                创建
              </button>
            </div>
          </div>
        </div>
      )}
      
      {showFolderModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96 max-w-full mx-4">
            <h2 className="text-xl font-medium mb-4">
              {editingFolder ? '编辑文件夹' : '创建新文件夹'}
            </h2>
            <input
              type="text"
              placeholder="文件夹名称"
              className="w-full border border-gray-300 rounded px-3 py-2 mb-4"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && (editingFolder ? handleSaveFolder() : handleCreateFolder())}
            />
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => {
                  setShowFolderModal(false);
                  setNewFolderName('');
                  setEditingFolder(null);
                }}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                取消
              </button>
              <button
                onClick={editingFolder ? handleSaveFolder : handleCreateFolder}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
                disabled={!newFolderName.trim()}
              >
                {editingFolder ? '保存' : '创建'}
              </button>
            </div>
          </div>
        </div>
      )}

      {deletingFolder && (
          <ConfirmModal
              isOpen={!!deletingFolder}
              title="确认删除文件夹"
              message={`确定要删除文件夹 "${deletingFolder.name}" 吗？文件夹中的笔记本将被移至根目录。此操作不可恢复。`}
              onConfirm={confirmDeleteFolder}
              onClose={() => setDeletingFolder(null)}
          />
      )}

      <SettingsDialog 
        isOpen={showMainSettingsModal}
        onClose={() => setShowMainSettingsModal(false)}
      />

      <SyncSettings 
        open={showCloudSyncModal}
        onOpenChange={setShowCloudSyncModal}
      />

      {/* 添加重命名笔记本模态框 */}
      <RenameNotebookModal
        isOpen={showRenameModal}
        onClose={() => setShowRenameModal(false)}
        notebook={renamingNotebook}
        onRenameSuccess={handleRenameSuccess}
      />
    </>
  );
} 