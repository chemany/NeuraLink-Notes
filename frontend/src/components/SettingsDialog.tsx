import { useState, useEffect } from 'react';
import { useSettings, LLMSettings, EmbeddingModelSettings, RerankingSettings, UISettings } from '@/contexts/SettingsContext';

interface SettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SettingsDialog({ isOpen, onClose }: SettingsDialogProps) {
  const { 
    llmSettings, 
    embeddingSettings, 
    rerankingSettings,
    uiSettings, 
    saveAllSettings,
    resetSettings 
  } = useSettings();
  
  const [isMounted, setIsMounted] = useState(false);
  const [activeTab, setActiveTab] = useState('general');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  
  // 使用 local state 来管理临时的表单值
  const [localLLMSettings, setLocalLLMSettings] = useState<LLMSettings>(llmSettings);
  const [localEmbeddingSettings, setLocalEmbeddingSettings] = useState<EmbeddingModelSettings>(embeddingSettings);
  const [localRerankingSettings, setLocalRerankingSettings] = useState<RerankingSettings>(rerankingSettings);
  const [localUISettings, setLocalUISettings] = useState<Partial<UISettings & { saveConversation: boolean }>>(uiSettings);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  
  // 仅在客户端渲染组件
  useEffect(() => {
    setIsMounted(true);
  }, []);
  
  // 当设置改变时更新临时状态 - 现在直接更新 local state
  useEffect(() => {
    if (isMounted) {
      setLocalLLMSettings(llmSettings);
      setLocalEmbeddingSettings(embeddingSettings);
      setLocalRerankingSettings(rerankingSettings);
    }
  }, [llmSettings, embeddingSettings, rerankingSettings, isMounted]);
  
  // 当设置变化或对话框打开时，更新本地状态
  useEffect(() => {
    if (isOpen && isMounted) {
      // 当对话框打开或 context 中的值变化时，用 context 的值重置 local state
      setLocalLLMSettings(llmSettings);
      setLocalEmbeddingSettings(embeddingSettings);
      setLocalRerankingSettings(rerankingSettings);
      setLocalUISettings(prev => ({
        ...prev,
        ...uiSettings,
        saveConversationHistory: uiSettings.saveConversationHistory
      }));
      setSaveStatus('idle');
    }
  }, [isOpen, isMounted, llmSettings, embeddingSettings, rerankingSettings, uiSettings]);
  
  // 服务器端渲染时不显示任何内容，避免hydration错误
  if (!isMounted) {
    return null;
  }
  
  if (!isOpen) return null;

