console.log('TIPTAP_NOTEBOOK_FILE_LOADED_VERSION_JULY_17_001'); // 新增的顶部日志
import React, { useEffect, forwardRef, useImperativeHandle, useState, useCallback } from 'react';
import { useEditor, EditorContent, BubbleMenu } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Link from '@tiptap/extension-link';
import Superscript from '@tiptap/extension-superscript'; // 导入上标扩展
import Subscript from '@tiptap/extension-subscript';   // 导入下标扩展
import Underline from '@tiptap/extension-underline'; // 导入下划线扩展
import Image from '@tiptap/extension-image'; // 导入图片扩展
// 导入 Tiptap 编辑器的核心类型，如果需要直接引用
import type { Editor } from '@tiptap/core';
import {
  ListBulletIcon,
  QueueListIcon, // 作为有序列表的替代图标
  ChatBubbleLeftIcon, // 更正: 使用 ChatBubbleLeftIcon
  CodeBracketIcon,
  MinusIcon as StrikeIconHero, // 删除线图标
  LinkIcon as LinkIconHero,         // 链接图标
  PhotoIcon as ImageIconHero,      // 图片图标
  // ArrowUpTrayIcon, // 不再需要，使用文本图标
  // ArrowDownTrayIcon, // 不再需要，使用文本图标
} from '@heroicons/react/24/outline'; // 使用outline风格

// 定义 API 接口，这与之前的 Ref 接口类似
export interface TiptapNotebookApi {
  addTextToNotebook: (text: string) => void;
  getEditorContent: () => string;
  saveNotebook: () => Promise<boolean | void>;
}

interface TiptapNotebookProps {
  notebookId: string;
  initialContent?: string;
  initialTitle?: string;
  onSave: (content: string, title: string) => Promise<void>;
  onApiReady?: (api: TiptapNotebookApi | null) => void; // 修改 prop 名称和签名
  style?: React.CSSProperties;
}

// 统一的图标包裹样式，确保垂直对齐和一致大小
const iconWrapperClass = "inline-flex items-center justify-center w-4 h-4"; // 统一尺寸为 w-4 h-4

// 自定义图标，应用统一包裹样式
const H1Icon = () => <span className={`${iconWrapperClass} font-bold text-xs px-0.5`}>H1</span>;
const H2Icon = () => <span className={`${iconWrapperClass} font-bold text-xs px-0.5`}>H2</span>;
const BoldIcon = () => <span className={`${iconWrapperClass} font-bold text-sm px-0.5`}>B</span>;
const ItalicIcon = () => <span style={{fontStyle: 'italic', fontWeight: '500'}} className={`${iconWrapperClass} text-sm px-0.5`}>I</span>;
const SupIcon = () => <span className={`${iconWrapperClass} text-sm px-0.5`}>X²</span>;
const SubIcon = () => <span className={`${iconWrapperClass} text-sm px-0.5`}>X₂</span>;
const UnderlineIcon = () => <span className={`${iconWrapperClass} underline text-sm px-0.5`}>U</span>;
const StrikeIcon = () => (
  <span className={`${iconWrapperClass} relative text-sm font-medium px-0.5`}>
    S
    <span 
      className="absolute left-0 w-full bg-current transform -translate-y-1/2"
      style={{ height: '1px', top: '50%' }}
    >
    </span>
  </span>
);
const LinkActionIcon = () => <LinkIconHero className={`${iconWrapperClass}`} />;
const ImageActionIcon = () => <ImageIconHero className={`${iconWrapperClass}`} />;

