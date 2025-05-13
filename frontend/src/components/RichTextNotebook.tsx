import React, { useState, useEffect, useRef, useImperativeHandle, forwardRef, useCallback } from 'react';
// 移除顶部的静态导入
// import { CKEditor } from '@ckeditor/ckeditor5-react';
// import ClassicEditorCore from '@ckeditor/ckeditor5-build-classic';
import { toast } from 'react-hot-toast'; // 假设你已经安装并配置了 react-hot-toast
// 仅保留类型导入
import type { Editor } from '@ckeditor/ckeditor5-core'; // CKEditor 核心类型
import type { RootElement } from '@ckeditor/ckeditor5-engine'; // RootElement 类型
import { useAutosave } from '../hooks/useAutosave'; // Back to relative path

// 移除这行，因为我们将在客户端条件中动态导入
// const ClassicEditor = ClassicEditorCore as any;

export interface RichTextNotebookRef {
  addTextToNotebook: (text: string) => void;
  getEditorContent: () => string; // 新增一个获取内容的方法，如果需要的话
  saveNotebook: () => Promise<void>; // 新增 saveNotebook 以匹配 MarkdownNotebookRef 的部分需求
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
  const imgRegex = /<img[^>]+src=["']?([^"'>]+)["']?/g;
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
  const editorInstanceRef = useRef<any | null>(null); // 修改类型为any
  // 记录上一次内容中的图片URL
  const prevImageUrlsRef = useRef<string[]>(extractImageUrls(initialContent));

  // 当 initialContent 或 initialTitle 改变时 (例如，用户选择了不同的笔记)，更新编辑器内容和标题
  useEffect(() => {
    setEditorData(initialContent);
    setTitle(initialTitle);
    if (editorInstanceRef.current && editorInstanceRef.current.getData() !== initialContent) {
      editorInstanceRef.current.setData(initialContent);
    }
  }, [initialContent, initialTitle, notebookId]);

  const handleSave = async () => {
    if (!title.trim()) {
      toast.error('笔记标题不能为空!');
      return; // 返回，不继续执行保存
    }
    try {
      const currentEditorData = editorInstanceRef.current ? editorInstanceRef.current.getData() : editorData;
      await onSave(currentEditorData, title);
      toast.success('笔记已保存');
    } catch (error) {
      toast.error('保存笔记失败');
      console.error("保存笔记失败:", error);
      throw error; // 重新抛出错误，以便 saveNotebook 可以捕获
    }
  };

  // Define the actual save function for the hook
  const performAutosave = useCallback(async (saveData: NoteAutosaveData) => {
    // Check for title similar to handleSave, but maybe less strict feedback for autosave?
    if (!saveData.title.trim()) {
      console.warn('Autosave skipped: Title is empty.');
      // Decide if you want to prevent autosave without title or save anyway
      // return; // Uncomment to prevent saving without title
    }
    try {
      // Call the original onSave prop passed from the parent
      await onSave(saveData.content, saveData.title);
      console.log('Note autosaved successfully (ID:', saveData.noteId, ')');
      // Optional: Update a subtle UI indicator for "Saved" status here
    } catch (error) {
      console.error('Autosave failed:', error);
      toast.error('自动保存笔记失败'); // Keep error toast for autosave failure
      // Optional: Update UI indicator for "Error" status
    }
  }, [onSave, notebookId]);

  // Use the autosave hook
  useAutosave<NoteAutosaveData>({
    // Data object that triggers the save when its reference changes
    data: { noteId: notebookId, content: editorData, title }, // Corrected: use notebookId from props
    onSave: performAutosave,
    debounceMs: 2500, // 2.5 seconds delay
    enabled: !!notebookId, // Enable only if notebookId is valid
  });

