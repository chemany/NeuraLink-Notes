import React, { useEffect, useState, useCallback, useRef, forwardRef, useImperativeHandle } from 'react';
import { Tldraw, Editor } from '@tldraw/tldraw';
import '@tldraw/tldraw/tldraw.css';
import { toast } from 'react-hot-toast';

interface TldrawBoardProps {
  notebookId: string;
  onSave?: (content: any) => void;
}

// 导出白板引用类型，以便其他组件可以调用白板方法
export interface TldrawBoardRef {
  addTextToBoard: (text: string) => void;
  saveBoard: () => void;
}

/**
 * TldrawBoard组件 - 提供绘图白板功能
 * @param {string} notebookId - 笔记本ID
 * @param {Function} onSave - 可选保存回调函数
 */
const TldrawBoard = forwardRef<TldrawBoardRef, TldrawBoardProps>(({ notebookId, onSave }, ref) => {
  const [ready, setReady] = useState(false);
  const editorRef = useRef<Editor | null>(null);
  const initialLoadDoneRef = useRef(false);
  
  // 使用延迟加载确保DOM元素已经准备好
  useEffect(() => {
    const timer = setTimeout(() => {
      setReady(true);
    }, 200);
    
    return () => clearTimeout(timer);
  }, []);

  // 保存白板内容到localStorage
  const saveToLocalStorage = useCallback((content: any) => {
    try {
      if (!content) {
        console.warn('尝试保存空白板内容');
        return false;
      }
      
      const key = `tldraw_whiteboard_${notebookId}`;
      const data = {
        content,
        notebookId,
        updatedAt: new Date().toISOString()
      };
      
      localStorage.setItem(key, JSON.stringify(data));
      console.log('已保存白板内容:', key);
      
      if (onSave) {
        onSave(data);
      }
      
      return true;
    } catch (error) {
      console.error('保存白板内容失败:', error);
      toast.error('保存白板内容失败');
      return false;
    }
  }, [notebookId, onSave]);
  
  // 加载白板内容
  const loadFromLocalStorage = useCallback(() => {
    try {
      const key = `tldraw_whiteboard_${notebookId}`;
      const saved = localStorage.getItem(key);
      
      if (saved) {
        const data = JSON.parse(saved);
        console.log('已加载白板内容:', key);
        return data.content;
      }
      
      return null;
    } catch (error) {
      console.error('加载白板内容失败:', error);
      return null;
    }
  }, [notebookId]);

  // 添加文本到白板 - 新增方法
  const addTextToBoard = useCallback((text: string) => {
    if (!editorRef.current || !text) {
      console.error('编辑器未准备好或文本为空，无法添加内容');
      toast.error('无法添加内容到白板');
      return;
    }
    
    try {
      console.log('尝试向白板添加内容...');
      
      const editor = editorRef.current;
      
      // 随机位置，但确保在可视区域内
      const x = 100 + Math.random() * 200;
      const y = 100 + Math.random() * 200;
      
      try {
        // 创建矩形作为内容容器
        const rectId = editor.createShape({
          type: 'geo',
          x,
          y,
          props: {
            geo: 'rectangle',
            color: 'yellow',
            fill: 'solid',
            w: 300,
            h: Math.min(Math.max(text.length / 2, 100), 320)
          }
        });

        // 保存内容到localStorage
        if (rectId && typeof rectId === 'string') {
          localStorage.setItem(`tldraw_content_${rectId}`, text);

          // 使编辑器聚焦到创建的形状
          // TODO: 修复tldraw API调用
          // editor.select([rectId]);
          // editor.zoomToSelection();
        }
        
        // 在控制台记录添加的内容
        console.log('已添加内容到白板，ID:', rectId);
        console.log('内容:', text);
        
        // 显示成功提示
        toast.success('内容已添加到白板', { duration: 2000 });
        
        // 显示预览提示
        setTimeout(() => {
          toast((t) => (
            <div>
              <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>已添加到白板:</div>
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
        
        // 保存白板状态
        setTimeout(() => {
          try {
            const snapshot = editor.store.getSnapshot();
            saveToLocalStorage(snapshot);
          } catch (e) {
            console.error('保存白板失败:', e);
          }
        }, 100);
      } catch (innerError) {
        console.error('创建内容容器失败:', innerError);
        toast.error('无法添加内容到白板');
      }
    } catch (error) {
      console.error('添加内容到白板失败:', error);
      toast.error('添加内容到白板失败');
    }
  }, [saveToLocalStorage]);
  
  // 暴露方法给父组件
  useImperativeHandle(ref, () => ({
    addTextToBoard,
    saveBoard: () => {
      if (editorRef.current) {
        try {
          const snapshot = editorRef.current.store.getSnapshot();
          if (saveToLocalStorage(snapshot)) {
            toast.success('白板内容已保存');
          }
        } catch (e) {
          console.error('保存白板失败:', e);
          toast.error('保存失败');
        }
      }
    }
  }));

  // 处理编辑器挂载和监听变更
  const handleMount = useCallback((editor: Editor) => {
    console.log('Tldraw编辑器已挂载');
    editorRef.current = editor;
    
    // 添加提示，引导用户如何与白板交互
    setTimeout(() => {
      toast.success('白板已准备好，您可以编辑文本和图形', {
        duration: 5000,
        position: 'top-center'
      });
    }, 1000);
    
    // 尝试加载保存的内容
    const savedContent = loadFromLocalStorage();
    if (savedContent) {
      try {
        // 延迟一点加载，确保编辑器已完全初始化
        setTimeout(() => {
          try {
            editor.store.loadSnapshot(savedContent);
            console.log('已加载白板快照');
            initialLoadDoneRef.current = true;
          } catch (e) {
            console.error('加载白板快照失败:', e);
          }
        }, 300);
      } catch (e) {
        console.error('设置白板内容失败:', e);
      }
    } else {
      initialLoadDoneRef.current = true; // 没有内容可加载，标记为初始化完成
    }
    
    // 监听变更事件
    editor.store.listen(() => {
      // 忽略初始加载期间的保存
      if (!initialLoadDoneRef.current) return;
      
      console.log('白板内容变化');
      
      // 使用防抖保存
      if (window.tldrawSaveTimeout) {
        clearTimeout(window.tldrawSaveTimeout);
      }
      
      window.tldrawSaveTimeout = setTimeout(() => {
        try {
          const snapshot = editor.store.getSnapshot();
          console.log('保存白板快照');
          saveToLocalStorage(snapshot);
        } catch (e) {
          console.error('获取白板快照失败:', e);
        }
      }, 1000);
    });
  }, [loadFromLocalStorage, saveToLocalStorage]);

  // 处理手动保存
  const handleSave = useCallback(() => {
    if (!editorRef.current) {
      toast.error('编辑器未准备好，无法保存');
      return;
    }
    
    try {
      const snapshot = editorRef.current.store.getSnapshot();
      if (saveToLocalStorage(snapshot)) {
        toast.success('白板内容已保存');
      }
    } catch (e) {
      console.error('手动保存白板内容失败:', e);
      toast.error('保存失败，请重试');
    }
  }, [saveToLocalStorage]);

  // 使用内联样式确保尺寸正确
  return (
    <div style={{ 
      width: '100%', 
      height: '600px', 
      position: 'relative', 
      border: '1px solid #e5e7eb',
      borderRadius: '4px',
      overflow: 'hidden',
      backgroundColor: '#fafafa'
    }}>
      {!ready ? (
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          height: '100%',
          color: '#6b7280'
        }}>
          加载白板中...
        </div>
      ) : (
        <>
          <Tldraw onMount={handleMount} />
          <button 
            style={{
              position: 'absolute',
              top: '10px',
              right: '10px',
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              padding: '5px 10px',
              cursor: 'pointer',
              fontSize: '14px',
              zIndex: 999
            }}
            onClick={handleSave}
          >
            保存白板
          </button>
        </>
      )}
    </div>
  );
});

// 为window添加tldrawSaveTimeout属性
declare global {
  interface Window {
    tldrawSaveTimeout: ReturnType<typeof setTimeout> | null;
  }
}

// 初始化
if (typeof window !== 'undefined') {
  window.tldrawSaveTimeout = null;
}

export default TldrawBoard; 