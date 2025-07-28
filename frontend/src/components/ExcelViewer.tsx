'use client';

import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { extractTextFromExcel } from '@/services/officeService';

interface ExcelViewerProps {
  url: string;
  file?: File;
  className?: string;
}

interface WorksheetData {
  name: string;
  data: string[][];
  headers: string[];
}

const ExcelViewer: React.FC<ExcelViewerProps> = ({ url, file, className = '' }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [worksheets, setWorksheets] = useState<WorksheetData[]>([]);
  const [activeSheet, setActiveSheet] = useState(0);
  const [textContent, setTextContent] = useState<string>('');

  useEffect(() => {
    const loadExcel = async () => {
      try {
        setLoading(true);
        setError(null);
        
        console.log('[ExcelViewer] 开始加载Excel文件', { url, hasFile: !!file });

        let excelFile: File;

        if (file) {
          excelFile = file;
        } else if (url) {
          // 从URL获取文件
          const response = await fetch(url);
          if (!response.ok) {
            throw new Error(`Failed to fetch Excel file: ${response.statusText}`);
          }
          
          const blob = await response.blob();
          excelFile = new File([blob], 'spreadsheet.xlsx', { 
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
          });
        } else {
          throw new Error('缺少文件或URL');
        }

        // 提取文本内容用于备用显示
        try {
          const text = await extractTextFromExcel(excelFile);
          setTextContent(text);
        } catch (textError) {
          console.warn('[ExcelViewer] 文本提取失败:', textError);
        }

        // 解析Excel文件为结构化数据
        const arrayBuffer = await excelFile.arrayBuffer();
        const XLSX = await import('xlsx-js-style');
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });

        const parsedWorksheets: WorksheetData[] = [];

        for (const sheetName of workbook.SheetNames) {
          const worksheet = workbook.Sheets[sheetName];
          
          // 转换为二维数组
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as string[][];
          
          if (jsonData.length > 0) {
            // 第一行作为表头
            const headers = jsonData[0] || [];
            const data = jsonData.slice(1);
            
            parsedWorksheets.push({
              name: sheetName,
              headers: headers.map(h => String(h || '')),
              data: data.map(row => 
                headers.map((_, index) => String(row[index] || ''))
              )
            });
          } else {
            // 空工作表
            parsedWorksheets.push({
              name: sheetName,
              headers: [],
              data: []
            });
          }
        }

        setWorksheets(parsedWorksheets);
        setActiveSheet(0);
        setLoading(false);

        console.log('[ExcelViewer] Excel文件解析成功，工作表数量:', parsedWorksheets.length);
        
      } catch (err) {
        console.error('[ExcelViewer] Excel文件加载失败:', err);
        setError(err instanceof Error ? err.message : 'Excel文件加载失败');
        setLoading(false);
        toast.error('Excel文件加载失败');
      }
    };

    loadExcel();
  }, [url, file]);

  if (loading) {
    return (
      <div className={`flex items-center justify-center h-full w-full ${className}`}>
        <div className="text-center">
          <div className="animate-spin h-10 w-10 border-4 border-green-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600">正在加载Excel文档...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`flex items-center justify-center h-full w-full ${className}`}>
        <div className="text-center">
          <div className="text-6xl mb-4">📊</div>
          <p className="text-lg font-medium mb-2 text-gray-700">Excel预览暂不可用</p>
          <p className="text-sm text-gray-500 mb-4 max-w-md mx-auto">
            {error.includes('文本提取失败') ? 
              '文档内容提取遇到问题，可能是文件格式复杂或损坏' : 
              error
            }
          </p>
          <div className="space-x-2">
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
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

  // 如果有结构化数据，显示表格预览
  if (worksheets.length > 0) {
    const currentSheet = worksheets[activeSheet];
    
    return (
      <div className={`h-full w-full flex flex-col bg-white ${className}`}>
        {/* 工作表标签 */}
        {worksheets.length > 1 && (
          <div className="flex border-b bg-gray-50 px-4 py-2 overflow-x-auto">
            {worksheets.map((sheet, index) => (
              <button
                key={index}
                onClick={() => setActiveSheet(index)}
                className={`px-3 py-1 mr-2 text-sm rounded-t border-b-2 whitespace-nowrap ${
                  index === activeSheet
                    ? 'bg-white border-green-500 text-green-600 font-medium'
                    : 'bg-gray-100 border-transparent text-gray-600 hover:bg-gray-200'
                }`}
              >
                {sheet.name}
              </button>
            ))}
          </div>
        )}

        {/* 表格内容 */}
        <div className="flex-1 overflow-auto p-4">
          <div className="bg-white rounded-lg shadow-sm border">
            <div className="p-4 border-b">
              <h3 className="text-lg font-medium text-gray-900">
                {currentSheet.name}
              </h3>
              <p className="text-sm text-gray-500">
                {currentSheet.data.length} 行数据
              </p>
            </div>
            
            {currentSheet.data.length > 0 ? (
              <div className="overflow-auto max-h-96">
                <table className="w-full text-sm">
                  {/* 表头 */}
                  {currentSheet.headers.length > 0 && (
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        {currentSheet.headers.map((header, index) => (
                          <th
                            key={index}
                            className="px-3 py-2 text-left font-medium text-gray-700 border-b"
                          >
                            {header || `列${index + 1}`}
                          </th>
                        ))}
                      </tr>
                    </thead>
                  )}
                  
                  {/* 数据行 */}
                  <tbody>
                    {currentSheet.data.slice(0, 100).map((row, rowIndex) => (
                      <tr key={rowIndex} className="hover:bg-gray-50">
                        {row.map((cell, cellIndex) => (
                          <td
                            key={cellIndex}
                            className="px-3 py-2 border-b text-gray-600"
                          >
                            {cell || '-'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                
                {currentSheet.data.length > 100 && (
                  <div className="p-4 text-center text-gray-500 bg-gray-50">
                    显示前100行，共{currentSheet.data.length}行数据
                  </div>
                )}
              </div>
            ) : (
              <div className="p-8 text-center text-gray-500">
                此工作表无数据
              </div>
            )}
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="border-t bg-gray-50 px-4 py-3 flex justify-between items-center">
          <div className="text-sm text-gray-600">
            Excel文档预览 - {worksheets.length} 个工作表
          </div>
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
      </div>
    );
  }

  // 如果只有文本内容，显示文本预览
  if (textContent) {
    return (
      <div className={`h-full w-full overflow-auto p-6 bg-gray-50 ${className}`}>
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">Excel内容预览</h3>
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
                {textContent}
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
        <div className="text-6xl mb-4">📊</div>
        <p className="text-lg font-medium mb-2">Excel预览不可用</p>
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

export default ExcelViewer;