const TiptapNotebook = forwardRef<TiptapNotebookApi, TiptapNotebookProps>((
  { notebookId, initialContent = '', initialTitle = '', onSave, onApiReady, style },
  ref // ref 仍可用于其他目的
) => {
  const [currentTitle, setCurrentTitle] = useState<string>(initialTitle);
  const [isContentLoaded, setIsContentLoaded] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // 在这里可以配置 StarterKit 中的各个插件，例如禁用某些不想要的
        heading: {
          levels: [1, 2, 3],
        },
        // strike: false, // 如果想禁用 StarterKit 中的删除线，可以这样配置
        // history: false, // 如果想自定义历史记录处理
      }),
      Placeholder.configure({
        placeholder: '开始输入笔记内容...',
      }),
      Link.configure({
        openOnClick: true, // 点击链接时自动打开
        autolink: true,    // 自动将文本中的URL转换为链接
        linkOnPaste: true, // 粘贴时自动转换链接
      }),
      Superscript, // 添加上标扩展
      Subscript,   // 添加下标扩展
      Underline,   // 添加下划线扩展
      Image,       // 添加图片扩展
      // 未来会在这里添加图片上传、自定义浮动工具栏等扩展
    ],
    content: '', // 初始内容设置为空，通过 useEffect 更新
    immediatelyRender: false,
    // 当编辑器内容改变时触发
    onUpdate: ({ editor: currentEditor }) => {
      // 可以在这里获取内容并更新父组件状态或触发自动保存
      // const html = currentEditor.getHTML();
      // console.log(html);
    },
    // 当编辑器失去焦点时，可以触发保存
    onBlur: ({ editor }) => {
      console.log('[Tiptap onBlur] Editor lost focus. Saving...');
      const html = editor.getHTML();
      onSave(html, currentTitle); // 传递当前标题
    },
  });

  // 将 useCallback 定义移到可能导致提前返回的 if (!editor) 语句之前
  const handleSetLink = useCallback(() => {
    if (!editor) return;
    const previousUrl = editor.getAttributes('link').href;
    const url = window.prompt('请输入链接 URL', previousUrl || 'https://');
    if (url === null) return;
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  }, [editor]);

  const handleAddImage = useCallback(() => {
    if (!editor) return;
    const url = window.prompt('请输入图片 URL');
    if (url) {
      editor.chain().focus().setImage({ src: url }).run();
    }
  }, [editor]);

  // 使用 useMemo 创建稳定的 API 对象
  const exposedApi = React.useMemo<TiptapNotebookApi | null>(() => {
    if (!editor) {
      return null;
    }
    return {
      addTextToNotebook: (text: string) => {
        if (editor) {
          const { from, to } = editor.state.selection;
          editor.chain().focus().insertContentAt(to, text).run();
        } else {
          console.warn('[Tiptap addTextToNotebook] Editor not available when called via API.');
        }
      },
      getEditorContent: () => {
        if (editor) {
          return editor.getHTML();
        } else {
          console.warn('[Tiptap getEditorContent] Editor not available when called via API.');
          return '';
        }
      },
      saveNotebook: async () => {
        if (!editor) {
          console.error('[Tiptap saveNotebook via API] Editor instance is not available.');
          return false;
        }
        if (!currentTitle.trim()) {
          console.error('[Tiptap saveNotebook via API] 笔记标题不能为空!');
          // toast.error('笔记标题不能为空!'); // 如果有全局 toast 实例，可以在这里使用
          return false;
        }
        try {
          const htmlContent = editor.getHTML();
          console.log(`[Tiptap saveNotebook via API] Saving with title: "${currentTitle}", content length: ${htmlContent.length}`);
          await onSave(htmlContent, currentTitle);
          console.log('[Tiptap saveNotebook via API] 笔记已保存 (onSave promise resolved).');
          // toast.success('笔记已保存');
          return true;
        } catch (error) {
          console.error("[Tiptap saveNotebook via API] 保存笔记失败:", error);
          // toast.error('保存笔记失败');
          return false;
        }
      },
    };
  }, [editor, currentTitle, onSave]); // 确保依赖项正确

  // Effect to signal API readiness
  useEffect(() => {
    console.log('TIPTAP_NOTEBOOK_EFFECT_RUNNING_VERSION_JULY_17_001'); // 新增的Effect内部日志
    if (onApiReady) {
      if (exposedApi) {
        console.log(`[TiptapNotebook Effect] API is ready for notebookId: ${notebookId}. Calling onApiReady with API object.`);
        onApiReady(exposedApi);
      } else {
        // This case might happen if editor becomes null after being ready
        // console.log(`[TiptapNotebook Effect] Editor became unavailable for notebookId: ${notebookId}. Calling onApiReady(null).`);
        // onApiReady(null);
      }
    }
    return () => {
      if (onApiReady) {
        // console.log(`[TiptapNotebook Effect Cleanup] API unmounting/changing for notebookId: ${notebookId}. Calling onApiReady(null).`);
        // onApiReady(null);
      }
    };
  }, [exposedApi, notebookId, onApiReady]);

  // 当 initialContent 或 notebookId 变化时，更新编辑器内容
  // Tiptap 的 useEditor 会在 content prop 变化时自动更新，但为了确保切换笔记时内容正确加载，
  // 我们使用 useEffect 来显式设置内容。
  useEffect(() => {
    if (editor && initialContent !== editor.getHTML() && !isContentLoaded) {
      console.log(`[Tiptap Effect] notebookId: ${notebookId} changed or initialContent updated. Setting editor content.`);
      editor.commands.setContent(initialContent || '');
      setIsContentLoaded(true); // 标记内容已加载
    }
  }, [editor, initialContent, notebookId]);
  
  // 当 initialTitle 变化时，更新 currentTitle
  useEffect(() => {
    setCurrentTitle(initialTitle);
  }, [initialTitle, notebookId]);

  // 当 initialContent 完全改变时 (例如切换笔记)，重置 isContentLoaded
  useEffect(() => {
    setIsContentLoaded(false);
  }, [initialContent, notebookId]);

  // useImperativeHandle 仍然可以暴露相同的 API，确保 ref 的一致性
  useImperativeHandle(ref, () => exposedApi || {
    addTextToNotebook: () => console.warn("Fallback ref: Editor not ready for addTextToNotebook"),
    getEditorContent: () => { console.warn("Fallback ref: Editor not ready for getEditorContent"); return ""; },
    saveNotebook: async () => { console.warn("Fallback ref: Editor not ready for saveNotebook"); return false; },
  }, [exposedApi]);

  const handleManualSave = useCallback(() => {
    if (editor) {
      console.log('[Tiptap handleManualSave] Triggered.');
      const html = editor.getHTML();
      onSave(html, currentTitle); 
      // 可选：显示保存成功的 toast 消息
      // toast.success('笔记已保存!'); 
    }
  }, [editor, onSave, currentTitle]);

  // 条件返回语句现在位于所有 Hook 定义之后
  if (!editor) {
    return <div style={{ padding: '1rem', color: 'gray' }}>编辑器加载中...</div>;
  }

  const iconButtonClass = (isActive: boolean) => 
    `p-0.5 rounded ${isActive ? 'bg-gray-300 text-black' : 'hover:bg-gray-200 text-black'}`;
    // 图标更小一点，按钮内边距也小一点，确保一行显示

  return (
    <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', height: '100%', ...style }}>
      {/* 
        这里暂时不放标题输入框，因为我们首先要让Tiptap编辑器本身工作。
        标题的处理方式后续再定，是放在编辑器外部，还是作为编辑器内容的一部分。
        <input 
          type="text" 
          value={currentTitle} 
          onChange={(e) => setCurrentTitle(e.target.value)}
          placeholder="笔记标题"
          style={{ marginBottom: '10px', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }} 
        /> 
      */}
      <BubbleMenu
        editor={editor}
        tippyOptions={{ duration: 100, placement: 'top-start' }}
        className="bubble-menu"
        shouldShow={({ editor, view, state, oldState, from, to }) => {
          // 仅在文本被选中时显示
          const { selection } = state;
          const { empty } = selection;
          if (empty) {
            return false;
          }
          return from !== to; // 确保有选区
        }}
      >
        <div className="flex items-center space-x-0.5 bg-white text-black p-0.5 rounded shadow-lg border border-gray-300 flex-nowrap overflow-x-auto">
          <button
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={iconButtonClass(editor.isActive('bold'))}
            title="加粗"
          >
            <BoldIcon />
          </button>
          <button
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={`${iconButtonClass(editor.isActive('italic'))} -ml-[3px]`}
            title="斜体"
          >
            <ItalicIcon />
          </button>
          <button
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            className={iconButtonClass(editor.isActive('heading', { level: 1 }))}
            title="标题1"
          >
            <H1Icon />
          </button>
          <button
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            className={iconButtonClass(editor.isActive('heading', { level: 2 }))}
            title="标题2"
          >
            <H2Icon />
          </button>
          <button
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={iconButtonClass(editor.isActive('bulletList'))}
            title="无序列表"
          >
            <ListBulletIcon className={iconWrapperClass} />
          </button>
          <button
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            className={iconButtonClass(editor.isActive('orderedList'))}
            title="有序列表"
          >
            <QueueListIcon className={iconWrapperClass} /> 
          </button>
          <button
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            className={iconButtonClass(editor.isActive('blockquote'))}
            title="引用"
          >
            <ChatBubbleLeftIcon className={iconWrapperClass} />
          </button>
          <button
            onClick={() => editor.chain().focus().toggleCodeBlock().run()}
            className={iconButtonClass(editor.isActive('codeBlock'))}
            title="代码块"
          >
            <CodeBracketIcon className={iconWrapperClass} />
          </button>
          <button
            onClick={() => editor.chain().focus().toggleSuperscript().run()}
            className={iconButtonClass(editor.isActive('superscript'))}
            title="上标"
          >
            <SupIcon />
          </button>
          <button
            onClick={() => editor.chain().focus().toggleSubscript().run()}
            className={iconButtonClass(editor.isActive('subscript'))}
            title="下标"
          >
            <SubIcon />
          </button>
          <button
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            className={iconButtonClass(editor.isActive('underline'))}
            title="下划线"
          >
            <UnderlineIcon />
          </button>
          <button
            onClick={() => editor.chain().focus().toggleStrike().run()}
            className={iconButtonClass(editor.isActive('strike'))}
            title="删除线"
          >
            <StrikeIcon />
          </button>
          <button
            onClick={handleSetLink}
            className={iconButtonClass(editor.isActive('link'))}
            title="插入/编辑链接"
          >
            <LinkActionIcon />
          </button>
          <button
            onClick={handleAddImage}
            className={iconButtonClass(false)}
            title="插入图片"
          >
            <ImageActionIcon />
          </button>
        </div>
      </BubbleMenu>
      <EditorContent editor={editor} style={{ flexGrow: 1, overflowY: 'auto', padding: '0.5rem' }} />
    </div>
  );
});

TiptapNotebook.displayName = 'TiptapNotebook'; // 添加 displayName

export default TiptapNotebook; 