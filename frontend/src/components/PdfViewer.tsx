'use client';

import React, { useEffect, useRef, useState } from 'react';
// 直接使用 require 导入以避免类型问题
const pdfjsLib = require('pdfjs-dist');

// 设置 PDF.js worker 路径
// 添加诊断信息来跟踪worker加载情况
console.log('[PdfViewer] 设置PDF.js worker路径');
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';

// 检查worker是否存在
fetch('/pdf.worker.min.js')
  .then(response => {
    if (response.ok) {
      console.log('[PdfViewer] PDF.js worker文件存在且可访问');
    } else {
      console.error('[PdfViewer] PDF.js worker文件不存在或无法访问，状态码:', response.status);
    }
  })
  .catch(error => {
    console.error('[PdfViewer] PDF.js worker文件访问失败:', error);
  });

interface PdfViewerProps {
  url?: string;
  data?: ArrayBuffer;
}

/**
 * PDF预览组件
 * 使用PDF.js实现PDF文件的预览功能
 * 提供类似于Adobe Reader的PDF阅读体验
 * @param url PDF文件的URL地址
 * @param data PDF文件的ArrayBuffer数据
 */
const PdfViewer: React.FC<PdfViewerProps> = ({ url, data }) => {
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.0);
  const [rotation, setRotation] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [pdfDocument, setPdfDocument] = useState<any>(null);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // 加载PDF文档
  useEffect(() => {
    setLoading(true);
    setError(null);

    let loadingTask: any;
    
    try {
      // 判断使用哪种方式加载PDF
      if (data) {
        // 使用ArrayBuffer数据加载
        console.log('[PdfViewer] 使用ArrayBuffer数据加载PDF，大小:', data.byteLength);
        loadingTask = pdfjsLib.getDocument({ data });
      } else if (url) {
        // 使用URL加载
        console.log('[PdfViewer] 开始加载PDF文档，URL类型:', typeof url);
        console.log('[PdfViewer] URL是否以blob:开头:', url.startsWith('blob:'));
        loadingTask = pdfjsLib.getDocument(url);
      } else {
        throw new Error('必须提供url或data参数');
      }
      
      console.log('[PdfViewer] PDF加载任务已创建');
      
      loadingTask.promise
        .then((doc: any) => {
          console.log('[PdfViewer] PDF文档加载成功，页数:', doc.numPages);
          setPdfDocument(doc);
          setNumPages(doc.numPages);
          setLoading(false);
        })
        .catch((err: Error) => {
          console.error('[PdfViewer] 加载PDF文档失败:', err);
          // 提供更详细的错误信息
          let errorMessage = '无法加载PDF文档。请确保文件格式正确并重试。';
          
          // 根据错误类型增加更多信息
          if (err.message.includes('Invalid PDF')) {
            errorMessage = '无效的PDF文件格式。文件可能已损坏或不是有效的PDF格式。';
          } else if (err.message.includes('Loading document')) {
            errorMessage = '加载PDF文档时出错。URL可能无法访问或格式不正确。';
          } else if (err.message.includes('CORS')) {
            errorMessage = 'PDF加载受到跨域限制。请检查服务器是否允许PDF文件的跨域访问。';
          } else if (err.message.includes('Unexpected server response')) {
            errorMessage = 'Blob URL访问失败。这可能是由于浏览器安全限制或URL已失效。';
          }
          
          setError(`${errorMessage}\n错误详情: ${err.message}`);
          setLoading(false);
        });
    } catch (err) {
      const error = err as Error;
      console.error('[PdfViewer] 创建PDF加载任务失败:', error);
      setError(`无法创建PDF加载任务。\n错误详情: ${error.message}`);
      setLoading(false);
      return () => {};
    }
      
    return () => {
      try {
        // 取消加载任务
        if (loadingTask && typeof loadingTask.destroy === 'function') {
          loadingTask.destroy();
        }
        
        // 释放文档资源
        if (pdfDocument && typeof pdfDocument.destroy === 'function') {
          pdfDocument.destroy();
        }
      } catch (e) {
        console.error('[PdfViewer] 清理PDF资源时出错:', e);
      }
    };
  }, [url, data]);

  // 渲染当前页面
  useEffect(() => {
    if (!pdfDocument || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    if (!context) return;

    setLoading(true);

    pdfDocument.getPage(pageNumber).then((page: any) => {
      // 计算视口，应用缩放和旋转
      const viewport = page.getViewport({ scale, rotation: rotation });

      // 设置canvas尺寸
      canvas.height = viewport.height;
      canvas.width = viewport.width;

      // 渲染页面
      const renderContext = {
        canvasContext: context,
        viewport: viewport,
      };

      const renderTask = page.render(renderContext);
      renderTask.promise.then(() => {
        setLoading(false);
      }).catch((err: Error) => {
        console.error('渲染页面失败:', err);
        setError('渲染页面失败。');
        setLoading(false);
      });
    });
  }, [pdfDocument, pageNumber, scale, rotation]);

  // 切换到上一页
  const goToPrevPage = () => {
    if (pageNumber > 1) {
      setPageNumber(pageNumber - 1);
    }
  };

  // 切换到下一页
  const goToNextPage = () => {
    if (pageNumber < numPages) {
      setPageNumber(pageNumber + 1);
    }
  };

  // 放大
  const zoomIn = () => {
    setScale(prevScale => Math.min(prevScale + 0.25, 3));
  };

  // 缩小
  const zoomOut = () => {
    setScale(prevScale => Math.max(prevScale - 0.25, 0.5));
  };

  // 旋转
  const rotateClockwise = () => {
    setRotation(prevRotation => (prevRotation + 90) % 360);
  };

  // 适应页面宽度
  const fitToWidth = () => {
    if (containerRef.current && canvasRef.current && pdfDocument) {
      const containerWidth = containerRef.current.clientWidth - 40; // 减去边距
      
      // 获取当前页面的实际宽度
      pdfDocument.getPage(1).then((page: any) => {
        const viewport = page.getViewport({ scale: 1, rotation: 0 });
        const newScale = containerWidth / viewport.width;
        setScale(newScale);
      });
    }
  };

  // 渲染工具栏
  const renderToolbar = () => (
    <div className="bg-gray-100 border-b border-gray-300 p-2 flex items-center space-x-2">
      <div className="flex items-center space-x-1">
        <button
          onClick={goToPrevPage}
          disabled={pageNumber <= 1}
          className={`p-1 rounded ${
            pageNumber <= 1 ? 'text-gray-400' : 'text-gray-700 hover:bg-gray-200'
          }`}
          title="上一页"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"
              clipRule="evenodd"
            />
          </svg>
        </button>
        
        <div className="flex items-center border rounded overflow-hidden">
          <input
            type="number"
            min={1}
            max={numPages}
            value={pageNumber}
            onChange={(e) => {
              const val = parseInt(e.target.value);
              if (val >= 1 && val <= numPages) {
                setPageNumber(val);
              }
            }}
            className="w-12 text-center p-1 border-none"
          />
          <span className="px-2 bg-gray-200 text-gray-700 text-sm">/ {numPages}</span>
        </div>
        
        <button
          onClick={goToNextPage}
          disabled={pageNumber >= numPages}
          className={`p-1 rounded ${
            pageNumber >= numPages ? 'text-gray-400' : 'text-gray-700 hover:bg-gray-200'
          }`}
          title="下一页"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      </div>
      
      <div className="w-px h-6 bg-gray-300 mx-1"></div>
      
      <div className="flex items-center space-x-1">
        <button
          onClick={zoomOut}
          className="p-1 rounded text-gray-700 hover:bg-gray-200"
          title="缩小"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M5 10a1 1 0 011-1h8a1 1 0 110 2H6a1 1 0 01-1-1z" clipRule="evenodd" />
          </svg>
        </button>
        
        <span className="text-sm text-gray-700">{Math.round(scale * 100)}%</span>
        
        <button
          onClick={zoomIn}
          className="p-1 rounded text-gray-700 hover:bg-gray-200"
          title="放大"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
          </svg>
        </button>
        
        <button
          onClick={fitToWidth}
          className="p-1 rounded text-gray-700 hover:bg-gray-200"
          title="适应宽度"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
          </svg>
        </button>
        
        <button
          onClick={rotateClockwise}
          className="p-1 rounded text-gray-700 hover:bg-gray-200"
          title="旋转"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
          </svg>
        </button>
        
        <div className="w-px h-6 bg-gray-300 mx-1"></div>
        
        {url && (
          <a
            href={url}
            download="document.pdf"
            className="p-1 rounded text-gray-700 hover:bg-gray-200"
            title="下载PDF"
            onClick={(e) => {
              // 如果URL不是以blob:开头，不直接下载
              if (!url.startsWith('blob:') && !url.startsWith('data:')) {
                e.preventDefault();
                alert('当前PDF不支持直接下载，请使用应用内的下载按钮。');
              }
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </a>
        )}
      </div>
    </div>
  );

  // 加载状态显示
  if (loading && !pdfDocument) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center">
          <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full mb-3"></div>
          <p className="text-gray-600">正在加载PDF文档...</p>
        </div>
      </div>
    );
  }

  // 错误状态显示
  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center text-center max-w-md p-6">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-red-500 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 className="text-lg font-medium text-gray-900 mb-2">加载PDF失败</h3>
          <p className="text-gray-600 mb-4">{error}</p>
          <p className="text-sm text-gray-500">请尝试在主界面点击下载按钮。</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col bg-gray-200">
      {renderToolbar()}
      <div className="flex-1 overflow-auto flex items-center justify-center p-4" ref={containerRef}>
        <div className={`pdf-page-container shadow-lg bg-white relative ${loading ? 'opacity-50' : 'opacity-100'} transition-opacity`}>
          <canvas ref={canvasRef} className="max-w-full" />
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full"></div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PdfViewer; 