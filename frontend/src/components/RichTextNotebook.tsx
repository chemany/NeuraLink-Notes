import React, { useState, useEffect, useRef, useImperativeHandle, forwardRef, useCallback, useMemo } from 'react';
// 移除顶部的静态导入
// import { CKEditor } from '@ckeditor/ckeditor5-react';
// import ClassicEditorCore from '@ckeditor/ckeditor5-build-classic';
import { toast } from 'react-hot-toast'; // 假设你已经安装并配置了 react-hot-toast
// 仅保留类型导入
import type { Editor } from '@ckeditor/ckeditor5-core'; // CKEditor 核心类型
import type { RootElement } from '@ckeditor/ckeditor5-engine'; // RootElement 类型
import type InlineEditorCore from '@ckeditor/ckeditor5-build-inline'; // 添加 InlineEditor 类型 (如果需要直接引用其类型)
import { useAutosave } from '../hooks/useAutosave'; // Back to relative path

// 移除这行，因为我们将在客户端条件中动态导入
// const ClassicEditor = ClassicEditorCore as any;

export interface RichTextNotebookRef {
  addTextToNotebook: (text: string) => void;
  getEditorContent: () => string; // 新增一个获取内容的方法，如果需要的话
  saveNotebook: () => Promise<boolean | void>; // 修改返回类型以匹配 handleSave
}

interface RichTextNotebookProps {
  notebookId: string;
  initialContent?: string; // 用于加载已有的笔记内容
  initialTitle?: string; // 用于加载已有的笔记标题
  onSave: (content: string, title: string) => Promise<void>; // 保存笔记的回调
  style?: React.CSSProperties; // 新增：支持自定义样式
}

// 自定义图片上传适配器，带类型声明
class MyUploadAdapter {
  loader: any;
  constructor(loader: any) {
    this.loader = loader;
  }
  // 上传逻辑：将图片文件POST到后端，返回图片URL
  upload(): Promise<{ default: string }> {
    return this.loader.file.then((file: File) => {
      const data = new FormData();
      data.append('file', file);
      return fetch('http://localhost:3001/api/upload/image', {
        method: 'POST',
        body: data,
      })
        .then(res => {
          if (!res.ok) {
            // 读取文本内容用于调试
            return res.text().then(text => {
              toast.error(`图片上传失败: ${text}`);
              throw new Error(`图片上传失败: ${text}`);
            });
          }
          return res.json();
        })
        .then(res => {
          if (!res.url) {
            toast.error('图片上传失败: 未返回图片URL');
            throw new Error('图片上传失败: 未返回图片URL');
          }
          // 返回图片URL，CKEditor会自动插入图片
          return { default: res.url };
        });
    });
  }
  abort() {}
}

// 工厂函数：为CKEditor注册自定义上传适配器
function MyCustomUploadAdapterPlugin(editor: any) {
  editor.plugins.get('FileRepository').createUploadAdapter = (loader: any) => {
    return new MyUploadAdapter(loader);
  };
}

