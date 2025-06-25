// AI Service - 支持Excel/CSV文档处理
import { DocumentStatus, Document } from '../types/shared_local';
import apiClient, { getApiBaseUrl } from './apiClient';

// 大语言模型设置接口
interface LLMSettings {
  provider: string;
  apiKey: string;
  model: string;
  temperature: number;
  maxTokens: number;
  customEndpoint?: string;
  useCustomModel?: boolean;
}

// 从后端获取包含API Key的完整设置
const fetchFullSettingsFromBackend = async (): Promise<LLMSettings | null> => {
  try {
    console.log('[fetchFullSettingsFromBackend] 从后端获取完整设置...');
    const token = localStorage.getItem('token');
    if (!token) {
      console.log('[fetchFullSettingsFromBackend] 无认证token，无法获取后端设置');
      return null;
    }

    // 使用智能的API基础URL配置
    const apiBaseUrl = getApiBaseUrl();
    const response = await fetch(`${apiBaseUrl}/api/settings/full`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    console.log('[fetchFullSettingsFromBackend] 成功获取后端设置:', data);
    return data.llm;
  } catch (error: any) {
    console.log('[fetchFullSettingsFromBackend] 获取设置失败:', error.message);
    return null;
  }
};

// 从 localStorage 或后端获取LLM设置，包含默认值
const fetchLLMConfig = async (useBackendSettings: boolean = false): Promise<LLMSettings> => {
  const defaultLLMSettings: LLMSettings = {
    provider: 'deepseek',
    apiKey: '',
    model: 'deepseek-chat',
    temperature: 0.7,
    maxTokens: 1500,
    useCustomModel: false,
    customEndpoint: '',
  };

  let config: LLMSettings = defaultLLMSettings;

  // 如果需要从后端获取设置（通常用于AI调用）
  if (useBackendSettings) {
    console.log("fetchLLMConfig: 尝试从后端获取完整设置包括API Key...");
    const backendSettings = await fetchFullSettingsFromBackend();
    if (backendSettings) {
      config = { ...defaultLLMSettings, ...backendSettings };
      console.log("fetchLLMConfig: 成功从后端获取设置");
    } else {
      console.log("fetchLLMConfig: 后端获取失败，回退到localStorage");
    }
  }

  // 如果没有从后端获取或获取失败，则从localStorage获取
  if (!useBackendSettings || !config.apiKey) {
    const rawSettings = localStorage.getItem('llmSettings');
    console.log("fetchLLMConfig: 从 localStorage 读取 'llmSettings':", rawSettings);

    if (rawSettings) {
      try {
        const parsedSettings = JSON.parse(rawSettings);
        console.log("fetchLLMConfig: 解析 localStorage 成功:", parsedSettings);
        config = { ...config, ...parsedSettings };
      } catch (error) {
        console.error("fetchLLMConfig: 解析 localStorage 中的 LLM 设置失败，将使用默认设置:", error);
      }
    } else {
      console.log("fetchLLMConfig: localStorage 中未找到 LLM 设置或为空，将使用默认设置。");
    }
  }

  // --- API Key 警告 ---
  if (!config.apiKey || config.apiKey.trim() === '') {
    console.warn(`fetchLLMConfig: LLM API 密钥未设置。对于需要密钥的提供商 (${config.provider})，API 调用将会失败。`);
  }
  
  console.log(`fetchLLMConfig: 最终返回的LLM配置: Provider=${config.provider}, Model=${config.model}, HasApiKey=${!!config.apiKey}`);
  return config;
};

/**
 * 生成AI响应 - 支持Excel/CSV文档
 */
export const generateAIResponse = async (
  query: string,
  documents: Document[],
  onProgress?: (partialResponse: string) => void
): Promise<string> => {
  console.log('generateAIResponse: 开始处理AI响应生成请求...');

  try {
    // 修改文档筛选逻辑：允许COMPLETED状态或有文本内容的文档（即使向量化失败）
    const availableDocuments = documents.filter(doc => {
      // 完全处理成功的文档
      if (doc.status === DocumentStatus.COMPLETED) {
        return true;
      }
      // 或者文档处理完成但向量化失败，只要有文本内容就可以参与AI分析
      if (doc.status === DocumentStatus.VECTORIZATION_FAILED && doc.textContent && doc.textContent.trim().length > 0) {
        console.log(`[generateAIResponse] 文档 ${doc.fileName} 向量化失败但有文本内容，允许AI分析`);
        return true;
      }
      return false;
    });
    
    console.log(`generateAIResponse: 检查可用文档状态: 总文档数=${documents.length}, 可用文档数=${availableDocuments.length}`);

    if (availableDocuments.length === 0) {
      console.warn("generateAIResponse: 没有可用的文档进行AI分析。");
      return "请先上传并等待文档处理完成后再提问。";
    }

    // 构建文档内容上下文
    let constructedContext = '';
    
    // 对于向量化失败的文档，直接使用原始内容
    const failedVectorizationDocs = availableDocuments.filter(doc => doc.status === DocumentStatus.VECTORIZATION_FAILED);
    if (failedVectorizationDocs.length > 0) {
      console.log(`[generateAIResponse] 处理 ${failedVectorizationDocs.length} 个向量化失败的文档`);
      failedVectorizationDocs.forEach(doc => {
        const maxDocLength = Math.min(doc.textContent?.length || 0, 8000);
        const truncatedContent = doc.textContent?.substring(0, maxDocLength) || '内容不可用';
        constructedContext += `---\n文档: ${doc.fileName}\n内容:\n${truncatedContent}\n---\n\n`;
      });
    }

    // 对于正常处理的文档，也包含其内容
    const completedDocs = availableDocuments.filter(doc => doc.status === DocumentStatus.COMPLETED);
    if (completedDocs.length > 0) {
      console.log(`[generateAIResponse] 处理 ${completedDocs.length} 个已完成的文档`);
      completedDocs.forEach(doc => {
        const maxDocLength = Math.min(doc.textContent?.length || 0, 8000);
        const truncatedContent = doc.textContent?.substring(0, maxDocLength) || '内容不可用';
        constructedContext += `---\n文档: ${doc.fileName}\n内容:\n${truncatedContent}\n---\n\n`;
      });
    }

    console.log(`[generateAIResponse] 构建的文档上下文长度: ${constructedContext.length} 字符`);

    // 构建最终的提示词
    let prompt = `你是一位专业的AI助手，负责根据用户提供的文档内容和问题进行回答和总结。

用户问题: "${query}"

相关文档内容:
---
${constructedContext || "没有提供额外的文档上下文。"}
---

请仔细分析以上信息，并给出清晰、准确的回答。

重要：请务必严格按照以下格式组织您的回答，确保"标题："和"正文："各占一行，并且作为明确的标记：
标题：[这里是您总结的标题]
正文：[这里是您总结的详细内容]`;

    console.log('[generateAIResponse] 最终构建的提示词 (前500字符):', prompt.substring(0, 500));
    console.log('[generateAIResponse] 提示词总长度:', prompt.length);

    // 获取LLM配置并调用API
    const llmConfig = await fetchLLMConfig(true);
    const response = await callOpenAICompatibleAPI(prompt, llmConfig, onProgress);

    console.log(`generateAIResponse: API返回响应，长度: ${response?.length || 0} 字符`);
    return response || "抱歉，未能生成回答。";

  } catch (error) {
    console.error('generateAIResponse: 生成AI响应时出错:', error);
    return `抱歉，生成回答时遇到错误: ${error instanceof Error ? error.message : '未知错误'}`;
  }
};

/**
 * OpenAI兼容的API调用
 */
async function callOpenAICompatibleAPI(prompt: string, config: LLMSettings, onProgress?: (chunk: string) => void): Promise<string> {
    // 特别处理内置模型 - 通过后端代理调用
    if (config.provider === 'builtin') {
        console.log('使用内置模型，通过后端代理调用...');
        
        // 构建消息数组
        const messages = [
            { role: "user", content: prompt }
        ];

        const requestBody = {
            messages: messages,
            stream: !!onProgress
        };

        try {
            // 调用后端代理接口，使用智能的API基础URL配置
            const apiBaseUrl = getApiBaseUrl();
            const response = await fetch(`${apiBaseUrl}/api/proxy/builtin-chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                let errorBody = '';
                try {
                    errorBody = await response.text();
                    console.error('后端代理API错误响应体:', errorBody);
                    throw new Error(`后端代理请求失败(${response.status}): ${errorBody}`);
                } catch (e) {
                    if (e instanceof Error) throw e;
                    throw new Error(`后端代理请求失败: ${response.status} ${response.statusText}`);
                }
            }

            // 处理流式响应
            if (onProgress && response.body) {
                const reader = response.body.getReader();
                const decoder = new TextDecoder('utf-8');
                let accumulatedResponse = '';
                let buffer = '';

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    
                    buffer += decoder.decode(value, { stream: true });
                    
                    const lines = buffer.split('\n');
                    buffer = lines.pop() || '';

                    for (const line of lines) {
                        if (line.startsWith('data: ')) {
                            const data = line.substring(6).trim();
                            if (data === '[DONE]') {
                                break;
                            }
                            try {
                                const parsed = JSON.parse(data);
                                const delta = parsed.choices?.[0]?.delta?.content;
                                if (delta) {
                                    accumulatedResponse += delta;
                                    onProgress(accumulatedResponse);
                                }
                            } catch (error) {
                                console.error('解析内置模型SSE数据块失败:', error, '原始数据:', data);
                            }
                        }
                    }
                }

                console.log("内置模型流式调用完成。");
                return accumulatedResponse;
            } else {
                // 处理非流式响应
                const result = await response.json();
                const content = result.choices?.[0]?.message?.content || '';
                
                if (!content) {
                    console.warn('内置模型API返回的响应没有有效内容。');
                    return '抱歉，内置模型没有返回有效内容。';
                }
                
                console.log("内置模型非流式调用完成。");
                return content;
            }
        } catch (error) {
            console.error('调用内置模型时出错:', error);
            throw error instanceof Error ? error : new Error('调用内置模型时发生未知错误');
        }
    }

    // 确定 API 端点 (非内置模型)
    let apiEndpoint = 
        config.provider === 'deepseek' ? 'https://api.deepseek.com/v1/chat/completions' 
        : config.provider === 'openai' ? 'https://api.openai.com/v1/chat/completions'
        : config.provider === 'openrouter' ? 'https://openrouter.ai/api/v1/chat/completions'
        : config.customEndpoint || ''; // Custom or other OpenAI compatible

    if (!apiEndpoint) {
        throw new Error(`无法确定 ${config.provider} 提供商的 API 端点。请检查设置中的自定义端点。`);
    }

    console.log(`调用 ${config.provider} API 端点: ${apiEndpoint}`);
    console.log(`模型: ${config.model}, 温度: ${config.temperature}`);

    // 检查 API 密钥
    if (!config.apiKey || config.apiKey.trim() === '' || config.apiKey === 'BUILTIN_PROXY') {
        console.error(`${config.provider} API Key 未设置或无效!`);
        throw new Error(`API Key 未设置。请在设置中配置有效的API密钥。`);
    }

    // 构建请求头
    const headers: Record<string, string> = {
        'Content-Type': 'application/json'
    };

    // 添加授权头
    if (config.apiKey) {
        headers['Authorization'] = `Bearer ${config.apiKey}`;
    }

    // 为OpenRouter添加特有的头部
    if (config.provider === 'openrouter') {
        headers['HTTP-Referer'] = window.location.origin;
        headers['X-Title'] = 'LingShu-Notes';
    }

    // 构建消息数组
    const messages = [
        { role: "user", content: prompt } 
    ];

    // 构建请求体
    const requestBody: any = {
        model: config.model || (
            config.provider === 'deepseek' ? 'deepseek-chat' : 
            config.provider === 'openrouter' ? 'google/gemini-2.0-flash-exp:free' :
            'gpt-3.5-turbo'
        ),
        messages: messages,
        temperature: config.temperature ?? 0.7,
        max_tokens: config.maxTokens || 1500,
        stream: !!onProgress // 如果有 onProgress 回调，则启用流式传输
    };

    console.log('发送到 API 的请求体 (部分):', JSON.stringify({ ...requestBody, messages: '[Messages Array]' }));

    try {
        const response = await fetch(apiEndpoint, {
            method: 'POST',
            headers,
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            let errorBody = '';
            try {
                errorBody = await response.text();
                console.error('API 错误响应体:', errorBody);
                const errorJson = JSON.parse(errorBody);
                const message = errorJson?.error?.message || errorJson?.message || errorBody;
                const type = errorJson?.error?.type || errorJson?.type || 'unknown_error';
                
                // 特别处理上下文长度错误
                if (message.includes('context_length_exceeded') || message.includes('maximum context length')) {
                    throw new Error(`请求失败(${response.status}): 模型上下文长度超出限制。请减少文档数量或简化查询。(${type})`);
                }
                // 处理认证错误
                if (response.status === 401) {
                     throw new Error(`请求失败(${response.status}): API 密钥无效或权限不足。(${type})`);
                }
                // 处理速率限制
                if (response.status === 429) {
                     throw new Error(`请求失败(${response.status}): API 请求过于频繁，请稍后再试。(${type})`);
                }
                throw new Error(`请求失败(${response.status}): ${message}`);
            } catch (e) {
                if (e instanceof Error) throw e;
                throw new Error(`API 请求失败: ${response.status} ${response.statusText}. 响应: ${errorBody || '无法读取响应体'}`);
            }
        }

        // 处理流式响应
        if (onProgress && response.body) {
            const reader = response.body.getReader();
            const decoder = new TextDecoder('utf-8');
            let accumulatedResponse = '';
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                
                buffer += decoder.decode(value, { stream: true });
                
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.substring(6).trim();
                        if (data === '[DONE]') {
                            break;
                        }
                        try {
                            const parsed = JSON.parse(data);
                            const delta = parsed.choices?.[0]?.delta?.content;
                            if (delta) {
                                accumulatedResponse += delta;
                                onProgress(accumulatedResponse);
                            }
                        } catch (error) {
                            console.error('解析 SSE 数据块失败:', error, '原始数据:', data);
                        }
                    }
                }
            }

            console.log("API 流式调用完成。");
            return accumulatedResponse;
        } else {
            // 处理非流式响应
            const result = await response.json();
            const content = result.choices?.[0]?.message?.content || '';
            
            if (!content) {
                console.warn('API 返回的响应没有有效内容。');
                return '抱歉，API没有返回有效内容。';
            }
            
            console.log("API 非流式调用完成。");
            return content;
        }
    } catch (error) {
        console.error(`调用 ${config.provider} API 时出错:`, error);
        throw error instanceof Error ? error : new Error('调用 API 时发生未知错误');
    }
}

/**
 * 生成文档摘要
 */
export const generateDocumentSummary = async (documentId: string): Promise<string> => {
  try {
    const response = await apiClient.post(`/ai/summary`, { documentId });
    return response.data.summary;
  } catch (error: any) {
    console.error(`Error generating summary for document ${documentId}:`, error);
    throw new Error(`Failed to generate summary: ${error.message}`);
  }
};

/**
 * 生成关键词作为笔记标题
 */
export function generateKeywords(content: string): string {
  if (!content || content.trim() === '') {
    return '新笔记';
  }
  
  const words = content.trim()
    .split(/\s+/)
    .filter(word => word.length > 1)
    .filter(word => !['的', '是', '在', '了', '和', '与', '或', '但是', '因为', '所以', '如果'].includes(word))
    .slice(0, 3);
  
  if (words.length > 0) {
    return words.join(' ') + ' - 笔记';
  }
  
  return content.substring(0, Math.min(20, content.length)) + '...';
}

/**
 * 生成嵌入向量（简化版）
 */
export const generateEmbeddings = async (texts: string[], settings: any): Promise<number[][]> => {
  console.log('generateEmbeddings: 暂时返回模拟向量');
  // 简化实现：返回模拟的向量数据
  return texts.map(() => Array.from({ length: 1536 }, () => Math.random()));
};

/**
 * 重排文档块（简化版）
 */
export const rerankChunks = async (
  query: string, 
  documents: string[],
  settings: any, 
  rerankModel: string = 'default', 
  topN?: number
): Promise<any[]> => {
  console.log('rerankChunks: 暂时返回原序');
  // 简化实现：返回原始顺序的结果
  return documents.map((doc, index) => ({
    index,
    score: 1.0 - (index * 0.1) // 简单的分数递减
  }));
};

/**
 * 生成音频概览
 */
export const generateAudioOverview = async (documentId: string): Promise<string> => {
  try {
    const response = await apiClient.post(`/ai/audio-overview`, { documentId });
    return response.data.overview;
  } catch (error: any) {
    console.error(`Error generating audio overview for document ${documentId}:`, error);
    throw new Error(`Failed to generate audio overview: ${error.message}`);
  }
};

/**
 * 生成学习指南
 */
export const generateStudyGuide = async (documentId: string): Promise<string> => {
  try {
    const response = await apiClient.post(`/ai/study-guide`, { documentId });
    return response.data.guide;
  } catch (error: any) {
    console.error(`Error generating study guide for document ${documentId}:`, error);
    throw new Error(`Failed to generate study guide: ${error.message}`);
  }
};

/**
 * 生成项目简介
 */
export const generateProjectBrief = async (documentId: string): Promise<string> => {
  try {
    const response = await apiClient.post(`/ai/project-brief`, { documentId });
    return response.data.brief;
  } catch (error: any) {
    console.error(`Error generating project brief for document ${documentId}:`, error);
    throw new Error(`Failed to generate project brief: ${error.message}`);
  }
};

/**
 * 导入所有文档
 */
export const importAllDocuments = async (notebookId?: string): Promise<any[]> => {
  try {
    console.log('importAllDocuments: 暂时返回空数组');
    return [];
  } catch (error: any) {
    console.error('Error importing documents:', error);
    throw new Error(`Failed to import documents: ${error.message}`);
  }
};