import React, { useRef, useEffect, useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import { toast } from 'react-hot-toast';

interface SimpleBoardProps {
  notebookId: string;
  onSave?: (content: any) => void;
}

// 导出白板引用类型，以便其他组件可以调用白板方法
export interface SimpleBoardRef {
  addTextToBoard: (text: string) => void;
  saveBoard: () => void;
}

// 便签样式定义
interface StickyNote {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  color: string;
  created: number;
}

/**
 * SimpleBoard组件 - 简单的白板功能
 * @param {string} notebookId - 笔记本ID
 * @param {Function} onSave - 可选保存回调函数
 */
const SimpleBoard = forwardRef<SimpleBoardRef, SimpleBoardProps>(({ notebookId, onSave }, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [notes, setNotes] = useState<StickyNote[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [draggedNoteIndex, setDraggedNoteIndex] = useState<number | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const isInitializedRef = useRef(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState<string>('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isEditingRef = useRef(false);

  // 保存白板内容到localStorage
  const saveToLocalStorage = useCallback((content: StickyNote[]) => {
    try {
      const key = `simple_whiteboard_${notebookId}`;
      const data = {
        notes: content,
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
  
  // 从localStorage加载白板内容
  const loadFromLocalStorage = useCallback(() => {
    try {
      const key = `simple_whiteboard_${notebookId}`;
      const saved = localStorage.getItem(key);
      
      if (saved) {
        const data = JSON.parse(saved);
        console.log('已加载白板内容:', key);
        if (data.notes && Array.isArray(data.notes)) {
          return data.notes as StickyNote[];
        }
      }
      
      return [];
    } catch (error) {
      console.error('加载白板内容失败:', error);
      return [];
    }
  }, [notebookId]);

  // 清空画布并重新绘制所有便签
  const redrawCanvas = useCallback(() => {
    if (isEditingRef.current) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    // 设置canvas尺寸为容器大小
    if (containerRef.current) {
      canvas.width = containerRef.current.clientWidth;
      canvas.height = containerRef.current.clientHeight;
    }
    
    // 清空画布
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // 绘制所有便签
    notes.forEach(note => {
      // 绘制便签背景
      ctx.fillStyle = note.color;
      ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
      ctx.shadowBlur = 5;
      ctx.shadowOffsetX = 2;
      ctx.shadowOffsetY = 2;
      
      // 绘制便签矩形带圆角
      roundRect(ctx, note.x, note.y, note.width, note.height, 5);
      ctx.fill();
      
      // 绘制文本
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
      ctx.fillStyle = '#000000';
      ctx.font = '14px Arial';
      
      // 文本换行处理
      const padding = 10;
      const maxWidth = note.width - padding * 2;
      const lineHeight = 16;
      wrapText(ctx, note.text, note.x + padding, note.y + padding + 12, maxWidth, lineHeight);
    });
  }, [notes]);

  // 绘制圆角矩形的辅助函数
  const roundRect = (
    ctx: CanvasRenderingContext2D, 
    x: number, 
    y: number, 
    width: number, 
    height: number, 
    radius: number
  ) => {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  };

  // 文本换行处理的辅助函数
  const wrapText = (
    ctx: CanvasRenderingContext2D, 
    text: string, 
    x: number, 
    y: number, 
    maxWidth: number, 
    lineHeight: number
  ) => {
    const words = text.split(' ');
    let line = '';
    let testLine = '';
    let testWidth = 0;
    
    for (let n = 0; n < words.length; n++) {
      testLine = line + words[n] + ' ';
      testWidth = ctx.measureText(testLine).width;
      
      if (testWidth > maxWidth && n > 0) {
        ctx.fillText(line, x, y);
        line = words[n] + ' ';
        y += lineHeight;
      } else {
        line = testLine;
      }
    }
    
    ctx.fillText(line, x, y);
  };

  // 添加文本到白板
  const addTextToBoard = useCallback((text: string) => {
    if (!text) {
      toast.error('无法添加空内容到白板');
      return;
    }
    
    try {
      // 获取实际canvas尺寸
      const canvasWidth = containerRef.current?.clientWidth || 800;
      const canvasHeight = containerRef.current?.clientHeight || 600;
      
      // 调整便签尺寸，最小宽度为200，最大宽度为300
      const noteWidth = Math.min(Math.max(Math.min(text.length * 2, 300), 200), canvasWidth * 0.8);
      
      // 根据文本长度估算高度，但限制最小和最大值
      const estimatedLines = Math.ceil(text.length / 30); // 假设每行约30个字符
      const noteHeight = Math.min(Math.max(estimatedLines * 20 + 40, 100), 300);
      
      // 确保便签完全在可视区域内，留出边距
      const marginX = 15;
      const marginY = 15;
      const maxX = canvasWidth - noteWidth - marginX;
      const maxY = canvasHeight - noteHeight - marginY;
      
      // 避免生成负值坐标
      const x = Math.max(marginX, Math.min(Math.random() * maxX, maxX));
      const y = Math.max(marginY, Math.min(Math.random() * maxY, maxY));
      
      // 生成随机颜色
      const colors = ['#fff9c4', '#ffe0b2', '#c8e6c9', '#b3e5fc', '#e1bee7', '#ffcdd2'];
      const color = colors[Math.floor(Math.random() * colors.length)];
      
      // 创建新便签
      const newNote: StickyNote = {
        id: `note-${Date.now()}`,
        x,
        y,
        width: noteWidth,
        height: noteHeight,
        text: text.substring(0, 500) + (text.length > 500 ? '...' : ''),
        color,
        created: Date.now()
      };
      
      // 更新状态
      const updatedNotes = [...notes, newNote];
      setNotes(updatedNotes);
      
      // 保存便签
      saveToLocalStorage(updatedNotes);
      
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
    } catch (error) {
      console.error('添加内容到白板失败:', error);
      toast.error('添加内容到白板失败');
    }
  }, [notes, saveToLocalStorage]);
  
  // 保存当前状态
  const saveBoard = useCallback(() => {
    saveToLocalStorage(notes);
    toast.success('白板内容已保存');
  }, [notes, saveToLocalStorage]);
  
  // 暴露方法给父组件
  useImperativeHandle(ref, () => ({
    addTextToBoard,
    saveBoard
  }));

  // 检查点击是否命中便签
  const getNoteAtPosition = useCallback((x: number, y: number) => {
    for (let i = notes.length - 1; i >= 0; i--) {
      const note = notes[i];
      if (
        x >= note.x && 
        x <= note.x + note.width && 
        y >= note.y && 
        y <= note.y + note.height
      ) {
        return { note, index: i };
      }
    }
    return null;
  }, [notes]);

  // 鼠标按下事件
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (isEditingRef.current) return;
    
    if (!canvasRef.current) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const hit = getNoteAtPosition(x, y);
    if (hit) {
      setIsDragging(true);
      setDraggedNoteIndex(hit.index);
      setDragOffset({ 
        x: x - hit.note.x, 
        y: y - hit.note.y 
      });
    }
  }, [getNoteAtPosition]);

  // 鼠标移动事件
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging || draggedNoteIndex === null || !canvasRef.current) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const note = notes[draggedNoteIndex];
    const canvasWidth = containerRef.current?.clientWidth || 800;
    const canvasHeight = containerRef.current?.clientHeight || 600;
    
    // 计算新位置，确保不会拖出边界
    const newX = Math.max(10, Math.min(x - dragOffset.x, canvasWidth - note.width - 10));
    const newY = Math.max(10, Math.min(y - dragOffset.y, canvasHeight - note.height - 10));
    
    const updatedNotes = [...notes];
    updatedNotes[draggedNoteIndex] = {
      ...updatedNotes[draggedNoteIndex],
      x: newX,
      y: newY
    };
    
    setNotes(updatedNotes);
  }, [isDragging, draggedNoteIndex, dragOffset, notes]);

  // 鼠标释放事件
  const handleMouseUp = useCallback(() => {
    if (isDragging && draggedNoteIndex !== null) {
      saveToLocalStorage(notes);
    }
    
    setIsDragging(false);
    setDraggedNoteIndex(null);
  }, [isDragging, draggedNoteIndex, notes, saveToLocalStorage]);

  // 添加双击便签处理
  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    if (!canvasRef.current) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const hit = getNoteAtPosition(x, y);
    if (hit) {
      setEditingNoteId(hit.note.id);
      setEditingText(hit.note.text);
      
      // 暂停绘制刷新
      isEditingRef.current = true;
      
      // 延迟聚焦，确保文本区域已渲染
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
        }
      }, 10);
    }
  }, [getNoteAtPosition]);

  // 处理文本编辑完成
  const handleEditComplete = useCallback(() => {
    if (editingNoteId) {
      // 查找并更新便签
      const updatedNotes = notes.map(note => {
        if (note.id === editingNoteId) {
          return { ...note, text: editingText };
        }
        return note;
      });
      
      setNotes(updatedNotes);
      saveToLocalStorage(updatedNotes);
      setEditingNoteId(null);
      
      // 恢复绘制刷新
      isEditingRef.current = false;
    }
  }, [editingNoteId, editingText, notes, saveToLocalStorage]);

  // 监听窗口大小变化
  useEffect(() => {
    const handleResize = () => {
      redrawCanvas();
    };
    
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [redrawCanvas]);

  // 组件挂载/笔记更新时重绘
  useEffect(() => {
    redrawCanvas();
  }, [notes, redrawCanvas]);
  
  // 初始加载数据
  useEffect(() => {
    if (!isInitializedRef.current) {
      const loadedNotes = loadFromLocalStorage();
      if (loadedNotes.length > 0) {
        setNotes(loadedNotes);
      }
      isInitializedRef.current = true;
    }
  }, [loadFromLocalStorage]);

  return (
    <div 
      ref={containerRef}
      style={{ 
        width: '100%', 
        height: '600px', 
        position: 'relative', 
        border: '1px solid #e5e7eb',
        borderRadius: '4px',
        overflow: 'hidden',
        backgroundColor: '#fafafa'
      }}
    >
      <canvas
        ref={canvasRef}
        style={{ 
          display: 'block', 
          width: '100%', 
          height: '100%' 
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onDoubleClick={handleDoubleClick}
      />
      
      {/* 编辑状态文本框 - 添加溢出处理 */}
      {editingNoteId && (
        <div
          style={{
            position: 'absolute',
            left: notes.find(n => n.id === editingNoteId)?.x || 0,
            top: notes.find(n => n.id === editingNoteId)?.y || 0,
            width: notes.find(n => n.id === editingNoteId)?.width || 200,
            height: notes.find(n => n.id === editingNoteId)?.height || 100,
            zIndex: 1000,
            maxWidth: '95%', // 限制最大宽度
            maxHeight: '80%', // 限制最大高度
          }}
        >
          <textarea
            ref={textareaRef}
            value={editingText}
            onChange={(e) => setEditingText(e.target.value)}
            onBlur={handleEditComplete}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && e.ctrlKey) {
                handleEditComplete();
              }
            }}
            style={{
              width: '100%',
              height: '100%',
              padding: '10px',
              border: '2px solid #3b82f6',
              borderRadius: '5px',
              backgroundColor: notes.find(n => n.id === editingNoteId)?.color || '#fff9c4',
              resize: 'none',
              outline: 'none',
              fontFamily: 'Arial, sans-serif',
              fontSize: '14px',
              overflow: 'auto' // 确保文本溢出时可滚动
            }}
          />
        </div>
      )}
      
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
        onClick={saveBoard}
      >
        保存白板
      </button>
      <div style={{
        position: 'absolute',
        bottom: '10px',
        right: '10px',
        color: '#6b7280',
        fontSize: '12px'
      }}>
        便签总数: {notes.length} {editingNoteId ? '(编辑中...)' : ''}
      </div>
      
      {/* 添加白板使用指南 */}
      <div style={{
        position: 'absolute',
        bottom: '10px',
        left: '10px',
        color: '#6b7280',
        fontSize: '12px'
      }}>
        提示: 双击便签可编辑内容
      </div>
    </div>
  );
});

export default SimpleBoard; 