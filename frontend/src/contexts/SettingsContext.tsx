'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

// 大语言模型设置接口
export interface LLMSettings {
  provider: string; // 'openai' | 'anthropic' | 'google' | 'deepseek' | 'ollama' | 'custom'
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
  provider: 'openai',
  apiKey: '',
  model: 'gpt-3.5-turbo',
  temperature: 0.7,
  maxTokens: 1000,
  useCustomModel: false // 默认不使用自定义模型
};

// 默认向量化模型设置
const defaultEmbeddingSettings: EmbeddingModelSettings = {
  provider: 'siliconflow',
  apiKey: '',
  model: 'BAAI/bge-large-zh-v1.5',
  encodingFormat: 'float',
  customEndpoint: ''
};

// --- 新增：默认重排序设置 ---
const defaultRerankingSettings: RerankingSettings = {
  enableReranking: false,
  rerankingProvider: 'siliconflow',
  rerankingModel: 'BAAI/bge-reranker-v2-m3',
  initialRerankCandidates: 50,
  finalRerankTopN: 5,
  rerankingCustomEndpoint: ''
};

// 默认UI设置
const defaultUISettings: UISettings = {
  darkMode: false,
  fontSize: 'medium',
  saveConversationHistory: true,
  customEndpoint: ''
};

// 提供商默认模型映射
const providerDefaultModels: Record<string, string> = {
  'openai': 'gpt-3.5-turbo',
  'deepseek': 'deepseek-chat',
  'anthropic': 'claude-instant-1',
  'google': 'gemini-pro',
  'ollama': 'llama2',
  'custom': ''
};

// 设置Context类型
export interface SettingsContextType {
  llmSettings: LLMSettings;
  embeddingSettings: EmbeddingModelSettings;
  rerankingSettings: RerankingSettings;
  uiSettings: UISettings;
  updateLLMSettings: (settings: Partial<LLMSettings>) => void;
  updateEmbeddingSettings: (settings: Partial<EmbeddingModelSettings>) => void;
  updateRerankingSettings: (settings: Partial<RerankingSettings>) => void;
  updateUISettings: (settings: Partial<UISettings>) => void;
  resetSettings: () => void;
}

// 创建Context
const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

// Provider组件
export function SettingsProvider({ children }: { children: ReactNode }) {
  // 状态初始化只使用默认值
  const [llmSettings, setLLMSettings] = useState<LLMSettings>(defaultLLMSettings);
  const [embeddingSettings, setEmbeddingSettings] = useState<EmbeddingModelSettings>(defaultEmbeddingSettings);
  const [rerankingSettings, setRerankingSettings] = useState<RerankingSettings>(defaultRerankingSettings);
  const [uiSettings, setUISettings] = useState<UISettings>(defaultUISettings);
  const [isInitialized, setIsInitialized] = useState(false);
  
  // 在客户端加载设置
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // 从本地存储加载LLM设置
      const savedLLMSettings = localStorage.getItem('llmSettings');
      if (savedLLMSettings) {
        try {
          setLLMSettings(JSON.parse(savedLLMSettings));
        } catch (e) {
          console.error('Failed to parse LLM settings:', e);
        }
      }
      
      // 从本地存储加载向量化设置
      const savedEmbeddingSettings = localStorage.getItem('embeddingSettings');
      if (savedEmbeddingSettings) {
        try {
          setEmbeddingSettings(JSON.parse(savedEmbeddingSettings));
        } catch (e) {
          console.error('Failed to parse embedding settings:', e);
        }
      }
      
      // 从本地存储加载重排序设置
      const savedRerankingSettings = localStorage.getItem('rerankingSettings');
      if (savedRerankingSettings) {
        try {
          setRerankingSettings(JSON.parse(savedRerankingSettings));
        } catch (e) {
          console.error('Failed to parse reranking settings:', e);
        }
      }
      
      // 从本地存储加载UI设置
      const savedUISettings = localStorage.getItem('uiSettings');
      if (savedUISettings) {
        try {
          setUISettings(JSON.parse(savedUISettings));
        } catch (e) {
          console.error('Failed to parse UI settings:', e);
        }
      }
      
      setIsInitialized(true);
    }
  }, []);

  // 更新设置到本地存储
  useEffect(() => {
    if (typeof window !== 'undefined' && isInitialized) {
      localStorage.setItem('llmSettings', JSON.stringify(llmSettings));
    }
  }, [llmSettings, isInitialized]);

  useEffect(() => {
    if (typeof window !== 'undefined' && isInitialized) {
      localStorage.setItem('embeddingSettings', JSON.stringify(embeddingSettings));
    }
  }, [embeddingSettings, isInitialized]);

  useEffect(() => {
    if (typeof window !== 'undefined' && isInitialized) {
      localStorage.setItem('rerankingSettings', JSON.stringify(rerankingSettings));
    }
  }, [rerankingSettings, isInitialized]);

  useEffect(() => {
    if (typeof window !== 'undefined' && isInitialized) {
      localStorage.setItem('uiSettings', JSON.stringify(uiSettings));
    }
  }, [uiSettings, isInitialized]);

  // 更新LLM设置
  const updateLLMSettings = (newSettings: Partial<LLMSettings>) => {
    setLLMSettings(prevSettings => {
      const updatedSettings = { ...prevSettings, ...newSettings };
      
      // 如果提供商更改且未设置使用自定义模型，自动更新模型名称为该提供商的默认模型
      if (
        newSettings.provider && 
        newSettings.provider !== prevSettings.provider && 
        !updatedSettings.useCustomModel
      ) {
        updatedSettings.model = providerDefaultModels[newSettings.provider] || '';
        console.log(`提供商变更为${newSettings.provider}，自动设置模型为${updatedSettings.model}`);
      }
      
      return updatedSettings;
    });
  };

  // 更新向量化模型设置
  const updateEmbeddingSettings = (newSettings: Partial<EmbeddingModelSettings>) => {
    setEmbeddingSettings(prevSettings => ({
      ...prevSettings,
      ...newSettings
    }));
  };

  // 更新重排序设置
  const updateRerankingSettings = (newSettings: Partial<RerankingSettings>) => {
    setRerankingSettings(prevSettings => ({
      ...prevSettings,
      ...newSettings
    }));
  };

  // 更新UI设置
  const updateUISettings = (newSettings: Partial<UISettings>) => {
    setUISettings(prevSettings => ({
      ...prevSettings,
      ...newSettings
    }));
  };

  // 重置所有设置为默认值
  const resetSettings = () => {
    setLLMSettings(defaultLLMSettings);
    setEmbeddingSettings(defaultEmbeddingSettings);
    setRerankingSettings(defaultRerankingSettings);
    setUISettings(defaultUISettings);
  };

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
        resetSettings
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
    throw new Error('useSettings必须在SettingsProvider内部使用');
  }
  return context;
}

// 兼容旧版本接口的别名(用于平滑过渡)
export type AIModelSettings = LLMSettings; 