  const handleEditorChange = (event: any, editor: any) => {
    const data = editor.getData();
    setEditorData(data);
    // 检查图片删除
    const currentImageUrls = extractImageUrls(data);
    const prevImageUrls = prevImageUrlsRef.current;
    // 找出被删除的图片URL
    const deleted = prevImageUrls.filter(url => !currentImageUrls.includes(url));
    if (deleted.length > 0) {
      deleted.forEach(url => {
        // 只处理本地上传的图片
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
    // 更新记录
    prevImageUrlsRef.current = currentImageUrls;
  };

  // 暴露方法给父组件
  useImperativeHandle(ref, () => ({
    // 添加文本到编辑器
    addTextToNotebook: (text: string) => {
      if (editorInstanceRef.current) {
        const currentContent = editorInstanceRef.current.getData();
        const newContent = currentContent ? `${currentContent}\n${text}` : text;
        editorInstanceRef.current.setData(newContent);
        setEditorData(newContent);
      }
    },
    // 获取编辑器内容
    getEditorContent: () => {
      return editorInstanceRef.current ? editorInstanceRef.current.getData() : editorData;
    },
    // 保存笔记本
    saveNotebook: async () => {
      await handleSave();
    }
  }));

  // 检测是否在浏览器环境中
  const isBrowser = typeof window !== 'undefined';
  
  // 仅在浏览器环境中导入CKEditor
  let CKEditorComponent = null;
  let ClassicEditorComponent = null;
  
  if (isBrowser) {
    // 动态导入
    try {
      CKEditorComponent = require('@ckeditor/ckeditor5-react').CKEditor;
      ClassicEditorComponent = require('@ckeditor/ckeditor5-build-classic');
    } catch (error) {
      console.error('Failed to load CKEditor:', error);
    }
  }

  return (
    <div 
      className="richtext-notebook-container"
      style={{
        display: 'flex', // 改为 Flex 布局
        flexDirection: 'column', // 垂直排列
        height: '100%', // 自身高度100%，依赖父级
        minHeight: 0,   // 防止 flex item 内容溢出撑开父级
        ...style
      }}
    >
      {/* 标题输入框不再显示在这里，而是由父组件 NotebookLayout 控制 */}

      {/* 编辑器容器，占据所有剩余空间，使用莫兰迪色系背景 */}
      <div 
        style={{ 
          flexGrow: 1, // 占据所有剩余空间
          minHeight: 0, // 关键，允许 CKEditor 在此容器内滚动
          display: 'flex', // 使 CKEditor 能够在其内部撑满
          flexDirection: 'column',
          backgroundColor: 'var(--bg-notes)', // 应用莫兰迪色系背景色
          borderRadius: '8px', // 添加圆角
          border: '1px solid var(--panel-border)', // 添加边框
          boxShadow: 'var(--panel-shadow)', // 添加阴影
          width: '100%', // 确保宽度填满父容器
          height: '100%', // 确保高度填满父容器
          padding: '0', // 移除内边距
          margin: '0', // 移除外边距
          overflow: 'hidden', // 防止溢出
        }}
      >
        {/* 仅在浏览器环境中渲染CKEditor */}
        {isBrowser && CKEditorComponent ? (
          <CKEditorComponent
            editor={ClassicEditorComponent}
            data={editorData}
            style={{
              height: '100%',
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              flex: 1
            }}
            config={{
              // 配置工具栏
              toolbar: {
                items: [
                  'heading',
                  '|',
                  'bold',
                  'italic',
                  'link',
                  'bulletedList',
                  'numberedList',
                  '|',
                  'outdent',
                  'indent',
                  '|',
                  'imageUpload',
                  'blockQuote',
                  'insertTable',
                  'mediaEmbed',
                  'undo',
                  'redo'
                ]
              },
              // 配置图片上传
              image: {
                toolbar: [
                  'imageStyle:full',
                  'imageStyle:side',
                  '|',
                  'imageTextAlternative'
                ]
              },
              // 配置表格
              table: {
                contentToolbar: [
                  'tableColumn',
                  'tableRow',
                  'mergeTableCells'
                ]
              },
              // 添加自定义上传适配器
              extraPlugins: [MyCustomUploadAdapterPlugin],
            }}
            onReady={(editor: any) => {
              editorInstanceRef.current = editor;
              // 使用新的方法来获取和设置编辑器容器样式
              if (editor.ui && editor.ui.view && editor.ui.view.editable) {
                const editableElement = editor.ui.getEditableElement() as HTMLElement;
                if (editableElement) {
                  editableElement.style.height = 'calc(100% - 41px)'; // 减去工具栏大致高度
                  editableElement.style.overflowY = 'auto'; // 确保内容可滚动
                  editableElement.style.border = 'none'; // 移除默认边框
                  editableElement.style.padding = '10px'; // 添加一些内边距
                  editableElement.style.boxShadow = 'none'; // 移除默认阴影
                  editableElement.style.borderRadius = '0'; // 移除默认圆角
                  
                   // 修改工具栏样式
                  const toolbarElement = editor.ui.view.toolbar.element as HTMLElement;
                  if (toolbarElement) {
                    toolbarElement.style.border = 'none';
                    toolbarElement.style.borderBottom = '1px solid var(--panel-border)'; // 保留下边框
                    toolbarElement.style.backgroundColor = 'var(--bg-secondary)'; // 背景色
                    // 设置最小垂直内边距，并尝试减小字体和行高
                    toolbarElement.style.padding = '0px 8px'; // 垂直内边距设为 0px
                    toolbarElement.style.fontSize = '0.75rem'; // 尝试缩小字体 (等同于 text-xs)
                    toolbarElement.style.lineHeight = '1';    // 尝试减小行高
                  }
                }
              }
              console.log('CKEditor is ready to use!', editor);
            }}
            onChange={handleEditorChange}
            onBlur={(event: any, editor: any) => {
              console.log('编辑器失去焦点', editor);
            }}
            onFocus={(event: any, editor: any) => {
              console.log('编辑器获得焦点', editor);
            }}
          />
        ) : (
          // 服务器端渲染时显示加载中或占位符
          <div style={{ padding: '20px', textAlign: 'center' }}>
            加载编辑器中...
          </div>
        )}
      </div>

      {/* 移除底部工具栏，不再显示保存按钮 */}
    </div>
  );
});

RichTextNotebook.displayName = 'RichTextNotebook';

export default RichTextNotebook;