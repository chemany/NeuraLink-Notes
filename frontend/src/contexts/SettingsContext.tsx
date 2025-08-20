'use client';

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
// Assuming AuthContext exists and provides a token. Adjust path if necessary.
import { useAuth } from './AuthContext';
import { getApiBaseUrl } from '../services/apiClient'; 
import localUnifiedSettingsService from '@/services/localUnifiedSettingsService';

// 大语言模型设置接口
export interface LLMSettings {
  provider: 'openai' | 'anthropic' | 'google' | 'deepseek' | 'openrouter' | 'ollama' | 'custom' | 'builtin' | 'builtin-neuralink';
  apiKey: string;
  model: string;
  temperature: number;
  maxTokens: number;
  customEndpoint?: string;
  useCustomModel?: boolean; // 新增：是否使用自定义模型名称
}

// 向量化模型设置接口
export interface EmbeddingModelSettings {
  provider: 'siliconflow'; // 固定为硅基流动
  apiKey: string;
  model: string;
  encodingFormat: 'float' | 'base64';
  customEndpoint?: string;
}

// --- 新增：重排序模型设置接口 ---
export interface RerankingSettings {
  enableReranking: boolean;       // 是否启用
  rerankingProvider: 'siliconflow'; // 固定为硅基流动 (与向量化保持一致)
  rerankingModel: string;         // 重排序模型名称
  initialRerankCandidates: number; // 初始候选数量
  finalRerankTopN: number;        // 最终返回数量
  rerankingCustomEndpoint?: string; // 自定义端点 (可选)
}

// 用户界面设置接口
export interface UISettings {
  darkMode: boolean;
  fontSize: 'small' | 'medium' | 'large';
  saveConversationHistory: boolean;
  customEndpoint: ''
}

// 默认大语言模型设置
const defaultLLMSettings: LLMSettings = {
  provider: 'builtin',
  apiKey: 'sk-or-v1-7f9a8b6c5d4e3f2a1b9c8d7e6f5a4b3c2d1e9f8a7b6c5d4e3f2a1b9c8d7e6f5',
  model: 'deepseek/deepseek-r1:free',
  temperature: 0.7,
  maxTokens: 2000,
  useCustomModel: false, // 默认不使用自定义模型
  customEndpoint: 'https://openrouter.ai/api/v1',
};

// 默认向量化模型设置
const defaultEmbeddingSettings: EmbeddingModelSettings = {
  provider: 'siliconflow',
  apiKey: '',
  model: 'BAAI/bge-large-zh-v1.5',
  encodingFormat: 'float',
  customEndpoint: '',
};

// --- 新增：默认重排序设置 ---
const defaultRerankingSettings: RerankingSettings = {
  enableReranking: false,
  rerankingProvider: 'siliconflow',
  rerankingModel: 'BAAI/bge-reranker-v2-m3',
  initialRerankCandidates: 50,
  finalRerankTopN: 5,
  rerankingCustomEndpoint: '',
};

// 默认UI设置
const defaultUISettings: UISettings = {
  darkMode: false,
  fontSize: 'medium',
  saveConversationHistory: true,
  customEndpoint: '',
};

// 提供商默认模型映射
const providerDefaultModels: Record<string, string> = {
  'openai': 'gpt-3.5-turbo',
  'deepseek': 'deepseek-chat',
  'anthropic': 'claude-instant-1',
  'google': 'gemini-pro',
  'openrouter': 'google/gemini-2.0-flash-exp:free',
  'ollama': 'llama2',
  'custom': ''
};

// 设置Context类型
export interface SettingsContextType {
  llmSettings: LLMSettings;
  embeddingSettings: EmbeddingModelSettings;
  rerankingSettings: RerankingSettings;
  uiSettings: UISettings;
  updateLLMSettings: (settings: Partial<LLMSettings>) => Promise<void>;
  updateEmbeddingSettings: (settings: Partial<EmbeddingModelSettings>) => Promise<void>;
  updateRerankingSettings: (settings: Partial<RerankingSettings>) => Promise<void>;
  updateUISettings: (settings: Partial<UISettings>) => Promise<void>;
  resetSettings: () => Promise<void>;
  isLoading: boolean; // To indicate settings are being fetched
  saveAllSettings: (settingsToSave: {
    llmSettings?: Partial<LLMSettings>;
    embeddingSettings?: Partial<EmbeddingModelSettings>;
    rerankingSettings?: Partial<RerankingSettings>;
    uiSettings?: Partial<UISettings>;
  }) => Promise<void>;
  getFullSettings: () => Promise<{
    llmSettings: LLMSettings;
    embeddingSettings: EmbeddingModelSettings;
    rerankingSettings: RerankingSettings;
    uiSettings: UISettings;
  } | null>;
  defaultModels: any;
  refreshSettings: () => Promise<void>;
}

// Helper function to validate and fix LLM settings
const validateAndFixLLMSettings = (settings: LLMSettings): LLMSettings => {
  // 完全移除自动修正逻辑，保持用户的模型选择
  return settings;
};

// 创建Context
const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

// API base URL is now imported from apiClient