  // 处理LLM表单变更
  const handleLLMChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    
    setLocalLLMSettings(prev => ({
      ...prev,
      [name]: type === 'number' ? parseFloat(value) : value
    }));
  };

  // 处理Embedding表单变更
  const handleEmbeddingChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    
    setLocalEmbeddingSettings(prev => ({
      ...prev,
      [name]: type === 'number' ? parseFloat(value) : value
    }));
  };

  const handleRangeChange = (modelType: 'llm' | 'embedding', e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    
    if (modelType === 'llm') {
      setLocalLLMSettings(prev => ({
        ...prev,
        [name]: parseFloat(value)
      }));
    } else {
      setLocalEmbeddingSettings(prev => ({
        ...prev,
        [name]: parseFloat(value)
      }));
    }
  };

  // --- 新增：处理 Reranking 表单变更 ---
  const handleRerankingChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const isCheckbox = type === 'checkbox';
    const checked = (e.target as HTMLInputElement).checked;

    setLocalRerankingSettings((prev: RerankingSettings) => ({
      ...prev,
      [name]: isCheckbox ? checked : (type === 'number' ? parseInt(value, 10) || 0 : value) // 解析为整数
    }));
  };

  // --- 新增：Reranking 模型选项获取逻辑 ---
  const getSiliconFlowRerankingOptions = (): { value: string, label: string }[] => {
    return [
      { value: 'BAAI/bge-reranker-v2-m3', label: 'BGE Reranker v2 M3' },
      { value: 'netease-youdao/bce-reranker-base_v1', label: 'BCE Reranker Base v1' }
    ];
  };

  // --- 新增：处理 UI 设置变更 ---
  const handleUISettingsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked, type } = e.target;
    if (type === 'checkbox') {
      setLocalUISettings(prev => ({
        ...prev,
        [name]: checked
      }));
    }
    // Add handling for other UI input types if necessary
  };

  // 保存设置
  const handleSave = async () => {
    setSaveStatus('saving');
    
    // 确保模型名称格式正确
    let fixedEmbeddingSettings = { ...localEmbeddingSettings };
    
    // 检查是否需要修正模型名称格式
    const modelName = fixedEmbeddingSettings.model;
    if (modelName === 'bge-large-zh-v1.5' || modelName === 'bge-large-zh') {
      fixedEmbeddingSettings.model = 'BAAI/bge-large-zh-v1.5';
    } else if (modelName === 'bge-large-en-v1.5' || modelName === 'bge-large-en') {
      fixedEmbeddingSettings.model = 'BAAI/bge-large-en-v1.5';
    } else if (modelName === 'bge-m3') {
      fixedEmbeddingSettings.model = 'BAAI/bge-m3';
    } else if (modelName === 'bce-embedding-base_v1' || modelName === 'bce-embedding-base') {
      fixedEmbeddingSettings.model = 'netease-youdao/bce-embedding-base_v1';
    }
    
    // Prepare the payload for saveAllSettings
    const payloadToSave = {
      llmSettings: localLLMSettings,
      embeddingSettings: fixedEmbeddingSettings,
      rerankingSettings: localRerankingSettings,
      uiSettings: {
        darkMode: localUISettings.darkMode,
        fontSize: localUISettings.fontSize,
        saveConversationHistory: localUISettings.saveConversationHistory,
        customEndpoint: localUISettings.customEndpoint,
      } as UISettings,
    };

    try {
      await saveAllSettings(payloadToSave);
      setSaveStatus('saved');
      
      if (fixedEmbeddingSettings.model !== localEmbeddingSettings.model) {
        console.log(`已自动修正模型名称格式: ${localEmbeddingSettings.model} -> ${fixedEmbeddingSettings.model}`);
      }
      
      setTimeout(() => {
        onClose();
        setSaveStatus('idle');
      }, 1000);
    } catch (error) {
      setSaveStatus('error');
      console.error('保存设置失败', error);
    }
  };

  const handleReset = () => {
    if (window.confirm('确定要重置所有设置到默认值吗？')) {
      resetSettings();
      setLocalLLMSettings(llmSettings);
      setLocalEmbeddingSettings(embeddingSettings);
    }
  };

  const getLLMOptions = () => {
    switch (localLLMSettings.provider) {
      case 'openai':
        return [
          { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
          { value: 'gpt-4', label: 'GPT-4' },
          { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' }
        ];
      case 'anthropic':
        return [
          { value: 'claude-instant-1', label: 'Claude Instant' },
          { value: 'claude-2', label: 'Claude 2' },
          { value: 'claude-3-opus', label: 'Claude 3 Opus' },
          { value: 'claude-3-sonnet', label: 'Claude 3 Sonnet' },
          { value: 'claude-3-haiku', label: 'Claude 3 Haiku' }
        ];
      case 'google':
        return [
          { value: 'gemini-pro', label: 'Gemini Pro' },
          { value: 'gemini-ultra', label: 'Gemini Ultra' }
        ];
      case 'deepseek':
        return [
          { value: 'deepseek-chat', label: 'DeepSeek Chat' },
          { value: 'deepseek-coder', label: 'DeepSeek Coder' }
        ];
      case 'ollama':
        return [
          { value: 'llama2', label: 'Llama 2' },
          { value: 'llama3', label: 'Llama 3' },
          { value: 'mistral', label: 'Mistral' },
          { value: 'vicuna', label: 'Vicuna' },
          { value: 'orca-mini', label: 'Orca Mini' },
          { value: 'custom', label: '自定义模型' }
        ];
      default:
        return [];
    }
  };

  const getSiliconFlowEmbeddingOptions = () => {
    return [
      { value: 'BAAI/bge-large-zh-v1.5', label: 'BGE-Large-ZH (中文大型模型)' },
      { value: 'BAAI/bge-large-en-v1.5', label: 'BGE-Large-EN (英文大型模型)' },
      { value: 'netease-youdao/bce-embedding-base_v1', label: 'BCE-Embedding-Base' },
      { value: 'BAAI/bge-m3', label: 'BGE-M3 (通用模型)' },
      { value: 'Pro/BAAI/bge-m3', label: 'Pro/BGE-M3 (高级版)' }
    ];
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col relative z-[10000]">
        <div className="flex justify-between items-center p-4 border-b">
          <h2 className="text-xl font-medium">设置</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex border-b">
          <button
            className={`px-4 py-2 font-medium text-sm ${
              activeTab === 'general'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
            onClick={() => setActiveTab('general')}
          >
            常规
          </button>
          <button
            className={`px-4 py-2 font-medium text-sm ${
              activeTab === 'llm'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
            onClick={() => setActiveTab('llm')}
          >
            大语言模型
          </button>
          <button
            className={`px-4 py-2 font-medium text-sm ${
              activeTab === 'embedding'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
            onClick={() => setActiveTab('embedding')}
          >
            向量化模型
          </button>
        </div>

        <div className="flex-grow overflow-y-auto p-6">
          {activeTab === 'general' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-md font-medium mb-2">界面设置</h3>
                <p className="text-sm text-gray-500 mb-4">通用界面偏好设置</p>
                
                <div className="space-y-4">
                  <div className="flex items-center">
                    <input
                      id="darkMode"
                      type="checkbox"
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <label htmlFor="darkMode" className="ml-2 block text-sm text-gray-700">
                      暗色模式
                    </label>
                  </div>
                  
                  <div className="flex items-center">
                    <input
                      id="compactMode"
                      type="checkbox"
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <label htmlFor="compactMode" className="ml-2 block text-sm text-gray-700">
                      紧凑显示
                    </label>
                  </div>
                </div>
              </div>
              
              <div className="border-t pt-4">
                <h3 className="text-md font-medium mb-2">会话设置</h3>
                <p className="text-sm text-gray-500 mb-4">会话历史和存储配置</p>
                
                <div className="space-y-4">
                  <div className="flex items-center">
                    <input
                      id="saveConversation"
                      name="saveConversation"
                      type="checkbox"
                      checked={localUISettings.saveConversation || false}
                      onChange={handleUISettingsChange}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <label htmlFor="saveConversation" className="ml-2 block text-sm text-gray-700">
                      保存对话历史
                    </label>
                  </div>
                  
                  <div>
                    <label htmlFor="maxHistory" className="block text-sm font-medium text-gray-700">
                      最大历史消息数量
                    </label>
                    <select
                      id="maxHistory"
                      name="maxHistory"
                      className="mt-1 block w-full rounded-md border-gray-300 py-2 pl-3 pr-10 text-base focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
                    >
                      <option>50</option>
                      <option>100</option>
                      <option>200</option>
                      <option>无限制</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'llm' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-md font-medium mb-2">大语言模型设置</h3>
                <p className="text-sm text-gray-500 mb-4">选择大语言模型设置</p>
                
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">大语言模型设置</h3>
                  
                  <div className="grid grid-cols-1 gap-4">
                    <div className="form-group relative">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        API提供商
                      </label>
                      <div className="relative">
                        <select
                          className="w-full p-2 border border-gray-300 rounded-md bg-white"
                          value={localLLMSettings.provider}
                          onChange={(e) => {
                            const newProvider = e.target.value;
                            const newModel = !localLLMSettings.useCustomModel 
                              ? (getLLMOptions().find(opt => opt.value)?.value || '')
                              : localLLMSettings.model;
                              
                            setLocalLLMSettings(prev => ({
                              ...prev,
                              provider: newProvider,
                              model: newModel
                            }));
                          }}
                        >
                          <option value="openai">OpenAI</option>
                          <option value="deepseek">DeepSeek</option>
                          <option value="anthropic">Anthropic</option>
                          <option value="google">Google AI</option>
                          <option value="ollama">Ollama</option>
                          <option value="custom">自定义</option>
                        </select>
                      </div>
                    </div>
                    
                    <div className="form-group">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        API密钥
                      </label>
                      <input
                        type="password"
                        name="apiKey"
                        className="w-full p-2 border border-gray-300 rounded-md"
                        value={localLLMSettings.apiKey}
                        onChange={handleLLMChange}
                        placeholder="输入API密钥"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        请输入您的API密钥
                      </p>
                    </div>
                    
                    <div className="form-group">
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-sm font-medium text-gray-700">
                          模型名称
                        </label>
                        <div className="flex items-center">
                          <input
                            type="checkbox"
                            id="useCustomModel"
                            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                            checked={localLLMSettings.useCustomModel || false}
                            onChange={(e) => {
                              const useCustom = e.target.checked;
                              setLocalLLMSettings(prev => ({
                                ...prev,
                                useCustomModel: useCustom,
                                model: !useCustom ? (getLLMOptions().find(opt => opt.value)?.value || '') : prev.model
                              }));
                            }}
                          />
                          <label htmlFor="useCustomModel" className="ml-2 text-xs text-gray-600 cursor-pointer">
                            使用自定义模型
                          </label>
                        </div>
                      </div>
                      
                      {localLLMSettings.useCustomModel ? (
                        <input
                          type="text"
                          name="model"
                          className="w-full p-2 border border-gray-300 rounded-md"
                          value={localLLMSettings.model || ''}
                          onChange={handleLLMChange}
                          placeholder="输入模型名称"
                        />
                      ) : (
                        <select
                          name="model"
                          className="w-full p-2 border border-gray-300 rounded-md bg-gray-50"
                          value={localLLMSettings.model}
                          onChange={handleLLMChange}
                        >
                          {getLLMOptions().map(option => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      )}
                      
                      <p className="text-xs text-gray-500 mt-1">
                        {localLLMSettings.useCustomModel 
                          ? '您正在使用自定义模型名称' 
                          : `使用预定义模型列表`}
                      </p>
                    </div>
                    
                    {localLLMSettings.provider === 'custom' && (
                      <div className="form-group">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          API地址
                        </label>
                        <input
                          type="text"
                          name="customEndpoint"
                          className="w-full p-2 border border-gray-300 rounded-md"
                          value={localLLMSettings.customEndpoint || ''}
                          onChange={handleLLMChange}
                          placeholder="输入API地址"
                        />
                      </div>
                    )}
                    
                    <div className="form-group">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        温度 ({localLLMSettings.temperature})
                      </label>
                      <input
                        type="range"
                        name="temperature"
                        min="0"
                        max="1"
                        step="0.1"
                        className="w-full"
                        value={localLLMSettings.temperature}
                        onChange={(e) => handleRangeChange('llm', e)}
                      />
                      <div className="flex justify-between text-xs text-gray-500">
                        <span>更确定性</span>
                        <span>更创造性</span>
                      </div>
                    </div>
                    
                    <div className="form-group">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        最大生成长度
                      </label>
                      <input
                        type="number"
                        name="maxTokens"
                        className="w-full p-2 border border-gray-300 rounded-md"
                        value={localLLMSettings.maxTokens}
                        onChange={handleLLMChange}
                        min="100"
                        max="8000"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'embedding' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-md font-medium mb-2">向量化模型提供商</h3>
                <p className="text-sm text-gray-500 mb-4">硅基流动向量化服务</p>
                
                <div className="mt-2">
                  <div className="p-3 bg-gray-50 rounded-md text-gray-700 font-medium">
                    硅基流动 (Silicon Flow)
                  </div>
                </div>
              </div>
              
              <div>
                <h3 className="text-md font-medium mb-2">API密钥</h3>
                <p className="text-sm text-gray-500 mb-4">
                  提供您的硅基流动 API 密钥
                </p>
                
                <div className="mt-2">
                  <input
                    type="password"
                    name="apiKey"
                    value={localEmbeddingSettings.apiKey}
                    onChange={handleEmbeddingChange}
                    className="block w-full rounded-md border-gray-300 py-2 px-3 text-base focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
                    placeholder="输入您的API密钥"
                  />
                </div>
              </div>
              
              <div>
                <h3 className="text-md font-medium mb-2">自定义端点</h3>
                <p className="text-sm text-gray-500 mb-4">
                  硅基流动API端点 (默认: https://api.siliconflow.cn/v1/embeddings)
                </p>
                
                <div className="mt-2">
                  <input
                    type="text"
                    name="customEndpoint"
                    value={localEmbeddingSettings.customEndpoint || ''}
                    onChange={handleEmbeddingChange}
                    className="block w-full rounded-md border-gray-300 py-2 px-3 text-base focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
                    placeholder="https://api.siliconflow.cn/v1/embeddings"
                  />
                </div>
              </div>
              
              <div>
                <h3 className="text-md font-medium mb-2">模型</h3>
                <p className="text-sm text-gray-500 mb-4">选择要使用的向量化模型</p>
                
                <div className="mt-2">
                  <select
                    id="model"
                    name="model"
                    value={localEmbeddingSettings.model}
                    onChange={handleEmbeddingChange}
                    className="block w-full rounded-md border-gray-300 py-2 pl-3 pr-10 text-base focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
                  >
                    {getSiliconFlowEmbeddingOptions().map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              
              <div>
                <h3 className="text-md font-medium mb-2">向量化参数</h3>
                <p className="text-sm text-gray-500 mb-4">调整向量化模型参数</p>
                
                <div className="space-y-4">
                  <div>
                    <label htmlFor="encodingFormat" className="block text-sm font-medium text-gray-700">
                      编码格式
                    </label>
                    <div className="mt-1">
                      <select
                        id="encodingFormat"
                        name="encodingFormat"
                        value={localEmbeddingSettings.encodingFormat}
                        onChange={handleEmbeddingChange}
                        className="block w-full rounded-md border-gray-300 py-2 pl-3 pr-10 text-base focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
                      >
                        <option value="float">Float (浮点数)</option>
                        <option value="base64">Base64 (编码)</option>
                      </select>
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                      向量的编码格式，Float适用于大多数场景，Base64可减少传输数据大小
                    </p>
                  </div>
                </div>
              </div>
              
              {/* --- 新增：Reranking Settings Section --- */}
              <div className="mt-6 pt-6 border-t">
                <h3 className="text-lg font-semibold mb-4 border-b pb-2">重排序设置 (Reranking)</h3>

                 {/* Enable Reranking Switch */}
                 <div className="flex items-center mb-4">
                   <input
                     id="enableReranking"
                     name="enableReranking" // 确保 name 匹配 RerankingSettings 中的字段
                     type="checkbox"
                     className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                     checked={localRerankingSettings.enableReranking}
                     onChange={handleRerankingChange} // 使用新的处理函数
                   />
                   <label htmlFor="enableReranking" className="ml-2 block text-sm font-medium text-gray-700 cursor-pointer">
                     启用重排序 (需要额外 API 调用和时间)
                   </label>
                 </div>

                 {/* Reranking Model Selection (conditionally rendered) */}
                 {localRerankingSettings.enableReranking && (
                    <>
                       <div className="mt-4">
                         <h4 className="text-md font-medium mb-2">重排序模型</h4>
                         <p className="text-sm text-gray-500 mb-2">选择用于重排序的模型</p>
                         <select
                           id="rerankingModel"
                           name="rerankingModel" // 确保 name 匹配
                           value={localRerankingSettings.rerankingModel}
                           onChange={handleRerankingChange} // 使用新的处理函数
                           className="block w-full rounded-md border-gray-300 py-2 pl-3 pr-10 text-base focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
                         >
                           {getSiliconFlowRerankingOptions().map((option: { value: string, label: string }) => (
                             <option key={option.value} value={option.value}>
                               {option.label}
                             </option>
                           ))}
                         </select>
                       </div>

                       {/* Initial Candidates Input */}
                       <div className="mt-4">
                         <h4 className="text-md font-medium mb-2">初始候选数量</h4>
                         <p className="text-sm text-gray-500 mb-2">
                            向量搜索阶段检索的文档块数量，用于后续重排序 (建议 20-100)
                         </p>
                         <input
                           type="number"
                           id="initialRerankCandidates"
                           name="initialRerankCandidates" // 确保 name 匹配
                           value={localRerankingSettings.initialRerankCandidates}
                           onChange={handleRerankingChange} // 使用新的处理函数
                           min="10"
                           max="200"
                           step="10"
                           className="block w-full rounded-md border-gray-300 py-2 px-3 text-base focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
                         />
                       </div>

                       {/* Final Top N Input */}
                       <div className="mt-4">
                         <h4 className="text-md font-medium mb-2">最终返回数量 (Top N)</h4>
                         <p className="text-sm text-gray-500 mb-2">
                            重排序后，最终选择多少个最相关的文档块用于生成回答 (建议 3-10)
                         </p>
                         <input
                           type="number"
                           id="finalRerankTopN"
                           name="finalRerankTopN" // 确保 name 匹配
                           value={localRerankingSettings.finalRerankTopN}
                           onChange={handleRerankingChange} // 使用新的处理函数
                           min="1"
                           max="20"
                           step="1"
                           className="block w-full rounded-md border-gray-300 py-2 px-3 text-base focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
                         />
                       </div>

                       {/* Reranking Custom Endpoint (optional) */}
                       <div className="mt-4">
                         <h4 className="text-md font-medium mb-2">自定义重排序端点</h4>
                         <p className="text-sm text-gray-500 mb-2">
                            (可选) 硅基流动重排序 API 端点 (默认: https://api.siliconflow.cn/v1/rerank)
                         </p>
                         <input
                           type="text"
                           id="rerankingCustomEndpoint"
                           name="rerankingCustomEndpoint" // 确保 name 匹配
                           value={localRerankingSettings.rerankingCustomEndpoint || ''}
                           onChange={handleRerankingChange} // 使用新的处理函数
                           className="block w-full rounded-md border-gray-300 py-2 px-3 text-base focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
                           placeholder="https://api.siliconflow.cn/v1/rerank"
                         />
                       </div>
                    </>
                 )}
              </div>
            </div>
          )}
        </div>

        <div className="border-t p-4 flex justify-between items-center">
          <button
            onClick={handleReset}
            className="text-gray-700 hover:text-gray-900"
          >
            重置为默认值
          </button>
          
          <div className="flex items-center space-x-3">
            {saveStatus === 'saved' && (
              <span className="text-green-600 text-sm flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                已保存
              </span>
            )}
            
            {saveStatus === 'error' && (
              <span className="text-red-600 text-sm">保存失败</span>
            )}
            
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              取消
            </button>
            
            <button
              onClick={handleSave}
              disabled={saveStatus === 'saving'}
              className={`px-4 py-2 rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 ${
                saveStatus === 'saving' ? 'opacity-70 cursor-not-allowed' : ''
              }`}
            >
              {saveStatus === 'saving' ? '保存中...' : '保存设置'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
} 