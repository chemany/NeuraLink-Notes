import React, { useState, useEffect } from 'react';
import { Document, DocumentStatus } from '@/types/shared_local';
import { FiFilter, FiChevronDown, FiChevronUp, FiSearch, FiX, FiRefreshCw } from 'react-icons/fi';
import { searchRelevantContent, extractParametersFromDocuments } from '@/services/vectorService';

interface DocumentOrganizerProps {
  documents: Document[];
  onSubmitQuery: (query: string, params: {
    documentNumbers: string[];
    catalystParams: string[];
    reactionParams: string[];
    resultParams: string[];
  }) => void;
}

/**
 * 文档组织组件，允许用户基于多个参数过滤和组织文档，并发送特定查询
 */
export default function DocumentOrganizer({ documents, onSubmitQuery }: DocumentOrganizerProps) {
  // 状态管理
  const [isExpanded, setIsExpanded] = useState(false);
  const [documentNumbers, setDocumentNumbers] = useState<string[]>([]);
  const [catalystParams, setCatalystParams] = useState<string[]>([]);
  const [reactionParams, setReactionParams] = useState<string[]>([]);
  const [resultParams, setResultParams] = useState<string[]>([]);
  const [selectedDocuments, setSelectedDocuments] = useState<string[]>([]);
  const [selectedCatalystParams, setSelectedCatalystParams] = useState<string[]>([]);
  const [selectedReactionParams, setSelectedReactionParams] = useState<string[]>([]);
  const [selectedResultParams, setSelectedResultParams] = useState<string[]>([]);
  const [customQuery, setCustomQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isExtractingParams, setIsExtractingParams] = useState(false);
  
  // 预设查询
  const predefinedQueries = [
    '整理这些文档的催化剂制备参数、反应条件和结果',
    '比较这些文档中不同催化剂的性能',
    '分析反应温度对产物选择性的影响',
    '总结银催化剂的制备方法及其性能',
    '汇总所有文档中提到的反应产率数据'
  ];
  
  // 提取文档编号
  useEffect(() => {
    if (documents.length === 0) return;
    
    // 提取文档编号
    const docNumbers = documents.map(doc => {
      // 提取文件名中的编号，假设有一定格式如 "DocXX" 或 "XX-"
      const matches = doc.fileName.match(/(?:Doc|Paper)?(\d+)/i);
      return matches ? matches[1] : doc.fileName.substring(0, 10);
    }).filter((v, i, a) => a.indexOf(v) === i); // 去重
    
    setDocumentNumbers(docNumbers);
  }, [documents]);
  
  // 从文档中提取参数
  const extractParams = async () => {
    if (documents.length === 0 || isExtractingParams) return;
    
    try {
      setIsExtractingParams(true);
      
      // 只处理已完成的文档
      const completedDocs = documents.filter(doc => 
        doc.status === DocumentStatus.COMPLETED && doc.textContent
      );
      
      if (completedDocs.length === 0) {
        console.warn('没有已处理完成的文档，无法提取参数');
        return;
      }
      
      console.log(`开始从 ${completedDocs.length} 个文档中提取参数`);
      
      // 调用extractParametersFromDocuments提取参数
      const extractedParams = await extractParametersFromDocuments(completedDocs);
      
      console.log('提取的参数:', extractedParams);
      
      // 更新状态
      setCatalystParams(extractedParams.catalystParams);
      setReactionParams(extractedParams.reactionParams);
      setResultParams(extractedParams.resultParams);
      
    } catch (error) {
      console.error('提取参数时出错:', error);
    } finally {
      setIsExtractingParams(false);
    }
  };
  
  // 首次加载时自动提取参数
  useEffect(() => {
    if (documents.length > 0 && isExpanded) {
      extractParams();
    }
  }, [documents, isExpanded]);
  
  // 渲染可选参数标签
  const renderFilterTags = (
    items: string[], 
    selectedItems: string[], 
    setSelectedItems: React.Dispatch<React.SetStateAction<string[]>>
  ) => {
    return (
      <div className="flex flex-wrap gap-1 mt-1">
        {items.map(item => (
          <button
            key={item}
            className={`text-xs px-2 py-1 rounded-full ${
              selectedItems.includes(item) 
                ? 'bg-blue-100 text-blue-700 border border-blue-300' 
                : 'bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-200'
            }`}
            onClick={() => {
              setSelectedItems(prev => 
                prev.includes(item)
                  ? prev.filter(i => i !== item)
                  : [...prev, item]
              );
            }}
          >
            {item}
            {selectedItems.includes(item) && (
              <FiX className="inline ml-1 w-3 h-3" />
            )}
          </button>
        ))}
      </div>
    );
  };
  
  // 处理查询提交
  const handleSubmit = async () => {
    if (!customQuery || customQuery.trim() === '') {
      alert('请输入查询内容');
      return;
    }
    
    setIsLoading(true);
    
    try {
      // 调用父组件提供的回调
      onSubmitQuery(customQuery, {
        documentNumbers: selectedDocuments,
        catalystParams: selectedCatalystParams,
        reactionParams: selectedReactionParams,
        resultParams: selectedResultParams
      });
      
      // 折叠面板
      setIsExpanded(false);
    } catch (error) {
      console.error('提交查询时出错:', error);
      alert('提交查询时出错，请重试');
    } finally {
      setIsLoading(false);
    }
  };
  
  // 使用预设查询
  const handleUsePredefinedQuery = (query: string) => {
    setCustomQuery(query);
  };
  
  // 渲染文档选择器
  const renderDocumentSelector = () => {
    const completedDocs = documents.filter(doc => doc.status === DocumentStatus.COMPLETED);
    
    return (
      <div className="mt-2">
        <p className="text-sm font-medium text-gray-700 mb-1">选择文档:</p>
        <div className="max-h-40 overflow-y-auto bg-gray-50 rounded p-1">
          {completedDocs.length === 0 ? (
            <p className="text-sm text-gray-500 italic p-2">无可用文档</p>
          ) : (
            completedDocs.map(doc => (
              <div key={doc.id} className="flex items-center py-1 px-2 hover:bg-gray-100 rounded">
                <input 
                  type="checkbox"
                  id={`doc-${doc.id}`}
                  checked={selectedDocuments.includes(doc.id)}
                  onChange={() => {
                    setSelectedDocuments(prev => 
                      prev.includes(doc.id)
                        ? prev.filter(id => id !== doc.id)
                        : [...prev, doc.id]
                    );
                  }}
                  className="mr-2"
                />
                <label htmlFor={`doc-${doc.id}`} className="text-sm cursor-pointer truncate">
                  {doc.fileName}
                </label>
              </div>
            ))
          )}
        </div>
      </div>
    );
  };
  
  return (
    <div className="mb-4 border border-gray-200 rounded-lg shadow-sm bg-white">
      <div 
        className="flex justify-between items-center p-3 cursor-pointer border-b"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center">
          <FiFilter className="mr-2 text-blue-600" />
          <h3 className="font-medium">文档组织与参数查询</h3>
        </div>
        {isExpanded ? <FiChevronUp /> : <FiChevronDown />}
      </div>
      
      {isExpanded && (
        <div className="p-3">
          {/* 文档选择 */}
          {renderDocumentSelector()}
          
          {/* 参数刷新按钮 */}
          <div className="mt-3 flex justify-between items-center">
            <p className="text-sm font-medium text-gray-700">参数过滤:</p>
            <button 
              className={`text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded flex items-center ${
                isExtractingParams ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              onClick={extractParams}
              disabled={isExtractingParams}
            >
              <FiRefreshCw className={`mr-1 ${isExtractingParams ? 'animate-spin' : ''}`} />
              {isExtractingParams ? '提取中...' : '刷新参数'}
            </button>
          </div>
          
          {/* 参数过滤器 */}
          <div className="mt-2">
            <p className="text-sm font-medium text-gray-700">催化剂参数:</p>
            {renderFilterTags(
              catalystParams, 
              selectedCatalystParams,
              setSelectedCatalystParams
            )}
          </div>
          
          <div className="mt-2">
            <p className="text-sm font-medium text-gray-700">反应参数:</p>
            {renderFilterTags(
              reactionParams, 
              selectedReactionParams,
              setSelectedReactionParams
            )}
          </div>
          
          <div className="mt-2">
            <p className="text-sm font-medium text-gray-700">结果参数:</p>
            {renderFilterTags(
              resultParams, 
              selectedResultParams,
              setSelectedResultParams
            )}
          </div>
          
          {/* 预设查询按钮 */}
          <div className="mt-3">
            <p className="text-sm font-medium text-gray-700 mb-1">常用查询:</p>
            <div className="flex flex-wrap gap-1">
              {predefinedQueries.map((query, index) => (
                <button
                  key={index}
                  className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded"
                  onClick={() => handleUsePredefinedQuery(query)}
                >
                  {query.length > 20 ? `${query.substring(0, 20)}...` : query}
                </button>
              ))}
            </div>
          </div>
          
          {/* 自定义查询输入框 */}
          <div className="mt-3">
            <label htmlFor="custom-query" className="block text-sm font-medium text-gray-700 mb-1">
              自定义查询:
            </label>
            <div className="relative">
              <input
                id="custom-query"
                type="text"
                value={customQuery}
                onChange={(e) => setCustomQuery(e.target.value)}
                placeholder="例如: 比较不同催化剂的性能..."
                className="w-full p-2 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
              />
              <button
                className="absolute right-2 top-1/2 transform -translate-y-1/2 text-blue-600 hover:text-blue-800"
                onClick={() => setCustomQuery('')}
                title="清空"
              >
                <FiX />
              </button>
            </div>
          </div>
          
          {/* 提交按钮 */}
          <div className="mt-3 flex justify-end">
            <button
              className={`px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center ${
                isLoading ? 'opacity-70 cursor-not-allowed' : ''
              }`}
              onClick={handleSubmit}
              disabled={isLoading}
            >
              <FiSearch className="mr-1" />
              {isLoading ? '处理中...' : '提交查询'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
} 