// 工具函数：从HTML内容中提取所有图片URL
function extractImageUrls(html: string): string[] {
  const imgRegex = /<img[^>]+src=["\']?([^\"\'>]+)[\"\']?/g;
  const urls: string[] = [];
  let match;
  while ((match = imgRegex.exec(html)) !== null) {
    urls.push(match[1]);
  }
  return urls;
}

// Define the data structure for autosave
interface NoteAutosaveData {
  noteId: string;
  content: string;
  title: string;
}

const RichTextNotebook = forwardRef<RichTextNotebookRef, RichTextNotebookProps>((
  { notebookId, initialContent = '', initialTitle = '', onSave, style },
  ref
) => {
  const [editorData, setEditorData] = useState<string>(initialContent);
  const [title, setTitle] = useState<string>(initialTitle);
  const editorInstanceRef = useRef<InlineEditorCore | null>(null); // 修改类型为 InlineEditorCore
  // 记录上一次内容中的图片URL
  const prevImageUrlsRef = useRef<string[]>(extractImageUrls(initialContent));

  // Ref to manage toast display for autosave
  const canShowAutosaveToastRef = useRef(true); // Initially true
  const toastDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 当 initialContent 或 initialTitle 改变时 (例如，用户选择了不同的笔记)，更新编辑器内容和标题
  useEffect(() => {
    setEditorData(initialContent);
    setTitle(initialTitle);
  }, [initialContent, initialTitle, notebookId]);

  const handleSave = async (isAutosave = false) => {
    if (!title.trim()) {
      if (!isAutosave) {
        toast.error('笔记标题不能为空!');
      }
      return false;
    }
    try {
      // const currentEditorData = editorInstanceRef.current ? editorInstanceRef.current.getData() : editorData;
      // 确保 editorInstanceRef.current 存在并且是 InlineEditorCore 的实例
      let currentEditorData = editorData; // Default to state if editor instance not ready
      if (editorInstanceRef.current && typeof editorInstanceRef.current.getData === 'function') {
        currentEditorData = editorInstanceRef.current.getData();
      }
      await onSave(currentEditorData, title);
      if (!isAutosave) {
        toast.success('笔记已保存');
      }
      return true;
    } catch (error) {
      if (!isAutosave) {
        toast.error('保存笔记失败');
      }
      console.error("保存笔记失败:", error);
      // throw error; // 不再向上抛出，避免 useImperativeHandle 中的 saveNotebook 再次处理
      return false; // Indicate failure
    }
  };

  // Define the actual save function for the hook
  const performAutosave = useCallback(async (saveData: NoteAutosaveData) => {
    if (!saveData.title.trim()) { // Title check for autosave
      console.warn('[RichTextNotebook] Autosave skipped: Title is empty.');
      return false; // Autosave skipped
    }

    console.log('[RichTextNotebook] Performing autosave for note:', saveData.noteId, 'Title:', saveData.title);
    try {
      await onSave(saveData.content, saveData.title); // Use the original onSave prop
      console.log('[RichTextNotebook] Autosave successful for note:', saveData.noteId);
      
      if (canShowAutosaveToastRef.current) {
        toast.success('笔记已自动保存 ✓', { duration: 2000, position: 'bottom-center' });
        canShowAutosaveToastRef.current = false; // Prevent immediate re-toasting
        
        if (toastDebounceTimerRef.current) {
          clearTimeout(toastDebounceTimerRef.current);
        }
        toastDebounceTimerRef.current = setTimeout(() => {
          canShowAutosaveToastRef.current = true;
        }, 15000); // Allow another toast after 15 seconds of no saves
      }
      return true; // Autosave successful
    } catch (error) {
      console.error('[RichTextNotebook] Autosave failed for note:', saveData.noteId, error);
      toast.error('自动保存失败'); // Keep error toast for autosave failure
      return false; // Autosave failed
    }
  }, [onSave]);

  // Autosave hook configuration
  const autosaveEnabled = !!notebookId && !!title.trim(); // Enable only if notebookId AND title are valid

  const autosaveData = useMemo(() => ({
    noteId: notebookId,
    content: editorData,
    title,
  }), [notebookId, editorData, title]);

  useAutosave<NoteAutosaveData>({
    data: autosaveData, // 使用 useMemo 后的 data
    onSave: performAutosave,
    debounceMs: 3000, 
    enabled: autosaveEnabled, 
  });
  
  useEffect(() => {
      canShowAutosaveToastRef.current = true;
      if (toastDebounceTimerRef.current) {
          clearTimeout(toastDebounceTimerRef.current);
          toastDebounceTimerRef.current = null;
      }
  }, [notebookId]);


  const handleEditorChange = (event: any, editor: any) => {
    const data = editor.getData();
    setEditorData(data);
    const currentImageUrls = extractImageUrls(data);
    const prevImageUrls = prevImageUrlsRef.current;
    const deleted = prevImageUrls.filter(url => !currentImageUrls.includes(url));
    if (deleted.length > 0) {
      deleted.forEach(url => {
        if (url.startsWith('http://localhost:3001/uploads/images/')) {
          fetch('http://localhost:3001/api/upload/image', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url }),
          })
            .then(res => res.json())
            .then(res => {
              if (res.success) {
                toast.success('图片已从服务器删除');
              } else {
                toast.error('服务器图片删除失败: ' + (res.error || '未知错误'));
              }
            })
            .catch(err => {
              toast.error('图片删除请求失败');
              console.error('图片删除请求失败', err);
            });
        }
      });
    }
    prevImageUrlsRef.current = currentImageUrls;
  };

  useImperativeHandle(ref, () => ({
    addTextToNotebook: (text: string) => {
      if (editorInstanceRef.current) {
        const currentContent = editorInstanceRef.current.getData();
        const newContent = currentContent ? `${currentContent}\n${text}` : text;
        editorInstanceRef.current.setData(newContent);
        setEditorData(newContent);
      }
    },
    getEditorContent: () => {
      return editorInstanceRef.current ? editorInstanceRef.current.getData() : editorData;
    },
    saveNotebook: async () => {
      return await handleSave(); // Ensure it returns the boolean from handleSave
    }
  }));

  const isBrowser = typeof window !== 'undefined';
  
  let CKEditorComponent = null;
  let InlineEditorComponent = null; // 添加 InlineEditorComponent
  
  if (isBrowser) {
    try {
      CKEditorComponent = require('@ckeditor/ckeditor5-react').CKEditor;
      InlineEditorComponent = require('@ckeditor/ckeditor5-build-inline'); // 引入 InlineEditor
    } catch (error) {
      console.error("Error loading CKEditor components:", error);
    }
  }

  // 编辑器配置
  const editorConfiguration = useMemo(() => ({
    language: 'zh-cn', // 设置语言为中文
    extraPlugins: [MyCustomUploadAdapterPlugin], // 保留自定义上传插件
    placeholder: '请输入笔记内容...', // 可以为 InlineEditor 设置 placeholder
    toolbar: { // 添加显式工具栏配置
      items: [
        'heading', '|',
        'bold', 'italic', '|',
        'link', '|',
        'bulletedList', 'numberedList', '|',
        'blockQuote', '|',
        'undo', 'redo'
      ],
      // 对于 InlineEditor，工具栏默认就是浮动的，并尝试定位到选区或编辑区域。
      // isFloating: true, // 这个选项通常在 ClassicEditor 中使用，InlineEditor 默认为 true
      // viewportTopOffset: 15, // 如果工具栏被其他固定元素遮挡，可以尝试设置偏移
    }
  }), []); // 依赖项为空数组，因为配置不依赖外部可变状态

  if (!isBrowser || !CKEditorComponent || !InlineEditorComponent) {
    return <div style={{ padding: '20px', color: '#888' }}>Loading Editor...</div>;
  }
  
  console.log('[RichTextNotebook Render] notebookId:', notebookId, 'editorData:', typeof editorData, 'editorInstanceRef.current:', editorInstanceRef.current);

  return (
    <div style={{ flexGrow: 1, overflowY: 'auto', position: 'relative', height: '100%', width: '100%', ...style }}> 
        <CKEditorComponent
          key={notebookId}
          editor={InlineEditorComponent}
          data={editorData}
          config={editorConfiguration}
          onReady={(editor: InlineEditorCore) => {
            console.log('[RichTextNotebook onReady] Editor is ready. Assigning to editorInstanceRef.current.');
            editorInstanceRef.current = editor;
            console.log('[RichTextNotebook onReady] editorInstanceRef.current is now:', editorInstanceRef.current);
            
            // 增加 editor 实例有效性检查
            if (editor && editor.ui && editor.ui.view) { 
              console.log('[CKEditor Debug] editor.ui:', editor.ui);
              if (editor.ui.view.element) {
                console.log('[CKEditor Debug] UI View Element:', editor.ui.view.element);
              }
              try {
                const editableElement = editor.ui.getEditableElement();
                if (editableElement) {
                  console.log('[CKEditor Debug] Editable Element:', editableElement);
                  let currentElement = editableElement.parentElement;
                  let depth = 0;
                  console.log('[CKEditor Debug] --- Begin Parent Chain Analysis ---');
                  while (currentElement && depth < 10) {
                    const styles = getComputedStyle(currentElement);
                    console.log(`[CKEditor Debug] Parent ${depth}:`, 
                      currentElement.tagName, 
                      currentElement.className, 
                      {
                        scrollTop: currentElement.scrollTop, 
                        scrollHeight: currentElement.scrollHeight,
                        clientHeight: currentElement.clientHeight,
                        position: styles.position,
                        overflowY: styles.overflowY,
                        transform: styles.transform
                      }
                    );
                    currentElement = currentElement.parentElement;
                    depth++;
                  }
                  console.log('[CKEditor Debug] --- End Parent Chain Analysis ---');
                } else {
                  console.warn('[CKEditor Debug] Editable Element not found.');
                }
              } catch (e) {
                console.warn('[CKEditor Debug] Error during parent chain analysis:', e);
              }
            } else {
              console.warn('[RichTextNotebook onReady] Editor instance or editor.ui or editor.ui.view is not available.');
            }
          }}
          onChange={(event: any, editor: InlineEditorCore) => {
            const data = editor.getData();
            console.log('[RichTextNotebook onChange] Data changed, editorInstanceRef.current:', editorInstanceRef.current, 'New data length:', data.length);
            handleEditorChange(event, editor);
          }}
          onError={(error: any, { phase }: { phase: string }) => { 
            console.error('[RichTextNotebook onError] CKEditor Error during:', phase, error, 'editorInstanceRef.current:', editorInstanceRef.current);
            toast.error(`编辑器错误: ${phase}`);
          }}
          onFocus={(event: any, editor: InlineEditorCore) => { 
            console.log('[RichTextNotebook onFocus] Focus., editorInstanceRef.current:', editorInstanceRef.current);
          }}
          onBlur={(event: any, editor: InlineEditorCore) => { 
            console.log('[RichTextNotebook onBlur] Blur., editorInstanceRef.current:', editorInstanceRef.current);
          }}
        />
    </div>
  );
});

export default RichTextNotebook;