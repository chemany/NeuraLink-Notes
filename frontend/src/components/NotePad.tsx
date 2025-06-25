import React, { useState, useRef, useEffect } from 'react';
import { NotePadNote } from '@/types';

export interface NotePadProps {
  notebookId: string;
  onSaveNotes: (notes: NotePadNote[]) => void;
  initialNotes?: NotePadNote[];
}

const COLORS = [
  'bg-yellow-100',
  'bg-blue-100',
  'bg-green-100',
  'bg-pink-100',
  'bg-purple-100',
  'bg-orange-100',
];

const NotePad: React.FC<NotePadProps> = ({ notebookId, onSaveNotes, initialNotes = [] }) => {
  const [notes, setNotes] = useState<NotePadNote[]>(initialNotes);
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isResizing, setIsResizing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [showPreview, setShowPreview] = useState(false);
  
  // 自动保存笔记
  useEffect(() => {
    const saveTimeout = setTimeout(() => {
      onSaveNotes(notes);
    }, 1000);
    
    return () => clearTimeout(saveTimeout);
  }, [notes, onSaveNotes]);
  
  // 创建新笔记
  const handleCreateNote = (e: React.MouseEvent) => {
    // 如果点击时已经有拖拽或调整大小的操作，不创建新笔记
    if (isDragging || isResizing) return;
    
    // 如果点击在已有笔记上，不创建新笔记
    if ((e.target as HTMLElement).closest('.note')) return;
    
    // 获取点击位置相对于容器的坐标
    const containerRect = containerRef.current?.getBoundingClientRect();
    if (!containerRect) return;
    
    const x = e.clientX - containerRect.left;
    const y = e.clientY - containerRect.top;
    
    // 创建新笔记
    const newNote: NotePadNote = {
      id: `note-${Date.now()}`,
      notebookId: notebookId,
      content: '',
      position: { x, y },
      size: { width: 300, height: 300 },
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    setNotes([...notes, newNote]);
    setActiveNoteId(newNote.id);
  };
  
  // 开始拖拽
  const handleStartDrag = (e: React.MouseEvent, noteId: string) => {
    // 阻止事件冒泡，避免创建新笔记
    e.stopPropagation();
    
    // 如果点击的是笔记的内容区域，不进行拖拽
    if ((e.target as HTMLElement).tagName === 'TEXTAREA') return;
    if ((e.target as HTMLElement).closest('.markdown-toolbar')) return;
    
    const note = notes.find(n => n.id === noteId);
    if (!note) return;
    
    setIsDragging(true);
    setActiveNoteId(noteId);
    
    // 计算鼠标与笔记左上角的偏移，用于保持拖拽时的相对位置
    const noteElement = document.getElementById(noteId);
    if (noteElement) {
      const noteRect = noteElement.getBoundingClientRect();
      setDragOffset({
        x: e.clientX - noteRect.left,
        y: e.clientY - noteRect.top,
      });
    }
  };
  
  // 开始调整大小
  const handleStartResize = (e: React.MouseEvent, noteId: string) => {
    e.stopPropagation();
    setIsResizing(true);
    setActiveNoteId(noteId);
  };
  
  // 处理鼠标移动
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      
      const containerRect = containerRef.current.getBoundingClientRect();
      
      if (isDragging && activeNoteId) {
        // 处理拖拽
        const x = e.clientX - containerRect.left - dragOffset.x;
        const y = e.clientY - containerRect.top - dragOffset.y;
        
        setNotes(notes.map(note => 
          note.id === activeNoteId 
            ? { ...note, position: { x, y }, updatedAt: new Date().toISOString() } 
            : note
        ));
      } else if (isResizing && activeNoteId) {
        // 处理调整大小
        const note = notes.find(n => n.id === activeNoteId);
        if (!note || !note.position) return;
        
        const width = Math.max(150, e.clientX - containerRect.left - note.position.x);
        const height = Math.max(150, e.clientY - containerRect.top - note.position.y);
        
        setNotes(notes.map(n => 
          n.id === activeNoteId 
            ? { ...n, size: { width, height }, updatedAt: new Date().toISOString() } 
            : n
        ));
      }
    };
    
    const handleMouseUp = () => {
      setIsDragging(false);
      setIsResizing(false);
    };
    
    if (isDragging || isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, isResizing, activeNoteId, notes, dragOffset]);
  
  // 更新笔记内容
  const handleNoteChange = (id: string, content: string) => {
    setNotes(notes.map(note => 
      note.id === id 
        ? { ...note, content, updatedAt: new Date().toISOString() } 
        : note
    ));
  };
  
  // 删除笔记
  const handleDeleteNote = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setNotes(notes.filter(note => note.id !== id));
    if (activeNoteId === id) {
      setActiveNoteId(null);
    }
  };
  
  // 更改笔记颜色
  const handleChangeColor = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const note = notes.find(n => n.id === id);
    if (!note) return;
    
    const currentColorIndex = COLORS.indexOf(note.color);
    const nextColorIndex = (currentColorIndex + 1) % COLORS.length;
    
    setNotes(notes.map(n => 
      n.id === id 
        ? { ...n, color: COLORS[nextColorIndex], updatedAt: new Date().toISOString() } 
        : n
    ));
  };
  
  // 插入Markdown格式
  const insertMarkdown = (id: string, type: string) => {
    const note = notes.find(n => n.id === id);
    if (!note) return;
    
    const textArea = document.getElementById(`textarea-${id}`) as HTMLTextAreaElement;
    if (!textArea) return;
    
    const start = textArea.selectionStart;
    const end = textArea.selectionEnd;
    const text = note.content;
    const selectedText = text.substring(start, end);
    
    let insertedText = '';
    
    switch (type) {
      case 'bold':
        insertedText = `**${selectedText || '粗体文本'}**`;
        break;
      case 'italic':
        insertedText = `*${selectedText || '斜体文本'}*`;
        break;
      case 'heading1':
        insertedText = `\n# ${selectedText || '标题1'}\n`;
        break;
      case 'heading2':
        insertedText = `\n## ${selectedText || '标题2'}\n`;
        break;
      case 'heading3':
        insertedText = `\n### ${selectedText || '标题3'}\n`;
        break;
      case 'link':
        insertedText = `[${selectedText || '链接文本'}](https://example.com)`;
        break;
      case 'image':
        insertedText = `![${selectedText || '图片说明'}](https://example.com/image.jpg)`;
        break;
      case 'list':
        insertedText = `\n- ${selectedText || '列表项'}\n- 列表项\n- 列表项\n`;
        break;
      case 'ordered-list':
        insertedText = `\n1. ${selectedText || '列表项'}\n2. 列表项\n3. 列表项\n`;
        break;
      case 'code':
        insertedText = `\`${selectedText || '代码'}\``;
        break;
      case 'codeblock':
        insertedText = `\n\`\`\`\n${selectedText || '代码块'}\n\`\`\`\n`;
        break;
      case 'quote':
        insertedText = `\n> ${selectedText || '引用文本'}\n`;
        break;
      case 'divider':
        insertedText = `\n---\n`;
        break;
      default:
        return;
    }
    
    const newContent = text.substring(0, start) + insertedText + text.substring(end);
    handleNoteChange(id, newContent);
    
    // 设置新的光标位置
    setTimeout(() => {
      textArea.focus();
      textArea.setSelectionRange(start + insertedText.length, start + insertedText.length);
    }, 0);
  };
  
  // 简单的Markdown转HTML (仅用于预览)
  const parseMarkdown = (markdown: string) => {
    if (!markdown) return '';
    
    let html = markdown
      // 转义HTML标签
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      // 标题
      .replace(/^# (.+)$/gm, '<h1>$1</h1>')
      .replace(/^## (.+)$/gm, '<h2>$1</h2>')
      .replace(/^### (.+)$/gm, '<h3>$1</h3>')
      // 粗体和斜体
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      // 链接
      .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank">$1</a>')
      // 图片
      .replace(/!\[(.+?)\]\((.+?)\)/g, '<img src="$2" alt="$1" style="max-width:100%;">')
      // 列表
      .replace(/^\- (.+)$/gm, '<li>$1</li>')
      .replace(/^[0-9]+\. (.+)$/gm, '<li>$1</li>')
      // 引用
      .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
      // 代码块
      .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
      // 行内代码
      .replace(/`(.+?)`/g, '<code>$1</code>')
      // 分隔线
      .replace(/^---$/gm, '<hr>')
      // 换行
      .replace(/\n/g, '<br>');
    
    return html;
  };
  
  // 切换预览模式
  const togglePreview = (id: string) => {
    if (activeNoteId === id) {
      setShowPreview(!showPreview);
    } else {
      setActiveNoteId(id);
      setShowPreview(true);
    }
  };
  
  return (
    <div 
      className="w-full h-full relative border border-gray-200 bg-gray-50 overflow-auto"
      onClick={handleCreateNote}
      ref={containerRef}
    >
      {/* 提示信息 */}
      {notes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center text-gray-500 pointer-events-none">
          <div className="text-center">
            <svg 
              className="mx-auto h-12 w-12 text-gray-400" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24" 
              xmlns="http://www.w3.org/2000/svg"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            <p className="mt-2 text-sm">点击任意位置创建笔记</p>
            <p className="text-xs mt-1">支持Markdown格式，可拖动笔记调整位置</p>
          </div>
        </div>
      )}
      
      {/* 笔记列表 */}
      {notes.map(note => (
        <div
          key={note.id}
          id={note.id}
          className={`note absolute shadow-lg rounded-md overflow-hidden ${note.color} ${activeNoteId === note.id ? 'ring-2 ring-blue-500 z-20' : 'z-10'}`}
          style={{
            left: `${note.position?.x || 0}px`,
            top: `${note.position?.y || 0}px`,
            width: `${note.size?.width || 200}px`,
            height: `${note.size?.height || 200}px`,
          }}
          onMouseDown={(e) => handleStartDrag(e, note.id)}
        >
          {/* 笔记头部 */}
          <div className="h-8 bg-opacity-20 bg-black flex items-center justify-between px-2 cursor-move">
            <div className="flex space-x-1">
              <button
                className="w-5 h-5 rounded-full hover:opacity-80"
                onClick={(e) => handleChangeColor(e, note.id)}
                style={{ backgroundColor: note.color === 'bg-yellow-100' ? '#FDE68A' : 
                         note.color === 'bg-blue-100' ? '#DBEAFE' :
                         note.color === 'bg-green-100' ? '#D1FAE5' :
                         note.color === 'bg-pink-100' ? '#FCE7F3' :
                         note.color === 'bg-purple-100' ? '#EDE9FE' : '#FFEDD5' }}
              />
              <button 
                className="text-xs text-gray-700 hover:text-blue-600 px-1"
                onClick={(e) => {
                  e.stopPropagation();
                  togglePreview(note.id);
                }}
                title={showPreview && activeNoteId === note.id ? "切换到编辑模式" : "切换到预览模式"}
              >
                {showPreview && activeNoteId === note.id ? "编辑" : "预览"}
              </button>
            </div>
            <button
              className="text-gray-600 hover:text-red-500"
              onClick={(e) => handleDeleteNote(e, note.id)}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          {/* Markdown工具栏 */}
          <div 
            className="markdown-toolbar flex flex-wrap items-center bg-gray-100 border-t border-b border-gray-200 px-1 py-1 overflow-x-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <button 
              className="p-1 rounded hover:bg-gray-200" 
              title="粗体"
              onClick={() => insertMarkdown(note.id, 'bold')}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 4h8a4 4 0 0 1 4 4a4 4 0 0 1-4 4H6z"></path>
                <path d="M6 12h9a4 4 0 0 1 4 4a4 4 0 0 1-4 4H6z"></path>
              </svg>
            </button>
            <button 
              className="p-1 rounded hover:bg-gray-200" 
              title="斜体"
              onClick={() => insertMarkdown(note.id, 'italic')}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="19" y1="4" x2="10" y2="4"></line>
                <line x1="14" y1="20" x2="5" y2="20"></line>
                <line x1="15" y1="4" x2="9" y2="20"></line>
              </svg>
            </button>
            <button 
              className="p-1 rounded hover:bg-gray-200" 
              title="标题1"
              onClick={() => insertMarkdown(note.id, 'heading1')}
            >
              <span className="font-bold text-xs">H1</span>
            </button>
            <button 
              className="p-1 rounded hover:bg-gray-200" 
              title="标题2"
              onClick={() => insertMarkdown(note.id, 'heading2')}
            >
              <span className="font-bold text-xs">H2</span>
            </button>
            <button 
              className="p-1 rounded hover:bg-gray-200" 
              title="标题3"
              onClick={() => insertMarkdown(note.id, 'heading3')}
            >
              <span className="font-bold text-xs">H3</span>
            </button>
            <button 
              className="p-1 rounded hover:bg-gray-200" 
              title="链接"
              onClick={() => insertMarkdown(note.id, 'link')}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
              </svg>
            </button>
            <button 
              className="p-1 rounded hover:bg-gray-200" 
              title="图片"
              onClick={() => insertMarkdown(note.id, 'image')}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                <circle cx="8.5" cy="8.5" r="1.5"></circle>
                <polyline points="21 15 16 10 5 21"></polyline>
              </svg>
            </button>
            <button 
              className="p-1 rounded hover:bg-gray-200" 
              title="无序列表"
              onClick={() => insertMarkdown(note.id, 'list')}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="8" y1="6" x2="21" y2="6"></line>
                <line x1="8" y1="12" x2="21" y2="12"></line>
                <line x1="8" y1="18" x2="21" y2="18"></line>
                <line x1="3" y1="6" x2="3.01" y2="6"></line>
                <line x1="3" y1="12" x2="3.01" y2="12"></line>
                <line x1="3" y1="18" x2="3.01" y2="18"></line>
              </svg>
            </button>
            <button 
              className="p-1 rounded hover:bg-gray-200" 
              title="有序列表"
              onClick={() => insertMarkdown(note.id, 'ordered-list')}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="10" y1="6" x2="21" y2="6"></line>
                <line x1="10" y1="12" x2="21" y2="12"></line>
                <line x1="10" y1="18" x2="21" y2="18"></line>
                <path d="M4 6h1v4"></path>
                <path d="M4 10h2"></path>
                <path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"></path>
              </svg>
            </button>
            <button 
              className="p-1 rounded hover:bg-gray-200" 
              title="代码"
              onClick={() => insertMarkdown(note.id, 'code')}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="16 18 22 12 16 6"></polyline>
                <polyline points="8 6 2 12 8 18"></polyline>
              </svg>
            </button>
            <button 
              className="p-1 rounded hover:bg-gray-200" 
              title="代码块"
              onClick={() => insertMarkdown(note.id, 'codeblock')}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2"></rect>
                <path d="M8 10l2 2-2 2"></path>
                <path d="M16 10l-2 2 2 2"></path>
                <path d="M14 7l-4 10"></path>
              </svg>
            </button>
            <button 
              className="p-1 rounded hover:bg-gray-200" 
              title="引用"
              onClick={() => insertMarkdown(note.id, 'quote')}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
              </svg>
            </button>
            <button 
              className="p-1 rounded hover:bg-gray-200" 
              title="分隔线"
              onClick={() => insertMarkdown(note.id, 'divider')}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="3" y1="12" x2="21" y2="12"></line>
              </svg>
            </button>
          </div>
          
          {/* 笔记内容 - 编辑/预览模式 */}
          {showPreview && activeNoteId === note.id ? (
            <div 
              className="markdown-preview w-full h-[calc(100%-69px)] p-3 overflow-auto bg-white"
              onClick={(e) => e.stopPropagation()}
              dangerouslySetInnerHTML={{ __html: parseMarkdown(note.content) }}
            />
          ) : (
          <textarea
              id={`textarea-${note.id}`}
              className="w-full h-[calc(100%-69px)] p-3 bg-white resize-none focus:outline-none"
            value={note.content}
            onChange={(e) => handleNoteChange(note.id, e.target.value)}
              placeholder="在此输入笔记内容，支持Markdown格式..."
            onClick={(e) => e.stopPropagation()}
            onFocus={() => setActiveNoteId(note.id)}
          />
          )}
          
          {/* 调整大小的手柄 */}
          <div
            className="absolute bottom-0 right-0 w-6 h-6 cursor-nwse-resize"
            onMouseDown={(e) => handleStartResize(e, note.id)}
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="opacity-50"
            >
              <path d="M22 22L12 12M22 12L12 22" stroke="currentColor" strokeWidth="2" />
            </svg>
          </div>
        </div>
      ))}
    </div>
  );
};

export default NotePad; 