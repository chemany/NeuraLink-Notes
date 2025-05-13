// frontend/src/components/RenameNotebookModal.tsx
import React, { useState, useEffect } from 'react';
import { Notebook } from '@/types'; // 确保导入 Notebook 类型
import { useNotebook } from '@/contexts/NotebookContext'; // 导入Context hook
import { toast } from 'react-hot-toast';

interface RenameNotebookModalProps {
  isOpen: boolean;
  onClose: () => void;
  notebook: Notebook | null; // 要重命名的笔记本
  onRenameSuccess: (updatedNotebook: Notebook) => void; // 成功后的回调
}

export default function RenameNotebookModal({
  isOpen,
  onClose,
  notebook,
  onRenameSuccess,
}: RenameNotebookModalProps) {
  const [newTitle, setNewTitle] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const { updateNotebookTitle } = useNotebook(); // 使用Context中的方法

  useEffect(() => {
    // 当模态框打开且有笔记本数据时，设置初始标题
    if (isOpen && notebook) {
      setNewTitle(notebook.title);
    } else if (!isOpen) {
      // 关闭时重置
      setNewTitle('');
      setIsSaving(false);
    }
  }, [isOpen, notebook]);

  const handleSave = async () => {
    if (!notebook || !newTitle.trim() || newTitle.trim() === notebook.title) {
      onClose(); // 没有有效更改或笔记本数据，直接关闭
      return;
    }

    setIsSaving(true);
    const originalTitle = notebook.title; // 保存原标题以备回滚

    try {
      // 使用Context中的方法更新笔记本标题
      await updateNotebookTitle(notebook.id, newTitle.trim());
      // 更新成功后，用更新后的笔记本数据调用成功回调
      const updatedNotebook = {
        ...notebook,
        title: newTitle.trim(),
        updatedAt: new Date().toISOString()
      };
      onRenameSuccess(updatedNotebook);
      onClose();
    } catch (error: any) {
      toast.error(`重命名失败: ${error.message || '未知错误'}`);
      // 不需要回滚输入框内容，让用户可以修正
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      handleSave();
    }
  };

  if (!isOpen || !notebook) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md">
        <h2 className="text-xl font-semibold mb-4">重命名笔记本</h2>
        <p className="text-sm text-gray-600 mb-4">
          为笔记本 <span className="font-medium">"{notebook.title}"</span> 输入新名称：
        </p>
        <input
          type="text"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={handleKeyDown}
          className="w-full px-3 py-2 border border-gray-300 rounded-md mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="输入新的笔记本标题"
          autoFocus // 自动聚焦
        />
        <div className="flex justify-end space-x-3">
          <button
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 disabled:opacity-50"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || !newTitle.trim() || newTitle.trim() === notebook.title}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  );
} 