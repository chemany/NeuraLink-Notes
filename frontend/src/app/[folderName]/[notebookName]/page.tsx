'use client';

import { useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useNotebook } from '@/contexts/NotebookContext';
import Link from 'next/link';

const NotebookDetailPage = () => {
  const params = useParams();

  // 获取文件夹名称和笔记本名称
  let folderName: string | undefined = undefined;
  let notebookName: string | undefined = undefined;

  if (params && typeof params.folderName === 'string') {
    folderName = decodeURIComponent(params.folderName);
  }
  if (params && typeof params.notebookName === 'string') {
    notebookName = decodeURIComponent(params.notebookName);
  }

  const { isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const {
    currentNotebook,
    setCurrentNotebookByFolderAndName,
    isLoadingNotebooks, // NotebookContext 提供的加载状态
    isLoadingDocuments,
    currentDocuments,
    // ... (可以按需添加其他需要的状态或函数)
  } = useNotebook();

  // 如果 folderName 或 notebookName 无法从 params 中获取，则显示错误或加载状态
  // 注意：这个检查应该在 Auth 加载完成后进行，以避免在 Auth 确定前就判定参数无效
  useEffect(() => {
    if (!isAuthLoading && (folderName === undefined || notebookName === undefined)) {
        // 可以在这里设置一个错误状态或者直接渲染错误信息
        // 为简单起见，我们依赖后续的 isAuthenticated 和 currentNotebook 检查
        console.warn('[NotebookDetailPage] folderName or notebookName is undefined after auth check.');
    }

    if (folderName && notebookName && isAuthenticated && !isAuthLoading) {
      console.log(`[NotebookDetailPage] Setting current notebook to: ${folderName}/${notebookName}`);
      setCurrentNotebookByFolderAndName(folderName, notebookName);
    }
  }, [folderName, notebookName, isAuthenticated, isAuthLoading, setCurrentNotebookByFolderAndName]);

  // 将 notebookId undefined 的情况移到 auth 和 loading 检查之后
  // 这样可以确保在用户未登录或数据仍在加载时，不会因为 notebookId 暂时 undefined 而提前显示错误

  if (isAuthLoading || isLoadingNotebooks) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <p>正在加载笔记本信息...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <p>您需要登录才能查看此页面。</p>
        <Link href="/auth/login">前往登录</Link>
      </div>
    );
  }

  // 现在检查 folderName 和 notebookName 是否有效以及 currentNotebook
  if (folderName === undefined || notebookName === undefined) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <p>无法确定文件夹或笔记本名称。</p>
        <Link href="/">返回首页</Link>
      </div>
    );
  }

  if (!currentNotebook || currentNotebook.title !== notebookName) {
    // 确保 currentNotebook 已加载且名称匹配
    // isLoadingNotebooks 应该处理了初始加载情况，这里更多是名称不匹配或未找到
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <p>笔记本未找到或正在加载...</p>
        <Link href="/">返回首页</Link>
      </div>
    );
  }

  // 成功加载笔记本后的显示逻辑
  return (
    <div style={{ padding: '20px' }}>
      <h1>笔记本: {currentNotebook.title}</h1>
      <p>ID: {currentNotebook.id}</p>
      <p>创建时间: {new Date(currentNotebook.createdAt).toLocaleString()}</p>
      <p>更新时间: {new Date(currentNotebook.updatedAt).toLocaleString()}</p>
      
      <h2>文档列表:</h2>
      {isLoadingDocuments ? (
        <p>正在加载文档...</p>
      ) : currentDocuments.length > 0 ? (
        <ul>
          {currentDocuments.map(doc => (
            <li key={doc.id}>{(doc.title || doc.fileName) || doc.id} (状态: {doc.status})</li>
          ))}
        </ul>
      ) : (
        <p>此笔记本中没有文档。</p>
      )}

      {/* 在这里可以添加更多关于笔记、白板等内容的显示 */}
      {/* 例如： <NotesList notebookId={currentNotebook.id} /> */}
      {/* 例如： <Whiteboard notebookId={currentNotebook.id} /> */}

      <div style={{ marginTop: '20px' }}>
        <Link href="/">返回笔记本列表</Link>
      </div>
    </div>
  );
};

export default NotebookDetailPage; 