// Provider组件
export function SettingsProvider({ children }: { children: ReactNode }) {
  const { token } = useAuth(); // Get token from AuthContext

  const [llmSettings, setLLMSettings] = useState<LLMSettings>(defaultLLMSettings);
  const [embeddingSettings, setEmbeddingSettings] = useState<EmbeddingModelSettings>(defaultEmbeddingSettings);
  const [rerankingSettings, setRerankingSettings] = useState<RerankingSettings>(defaultRerankingSettings);
  const [uiSettings, setUISettings] = useState<UISettings>(defaultUISettings);
  const [defaultModels, setDefaultModels] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true); // Start with loading true

  // 使用统一设置服务的API调用
  const unifiedApiCall = useCallback(async (method: 'get' | 'save', type: 'global' | 'app', category: string, data?: any) => {
    try {
      // 这个函数已经废弃，使用本地文件操作代替
      console.log('unifiedApiCall 已废弃，使用本地文件操作代替');
      return null;
    } catch (error) {
      console.error('统一设置服务API调用失败:', error);
      return null;
    }
  }, []);

  // 从统一设置服务获取LLM配置（多提供商格式）
  const fetchLLMSettingsFromUnified = useCallback(async () => {
    try {
      const isLoggedIn = localUnifiedSettingsService.isLoggedIn();
      console.log('[fetchLLMSettingsFromUnified] 检查登录状态:', isLoggedIn);

      if (!isLoggedIn) {
        console.log('未登录本地统一设置服务，使用默认设置');
        return null;
      }

      console.log('[fetchLLMSettingsFromUnified] 开始调用 getLLMSettingsFromFile...');
      const llmConfig = await localUnifiedSettingsService.getLLMSettingsFromFile();
      console.log('[fetchLLMSettingsFromUnified] 获取到的LLM配置:', llmConfig);
      return llmConfig;
    } catch (error) {
      console.error('获取LLM设置文件失败:', error);
      return null;
    }
  }, []);

  // 获取默认模型配置
  const fetchDefaultModels = useCallback(async () => {
    try {
      if (!localUnifiedSettingsService.isLoggedIn()) {
        return null;
      }

      const defaultModels = await localUnifiedSettingsService.getDefaultModels();
      return defaultModels;
    } catch (error) {
      console.error('获取默认模型配置失败:', error);
      return null;
    }
  }, []);



  // Fetch settings from unified service or legacy API
  useEffect(() => {
    const fetchSettings = async () => {
      console.log('[SettingsContext] fetchSettings被调用，token:', token);
      if (token) {
        console.log('[SettingsContext] token存在，开始获取设置');
        setIsLoading(true);
        
        // 首先尝试本地统一设置服务
        const isLoggedIn = localUnifiedSettingsService.isLoggedIn();
        console.log('[SettingsContext] 检查本地统一设置服务登录状态:', isLoggedIn);
        console.log('[SettingsContext] localStorage中的token:', localStorage.getItem('calendar_unified_token'));

        if (isLoggedIn) {
          console.log('从本地统一设置服务获取LLM配置...');
          const llmConfig = await fetchLLMSettingsFromUnified();
          const defaultModelsData = await fetchDefaultModels();
          setDefaultModels(defaultModelsData);
          
          if (llmConfig) {
            console.log('从本地统一设置服务获取的LLM配置:', llmConfig);
            console.log('llmConfig.provider:', llmConfig.provider);
            console.log('llmConfig.model:', llmConfig.model);
            console.log('llmConfig.model_name:', llmConfig.model_name);
            
            // 处理LLM设置 - 支持直接provider配置和多provider配置
            let currentProvider: string;
            let llmSettings: LLMSettings;
            
            // 检查是否是直接provider配置（新格式）
            const hasDirectProvider = llmConfig.provider && (llmConfig.model || llmConfig.model_name);
            console.log('检查直接provider条件:', hasDirectProvider);
            
            if (hasDirectProvider) {
              console.log('检测到直接provider配置格式:', llmConfig);
              currentProvider = llmConfig.provider;
              
              if (currentProvider === 'builtin' || currentProvider === 'builtin-neuralink') {
                // 对于内置模型，显示从default-models.json读取的配置信息
                const modelConfigKey = currentProvider === 'builtin-neuralink' ? 'builtin_free_neuralink' : 'builtin_free';
                const modelConfig = defaultModelsData?.[modelConfigKey] || defaultModelsData?.builtin_free;
                
                if (modelConfig) {
                  llmSettings = {
                    provider: currentProvider as LLMSettings['provider'],
                    apiKey: '内置免费模型', // 显示友好的文本而不是占位符
                    model: modelConfig.name || modelConfig.model_name || 'deepseek/deepseek-chat-v3-0324:free',
                    temperature: modelConfig.temperature || defaultLLMSettings.temperature,
                    maxTokens: modelConfig.max_tokens || defaultLLMSettings.maxTokens,
                    customEndpoint: modelConfig.description || '通过内置代理服务访问',
                    useCustomModel: false
                  };
                } else {
                  llmSettings = {
                    provider: currentProvider as LLMSettings['provider'],
                    apiKey: '内置免费模型',
                    model: '灵枢笔记专用 - 大规模模型',
                    temperature: 0.7,
                    maxTokens: 4000,
                    customEndpoint: '通过内置代理服务访问',
                    useCustomModel: false
                  };
                }
                console.log('使用内置模型配置 (显示模式):', llmSettings);
              } else {
                // 对于custom/其他provider，直接使用配置
                llmSettings = {
                  provider: currentProvider as LLMSettings['provider'],
                  apiKey: llmConfig.api_key || (llmConfig.hasApiKey ? 'CONFIGURED' : ''), // 优先使用api_key字段，回退到hasApiKey标记
                  model: llmConfig.model || llmConfig.model_name || '', // 支持model和model_name字段
                  temperature: defaultLLMSettings.temperature,
                  maxTokens: defaultLLMSettings.maxTokens,
                  customEndpoint: llmConfig.custom_endpoint || '',
                  useCustomModel: true // custom provider总是使用自定义模型
                };
                console.log('使用直接provider配置:', llmSettings);
              }
            } else {
              // 处理传统的多提供商配置结构
              currentProvider = llmConfig.current_provider || 'builtin';
              console.log('检测到传统多provider配置格式，当前provider:', currentProvider);
              
              if (currentProvider === 'builtin' || currentProvider === 'builtin-neuralink') {
                // 内置模型逻辑同上
                const modelConfigKey = currentProvider === 'builtin-neuralink' ? 'builtin_free_neuralink' : 'builtin_free';
                const modelConfig = defaultModelsData?.[modelConfigKey] || defaultModelsData?.builtin_free;
                
                if (modelConfig) {
                  llmSettings = {
                    provider: currentProvider as LLMSettings['provider'],
                    apiKey: '内置免费模型',
                    model: modelConfig.name || modelConfig.model_name || 'deepseek/deepseek-chat-v3-0324:free',
                    temperature: modelConfig.temperature || defaultLLMSettings.temperature,
                    maxTokens: modelConfig.max_tokens || defaultLLMSettings.maxTokens,
                    customEndpoint: modelConfig.description || '通过内置代理服务访问',
                    useCustomModel: false
                  };
                } else {
                  llmSettings = {
                    provider: currentProvider as LLMSettings['provider'],
                    apiKey: '内置免费模型',
                    model: '灵枢笔记专用 - 大规模模型',
                    temperature: 0.7,
                    maxTokens: 4000,
                    customEndpoint: '通过内置代理服务访问',
                    useCustomModel: false
                  };
                }
                console.log('使用内置模型配置 (显示模式):', llmSettings);
              } else if (llmConfig.providers && llmConfig.providers[currentProvider]) {
                // 使用指定提供商的配置
                const providerConfig = llmConfig.providers[currentProvider];
                const useCustom = providerConfig.use_custom_model || false;
                
                // 根据use_custom_model字段决定显示哪个模型
                let modelToDisplay = '';
                if (useCustom) {
                  // 使用自定义模型时，优先使用custom_model，回退到model_name
                  modelToDisplay = providerConfig.custom_model || providerConfig.model_name || defaultLLMSettings.model;
                } else {
                  // 使用预定义模型时，优先使用predefined_model，回退到model_name
                  modelToDisplay = providerConfig.predefined_model || providerConfig.model_name || defaultLLMSettings.model;
                }
                
                llmSettings = {
                  provider: currentProvider as any,
                  apiKey: providerConfig.api_key || '',
                  model: modelToDisplay,
                  temperature: defaultLLMSettings.temperature, // 温度等参数使用默认值
                  maxTokens: defaultLLMSettings.maxTokens,
                  customEndpoint: providerConfig.base_url || '',
                  useCustomModel: useCustom
                };
              } else {
                // 回退到默认设置，但如果是builtin，使用正确的默认值
                if (currentProvider === 'builtin' || currentProvider === 'builtin-neuralink') {
                  llmSettings = {
                    provider: currentProvider as LLMSettings['provider'],
                    apiKey: '内置免费模型',
                    model: '灵枢笔记专用 - 大规模模型',
                    temperature: 0.7,
                    maxTokens: 4000,
                    customEndpoint: '通过内置代理服务访问',
                    useCustomModel: false
                  };
                } else {
                  llmSettings = { ...defaultLLMSettings, provider: currentProvider as any };
                }
              }
            }
            
            const fixedLLMSettings = validateAndFixLLMSettings(llmSettings);
            setLLMSettings(fixedLLMSettings);
            
            // 同步到localStorage
            if (typeof window !== 'undefined') {
              localStorage.setItem('llmSettings', JSON.stringify(fixedLLMSettings));
              console.log('[SettingsContext] 已同步LLM设置到localStorage (from unified service):', fixedLLMSettings);
            }
            
            // 从本地统一设置服务获取embedding和reranking设置
            try {
              const embeddingData = await localUnifiedSettingsService.getEmbeddingSettingsFromFile();
              if (embeddingData && embeddingData.data) {
                // 转换embedding设置格式以匹配前端接口
                const embeddingSettings = {
                  provider: embeddingData.data.provider || 'siliconflow',
                  apiKey: embeddingData.data.apiKey || embeddingData.data.api_key || '', // 支持两种字段名
                  model: embeddingData.data.model || defaultEmbeddingSettings.model,
                  encodingFormat: (embeddingData.data.encodingFormat || embeddingData.data.encoding_format as 'float' | 'base64') || defaultEmbeddingSettings.encodingFormat,
                  customEndpoint: embeddingData.data.customEndpoint || embeddingData.data.custom_endpoint || defaultEmbeddingSettings.customEndpoint
                };
                setEmbeddingSettings(embeddingSettings);
                console.log('[SettingsContext] 从统一设置服务读取embedding设置:', embeddingSettings);
              } else {
                setEmbeddingSettings(defaultEmbeddingSettings);
                console.log('[SettingsContext] 未找到embedding配置，使用默认设置');
              }
            } catch (error) {
              console.log('获取embedding设置失败，使用默认设置:', error);
              setEmbeddingSettings(defaultEmbeddingSettings);
            }

            try {
              const rerankingData = await localUnifiedSettingsService.getRerankingSettingsFromFile();
              if (rerankingData && rerankingData.data) {
                // 转换reranking设置格式以匹配前端接口
                const rerankingSettings = {
                  enableReranking: rerankingData.data.enableReranking || false,
                  rerankingProvider: rerankingData.data.rerankingProvider || 'siliconflow',
                  rerankingModel: rerankingData.data.rerankingModel || defaultRerankingSettings.rerankingModel,
                  initialRerankCandidates: rerankingData.data.initialRerankCandidates || defaultRerankingSettings.initialRerankCandidates,
                  finalRerankTopN: rerankingData.data.finalRerankTopN || defaultRerankingSettings.finalRerankTopN,
                  rerankingCustomEndpoint: rerankingData.data.rerankingCustomEndpoint || defaultRerankingSettings.rerankingCustomEndpoint
                };
                setRerankingSettings(rerankingSettings);
              } else {
                setRerankingSettings(defaultRerankingSettings);
              }
            } catch (error) {
              console.log('获取reranking设置失败，使用默认设置:', error);
              setRerankingSettings(defaultRerankingSettings);
            }

            setUISettings(defaultUISettings);
          } else {
            console.log('本地统一设置服务获取失败，使用默认设置');
            setLLMSettings(validateAndFixLLMSettings(defaultLLMSettings));
            setEmbeddingSettings(defaultEmbeddingSettings);
            setRerankingSettings(defaultRerankingSettings);
            setUISettings(defaultUISettings);
          }
        } else {
          console.log('未登录本地统一设置服务，使用默认设置并提示用户登录');
          setLLMSettings(validateAndFixLLMSettings(defaultLLMSettings));
          setEmbeddingSettings(defaultEmbeddingSettings);
          setRerankingSettings(defaultRerankingSettings);
          setUISettings(defaultUISettings);
        }
        setIsLoading(false);
      } else {
        console.log('无令牌，使用默认设置');
        setLLMSettings(validateAndFixLLMSettings(defaultLLMSettings));
        setEmbeddingSettings(defaultEmbeddingSettings);
        setRerankingSettings(defaultRerankingSettings);
        setUISettings(defaultUISettings);
        setIsLoading(false);
    }
    };
    fetchSettings();
  }, [token, fetchLLMSettingsFromUnified]);

  // Generic update function using unified service
  const makeUnifiedUpdateFunction = <T extends LLMSettings | EmbeddingModelSettings | RerankingSettings | UISettings>(
    setStateFunction: React.Dispatch<React.SetStateAction<T>>,
    settingsKey: 'llmSettings' | 'embeddingSettings' | 'rerankingSettings' | 'uiSettings',
  ) => {
    return async (newPartialSettings: Partial<T>) => {
      // Apply validation for LLM settings
      if (settingsKey === 'llmSettings') {
        setStateFunction(prevState => {
          const updatedSettings = { ...prevState, ...newPartialSettings } as LLMSettings;
          const fixedSettings = validateAndFixLLMSettings(updatedSettings);
          // 同步更新localStorage
          if (typeof window !== 'undefined') {
            localStorage.setItem('llmSettings', JSON.stringify(fixedSettings));
            console.log('[SettingsContext] 已同步LLM设置到localStorage (individual update):', fixedSettings);
          }
          return fixedSettings as T;
        });
      } else {
        setStateFunction(prevState => ({ ...prevState, ...newPartialSettings }));
      }
      
      // 保存到本地统一设置服务或原有API
      let saveSuccess = false;
      
      if (localUnifiedSettingsService.isLoggedIn()) {
        try {
          if (settingsKey === 'llmSettings') {
            const llmData = newPartialSettings as Partial<LLMSettings>;
            const currentSettings = llmSettings;
            const updatedSettings = { ...currentSettings, ...llmData };
            
            let providerSettings;
            
            if (updatedSettings.provider === 'builtin' || updatedSettings.provider === 'builtin-neuralink') {
              // 对于内置模型，使用特殊标记让后端从default-models.json读取配置
              providerSettings = {
                api_key: 'USE_DEFAULT_CONFIG',
                temperature: 'USE_DEFAULT_CONFIG',
                max_tokens: 'USE_DEFAULT_CONFIG',
                model_name: 'USE_DEFAULT_CONFIG',
                base_url: 'USE_DEFAULT_CONFIG'
              };
            } else {
              // 对于其他提供商，使用实际配置
              const useCustom = updatedSettings.useCustomModel || false;
              providerSettings = {
                api_key: updatedSettings.apiKey || '',
                temperature: updatedSettings.temperature || 0.7,
                max_tokens: updatedSettings.maxTokens || 2000,
                model_name: updatedSettings.model || '', // 保持兼容性，存储当前使用的模型
                predefined_model: useCustom ? '' : (updatedSettings.model || ''), // 预定义模型选择
                custom_model: useCustom ? (updatedSettings.model || '') : '',     // 自定义模型名称
                base_url: updatedSettings.customEndpoint || '',
                use_custom_model: useCustom
              };
            }
            
            const result = await localUnifiedSettingsService.saveLLMSettingsToFile(
              updatedSettings.provider || 'builtin',
              providerSettings
            );
            saveSuccess = !!result;
          } else if (settingsKey === 'embeddingSettings') {
            const embeddingData = newPartialSettings as Partial<EmbeddingModelSettings>;
            const currentSettings = embeddingSettings;
            const updatedSettings = { ...currentSettings, ...embeddingData };
            
            // 转换为统一设置服务需要的格式，包含API密钥
            const embeddingDataToSave = {
              provider: updatedSettings.provider,
              model: updatedSettings.model,
              api_key: updatedSettings.apiKey || '',
              encoding_format: updatedSettings.encodingFormat || 'float',
              custom_endpoint: updatedSettings.customEndpoint || ''
            };
            const result = await localUnifiedSettingsService.saveEmbeddingSettingsToFile(embeddingDataToSave);
            saveSuccess = !!result;
          } else if (settingsKey === 'rerankingSettings') {
            const rerankingData = newPartialSettings as Partial<RerankingSettings>;
            const currentSettings = rerankingSettings;
            const updatedSettings = { ...currentSettings, ...rerankingData };
            
            const rerankingDataToSave = {
              enableReranking: updatedSettings.enableReranking,
              rerankingProvider: updatedSettings.rerankingProvider,
              rerankingModel: updatedSettings.rerankingModel,
              initialRerankCandidates: updatedSettings.initialRerankCandidates,
              finalRerankTopN: updatedSettings.finalRerankTopN,
              rerankingCustomEndpoint: updatedSettings.rerankingCustomEndpoint
            };
            const result = await localUnifiedSettingsService.saveRerankingSettingsToFile(rerankingDataToSave);
            saveSuccess = !!result;
          } else if (settingsKey === 'uiSettings') {
            const uiData = newPartialSettings as Partial<UISettings>;
            const appData = {
              theme: uiData.darkMode ? 'dark' : 'light',
              auto_save: uiData.saveConversationHistory
            };
            // UI设置暂时保存到localStorage，未来可以添加到文件存储
            localStorage.setItem('uiSettings', JSON.stringify(uiData));
            const result = { success: true };
            saveSuccess = !!result;
          }
          
          if (saveSuccess) {
            console.log(`${settingsKey} 已保存到统一设置服务`);
            return;
      } else {
            console.log(`统一设置服务保存${settingsKey}失败，回退到原有API`);
          }
        } catch (error) {
          console.error(`保存${settingsKey}到统一设置服务失败，回退到原有API:`, error);
        }
      }
      
      // 如果未登录统一设置服务，提示用户登录
      if (!saveSuccess) {
        console.warn(`无法保存${settingsKey}：请登录统一设置服务`);
        // 可以在这里添加用户提示或其他处理逻辑
    }
    };
  };
  
  const updateLLMSettings = makeUnifiedUpdateFunction(setLLMSettings, 'llmSettings');
  const updateEmbeddingSettings = makeUnifiedUpdateFunction(setEmbeddingSettings, 'embeddingSettings');
  const updateRerankingSettings = makeUnifiedUpdateFunction(setRerankingSettings, 'rerankingSettings');
  const updateUISettings = makeUnifiedUpdateFunction(setUISettings, 'uiSettings');
      
  // New method to save all potentially changed settings at once
  const saveAllSettings = async (settingsToSave: {
    llmSettings?: Partial<LLMSettings>;
    embeddingSettings?: Partial<EmbeddingModelSettings>;
    rerankingSettings?: Partial<RerankingSettings>;
    uiSettings?: Partial<UISettings>;
  }) => {
    console.log('Attempting to save all settings to backend:', settingsToSave);
    // Optimistically update local state for all parts included in settingsToSave
    if (settingsToSave.llmSettings) {
      setLLMSettings(prev => {
        const updatedSettings = { ...prev, ...settingsToSave.llmSettings };
        const fixedSettings = validateAndFixLLMSettings(updatedSettings);
        // 同步更新localStorage以便aiService.ts可以读取到最新配置
        if (typeof window !== 'undefined') {
          localStorage.setItem('llmSettings', JSON.stringify(fixedSettings));
          console.log('[SettingsContext] 已同步LLM设置到localStorage:', fixedSettings);
        }
        return fixedSettings;
      });
    }
    if (settingsToSave.embeddingSettings) {
      setEmbeddingSettings(prev => ({ ...prev, ...settingsToSave.embeddingSettings }));
    }
    if (settingsToSave.rerankingSettings) {
      setRerankingSettings(prev => ({ ...prev, ...settingsToSave.rerankingSettings }));
    }
    if (settingsToSave.uiSettings) {
      setUISettings(prev => ({ ...prev, ...settingsToSave.uiSettings }));
    }

    // 使用本地统一设置服务保存设置
    if (!localUnifiedSettingsService.isLoggedIn()) {
      throw new Error('用户未登录本地统一设置服务');
    }
    
    console.log('使用本地统一设置服务保存设置...');
    
    // 保存到本地统一设置服务（使用分别保存的方式）
    const savePromises = [];
    
    if (settingsToSave.llmSettings) {
      let providerSettings;
      
      if (settingsToSave.llmSettings.provider === 'builtin' || settingsToSave.llmSettings.provider === 'builtin-neuralink') {
        // 对于内置模型，使用特殊标记让后端从default-models.json读取配置
        providerSettings = {
          api_key: 'USE_DEFAULT_CONFIG',
          temperature: 'USE_DEFAULT_CONFIG',
          max_tokens: 'USE_DEFAULT_CONFIG',
          model_name: 'USE_DEFAULT_CONFIG',
          base_url: 'USE_DEFAULT_CONFIG'
        };
              } else {
          // 对于其他提供商，使用实际配置
          const useCustom = settingsToSave.llmSettings.useCustomModel || false;
          providerSettings = {
            api_key: settingsToSave.llmSettings.apiKey || '',
            model_name: settingsToSave.llmSettings.model || '', // 保持兼容性，存储当前使用的模型
            predefined_model: useCustom ? '' : (settingsToSave.llmSettings.model || ''), // 预定义模型选择
            custom_model: useCustom ? (settingsToSave.llmSettings.model || '') : '',     // 自定义模型名称
            base_url: settingsToSave.llmSettings.customEndpoint || '',
            use_custom_model: useCustom
          };
        }
      
      savePromises.push(
        localUnifiedSettingsService.saveLLMSettingsToFile(
          settingsToSave.llmSettings.provider || 'builtin',
          providerSettings
        )
      );
    }
    
    if (settingsToSave.embeddingSettings) {
      // 转换为统一设置服务需要的格式，包含API密钥
      const embeddingDataToSave = {
        provider: settingsToSave.embeddingSettings.provider,
        model: settingsToSave.embeddingSettings.model,
        api_key: settingsToSave.embeddingSettings.apiKey || '',
        encoding_format: settingsToSave.embeddingSettings.encodingFormat || 'float',
        custom_endpoint: settingsToSave.embeddingSettings.customEndpoint || ''
      };
      savePromises.push(
        localUnifiedSettingsService.saveEmbeddingSettingsToFile(embeddingDataToSave)
      );
    }
    
    if (settingsToSave.rerankingSettings) {
      const rerankingGlobalData = {
        enableReranking: settingsToSave.rerankingSettings.enableReranking,
        rerankingProvider: settingsToSave.rerankingSettings.rerankingProvider,
        rerankingModel: settingsToSave.rerankingSettings.rerankingModel,
        initialRerankCandidates: settingsToSave.rerankingSettings.initialRerankCandidates,
        finalRerankTopN: settingsToSave.rerankingSettings.finalRerankTopN,
        rerankingCustomEndpoint: settingsToSave.rerankingSettings.rerankingCustomEndpoint
      };
      savePromises.push(
        localUnifiedSettingsService.saveRerankingSettingsToFile(rerankingGlobalData)
      );
    }
    
    if (settingsToSave.uiSettings) {
      const appData = {
        theme: settingsToSave.uiSettings.darkMode ? 'dark' : 'light',
        auto_save: settingsToSave.uiSettings.saveConversationHistory
      };
      // UI设置暂时保存到localStorage，未来可以添加到文件存储
      localStorage.setItem('uiSettings', JSON.stringify(appData));
      savePromises.push(Promise.resolve({ success: true }));
    }
    
    // 等待所有保存操作完成
    const results = await Promise.all(savePromises);
    
    // 检查是否所有操作都成功（API返回响应对象表示成功）
    const allSuccess = results.every(result => result !== null && result !== undefined);
    
    if (allSuccess) {
      console.log('统一设置服务保存成功');
      return;
    } else {
      throw new Error('统一设置服务保存失败');
    }
  };

  const resetSettings = async () => {
    console.log('Resetting settings to default and updating backend...');
    const fixedLLMSettings = validateAndFixLLMSettings(defaultLLMSettings);
    setLLMSettings(fixedLLMSettings);
    setEmbeddingSettings(defaultEmbeddingSettings);
    setRerankingSettings(defaultRerankingSettings);
    setUISettings(defaultUISettings);
    
    // 同步到localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('llmSettings', JSON.stringify(fixedLLMSettings));
      console.log('[SettingsContext] 已重置并同步LLM设置到localStorage:', fixedLLMSettings);
    }

    const payload = {
      llmSettings: defaultLLMSettings,
      embeddingSettings: defaultEmbeddingSettings,
      rerankingSettings: defaultRerankingSettings,
      uiSettings: defaultUISettings,
    };
    // 使用本地统一设置服务重置设置
    try {
      if (localUnifiedSettingsService.isLoggedIn()) {
        await saveAllSettings(payload);
        console.log('Settings successfully reset on backend.');
      } else {
        console.log('未登录本地统一设置服务，仅更新本地状态');
      }
    } catch (error) {
      console.error('Failed to reset settings on backend:', error);
      // Handle error, perhaps by notifying user
    }
  };

  // 获取包含API Key的完整设置，用于AI服务调用
  const getFullSettings = async (): Promise<{
    llmSettings: LLMSettings;
    embeddingSettings: EmbeddingModelSettings;
    rerankingSettings: RerankingSettings;
    uiSettings: UISettings;
  } | null> => {
    if (!token) {
      console.log('[SettingsContext] No token available for full settings fetch');
      return null;
    }
    
    try {
      console.log('[SettingsContext] Fetching full settings including API keys...');
      // 使用本地统一设置服务获取完整设置
      if (localUnifiedSettingsService.isLoggedIn()) {
        const [llmData, embeddingData, rerankingData] = await Promise.all([
          localUnifiedSettingsService.getLLMSettingsFromFile(),
          localUnifiedSettingsService.getEmbeddingSettingsFromFile(),
          localUnifiedSettingsService.getRerankingSettingsFromFile()
        ]);
        
        console.log('[SettingsContext] Full settings fetched successfully');
        
        // 处理LLM设置
        let llmSettings = defaultLLMSettings;
        if (llmData && llmData.data) {
          const currentProvider = llmData.data.current_provider || 'builtin';
          if (llmData.data.providers && llmData.data.providers[currentProvider]) {
            const providerConfig = llmData.data.providers[currentProvider];
            const useCustom = providerConfig.use_custom_model || false;
            
            // 根据use_custom_model字段决定显示哪个模型
            let modelToDisplay = '';
            if (useCustom) {
              // 使用自定义模型时，优先使用custom_model，回退到model_name
              modelToDisplay = providerConfig.custom_model || providerConfig.model_name || defaultLLMSettings.model;
            } else {
              // 使用预定义模型时，优先使用predefined_model，回退到model_name
              modelToDisplay = providerConfig.predefined_model || providerConfig.model_name || defaultLLMSettings.model;
            }
            
            llmSettings = {
              provider: currentProvider as any,
              apiKey: providerConfig.api_key || '',
              model: modelToDisplay,
              temperature: defaultLLMSettings.temperature,
              maxTokens: defaultLLMSettings.maxTokens,
              customEndpoint: providerConfig.base_url || '',
              useCustomModel: useCustom
            };
          }
        }
        
        // 处理embedding设置
        let embeddingSettings = defaultEmbeddingSettings;
        if (embeddingData && embeddingData.data) {
          embeddingSettings = {
            provider: embeddingData.data.provider || 'siliconflow',
            apiKey: embeddingData.data.api_key || '',
            model: embeddingData.data.model || defaultEmbeddingSettings.model,
            encodingFormat: (embeddingData.data.encoding_format as 'float' | 'base64') || defaultEmbeddingSettings.encodingFormat,
            customEndpoint: embeddingData.data.custom_endpoint || defaultEmbeddingSettings.customEndpoint
          };
        }
        
        // 处理reranking设置
        let rerankingSettings = defaultRerankingSettings;
        if (rerankingData && rerankingData.data) {
          rerankingSettings = {
            enableReranking: rerankingData.data.enableReranking || false,
            rerankingProvider: rerankingData.data.rerankingProvider || 'siliconflow',
            rerankingModel: rerankingData.data.rerankingModel || defaultRerankingSettings.rerankingModel,
            initialRerankCandidates: rerankingData.data.initialRerankCandidates || defaultRerankingSettings.initialRerankCandidates,
            finalRerankTopN: rerankingData.data.finalRerankTopN || defaultRerankingSettings.finalRerankTopN,
            rerankingCustomEndpoint: rerankingData.data.rerankingCustomEndpoint || defaultRerankingSettings.rerankingCustomEndpoint
          };
        }
        
        // 应用验证和修正
        const fixedLLMSettings = validateAndFixLLMSettings(llmSettings);
        return {
          llmSettings: fixedLLMSettings,
          embeddingSettings,
          rerankingSettings,
          uiSettings: defaultUISettings // UI设置从localStorage读取
        };
      }
    } catch (error) {
      console.error('[SettingsContext] Failed to fetch full settings:', error);
    }
    return null;
  };

  // 手动刷新设置的方法
  const refreshSettings = useCallback(async () => {
    console.log('[SettingsContext] 手动刷新设置被调用');
    if (token) {
      setIsLoading(true);

      // 重新从统一设置服务获取最新设置
      const isLoggedIn = localUnifiedSettingsService.isLoggedIn();
      console.log('[SettingsContext] 刷新设置 - 检查登录状态:', isLoggedIn);

      if (isLoggedIn) {
        try {
          console.log('[SettingsContext] 从统一设置服务刷新LLM配置...');
          const llmConfig = await fetchLLMSettingsFromUnified();
          const defaultModelsData = await fetchDefaultModels();
          setDefaultModels(defaultModelsData);

          if (llmConfig) {
            console.log('[SettingsContext] 刷新获取的LLM配置:', llmConfig);
            console.log('[SettingsContext] 刷新 - llmConfig.provider:', llmConfig.provider);
            console.log('[SettingsContext] 刷新 - llmConfig.model_name:', llmConfig.model_name);

            // 处理LLM设置 - 支持直接provider配置和传统多provider配置
            let currentProvider: string;
            let llmSettings: LLMSettings;
            
            // 检查是否是直接provider配置（新格式）
            const hasDirectProvider = llmConfig.provider && (llmConfig.model || llmConfig.model_name);
            console.log('[SettingsContext] 刷新 - 检查直接provider条件:', hasDirectProvider);
            
            if (hasDirectProvider) {
              console.log('[SettingsContext] 刷新 - 检测到直接provider配置格式');
              currentProvider = llmConfig.provider;
              
              if (currentProvider === 'builtin' || currentProvider === 'builtin-neuralink') {
                const modelConfigKey = currentProvider === 'builtin-neuralink' ? 'builtin_free_neuralink' : 'builtin_free';
                const modelConfig = defaultModelsData?.[modelConfigKey] || defaultModelsData?.builtin_free;
                
                if (modelConfig) {
                  llmSettings = {
                    provider: currentProvider as LLMSettings['provider'],
                    apiKey: '内置免费模型',
                    model: modelConfig.name || modelConfig.model_name || 'deepseek/deepseek-chat-v3-0324:free',
                    temperature: modelConfig.temperature || defaultLLMSettings.temperature,
                    maxTokens: modelConfig.max_tokens || defaultLLMSettings.maxTokens,
                    customEndpoint: modelConfig.description || '通过内置代理服务访问',
                    useCustomModel: false
                  };
                } else {
                  llmSettings = {
                    provider: currentProvider as LLMSettings['provider'],
                    apiKey: '内置免费模型',
                    model: '灵枢笔记专用 - 大规模模型',
                    temperature: 0.7,
                    maxTokens: 4000,
                    customEndpoint: '通过内置代理服务访问',
                    useCustomModel: false
                  };
                }
                console.log('[SettingsContext] 刷新 - 使用内置模型配置:', llmSettings);
              } else {
                // 对于custom/其他provider，直接使用配置
                llmSettings = {
                  provider: currentProvider as LLMSettings['provider'],
                  apiKey: llmConfig.api_key || (llmConfig.hasApiKey ? 'CONFIGURED' : ''), // 优先使用api_key字段，回退到hasApiKey标记
                  model: llmConfig.model || llmConfig.model_name || '', // 支持model和model_name字段
                  temperature: defaultLLMSettings.temperature,
                  maxTokens: defaultLLMSettings.maxTokens,
                  customEndpoint: llmConfig.custom_endpoint || '',
                  useCustomModel: true // custom provider总是使用自定义模型
                };
                console.log('[SettingsContext] 刷新 - 使用直接provider配置:', llmSettings);
              }
            } else {
              // 处理传统的多提供商配置结构
              console.log('[SettingsContext] 刷新 - 使用传统多provider配置格式');
              currentProvider = llmConfig.current_provider || 'builtin';
              
              if (currentProvider === 'builtin' || currentProvider === 'builtin-neuralink') {
                const modelConfigKey = currentProvider === 'builtin-neuralink' ? 'builtin_free_neuralink' : 'builtin_free';
                const modelConfig = defaultModelsData?.[modelConfigKey] || defaultModelsData?.builtin_free;
                
                if (modelConfig) {
                  llmSettings = {
                    provider: currentProvider as LLMSettings['provider'],
                    apiKey: '内置免费模型',
                    model: modelConfig.name || modelConfig.model_name || 'deepseek/deepseek-chat-v3-0324:free',
                    temperature: modelConfig.temperature || defaultLLMSettings.temperature,
                    maxTokens: modelConfig.max_tokens || defaultLLMSettings.maxTokens,
                    customEndpoint: modelConfig.description || '通过内置代理服务访问',
                    useCustomModel: false
                  };
                } else {
                  llmSettings = {
                    provider: currentProvider as LLMSettings['provider'],
                    apiKey: '内置免费模型',
                    model: '灵枢笔记专用 - 大规模模型',
                    temperature: 0.7,
                    maxTokens: 4000,
                    customEndpoint: '通过内置代理服务访问',
                    useCustomModel: false
                  };
                }
              } else {
                const providerConfig = llmConfig.providers?.[currentProvider];
                if (providerConfig) {
                  llmSettings = {
                    provider: currentProvider as any,
                    apiKey: providerConfig.api_key || '',
                    model: providerConfig.model_name || defaultLLMSettings.model,
                    temperature: providerConfig.temperature || defaultLLMSettings.temperature,
                    maxTokens: providerConfig.max_tokens || defaultLLMSettings.maxTokens,
                    customEndpoint: providerConfig.base_url || defaultLLMSettings.customEndpoint
                };
                } else {
                  llmSettings = { ...defaultLLMSettings, provider: currentProvider as any };
                }
              }
            }

            setLLMSettings(validateAndFixLLMSettings(llmSettings));
          }

          // 刷新embedding和reranking设置
          try {
            const embeddingData = await localUnifiedSettingsService.getEmbeddingSettingsFromFile();
            if (embeddingData && embeddingData.data) {
              const embeddingSettings = {
                provider: embeddingData.data.provider || 'siliconflow',
                apiKey: embeddingData.data.apiKey || embeddingData.data.api_key || '',
                model: embeddingData.data.model || defaultEmbeddingSettings.model,
                encodingFormat: (embeddingData.data.encodingFormat || embeddingData.data.encoding_format as 'float' | 'base64') || defaultEmbeddingSettings.encodingFormat,
                customEndpoint: embeddingData.data.customEndpoint || embeddingData.data.custom_endpoint || defaultEmbeddingSettings.customEndpoint
              };
              setEmbeddingSettings(embeddingSettings);
              console.log('[SettingsContext] 刷新的embedding设置:', embeddingSettings);
            }
          } catch (error) {
            console.error('[SettingsContext] 刷新embedding设置失败:', error);
          }

          try {
            const rerankingData = await localUnifiedSettingsService.getRerankingSettingsFromFile();
            if (rerankingData && rerankingData.data) {
              const rerankingSettings = {
                enableReranking: rerankingData.data.enableReranking || false,
                rerankingProvider: rerankingData.data.rerankingProvider || 'siliconflow',
                rerankingModel: rerankingData.data.rerankingModel || defaultRerankingSettings.rerankingModel,
                initialRerankCandidates: rerankingData.data.initialRerankCandidates || defaultRerankingSettings.initialRerankCandidates,
                finalRerankTopN: rerankingData.data.finalRerankTopN || defaultRerankingSettings.finalRerankTopN,
                rerankingCustomEndpoint: rerankingData.data.rerankingCustomEndpoint || defaultRerankingSettings.rerankingCustomEndpoint
              };
              setRerankingSettings(rerankingSettings);
              console.log('[SettingsContext] 刷新的reranking设置:', rerankingSettings);
            }
          } catch (error) {
            console.error('[SettingsContext] 刷新reranking设置失败:', error);
          }

        } catch (error) {
          console.error('[SettingsContext] 刷新设置失败:', error);
        }
      }

      setIsLoading(false);
    }
  }, [token, fetchLLMSettingsFromUnified]);

  return (
    <SettingsContext.Provider
      value={{
        llmSettings,
        embeddingSettings,
        rerankingSettings,
        uiSettings,
        updateLLMSettings,
        updateEmbeddingSettings,
        updateRerankingSettings,
        updateUISettings,
        resetSettings,
        isLoading,
        saveAllSettings,
        getFullSettings,
        defaultModels,
        refreshSettings, // 添加刷新方法
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

// 自定义Hook以便于使用Context
export function useSettings() {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}

// 兼容旧版本接口的别名(用于平滑过渡)
export type AIModelSettings = LLMSettings;