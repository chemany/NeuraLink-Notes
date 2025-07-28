'use client';

import React, { useEffect, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';
import { extractTextFromPPT } from '@/services/officeService';

interface PptxViewerProps {
  url: string;
  file?: File;
  className?: string;
}

const PptxViewer: React.FC<PptxViewerProps> = ({ url, file, className = '' }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pptxContent, setPptxContent] = useState<string>('');
  // 移除Office Online Viewer相关状态

  useEffect(() => {
    const loadPptx = async () => {
      try {
        setLoading(true);
        setError(null);

        console.log('[PptxViewer] 开始加载PPTX - 版本3.0 (完全禁用Office Online)', { url, hasFile: !!file });

        // 方法1: 如果有文件对象，直接提取文本内容进行预览
        if (file) {
          console.log('[PptxViewer] 方法1: 从文件对象提取PPTX文本内容');
          try {
            const textContent = await extractTextFromPPT(file);
            console.log('[PptxViewer] 文本提取成功，长度:', textContent.length);
            setPptxContent(textContent);
            setLoading(false);
            return;
          } catch (textError) {
            console.warn('[PptxViewer] 文件对象文本提取失败:', textError);
            setError('PPTX文本提取失败: ' + (textError instanceof Error ? textError.message : '未知错误'));
            setLoading(false);
            return;
          }
        }

        // 方法2: 从URL获取文件并提取文本
        if (url) {
          console.log('[PptxViewer] 方法2: 从URL获取文件并提取文本', url);
          try {
            const response = await fetch(url);
            if (!response.ok) {
              throw new Error(`Failed to fetch PPTX file: ${response.statusText}`);
            }

            const blob = await response.blob();
            console.log('[PptxViewer] 获取到blob，大小:', blob.size, '类型:', blob.type);
            const file = new File([blob], 'presentation.pptx', { type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' });

            const textContent = await extractTextFromPPT(file);
            console.log('[PptxViewer] URL文本提取成功，长度:', textContent.length);
            setPptxContent(textContent);
            setLoading(false);
            return;
          } catch (textError) {
            console.warn('[PptxViewer] URL文本提取失败:', textError);

            // 方法3: 不再使用Office Online Viewer，直接显示错误信息
            console.log('[PptxViewer] 文本提取失败，显示错误信息（已禁用Office Online Viewer）');
            setError('PPTX文本提取失败: ' + (textError instanceof Error ? textError.message : '未知错误'));
            setLoading(false);
            return;
          }
        }

        throw new Error('无法加载PPTX文件：缺少文件或URL');

      } catch (err) {
        console.error('[PptxViewer] Error loading PPTX:', err);
        setError(err instanceof Error ? err.message : 'Failed to load PPTX file');
        setLoading(false);
        toast.error('PPTX文件加载失败');
      }
    };

    loadPptx();
  }, [url, file]);

  // Office Online Viewer功能已移除

  if (loading) {
    return (
      <div className={`flex items-center justify-center h-full w-full ${className}`}>
        <div className="text-center">
          <div className="animate-spin h-10 w-10 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600">正在加载PPTX文档...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`flex items-center justify-center h-full w-full ${className}`}>
        <div className="text-center">
          <div className="text-6xl mb-4">📄</div>
          <p className="text-lg font-medium mb-2 text-gray-700">PPTX预览暂不可用</p>
          <p className="text-sm text-gray-500 mb-4 max-w-md mx-auto">
            {error.includes('文本提取失败') ?
              '文档内容提取遇到问题，可能是文件格式复杂或损坏' :
              error
            }
          </p>
          <div className="space-x-2">
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              重新加载
            </button>
            {url && (
              <button
                onClick={() => window.open(url, '_blank')}
                className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
              >
                下载文件
              </button>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-4">
            提示：您仍可以通过AI聊天功能分析此文档的内容
          </p>
        </div>
      </div>
    );
  }

  // Office Online Viewer已移除

  // 显示提取的文本内容
  if (pptxContent) {
    return (
      <div className={`h-full w-full overflow-auto p-6 bg-gray-50 ${className}`}>
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">PPTX内容预览</h3>
              <div className="space-x-2">
                {url && (
                  <button
                    onClick={() => window.open(url, '_blank')}
                    className="px-3 py-1 bg-gray-500 text-white rounded text-sm hover:bg-gray-600"
                  >
                    下载文件
                  </button>
                )}
              </div>
            </div>
            <div className="prose max-w-none">
              <pre className="whitespace-pre-wrap text-sm text-gray-700 leading-relaxed">
                {pptxContent}
              </pre>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 默认回退
  return (
    <div className={`flex items-center justify-center h-full w-full ${className}`}>
      <div className="text-center text-gray-500">
        <div className="text-6xl mb-4">📄</div>
        <p className="text-lg font-medium mb-2">PPTX预览不可用</p>
        <p className="text-sm mb-4">请下载文件查看完整内容</p>
        <div className="space-x-2">
          {url && (
            <button
              onClick={() => window.open(url, '_blank')}
              className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
            >
              下载文件
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default PptxViewer;
