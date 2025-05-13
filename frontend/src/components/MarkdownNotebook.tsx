import React, { useRef, useEffect, useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import { toast } from 'react-hot-toast';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import axios from 'axios'; // Import axios

interface MarkdownNotebookProps {
  notebookId: string;
  // onSave prop is removed as saving is now handled per note via API
}

// 导出笔记本引用类型，以便其他组件可以调用笔记本方法
export interface MarkdownNotebookRef {
  addTextToNotebook: (text: string) => void;
  // saveNotebook is less relevant now, could be removed or kept to save current edit
  saveNotebook: () => void; 
}

// 更新笔记定义以匹配后端 (假设后端返回 ISO 字符串)
interface MarkdownNote {
  id: string;
  title: string;
  content: string;
  createdAt: string; // Changed from number
  updatedAt: string; // Changed from number
  notebookId?: string; // Optional, might be useful
}

/**
 * MarkdownNotebook组件 - 集成后端 API
 * @param {string} notebookId - 笔记本ID
 */
const MarkdownNotebook = forwardRef<MarkdownNotebookRef, MarkdownNotebookProps>(({ notebookId }, ref) => {
  // 状态
  const [notes, setNotes] = useState<MarkdownNote[]>([]);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [isLoading, setIsLoading] = useState(true); // Loading state for initial fetch
  const [isSaving, setIsSaving] = useState(false); // Saving state for API calls
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [notesDropdownOpen, setNotesDropdownOpen] = useState(false);

  // 当前选中的笔记内容 (从更新后的 notes state 获取)
  const selectedNote = selectedNoteId 
    ? notes.find(note => note.id === selectedNoteId) 
    : null;

  // --- API Interaction Functions --- 

  // 从 API 加载笔记
  const loadNotesFromAPI = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await axios.get<MarkdownNote[]>(`/api/notebooks/${notebookId}/notes`);
      // Sort notes by creation date (optional, but good practice)
      const sortedNotes = response.data.sort((a, b) => 
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
      setNotes(sortedNotes);
      if (sortedNotes.length > 0 && !selectedNoteId) {
        // Select the first note by default if none is selected
        setSelectedNoteId(sortedNotes[0].id);
      }
      console.log('Loaded notes from API for notebook:', notebookId);
    } catch (error: any) {
      console.error('加载笔记失败:', error);
      toast.error(`加载笔记失败: ${error.response?.data?.message || error.message}`);
      setNotes([]); // Reset notes on error
    } finally {
      setIsLoading(false);
    }
  }, [notebookId, selectedNoteId]); // Added selectedNoteId dependency

  // 通过 API 创建新笔记 (修改：先提示输入名称)
  const createNewNote = useCallback(async () => {
    // 1. 提示用户输入名称
    const noteTitle = window.prompt("请输入新笔记的名称:");

    // 2. 检查名称是否有效
    if (!noteTitle) {
      toast.error("笔记名称不能为空!");
      return; // 用户取消或输入空名称，则不继续
    }

    setIsSaving(true);
    const newNoteData = {
      title: noteTitle, // 使用用户输入的名称
      content: '' // Start with empty content
    };
    
    try {
      const response = await axios.post<MarkdownNote>(`/api/notebooks/${notebookId}/notes`, newNoteData);
      const createdNote = response.data;
      const updatedNotes = [...notes, createdNote];
      setNotes(updatedNotes);
      
      // 自动选择新创建的笔记并进入编辑模式
      setSelectedNoteId(createdNote.id);
      setEditTitle(createdNote.title);
      setEditContent(createdNote.content);
      setIsEditing(true);
      
      toast.success('已创建新笔记');
      
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 100);

    } catch (error: any) {
      console.error('创建笔记失败:', error);
      toast.error(`创建笔记失败: ${error.response?.data?.message || error.message}`);
    } finally {
      setIsSaving(false);
    }
  }, [notebookId, notes]); // Removed saveToLocalStorage dependency

  // 通过 API 删除笔记
  const deleteNote = useCallback(async (noteId: string) => {
    const noteToDelete = notes.find(note => note.id === noteId);
    if (!noteToDelete) {
      toast.error('找不到要删除的笔记');
      return;
    }
    
    if (confirm(`确定要删除笔记 "${noteToDelete.title}" 吗?`)) {
      setIsSaving(true);
      try {
        await axios.delete(`/api/notebooks/${notebookId}/notes/${noteId}`);
        const updatedNotes = notes.filter(note => note.id !== noteId);
        setNotes(updatedNotes);
        
        // 如果删除的是当前选中的笔记，清除选择
        if (selectedNoteId === noteId) {
          setSelectedNoteId(updatedNotes.length > 0 ? updatedNotes[0].id : null); // Select first or none
          setIsEditing(false);
        }
        
        toast.success('笔记已删除');
      } catch (error: any) {
        console.error('删除笔记失败:', error);
        toast.error(`删除笔记失败: ${error.response?.data?.message || error.message}`);
      } finally {
        setIsSaving(false);
      }
    }
  }, [notebookId, notes, selectedNoteId]); // Removed saveToLocalStorage dependency

  // 编辑笔记 (准备阶段，不变)
  const startEditing = useCallback((noteId: string) => {
    const noteToEdit = notes.find(note => note.id === noteId);
    if (!noteToEdit) {
      toast.error('找不到要编辑的笔记');
      return;
    }
    setSelectedNoteId(noteId); // Ensure correct note is selected
    setEditTitle(noteToEdit.title);
    setEditContent(noteToEdit.content);
    setIsEditing(true);
    setTimeout(() => {
      textareaRef.current?.focus();
    }, 100);
  }, [notes]);

  // 通过 API 保存编辑内容
  const saveEdit = useCallback(async () => {
    if (!selectedNoteId) return;
    setIsSaving(true);
    const noteDataToUpdate = {
      title: editTitle,
      content: editContent
    };
    try {
      const response = await axios.put<MarkdownNote>(`/api/notebooks/${notebookId}/notes/${selectedNoteId}`, noteDataToUpdate);
      const updatedNote = response.data;
      
      const updatedNotes = notes.map(note => 
        note.id === selectedNoteId ? updatedNote : note
      );
      setNotes(updatedNotes);
      setIsEditing(false);
      toast.success('笔记已保存');

    } catch (error: any) {
      console.error('保存笔记失败:', error);
      toast.error(`保存笔记失败: ${error.response?.data?.message || error.message}`);
    } finally {
      setIsSaving(false);
    }
  }, [notebookId, selectedNoteId, notes, editTitle, editContent]); // Removed saveToLocalStorage dependency

  // 取消编辑 (不变)
  const cancelEdit = useCallback(() => {
    if (selectedNote) {
      setEditTitle(selectedNote.title);
      setEditContent(selectedNote.content);
    }
    setIsEditing(false);
  }, [selectedNote]);

  // 从AI对话添加文本到笔记本
  const addTextToNotebook = useCallback(async (text: string) => { // Made async
    if (!text) {
      toast.error('无法添加空内容到笔记本');
      return;
    }
    
    // 如果有选中的笔记并且处于编辑模式，则追加到当前编辑状态
    if (selectedNoteId && isEditing) {
      setEditContent(prev => prev + (prev ? '\n\n' : '') + text);
      toast.success('内容已添加到当前笔记编辑区', { duration: 2000 });
      // Note: Content is not saved until user clicks 'Save' button
    } else {
      // 否则创建新笔记 via API
      setIsSaving(true);
      
      // --- New Title Logic: Extract last non-empty line --- 
      const lines = text.trim().split('\n');
      let title = '';
      // Iterate backwards from the last line
      for (let i = lines.length - 1; i >= 0; i--) {
          const line = lines[i].trim();
          if (line) { // Found the last non-empty line
              title = line;
              break;
          }
      }
      // --- End New Title Logic ---

      // Limit length and provide default if still empty
      if (title) {
          // Keep a reasonable length limit for the summary title
          title = title.substring(0, 60) + (title.length > 60 ? '...' : ''); 
      } else {
          title = `新笔记 ${new Date().toLocaleString()}`; // Default title
      }

      const newNoteData = {
        title: title, // 使用提取或生成的标题
        content: text
      };
      try {
        const response = await axios.post<MarkdownNote>(`/api/notebooks/${notebookId}/notes`, newNoteData);
        const createdNote = response.data;
        const updatedNotes = [...notes, createdNote];
        setNotes(updatedNotes);
        
        // 自动选择新创建的笔记 (但不进入编辑模式)
        setSelectedNoteId(createdNote.id);
        setIsEditing(false); // Don't automatically enter edit mode here
        
        toast.success('内容已保存为新笔记');
        // Display preview toast (existing logic is complex, keeping it simple here)
        // setTimeout(() => { /* ... complex toast display logic ... */ }, 500); 
        setTimeout(() => {
            toast((t) => (
              <div>
                <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>已添加到笔记本:</div>
                <div style={{ 
                  maxHeight: '100px', 
                  overflow: 'auto', 
                  background: '#fff', 
                  padding: '8px',
                  borderRadius: '4px',
                  fontSize: '14px',
                  whiteSpace: 'pre-wrap' 
                }}>
                  {text.length > 150 ? text.substring(0, 150) + '...' : text}
                </div>
              </div>
            ), { duration: 3000 });
          }, 500);

      } catch (error: any) {
        console.error('添加内容到新笔记失败:', error);
        toast.error(`添加为新笔记失败: ${error.response?.data?.message || error.message}`);
      } finally {
        setIsSaving(false);
      }
    }
  }, [notebookId, notes, selectedNoteId, isEditing]);
  
  // 保存当前正在编辑的笔记 (如果适用)
  const saveNotebook = useCallback(() => {
    if (isEditing && selectedNoteId) {
      saveEdit(); // Calls the API-based save function
    } else {
      // FIX: Use standard toast call
      toast('没有正在编辑的笔记可保存'); 
    }
  }, [isEditing, selectedNoteId, saveEdit]); // Adjusted dependencies
  
  // 暴露方法给父组件 (不变)
  useImperativeHandle(ref, () => ({ 
    addTextToNotebook,
    saveNotebook 
  }));
  
  // 初始加载数据 - 改为从 API 加载
  useEffect(() => {
    if (notebookId) { // Only load if notebookId is available
      loadNotesFromAPI();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notebookId]); // Run only when notebookId changes

  // Effect to reset edit state when selected note changes
  useEffect(() => {
    if (selectedNote) {
        setIsEditing(false); // Exit edit mode when switching notes
        setEditTitle(selectedNote.title); // Pre-fill for potential future edit
        setEditContent(selectedNote.content);
    } else {
        // Handle case where no note is selected (e.g., after deletion)
        setIsEditing(false);
        setEditTitle('');
        setEditContent('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedNoteId, notes]); // Depend on selectedNoteId and notes. Re-evaluate if notes array itself changes reference.

  // --- Rendering Logic (Styles remain the same) --- 

  const CodeBlock = ({ node, inline, className, children, ...props }: any) => { 
      const style = inline
      ? { backgroundColor: '#f3f4f6', padding: '0.2rem 0.4rem', borderRadius: '3px', fontFamily: 'monospace' }
      : { display: 'block', backgroundColor: '#f3f4f6', padding: '1rem', borderRadius: '5px', overflow: 'auto', fontFamily: 'monospace' };
    
    return (
      <code style={style} className={className} {...props}>
        {children}
      </code>
    );
   };
  const toolbarButtonStyle = { 
      padding: '4px 8px',
      border: '1px solid #d1d5db',
      borderRadius: '4px',
      backgroundColor: '#f9fafb',
      cursor: 'pointer',
      fontSize: '12px',
      fontWeight: 'bold',
   };
  const dropdownItemStyle = { 
      padding: '8px 10px',
      borderBottom: '1px solid #e5e7eb',
      cursor: 'pointer',
      backgroundColor: 'transparent',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center'
   };
  const dropdownItemSelectedStyle = { 
      backgroundColor: '#dbeafe'
   };
  const dropdownItemHoverStyle = { 
      backgroundColor: '#dbeafe'
   };

  // Loading Indicator
  if (isLoading) {
    return <div style={{ padding: '20px', textAlign: 'center', color: '#6b7280' }}>加载笔记中...</div>;
  }

  // Main Render
  return (
    <div style={{ 
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      border: '1px solid #e5e7eb',
      borderRadius: '4px',
      overflow: 'hidden'
    }}>
      {/* Top Toolbar */} 
      <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '6px 8px',
          borderBottom: '1px solid #e5e7eb',
          position: 'relative'
       }}>
         {/* Notes Dropdown */} 
         <div style={{ position: 'relative', flexGrow: 1, marginRight: '16px' /* Add margin to separate from buttons */ }}>
           <button
             disabled={isSaving || isLoading} // Disable while loading/saving
             onClick={() => setNotesDropdownOpen(prev => !prev)}
             style={{
                display: 'flex',
                alignItems: 'center',
                padding: '4px 8px', 
                border: '1px solid #d1d5db',
                borderRadius: '4px',
                backgroundColor: 'white',
                cursor: 'pointer',
                width: '100%' // Make button fill the growing div
              }}
           >
             <span style={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                fontSize: '13px'
              }}>
               {selectedNote ? selectedNote.title : (notes.length > 0 ? '选择笔记...' : '无笔记')}
             </span>
             <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" style={{ width: '16px', height: '16px', marginLeft: '4px' }}>
               <path fillRule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
             </svg>
           </button>
           
           {/* Dropdown List */} 
           {notesDropdownOpen && (
             <div style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                backgroundColor: 'white',
                border: '1px solid #e5e7eb',
                borderRadius: '4px',
                boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
                zIndex: 10,
                maxHeight: '300px',
                overflowY: 'auto',
                minWidth: '250px'
              }}>
               {notes.length > 0 ? (
                 notes.map(note => (
                   <div
                     key={note.id}
                     onClick={() => {
                       setSelectedNoteId(note.id);
                       // setIsEditing(false); // Removed from here, handled by useEffect
                       setNotesDropdownOpen(false);
                     }}
                     style={{
                      ...dropdownItemStyle,
                      ...(note.id === selectedNoteId ? dropdownItemSelectedStyle : {}),
                    }}
                     onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = dropdownItemHoverStyle.backgroundColor)}
                     onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = (note.id === selectedNoteId ? dropdownItemSelectedStyle.backgroundColor : dropdownItemStyle.backgroundColor))}
                   >
                     <span style={{ flexGrow: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{note.title}</span>
                     <button
                       disabled={isSaving} // Disable while saving
                       onClick={(e) => { 
                         e.stopPropagation();
                         deleteNote(note.id); 
                       }}
                       style={{
                        background: 'none',
                        border: 'none',
                        color: '#ef4444',
                        cursor: 'pointer',
                        padding: '2px'
                      }}
                     >
                       <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" style={{ width: '14px', height: '14px' }}>
                         <path fillRule="evenodd" d="M5 3.25V4H2.75a.75.75 0 0 0 0 1.5h.3l.815 8.15A1.5 1.5 0 0 0 5.357 15h5.285a1.5 1.5 0 0 0 1.493-1.35l.815-8.15h.3a.75.75 0 0 0 0-1.5H11v-.75A2.25 2.25 0 0 0 8.75 1h-1.5A2.25 2.25 0 0 0 5 3.25Zm2.25-.75a.75.75 0 0 0-.75.75V4h3v-.75a.75.75 0 0 0-.75-.75h-1.5ZM6.05 6a.75.75 0 0 1 .787.713l.275 5.5a.75.75 0 0 1-1.498.075l-.275-5.5A.75.75 0 0 1 6.05 6Zm3.9 0a.75.75 0 0 1 .712.787l-.275 5.5a.75.75 0 0 1-1.498-.075l.275-5.5A.75.75 0 0 1 9.95 6Z" clipRule="evenodd" />
                       </svg>
                     </button>
                   </div>
                 ))
               ) : (
                 <div style={dropdownItemStyle}>无笔记</div>
               )}
               {/* New Note Button */}
               <div 
                 style={{ ...dropdownItemStyle, borderTop: '1px solid #e5e7eb' }}
                 onClick={createNewNote}
                 onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = dropdownItemHoverStyle.backgroundColor)}
                 onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = dropdownItemStyle.backgroundColor)}
               >
                 + 新建笔记
               </div>
             </div>
           )}
         </div>
         
         {/* Edit/Save/Cancel Buttons - Revised Logic */}
         <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
           {/* Edit Mode Buttons */} 
           {selectedNote && isEditing && (
             <>
               <input
                 type="text"
                 value={editTitle}
                 onChange={(e) => setEditTitle(e.target.value)}
                 placeholder="笔记标题"
                 disabled={isSaving}
                 style={{ 
                   fontSize: '13px',
                   padding: '2px 4px',
                   border: '1px solid #d1d5db',
                   borderRadius: '4px'
                 }}
               />
               <button onClick={saveEdit} disabled={isSaving} style={{ backgroundColor: '#10b981', color: 'white', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '13px' }}>{isSaving ? '保存中...' : '保存'}</button>
               <button onClick={cancelEdit} disabled={isSaving} style={{ backgroundColor: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '13px' }}>取消</button>
             </>
           )}

           {/* View Mode Buttons */} 
           {!isEditing && (
             <div className="flex items-center space-x-2">
               {/* Edit button - only if a note is selected */} 
               {selectedNote && (
                 <button 
                   onClick={() => startEditing(selectedNote.id)}
                   className="px-3 py-1 text-sm bg-blue-500 hover:bg-blue-600 text-white rounded shadow transition-colors duration-150 ease-in-out disabled:opacity-50"
                   disabled={isSaving || isLoading}
                 >
                   编辑
                 </button>
               )}
               {/* New button - always in view mode */} 
               <button 
                 onClick={createNewNote}
                 className="px-3 py-1 text-sm bg-green-500 hover:bg-green-600 text-white rounded shadow font-semibold transition-colors duration-150 ease-in-out disabled:opacity-50"
                 disabled={isSaving || isLoading}
               >
                 新建
               </button>
             </div>
           )}
         </div>
      </div>
      
      {/* Content Area - Add flex-grow and overflow-y-auto */}
      <div style={{
        flexGrow: 1, // Fill remaining space
        overflowY: 'auto', // Handle its own scrolling
        padding: '12px' // Add some padding
      }}>
        {isEditing ? (
          // Edit Mode: Textarea
          <textarea
            ref={textareaRef}
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            disabled={isSaving} // Disable while saving
            style={{
              width: '100%',
              height: '100%', // Make textarea fill its container
              minHeight: '300px', // Ensure a minimum size
              border: '1px solid #d1d5db',
              borderRadius: '4px',
              padding: '8px',
              fontFamily: 'inherit',
              fontSize: '14px',
              resize: 'none' // Disable browser resize handle
            }}
            placeholder="开始输入笔记内容..."
          />
        ) : (
          // Preview Mode: ReactMarkdown
          selectedNote ? (
            // Wrap ReactMarkdown in a div with prose styles
            <div className="prose max-w-none">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{ code: CodeBlock }}
              >
                {selectedNote.content}
              </ReactMarkdown>
            </div>
          ) : (
            <div style={{ textAlign: 'center', color: '#9ca3af', marginTop: '20px' }}>
              {notes.length > 0 ? '请在上方选择一篇笔记查看或编辑' : '点击"新建"按钮创建第一篇笔记'}
            </div>
          )
        )}
      </div>
      
      {/* Bottom Action Bar (Only in Edit Mode) */}
      {isEditing && (
        <div style={{ 
            display: 'flex', 
            justifyContent: 'flex-end',
            padding: '6px 8px',
            borderTop: '1px solid #e5e7eb'
         }}>
          <button 
            onClick={cancelEdit}
            disabled={isSaving} // Disable while saving
            style={{ ...toolbarButtonStyle, marginRight: '8px', backgroundColor: '#f3f4f6' }}
          >
            取消
          </button>
          <button 
            onClick={saveEdit}
            disabled={isSaving || !editTitle.trim()} // Disable if saving or title is empty
            style={{
              ...toolbarButtonStyle, 
              backgroundColor: (isSaving || !editTitle.trim()) ? '#e5e7eb' : '#10b981', // Green for save, gray if disabled
              color: (isSaving || !editTitle.trim()) ? '#6b7280' : 'white'
            }}
          >
            {isSaving ? '保存中...' : '保存'}
          </button>
        </div>
      )}
      
      {/* Click outside handler (unchanged) */} 
      {notesDropdownOpen && (
        <div 
          onClick={() => setNotesDropdownOpen(false)}
          style={{ 
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 5
           }}
        />
      )}
    </div>
  );
});

MarkdownNotebook.displayName = 'MarkdownNotebook';

export default MarkdownNotebook; 