'use client';

import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';

interface PerformanceData {
  docId: string;
  fileName: string;
  fileSize: number;
  startTime: number;
  endTime?: number;
  duration?: number;
  cacheHit?: boolean;
}

/**
 * PDF预览性能监控组件
 * 监控和显示PDF预览加载时间，帮助诊断性能问题
 */
const PreviewPerformanceMonitor: React.FC = () => {
  const [performanceData, setPerformanceData] = useState<PerformanceData[]>([]);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // 监听自定义性能事件
    const handlePreviewStart = () => {
      const data = (window as any).__lastPreviewStart;
      if (data) {
        setPerformanceData(prev => {
          const updated = prev.filter(p => p.docId !== data.docId); // 移除旧记录
          return [...updated, data];
        });
      }
    };

    const handlePreviewEnd = (success: boolean) => {
      const endTime = performance.now();
      const data = (window as any).__lastPreviewStart;
      
      if (data) {
        const duration = endTime - data.startTime;
        const cacheHit = duration < 500; // 小于500ms认为是缓存命中
        
        setPerformanceData(prev => 
          prev.map(p => 
            p.docId === data.docId 
              ? { ...p, endTime, duration, cacheHit }
              : p
          )
        );

        // 性能分析和建议
        if (success) {
          if (duration > 5000) {
            toast.error(`⚠️ ${data.fileName} 加载过慢 (${(duration/1000).toFixed(1)}s)`, {
              duration: 4000,
              id: 'perf-warning'
            });
          } else if (duration > 2000) {
            toast(`📊 ${data.fileName} 加载完成 (${(duration/1000).toFixed(1)}s)`, {
              duration: 2000,
              id: 'perf-info'
            });
          } else if (cacheHit) {
            toast.success(`⚡ ${data.fileName} 缓存命中 (${duration.toFixed(0)}ms)`, {
              duration: 1500,
              id: 'perf-cache'
            });
          }
        }
      }
    };

    // 监听URL对象创建完成事件（通过MutationObserver模拟）
    const observer = new MutationObserver(() => {
      // 简单检测：如果有iframe出现，认为预览完成
      const iframes = document.querySelectorAll('iframe[src^="blob:"]');
      if (iframes.length > 0) {
        handlePreviewEnd(true);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    // 定期检查预览状态
    const checkInterval = setInterval(handlePreviewStart, 1000);

    // 监听键盘快捷键显示/隐藏监控面板
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.altKey && e.key === 'p') {
        setIsVisible(prev => !prev);
      }
    };

    document.addEventListener('keydown', handleKeyPress);

    return () => {
      clearInterval(checkInterval);
      observer.disconnect();
      document.removeEventListener('keydown', handleKeyPress);
    };
  }, []);

  if (!isVisible) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <button
          onClick={() => setIsVisible(true)}
          className="bg-gray-800 text-white px-2 py-1 rounded text-xs opacity-50 hover:opacity-100"
          title="显示性能监控面板 (Ctrl+Alt+P)"
        >
          📊
        </button>
      </div>
    );
  }

  const recentData = performanceData.slice(-5); // 最近5次预览
  const avgLoadTime = recentData
    .filter(d => d.duration)
    .reduce((sum, d) => sum + (d.duration || 0), 0) / 
    recentData.filter(d => d.duration).length || 0;

  return (
    <div className="fixed bottom-4 right-4 z-50 bg-white shadow-lg rounded-lg border p-4 max-w-sm">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-sm font-semibold">PDF预览性能</h3>
        <button
          onClick={() => setIsVisible(false)}
          className="text-gray-500 hover:text-gray-700 text-xs"
        >
          ✕
        </button>
      </div>
      
      <div className="space-y-2 text-xs">
        <div className="flex justify-between">
          <span>平均加载时间:</span>
          <span className={avgLoadTime > 3000 ? 'text-red-500' : avgLoadTime > 1000 ? 'text-yellow-500' : 'text-green-500'}>
            {avgLoadTime ? `${(avgLoadTime/1000).toFixed(1)}s` : 'N/A'}
          </span>
        </div>
        
        <div className="border-t pt-2">
          <div className="font-medium mb-1">最近预览:</div>
          {recentData.length === 0 && (
            <div className="text-gray-500 text-xs">暂无数据</div>
          )}
          {recentData.map((data, index) => (
            <div key={`${data.docId}-${index}`} className="flex justify-between items-center mb-1">
              <span className="truncate flex-1 mr-2" title={data.fileName}>
                {data.fileName.length > 15 ? data.fileName.substring(0, 15) + '...' : data.fileName}
              </span>
              <div className="flex items-center space-x-1">
                {data.cacheHit && <span className="text-blue-500" title="缓存命中">⚡</span>}
                <span className={
                  !data.duration ? 'text-gray-400' :
                  data.duration > 3000 ? 'text-red-500' :
                  data.duration > 1000 ? 'text-yellow-500' : 'text-green-500'
                }>
                  {data.duration ? `${(data.duration/1000).toFixed(1)}s` : '...'}
                </span>
              </div>
            </div>
          ))}
        </div>
        
        <div className="border-t pt-2 text-xs text-gray-500">
          <div>💡 优化提示:</div>
          <ul className="mt-1 space-y-1">
            <li>• 缓存命中 ⚡ = &lt;500ms</li>
            <li>• 良好 🟢 = &lt;1s</li>
            <li>• 一般 🟡 = 1-3s</li>
            <li>• 需优化 🔴 = &gt;3s</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default PreviewPerformanceMonitor;