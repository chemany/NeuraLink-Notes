import { useState, useEffect } from 'react';
import { Note } from '@/types';

interface NoteEditorProps {
  notebookId: string;
  note?: Note;
  onSave: (title: string, content: string) => void;
}

export default function NoteEditor({ notebookId, note, onSave }: NoteEditorProps) {
  const [title, setTitle] = useState(note?.title || '');
  const [content, setContent] = useState(note?.contentHtml || '');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (note) {
      setTitle(note.title || '');
      setContent(note.contentHtml || '');
    } else {
      setTitle('');
      setContent('');
    }
  }, [note]);

  const handleSave = async () => {
    if (!title.trim()) {
      alert('请输入笔记标题');
      return;
    }

    setIsSaving(true);
    
    // 模拟保存过程
    await new Promise(resolve => setTimeout(resolve, 500));
    
    onSave(title, content);
    setIsSaving(false);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="mb-4">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="笔记标题"
          className="w-full p-2 border-0 border-b focus:outline-none text-lg font-medium"
        />
      </div>

      <div className="flex-grow mb-4">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="在此输入笔记内容。支持Markdown格式。"
          className="w-full h-full p-2 border-0 resize-none focus:outline-none focus:ring-0 font-normal text-sm"
        />
      </div>

      <div className="flex justify-between items-center text-sm text-gray-500 border-t pt-3">
        <div>
          支持Markdown格式
        </div>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className={`bg-blue-600 text-white px-4 py-2 rounded-md ${isSaving ? 'opacity-70 cursor-not-allowed' : 'hover:bg-blue-700'}`}
        >
          {isSaving ? '保存中...' : (note ? '更新笔记' : '创建笔记')}
        </button>
      </div>
    </div>
  );
} 