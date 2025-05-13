import React, { useEffect, useState, useCallback, useRef, forwardRef, useImperativeHandle } from 'react';
import { Excalidraw, exportToBlob, serializeAsJSON } from '@excalidraw/excalidraw';
// 使用any类型避免复杂的类型依赖问题
import { toast } from 'react-hot-toast';

interface ExcalidrawBoardProps {
  notebookId: string;
  onSave?: (content: any) => void;
}

// 导出白板引用类型，以便其他组件可以调用白板方法
export interface ExcalidrawBoardRef {
  addTextToBoard: (text: string) => void;
  saveBoard: () => void;
}

/**
 * ExcalidrawBoard组件 - 提供绘图白板功能
 * @param {string} notebookId - 笔记本ID
 * @param {Function} onSave - 可选保存回调函数
 */
const ExcalidrawBoard = forwardRef<ExcalidrawBoardRef, ExcalidrawBoardProps>(({ notebookId, onSave }, ref) => {
  const [ready, setReady] = useState(false);
  const [elements, setElements] = useState<readonly any[]>([]);
  const [appState, setAppState] = useState({});
  const excalidrawRef = useRef<any>(null);
  
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
      
      const key = `excalidraw_whiteboard_${notebookId}`;
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
      const key = `excalidraw_whiteboard_${notebookId}`;
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

  // 在组件加载时读取保存的数据
  useEffect(() => {
    if (!ready) return;
    
    const savedContent = loadFromLocalStorage();
    if (savedContent && excalidrawRef.current) {
      try {
        const parsedContent = JSON.parse(savedContent);
        if (parsedContent.elements) {
          setElements(parsedContent.elements);
          if (parsedContent.appState) {
            setAppState(parsedContent.appState);
          }
        }
      } catch (e) {
        console.error('解析保存的白板内容失败:', e);
      }
    }
  }, [ready, loadFromLocalStorage]);

  // 生成随机位置，但确保在可见区域内
  const getRandomPosition = () => {
    const viewportWidth = window.innerWidth * 0.6; // 视口宽度的60%
    const viewportHeight = window.innerHeight * 0.6; // 视口高度的60%
    
    return {
      x: 50 + Math.random() * (viewportWidth - 300),
      y: 50 + Math.random() * (viewportHeight - 200)
    };
  };

  // 添加文本到白板
  const addTextToBoard = useCallback((text: string) => {
    if (!excalidrawRef.current || !text) {
      console.error('编辑器未准备好或文本为空，无法添加内容');
      toast.error('无法添加内容到白板');
      return;
    }
    
    try {
      console.log('尝试向白板添加内容...');
      
      // 获取随机位置
      const position = getRandomPosition();
      
      // 创建新的便签元素
      const newTextElement = {
        id: `text-${Date.now()}`,
        type: "text",
        x: position.x,
        y: position.y,
        width: 300,
        height: Math.min(Math.max(text.length / 2, 100), 320),
        fontSize: 20,
        fontFamily: 1,
        text: text.substring(0, 500) + (text.length > 500 ? '...' : ''),
        textAlign: "left",
        verticalAlign: "top",
        strokeWidth: 1,
        strokeStyle: "solid",
        roughness: 1,
        opacity: 100,
        backgroundColor: "#fff9c4",
        fillStyle: "solid",
        strokeColor: "#000000",
        strokeSharpness: "sharp",
        seed: Math.floor(Math.random() * 1000),
        version: 1,
        versionNonce: Math.floor(Math.random() * 1000),
        isDeleted: false,
        groupIds: [],
        boundElements: null,
        link: null,
        locked: false,
        containerId: null,
        updated: Date.now(),
        roundness: null,
        baseline: 0,
        hasText: true
      };
      
      // 更新元素数组
      const updatedElements = [...elements, newTextElement];
      setElements(updatedElements);
      
      // 通知excalidraw实例
      if (excalidrawRef.current?.updateScene) {
        excalidrawRef.current.updateScene({
          elements: updatedElements
        });
      }
      
      // 保存白板状态
      saveCurrentState();
      
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
  }, [elements, saveToLocalStorage]);
  
  // 保存当前状态
  const saveCurrentState = useCallback(() => {
    if (!excalidrawRef.current) {
      return;
    }
    
    try {
      // 简化序列化，只保存基本的JSON结构
      const sceneData = {
        elements: elements,
        appState: appState || {}
      };
      
      // 使用JSON.stringify替代serializeAsJSON
      const serializedData = JSON.stringify(sceneData);
      
      saveToLocalStorage(serializedData);
    } catch (e) {
      console.error('保存当前状态失败:', e);
    }
  }, [elements, appState, saveToLocalStorage]);
  
  // 处理元素变更
  const handleChange = useCallback((els: readonly any[]) => {
    setElements(els);
  }, []);
  
  // 暴露方法给父组件
  useImperativeHandle(ref, () => ({
    addTextToBoard,
    saveBoard: saveCurrentState
  }));

  // 处理手动保存
  const handleSave = useCallback(() => {
    saveCurrentState();
    toast.success('白板内容已保存');
  }, [saveCurrentState]);

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
          {/* 根据Excalidraw文档使用正确的props */}
          <Excalidraw
            initialData={{
              elements: elements,
              appState: appState,
              scrollToContent: true
            }}
            onChange={(els) => {
              setElements(els);
            }}
            onPointerUpdate={() => {}}
            viewModeEnabled={false}
            zenModeEnabled={false}
            gridModeEnabled={false}
            excalidrawAPI={(api) => {
              excalidrawRef.current = api;
            }}
          />
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

export default ExcalidrawBoard; 