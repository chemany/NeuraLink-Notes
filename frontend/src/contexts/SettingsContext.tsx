'use client';

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
// Assuming AuthContext exists and provides a token. Adjust path if necessary.
import { useAuth } from './AuthContext'; 

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
  useCustomModel: false, // 默认不使用自定义模型
  customEndpoint: '',
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
}

// 创建Context
const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

// API base URL - adjust if your API is hosted elsewhere or has a different prefix
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

// Provider组件
export function SettingsProvider({ children }: { children: ReactNode }) {
  const { token } = useAuth(); // Get token from AuthContext

  const [llmSettings, setLLMSettings] = useState<LLMSettings>(defaultLLMSettings);
  const [embeddingSettings, setEmbeddingSettings] = useState<EmbeddingModelSettings>(defaultEmbeddingSettings);
  const [rerankingSettings, setRerankingSettings] = useState<RerankingSettings>(defaultRerankingSettings);
  const [uiSettings, setUISettings] = useState<UISettings>(defaultUISettings);
  const [isLoading, setIsLoading] = useState(true); // Start with loading true

  // Helper for API calls
  const apiCall = useCallback(async (endpoint: string, method: string, body?: any) => {
    if (!token) {
      // Or handle more gracefully, e.g., redirect to login
      console.error('No auth token found for API call');
      // Potentially set an error state or throw
      return null; 
    }
    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: response.statusText }));
        console.error(`API call failed: ${response.status}`, errorData);
        // throw new Error(`API call failed: ${response.status} ${errorData.message || ''}`);
        // Handle error state in UI if needed
        return null;
      }
      return response.json();
    } catch (error) {
      console.error('API call error:', error);
      // throw error;
      // Handle error state in UI if needed
      return null;
        }
  }, [token]);

  // Fetch settings from backend on mount
  useEffect(() => {
    const fetchSettings = async () => {
      if (token) { // Only fetch if token is available
        setIsLoading(true);
        console.log('Attempting to fetch settings from backend...');
        const data = await apiCall('/settings', 'GET');
        if (data) {
          console.log('Settings fetched from backend:', data);
          // Backend should not return API keys for GET.
          // If it does, ensure they are not directly set into state here,
          // or that the state's apiKey field is treated as "potentially stale/absent"
          // and user is prompted if an action requires it.
          // For now, we assume backend sends objects matching our DTOs (without apiKeys for GET)
          setLLMSettings(prev => ({ ...prev, ...data.llmSettings, apiKey: prev.apiKey || '' })); // Preserve local/default apiKey if not sent
          setEmbeddingSettings(prev => ({ ...prev, ...data.embeddingSettings, apiKey: prev.apiKey || '' })); // Preserve local/default apiKey
          setRerankingSettings(data.rerankingSettings || defaultRerankingSettings);
          setUISettings(data.uiSettings || defaultUISettings);
        } else {
          console.log('Failed to fetch settings or no settings found, using defaults.');
          // Keep default settings if fetch fails or returns nothing
          setLLMSettings(defaultLLMSettings);
          setEmbeddingSettings(defaultEmbeddingSettings);
          setRerankingSettings(defaultRerankingSettings);
          setUISettings(defaultUISettings);
        }
        setIsLoading(false);
      } else {
        console.log('No token available, using default settings.');
        // If no token, use defaults and stop loading (user might be logged out)
        setLLMSettings(defaultLLMSettings);
        setEmbeddingSettings(defaultEmbeddingSettings);
        setRerankingSettings(defaultRerankingSettings);
        setUISettings(defaultUISettings);
        setIsLoading(false);
    }
    };
    fetchSettings();
  }, [token, apiCall]); // apiCall is memoized with token dependency

  // Generic update function
  const makeUpdateFunction = <T extends LLMSettings | EmbeddingModelSettings | RerankingSettings | UISettings>(
    setStateFunction: React.Dispatch<React.SetStateAction<T>>,
    settingsKey: 'llmSettings' | 'embeddingSettings' | 'rerankingSettings' | 'uiSettings',
  ) => {
    return async (newPartialSettings: Partial<T>) => {
      setStateFunction(prevState => ({ ...prevState, ...newPartialSettings }));
      const payload = { [settingsKey]: newPartialSettings };
      console.log(`Updating ${settingsKey} on backend (via individual update):`, payload);
      const result = await apiCall('/settings', 'PUT', payload);
      if (result) {
        console.log(`${settingsKey} updated successfully on backend (via individual update):`, result);
      } else {
        console.error(`Failed to update ${settingsKey} on backend (via individual update).`);
    }
    };
  };
  
  const updateLLMSettings = makeUpdateFunction(setLLMSettings, 'llmSettings');
  const updateEmbeddingSettings = makeUpdateFunction(setEmbeddingSettings, 'embeddingSettings');
  const updateRerankingSettings = makeUpdateFunction(setRerankingSettings, 'rerankingSettings');
  const updateUISettings = makeUpdateFunction(setUISettings, 'uiSettings');
      
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
      setLLMSettings(prev => ({ ...prev, ...settingsToSave.llmSettings }));
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

    const result = await apiCall('/settings', 'PUT', settingsToSave);
    if (result) {
      console.log('All settings saved successfully to backend:', result);
      // Optionally, update state again from `result` if backend modifies data
      // For simplicity, current optimistic update is assumed sufficient.
    } else {
      console.error('Failed to save all settings to backend.');
      // Potentially show error to user and revert optimistic updates
    }
  };

  const resetSettings = async () => {
    console.log('Resetting settings to default and updating backend...');
    setLLMSettings(defaultLLMSettings);
    setEmbeddingSettings(defaultEmbeddingSettings);
    setRerankingSettings(defaultRerankingSettings);
    setUISettings(defaultUISettings);

    const payload = {
      llmSettings: defaultLLMSettings,
      embeddingSettings: defaultEmbeddingSettings,
      rerankingSettings: defaultRerankingSettings,
      uiSettings: defaultUISettings,
    };
    const result = await apiCall('/settings', 'PUT', payload);
    if (result) {
      console.log('Settings successfully reset on backend.');
    } else {
      console.error('Failed to reset settings on backend.');
      // Handle error, perhaps by notifying user
    }
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
        resetSettings,
        isLoading,
        saveAllSettings,
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