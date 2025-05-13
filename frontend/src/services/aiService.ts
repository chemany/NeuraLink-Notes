import { Document, DocumentStatus } from '@/types/shared_local';
import { getDocumentContent } from '@/services/documentService';
import { LLMSettings, EmbeddingModelSettings, RerankingSettings } from "@/contexts/SettingsContext";
import {
  searchRelevantContent,
  processDocumentsForRAG,
  storeDocumentChunks,
  DocumentChunk,
  SearchResult,
  getDocumentChunks
} from './vectorService';
import { Message } from '@/types';

// 后端 API 地址
const API_BASE_URL = 'http://localhost:3001';

// 模拟延迟，在实际集成API时会被替换
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// 从 localStorage 获取LLM设置，包含默认值
const fetchLLMConfig = (): LLMSettings => {
  // --- 添加日志 ---
  const rawSettings = localStorage.getItem('llmSettings');
  console.log("fetchLLMConfig: 从 localStorage 读取 'llmSettings':", rawSettings);
  // ---------------

  let config: LLMSettings;
  const defaultLLMSettings: LLMSettings = {
    provider: 'openai',
    apiKey: '',
    model: 'gpt-3.5-turbo',
    temperature: 0.7,
    maxTokens: 1000,
    useCustomModel: false,
    customEndpoint: '',
  };

  if (rawSettings) { // 检查 rawSettings 是否为 null 或空字符串
    try {
      const parsedSettings = JSON.parse(rawSettings);
      // --- 添加日志 ---
      console.log("fetchLLMConfig: 解析 localStorage 成功:", parsedSettings);
      // ---------------
      config = { ...defaultLLMSettings, ...parsedSettings };
    } catch (error) {
      // --- 添加日志 ---
      console.error("fetchLLMConfig: 解析 localStorage 中的 LLM 设置失败，将使用默认设置:", error);
      // ---------------
      config = defaultLLMSettings;
    }
  } else {
    // --- 添加日志 ---
    console.log("fetchLLMConfig: localStorage 中未找到 LLM 设置或为空，将使用默认设置。");
    // ---------------
    config = defaultLLMSettings;
  }

  // --- 保留模型名称修正逻辑 (略作调整) ---
  const defaultModels: Record<string, string> = {
    'openai': 'gpt-3.5-turbo', 'deepseek': 'deepseek-chat',
    'anthropic': 'claude-instant-1', 'google': 'gemini-pro', 'ollama': 'llama2'
  };
  if (config.provider && defaultModels[config.provider] && !config.useCustomModel && config.model !== defaultModels[config.provider]) {
      // 如果模型不是已知提供商的默认模型，并且不是自定义模型，则尝试修正
      // 更准确的检查应该对比该提供商的所有可用模型，此处简化
      console.warn(`fetchLLMConfig: 检测到模型名称 "${config.model}" 可能与提供商 "${config.provider}" 不匹配，修正为默认: ${defaultModels[config.provider]}`);
    config.model = defaultModels[config.provider];
  }
  // --- 结束模型名称修正逻辑 ---
  
  // --- API Key 警告 (保留) ---
  if (!config.apiKey || config.apiKey.trim() === '') {
    console.warn(`fetchLLMConfig: LLM API 密钥未设置。对于需要密钥的提供商 (${config.provider})，API 调用将会失败。`);
  }
  
  // --- 提供商检查 (保留) ---
  const supportedProviders = ['openai', 'deepseek', 'anthropic', 'google', 'ollama', 'custom'];
  if (!supportedProviders.includes(config.provider)) {
    console.warn(`fetchLLMConfig: LLM 提供商 "${config.provider}" 可能不受支持或配置错误。`);
  }
  
  // --- 添加日志 ---
  console.log(`fetchLLMConfig: 最终返回的LLM配置: Provider=${config.provider}, Model=${config.model}, HasApiKey=${!!config.apiKey}`);
  // ---------------
  return config;
};

// 从设置获取向量化模型配置
const fetchEmbeddingConfig = async (settings: EmbeddingModelSettings | null) => {
  // 实际项目中，这里会根据settings配置来决定使用哪个向量化模型
  return settings || {
    provider: 'siliconflow',
    model: 'BAAI/bge-large-zh-v1.5', // 默认使用支持的中文模型
    encodingFormat: 'float',
    apiKey: ''
  };
};

// SiliconFlow API响应格式
interface SiliconFlowEmbeddingResponse {
  model: string;
  data: {
    object: string;
    embedding: number[];
    index: number;
  }[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  error?: string;
}

// Rerank API 响应格式
interface SiliconFlowRerankResult {
  document?: { text: string };
  index: number;
  relevance_score: number;
}

interface SiliconFlowRerankResponse {
  id: string;
  results: SiliconFlowRerankResult[];
  tokens?: { input_tokens?: number; output_tokens?: number }; // 根据 openapi.yaml 调整
  error?: string;
}

// 定义 Rerank 函数的返回值类型
export interface RerankResult {
  index: number;
  score: number;
}

// 检查是否在浏览器环境中
const isBrowser = typeof window !== 'undefined';

/**
 * 生成文本的向量嵌入
 * @param texts 要向量化的文本数组
 * @param settings 嵌入模型设置
 * @returns 向量嵌入数组，每个文本对应一个向量
 */
export const generateEmbeddingsInternal = async (
  texts: string[],
  settings: EmbeddingModelSettings
): Promise<number[][]> => {
  const startTime = Date.now();
  console.log(`[generateEmbeddingsInternal] 开始生成嵌入向量: ${texts.length}个文本块, 总字符数: ${texts.reduce((sum, text) => sum + text.length, 0)}`);
  
  if (!isBrowser) {
    console.error("[generateEmbeddingsInternal] 只能在浏览器环境中使用");
    return [];
  }

  if (!texts || texts.length === 0) {
    console.error("[generateEmbeddingsInternal] 收到空文本数组");
    return [];
  }

  // 验证API密钥
  if (!settings.apiKey || settings.apiKey.trim() === '') {
    throw new Error('向量化API密钥未设置，请在设置中配置有效的API密钥');
  }

  // 验证模型名称
  if (!settings.model || settings.model.trim() === '') {
    throw new Error('向量化模型未设置，请在设置中选择有效的模型');
  }

  // 验证模型是否为SiliconFlow支持的模型
  const supportedModels = [
    'BAAI/bge-large-zh-v1.5',
    'BAAI/bge-large-en-v1.5',
    'netease-youdao/bce-embedding-base_v1',
    'BAAI/bge-m3',
    'Pro/BAAI/bge-m3'
  ];
  
  if (!supportedModels.includes(settings.model)) {
    console.warn(`[generateEmbeddingsInternal] 模型 "${settings.model}" 可能不被SiliconFlow支持，将尝试使用，但可能会失败`);
  }
  
  // 记录文本块大小分布
  const textLengths = texts.map(text => text.length);
  const avgTextLength = textLengths.reduce((sum, len) => sum + len, 0) / texts.length;
  const maxTextLength = Math.max(...textLengths);
  const minTextLength = Math.min(...textLengths);
  
  console.log(`[generateEmbeddingsInternal] 文本块统计: 平均长度: ${Math.round(avgTextLength)}字符, 最大: ${maxTextLength}字符, 最小: ${minTextLength}字符`);

  try {
    // 使用SiliconFlow API进行向量化
    const endpoint = settings.customEndpoint || 'https://api.siliconflow.cn/v1/embeddings';
    
    // 构建请求体
    const requestBody = {
      model: settings.model,
      input: texts,
      encoding_format: settings.encodingFormat || 'float'
    };
    
    console.log(`[generateEmbeddingsInternal] 向 ${endpoint} 发送向量化请求:`, {
      文本数量: texts.length,
      模型: settings.model,
      编码格式: settings.encodingFormat || 'float',
      请求大小: JSON.stringify(requestBody).length + ' 字节'
    });
    
    const apiStartTime = Date.now();

    // 实现重试逻辑
    let attemptCount = 0;
    const maxAttempts = 3;
    let lastError: any = null;

    while (attemptCount < maxAttempts) {
      attemptCount++;
      console.log(`[generateEmbeddingsInternal] 尝试向量化请求 (${attemptCount}/${maxAttempts})`);

      try {
        // 发送请求
        const fetchStartTime = Date.now();
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${settings.apiKey}`
          },
          body: JSON.stringify(requestBody)
        });
        const fetchTime = Date.now() - fetchStartTime;
        console.log(`[generateEmbeddingsInternal] API请求耗时: ${fetchTime/1000}秒`);
        
        // 检查HTTP响应
        if (!response.ok) {
          const errorText = await response.text();
          
          // 特定错误处理
          if (response.status === 401) {
            throw new Error(`向量化API认证失败: API密钥可能无效 (${response.status})`);
          } else if (response.status === 429) {
            throw new Error(`向量化API请求过多，请稍后再试 (${response.status})`);
          } else if (response.status === 400) {
            throw new Error(`向量化API请求参数错误: ${errorText} (${response.status})`);
          } else if (response.status === 413) {
            throw new Error(`请求数据过大。请尝试减小文档大小或分割文档 (${response.status})`);
          } else if (response.status === 504 || response.status === 502) {
            throw new Error(`API网关超时。请求处理时间过长，可能是文档过大导致 (${response.status})`);
          } else {
            throw new Error(`向量化API请求失败: ${response.status} ${errorText}`);
          }
        }
        
        // 解析响应
        const parseStartTime = Date.now();
        const data = await response.json() as SiliconFlowEmbeddingResponse;
        const parseTime = Date.now() - parseStartTime;
        console.log(`[generateEmbeddingsInternal] 响应解析完成，耗时: ${parseTime/1000}秒`);
        
        // 检查API响应是否有错误
        if (data.error) {
          console.error('[generateEmbeddingsInternal] 向量化API返回错误:', data.error);
          throw new Error(`向量化API返回错误: ${data.error}`);
        }
        
        // 确保data字段存在且包含嵌入向量
        if (!data.data || !Array.isArray(data.data) || data.data.length === 0) {
          console.error('[generateEmbeddingsInternal] 向量化API返回无效响应格式:', data);
          throw new Error('向量化API返回无效响应格式，未包含嵌入向量');
        }
        
        // 从响应中提取嵌入向量
        const embeddings = data.data.map(item => item.embedding);
        
        // 确保嵌入向量数量与输入文本数量匹配
        if (embeddings.length !== texts.length) {
          console.warn(`[generateEmbeddingsInternal] 向量化结果数量不匹配: 预期 ${texts.length}, 实际 ${embeddings.length}`);
        }
        
        // 记录向量统计信息
        if (embeddings.length > 0 && embeddings[0].length > 0) {
          const dimensions = embeddings[0].length;
          console.log(`[generateEmbeddingsInternal] 向量维度: ${dimensions}, 向量数量: ${embeddings.length}`);
        }
        
        const totalTime = Date.now() - startTime;
        console.log(`[generateEmbeddingsInternal] 成功生成 ${embeddings.length} 个嵌入向量，总耗时: ${totalTime/1000}秒`);
        
        // 如果成功，返回结果并退出重试循环
        return embeddings;
        
      } catch (error) {
        lastError = error;
        // 如果是最后一次尝试，直接抛出错误
        if (attemptCount >= maxAttempts) {
          throw error;
        }
        
        // 记录错误但继续尝试
        console.error(`[generateEmbeddingsInternal] 尝试 ${attemptCount} 失败:`, error);
        
        // 指数退避等待，并添加随机抖动 (0-1000ms)
        const baseWaitTime = Math.pow(2, attemptCount) * 500;
        const jitter = Math.random() * 200; 
        const waitTime = baseWaitTime + jitter;
        console.log(`[generateEmbeddingsInternal] 等待 ${waitTime.toFixed(0)}ms 后重试...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
    
    // 理论上不会执行到这里，但是TypeScript需要有返回值
    const totalErrorTime = Date.now() - apiStartTime;
    console.error(`[generateEmbeddingsInternal] 所有重试均失败，总耗时: ${totalErrorTime/1000}秒`);
    throw lastError || new Error('向量化失败，请检查网络连接和API设置');
    
  } catch (error) {
    console.error('生成嵌入向量时出错:', error);
    
    // 美化错误信息
    let errorMessage = '向量化处理失败';
    if (error instanceof Error) {
      errorMessage = error.message;
      
      // 添加更友好的错误提示
      if (errorMessage.includes('认证失败') || errorMessage.includes('API密钥')) {
        errorMessage += '。请在设置中检查您的SiliconFlow API密钥是否正确。';
      } else if (errorMessage.includes('请求过多')) {
        errorMessage += '。请等待几分钟后再尝试。';
      } else if (errorMessage.includes('Network Error') || errorMessage.includes('network')) {
        errorMessage = '网络连接失败。请检查您的网络连接并确保能够访问SiliconFlow API。';
      } else if (errorMessage.includes('请求参数错误')) {
        errorMessage += '。请检查向量化设置中的模型名称是否为SiliconFlow支持的模型。';
      }
    }
    
    throw new Error(errorMessage);
  }
};

// 为了保持兼容性，导出一个别名
export const generateEmbeddings = async (texts: string[], settings: EmbeddingModelSettings): Promise<number[][]> => {
  const startTime = Date.now();
  console.log(`[generateEmbeddings] 开始生成嵌入向量: ${texts.length}个文本块, 总字符数: ${texts.reduce((sum, text) => sum + text.length, 0)}`);
  
  // 验证API密钥
  if (!settings.apiKey || settings.apiKey.trim() === '') {
    throw new Error('API密钥未设置，请在设置中配置有效的API密钥');
  }

  // 验证模型名称
  if (!settings.model || settings.model.trim() === '') {
    throw new Error('向量化模型未设置，请在设置中选择有效的模型');
  }

  // 验证模型是否为支持的模型
  const supportedModels = [
    'BAAI/bge-large-zh-v1.5',
    'BAAI/bge-large-en-v1.5',
    'netease-youdao/bce-embedding-base_v1',
    'BAAI/bge-m3',
    'Pro/BAAI/bge-m3'
  ];
  
  if (!supportedModels.includes(settings.model)) {
    console.warn(`模型 "${settings.model}" 可能不被支持，将尝试使用，但可能会失败`);
  }

  // 记录文本块大小分布
  const textLengths = texts.map(text => text.length);
  const avgTextLength = textLengths.reduce((sum, len) => sum + len, 0) / texts.length;
  const maxTextLength = Math.max(...textLengths);
  const minTextLength = Math.min(...textLengths);
  
  console.log(`[generateEmbeddings] 文本块统计: 平均长度: ${Math.round(avgTextLength)}字符, 最大: ${maxTextLength}字符, 最小: ${minTextLength}字符`);

  try {
    // 调用内部实现函数
    return await generateEmbeddingsInternal(texts, settings);
  } catch (error) {
    const errorTime = Date.now() - startTime;
    if (error instanceof Error) {
      console.error(`[generateEmbeddings] 错误(${errorTime/1000}秒后): ${error.message}`);
      throw error;
    } else {
      console.error(`[generateEmbeddings] 未知错误(${errorTime/1000}秒后):`, error);
      throw new Error('生成嵌入向量时发生未知错误');
    }
  }
};

/**
 * 调用 SiliconFlow Rerank API 对文档进行重排序
 * @param query 原始查询
 * @param documents 文档内容字符串数组
 * @param settings 包含 API Key 和 Base URL 的设置
 * @param rerankModel 要使用的重排序模型名称，默认为 BAAI/bge-reranker-v2-m3
 * @param topN 返回多少个结果，默认为 documents.length
 * @returns 返回包含原始索引和重排序分数的对象数组
 */
export const rerankChunks = async (
  query: string, 
  documents: string[],
  settings: EmbeddingModelSettings, // 复用 Embedding 设置获取 API Key 和 Base URL
  rerankModel: string = 'BAAI/bge-reranker-v2-m3', 
  topN?: number
): Promise<RerankResult[]> => {
  if (!isBrowser) {
    console.error("rerankChunks 只能在浏览器环境中使用");
    return [];
  }

  if (!query || !documents || documents.length === 0) {
    console.error("rerankChunks 收到无效的查询或文档数组");
    return [];
  }

  // 验证API密钥
  if (!settings.apiKey || settings.apiKey.trim() === '') {
    throw new Error('Rerank API密钥未设置 (使用 Embedding API Key)，请在设置中配置有效的API密钥');
  }

  // 验证模型名称
  if (!rerankModel || rerankModel.trim() === '') {
    throw new Error('Rerank 模型未指定');
  }

  // 检查模型是否支持
  const supportedRerankModels = [
    'BAAI/bge-reranker-v2-m3',
    'netease-youdao/bce-reranker-base_v1'
  ];
  if (!supportedRerankModels.includes(rerankModel)) {
      console.warn(`Rerank 模型 "${rerankModel}" 可能不被 SiliconFlow 支持`);
  }

  try {
    console.log(`开始对 ${documents.length} 个文档进行重排序，查询: "${query.slice(0,50)}..."，模型: ${rerankModel}`);
    
    // 使用 SiliconFlow Rerank API
    // 基础 URL 可能与 embedding 不同，但 openapi.yaml 显示在同一 base 下
    const baseUrl = settings.customEndpoint || 'https://api.siliconflow.cn/v1'; 
    const endpoint = `${baseUrl}/rerank`;
    
    // 构建请求体
    const requestBody: any = {
      model: rerankModel,
      query: query,
      documents: documents,
      return_documents: false // 通常不需要返回文档内容
    };
    
    if (topN !== undefined && topN > 0) {
        requestBody.top_n = topN;
    }

    console.log(`向 ${endpoint} 发送 Rerank 请求`, {
      模型: rerankModel,
      查询: query.slice(0, 50) + '...',
      文档数量: documents.length,
      top_n: topN
    });

    // 实现重试逻辑
    let attemptCount = 0;
    const maxAttempts = 3; // 与 embedding 保持一致
    let lastError: any = null;

    while (attemptCount < maxAttempts) {
      attemptCount++;
      console.log(`尝试 Rerank 请求 (${attemptCount}/${maxAttempts})`);

      try {
        // 发送请求
        const response = await fetch(endpoint, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
            'Authorization': `Bearer ${settings.apiKey}`
              },
              body: JSON.stringify(requestBody)
            });
            
        // 检查HTTP响应
        if (!response.ok) {
          const errorText = await response.text();
          if (response.status === 401) {
            throw new Error(`Rerank API认证失败: API密钥可能无效 (${response.status})`);
          } else if (response.status === 429) {
            throw new Error(`Rerank API请求过多 (${response.status})`); // 应用指数退避
          } else if (response.status === 400) {
            throw new Error(`Rerank API请求参数错误: ${errorText} (${response.status})`);
  } else {
            throw new Error(`Rerank API请求失败: ${response.status} ${errorText}`);
          }
        }
        
        // 解析响应
        const data = await response.json() as SiliconFlowRerankResponse;
        
        // 检查API响应是否有错误
        if (data.error) {
          console.error('Rerank API返回错误:', data.error);
          throw new Error(`Rerank API返回错误: ${data.error}`);
        }
        
        // 确保 results 字段存在
        if (!data.results || !Array.isArray(data.results)) {
          console.error('Rerank API返回无效响应格式:', data);
          throw new Error('Rerank API返回无效响应格式，未包含 results');
        }
        
        // 提取重排序结果
        const rerankedResults: RerankResult[] = data.results.map(item => ({
          index: item.index,
          score: item.relevance_score
        }));
        
        console.log(`成功获取 ${rerankedResults.length} 个重排序结果`);
        
        // 如果成功，返回结果并退出重试循环
        return rerankedResults;
        
      } catch (error) {
        lastError = error;
        if (attemptCount >= maxAttempts) {
          throw error; // 最后一次尝试失败，抛出
        }
        console.error(`Rerank 尝试 ${attemptCount} 失败:`, error);
        
        // 指数退避等待 + Jitter
        const baseWaitTime = Math.pow(2, attemptCount) * 1000;
        const jitter = Math.random() * 1000; 
        const waitTime = baseWaitTime + jitter;
        console.log(`等待 ${waitTime.toFixed(0)}ms 后重试 Rerank...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
    
    // 重试耗尽后抛出最后的错误
    throw lastError || new Error('Rerank 请求失败，请检查网络连接和API设置');
    
  } catch (error) {
    console.error('Rerank 处理时出错:', error);
    let errorMessage = 'Rerank 处理失败';
    if (error instanceof Error) {
        errorMessage = error.message; // 使用捕获到的具体错误信息
        // 可以添加更多友好的错误提示
         if (errorMessage.includes('API密钥')) {
            errorMessage += '。请检查设置中的 SiliconFlow API 密钥。';
        } else if (errorMessage.includes('请求过多')) {
            errorMessage += '。请稍后再试。';
        }
    }
    throw new Error(errorMessage);
  }
};

/**
 * 生成AI响应
 * @param query 用户查询
 * @param documents 相关文档列表
 * @param settings 模型配置
 * @param onProgress 处理流式输出的回调函数
 * @returns 生成的回答
 */
export const generateAIResponse = async (
  query: string,
  documents: Document[],
  onProgress?: (partialResponse: string) => void
): Promise<string> => {
  console.log('generateAIResponse: 开始处理AI响应生成请求...');

  const llmConfig = fetchLLMConfig();

  let embeddingSettings: EmbeddingModelSettings | null = null;
  let rerankingSettings: RerankingSettings | null = null;
  try {
      const rawEmbSettings = localStorage.getItem('embeddingSettings');
      if (rawEmbSettings) embeddingSettings = JSON.parse(rawEmbSettings);
      const rawRerankSettings = localStorage.getItem('rerankingSettings');
      if (rawRerankSettings) rerankingSettings = JSON.parse(rawRerankSettings);
      console.log("generateAIResponse: 临时从 localStorage 加载 Embedding/Reranking 设置完成。");
  } catch (e) {
      console.error("generateAIResponse: 加载 Embedding/Reranking 设置失败:", e);
  }

  console.log(`generateAIResponse: 使用 ${llmConfig.provider} 提供商...`);
  console.log(`generateAIResponse: 查询: "${query}"`);
  console.log(`generateAIResponse: 文档数量: ${documents.length}`);

  try {
    let response = '';
    const completedDocuments = documents.filter(doc => doc.status === DocumentStatus.COMPLETED);
    console.log(`generateAIResponse: 检查完成文档状态: 总文档数=${documents.length}, 已完成文档数=${completedDocuments.length}`);

    if (completedDocuments.length === 0) {
      console.warn("generateAIResponse: 没有已完成处理的文档可供检索。");
      return "请先上传并等待文档处理完成后再提问。";
    }

    console.log("[RAG] (临时) 跳过 checkAndProcessDocumentsIfNeeded 调用，直接进行搜索。");

    const documentIds = completedDocuments.map(doc => doc.id);

    const searchOptions = {
      threshold: 0.6, // TODO: 从设置读取
      documentIds: documentIds,
      enableReranking: rerankingSettings?.enableReranking,
      rerankModel: rerankingSettings?.rerankingModel,
      initialCandidates: rerankingSettings?.initialRerankCandidates,
      finalTopN: rerankingSettings?.finalRerankTopN,
      embeddingSettings: embeddingSettings
    };
    const searchResults = await searchRelevantContent(query, searchOptions);

    console.log(`[RAG] 从${completedDocuments.length}个文档中检索到${searchResults.length}个相关文本块`);

    const retrievedContents = searchResults.map(result => ({
       content: result.chunk.content,
       documentName: result.chunk.metadata.documentName || '未知文档',
       similarity: result.similarity?.toFixed(3) || 'N/A'
    }));

    let constructedContext = '';
    if (retrievedContents.length > 0) {
          constructedContext = retrievedContents
              .map(item => `---\n文档: ${item.documentName} (相关度: ${item.similarity})\n内容:\n${item.content}\n---\n\n`)
              .join('');
        } else {
      console.log('[RAG] 未检索到相关内容，回退到原始文档处理方式');
       constructedContext = completedDocuments.map(doc => {
         const maxDocLength = Math.min(doc.textContent?.length || 0, 5000);
         const truncatedContent = doc.textContent?.substring(0, maxDocLength) || '内容不可用';
         return `---\n文档: ${doc.fileName}\n内容:\n${truncatedContent}\n---\n\n`;
      }).join('');
    }

    console.log(`[RAG] 构建的最终上下文长度: ${constructedContext.length} 字符`);

    const provider = llmConfig.provider;
    const prompt = `
你是分析化学文献的专家AI助手，任务是根据提供的上下文信息（文献片段）精确回答用户问题，并详细整理关键参数。

**重要指令：**
1.  在整理文献信息时，请务必详细提取并列出以下参数（如果文献中存在，请包含具体数值和单位）：
    *   **每条文献的整理都要加上编号和概括的文献标题**
    *   **催化剂制备过程**: 详细步骤、温度、压力、时间、前驱体、载体、活性组分用量、处理方法（如浸渍、沉淀、焙烧、还原等）。
    *   **反应评价信息**: 反应温度、反应压力、原料组成及流速/用量、催化剂装填量（质量或体积）、反应器类型/尺寸/材质、气体时空速 (GHSV) 或液体时空速 (LHSV)。
    *   **反应结果**: 转化率 (Conversion)、选择性 (Selectivity)、收率 (Yield)、时空收率 (Space-Time Yield, STY)、催化剂稳定性/寿命、主要副产物。
2.  请最后一句总结本次回答。回答必须是对你整个回复内容的**关键点总结**，30个字以内。（例：（Ag、Pt、Au）及其合金对反应性能影响）**不要**使用"总结："、"关键点："或"标题："等任何标签文字。

上下文信息:
---
${constructedContext}
---

用户问题: ${query}

请根据以上信息和指令回答问题：`;

    switch (provider) {
        case 'openai':
        case 'deepseek':
        case 'custom':
            console.log(`generateAIResponse: 调用 ${provider} API...`);
            response = await callOpenAICompatibleAPI(prompt, llmConfig, onProgress);
            break;
        default:
             console.error(`generateAIResponse: 不支持的LLM提供商: ${provider}`);
             response = `错误：不支持的LLM提供商 "${provider}"`;
    }

    console.log(`generateAIResponse: API返回响应，长度: ${response?.length || 0} 字符`);
    return response || "抱歉，未能生成回答。";

  } catch (error) {
    console.error('generateAIResponse: 生成AI响应时出错:', error);
    return `抱歉，生成回答时遇到错误: ${error instanceof Error ? error.message : '未知错误'}`;
  }
};

/**
 * 检查并处理文档，如果需要的话
 */
async function checkAndProcessDocumentsIfNeeded(
  documents: Document[],
  embeddingSettings: EmbeddingModelSettings | null
): Promise<boolean> {
  console.log("[RAG] checkAndProcessDocumentsIfNeeded: 临时跳过检查，假定文档已在上传时处理。");
  return false; // <-- 强制返回 false，跳过此函数内的处理逻辑

  /* 原始逻辑已注释掉
  try {
    const documentIds = documents.map(doc => doc.id);
    if (documentIds.length > 0) {
      const sampleDocId = documentIds[0];
      const existingChunks = await getDocumentChunks(sampleDocId);
      if (existingChunks && existingChunks.length > 0) {
        console.log(`[RAG] 文档 ${sampleDocId} 已有 ${existingChunks.length} 个处理过的块，跳过处理`);
        return false;
      }
    }
    console.log(`[RAG] 检查并处理 ${documents.length} 个文档以用于检索增强生成`);
    const documentChunks = await processDocumentsForRAG(documents);
    console.log(`[RAG] 已处理并存储了 ${documentChunks.length} 个文档块`);
    await storeDocumentChunks(documentChunks);
    return true;
  } catch (error) {
    console.error(`[RAG] 处理文档出错:`, error);
    return true;
  }
  */
}

// 修改generateDocumentSummary函数
export const generateDocumentSummary = async (documentId: string): Promise<string> => {
  try {
    // 使用异步API获取文档内容
    const content = await getDocumentContent(documentId);
    if (!content) {
      throw new Error('无法获取文档内容');
    }

    const response = await fetch(`${API_BASE_URL}/api/ai/summarize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content,
        documentId
      }),
    });

    if (!response.ok) {
      let errorBody = '无可用错误详情';
      try {
        errorBody = await response.text();
      } catch (e) {
        // 如果读取响应体失败则忽略
      }
      console.error(`API 错误 ${response.status}: ${response.statusText}. 响应体: ${errorBody}`);
      throw new Error(`生成摘要失败: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.summary;
  } catch (error) {
    console.error('生成文档摘要失败:', error);
    throw error;
  }
};

// 修改generateAudioOverview函数
export const generateAudioOverview = async (documentId: string): Promise<string> => {
  try {
    // 使用异步API获取文档内容
    const content = await getDocumentContent(documentId);
    if (!content) {
      throw new Error('无法获取文档内容');
    }

    const response = await fetch(`${API_BASE_URL}/api/ai/audio-overview`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content,
        documentId
      }),
    });

    if (!response.ok) {
      let errorBody = '无可用错误详情';
      try {
        errorBody = await response.text();
      } catch (e) {
        // 如果读取响应体失败则忽略
      }
      console.error(`API 错误 ${response.status}: ${response.statusText}. 响应体: ${errorBody}`);
      throw new Error(`生成音频概述失败: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.audioUrl;
  } catch (error) {
    console.error('生成音频概述失败:', error);
    throw error;
  }
};

// 修改generateStudyGuide函数
export const generateStudyGuide = async (documentId: string): Promise<string> => {
  try {
    // 使用异步API获取文档内容
    const content = await getDocumentContent(documentId);
    if (!content) {
      throw new Error('无法获取文档内容');
    }

    const response = await fetch(`${API_BASE_URL}/api/ai/study-guide`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content,
        documentId
      }),
    });

    if (!response.ok) {
      let errorBody = '无可用错误详情';
      try {
        errorBody = await response.text();
      } catch (e) {
        // 如果读取响应体失败则忽略
      }
      console.error(`API 错误 ${response.status}: ${response.statusText}. 响应体: ${errorBody}`);
      throw new Error(`生成学习指南失败: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.guide;
  } catch (error) {
    console.error('生成学习指南失败:', error);
    throw error;
  }
};

// 修改generateProjectBrief函数
export const generateProjectBrief = async (documentId: string): Promise<string> => {
  try {
    // 使用异步API获取文档内容
    const content = await getDocumentContent(documentId);
    if (!content) {
      throw new Error('无法获取文档内容');
    }

    const response = await fetch(`${API_BASE_URL}/api/ai/project-brief`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content,
        documentId
      }),
    });

    if (!response.ok) {
      let errorBody = '无可用错误详情';
      try {
        errorBody = await response.text();
      } catch (e) {
        // 如果读取响应体失败则忽略
      }
      console.error(`API 错误 ${response.status}: ${response.statusText}. 响应体: ${errorBody}`);
      throw new Error(`生成项目简介失败: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.brief;
  } catch (error) {
    console.error('生成项目简介失败:', error);
    throw error;
  }
};

/**
 * 导入所有文档
 * @param notebookId 笔记本ID，如果提供则将文档关联到该笔记本
 * @returns 导入的文档列表
 */
export const importAllDocuments = async (notebookId?: string): Promise<Document[]> => {
  try {
    console.log('开始导入所有可用文档...');
    
    // 从存储或API获取所有可用文档
    // 这里需要实现实际的文档获取逻辑，可能是从本地存储、数据库或API
    const availableDocuments = await fetchAvailableDocuments();
    
    if (!availableDocuments || availableDocuments.length === 0) {
      console.warn('未找到可用文档');
      return [];
    }
    
    console.log(`找到${availableDocuments.length}个可用文档`);
    
    // 处理每个文档，设置状态为已完成
    const processedDocuments = availableDocuments.map(doc => ({
      ...doc,
      status: DocumentStatus.COMPLETED,
      // 如果提供了笔记本ID，将文档关联到该笔记本
      notebookId: notebookId || doc.notebookId
    }));
    
    // 存储已处理的文档信息
    await storeProcessedDocuments(processedDocuments);
    
    console.log(`成功导入${processedDocuments.length}个文档${notebookId ? `到笔记本 ${notebookId}` : ''}`);
    return processedDocuments;
  } catch (error) {
    console.error('导入所有文档时出错:', error);
    throw new Error(`导入文档失败: ${error instanceof Error ? error.message : '未知错误'}`);
  }
};

/**
 * 获取所有可用文档
 * @returns 可用文档列表
 */
const fetchAvailableDocuments = async (): Promise<Document[]> => {
  console.log('fetchAvailableDocuments被调用，返回空数组而非示例文档');
  // 不再返回任何示例文档，直接返回空数组
  return [];
};

/**
 * 存储已处理的文档
 * @param documents 已处理的文档列表
 */
const storeProcessedDocuments = async (documents: Document[]): Promise<void> => {
  // 实际项目中，这里应该实现将处理后的文档保存到存储或数据库的逻辑
  // 这里使用模拟实现
  await delay(300);
  console.log('文档已保存:', documents.map(d => d.fileName).join(', '));
}; 

/**
 * 从文本内容中提取关键词作为笔记标题
 * @param content 文本内容
 * @returns 生成的标题
 */
export function generateKeywords(content: string): string {
  // 如果内容为空，返回默认标题
  if (!content || content.trim() === '') {
    return '新笔记';
  }
  
  // 简单实现：从内容中提取前几个有意义的词
  const words = content.trim()
    .split(/\s+/)
    .filter(word => word.length > 1)
    .filter(word => !['的', '是', '在', '了', '和', '与', '或', '但是', '因为', '所以', '如果'].includes(word))
    .slice(0, 3);
  
  // 如果能提取有效词，使用它们作为标题
  if (words.length > 0) {
    return words.join(' ') + ' - 笔记';
  }
  
  // 如果无法提取有效词，使用内容前20个字符作为标题
  return content.substring(0, Math.min(20, content.length)) + '...';
}

// 辅助函数：将文本分成小块以模拟流式输出
function splitIntoChunks(text: string, avgChunkSize: number): string[] {
  const chunks: string[] = [];
  let currentIndex = 0;
  
  while (currentIndex < text.length) {
    // 随机化块大小以更真实
    const randomFactor = 0.5 + Math.random();
    const chunkSize = Math.max(1, Math.floor(avgChunkSize * randomFactor));
    const endIndex = Math.min(currentIndex + chunkSize, text.length);
    
    chunks.push(text.substring(currentIndex, endIndex));
    currentIndex = endIndex;
  }
  
  return chunks;
} 

// --- 替换模拟函数为真实的 DeepSeek API 调用 ---
async function callOpenAICompatibleAPI(prompt: string, config: LLMSettings, onProgress?: (chunk: string) => void): Promise<string> {
    // 确定 API 端点
    let apiEndpoint = 
        config.provider === 'deepseek' ? 'https://api.deepseek.com/v1/chat/completions' 
        : config.provider === 'openai' ? 'https://api.openai.com/v1/chat/completions'
        : config.customEndpoint || ''; // Custom or other OpenAI compatible

    // 对 Ollama 或本地自定义端点做特殊处理 (如果需要)
    if (config.provider === 'ollama' && !config.customEndpoint) {
        apiEndpoint = 'http://localhost:11434/api/chat'; // Default Ollama endpoint
        console.warn("未指定 Ollama 自定义端点，将使用默认 http://localhost:11434");
    }

    if (!apiEndpoint) {
        throw new Error(`无法确定 ${config.provider} 提供商的 API 端点。请检查设置中的自定义端点。`);
    }

    console.log(`调用 ${config.provider} API 端点: ${apiEndpoint}`);
    console.log(`模型: ${config.model}, 温度: ${config.temperature}`);

    // 检查 API 密钥 (对于 Ollama 可能不需要)
    if (!config.apiKey && config.provider !== 'ollama') {
        console.error(`${config.provider} API Key 未设置!`);
        throw new Error(`${config.provider} 的 API Key 未设置。请在设置中配置。`);
    }

    // 从 prompt 中分离 System Prompt 和 User Prompt (如果存在特定格式)
    // 简单实现：假设 prompt 格式为 "System Prompt\n---\nUser Prompt"
    // 或者直接将整个 prompt 作为 User Prompt
    // 更好的方法是在 generateAIResponse 中构建 messages 数组
    const messages = [
        // { role: "system", content: "You are a helpful assistant." }, // 可以添加一个固定的系统提示
        { role: "user", content: prompt } 
    ];

    // 构建请求体
    const requestBody: any = {
        model: config.model || (config.provider === 'deepseek' ? 'deepseek-chat' : 'gpt-3.5-turbo'),
        messages: messages,
        temperature: config.temperature ?? 0.7,
        max_tokens: config.maxTokens || 1500, // DeepSeek 默认值可能不同，这里用一个通用值
        stream: !!onProgress // 如果有 onProgress 回调，则启用流式传输
    };
    
    // Ollama 可能需要不同的请求体结构
    if (config.provider === 'ollama') {
        // Ollama API 通常需要将整个 prompt 作为字符串
        requestBody.prompt = prompt;
        delete requestBody.messages; // Ollama 不使用 messages 数组
        // Ollama 可能有其他特定参数，如 options
        requestBody.options = {
            temperature: config.temperature ?? 0.7,
            num_predict: config.maxTokens || 1500 // Ollama 使用 num_predict 控制长度
        };
        delete requestBody.temperature;
        delete requestBody.max_tokens;
    }

    console.log('发送到 API 的请求体 (部分):', JSON.stringify({ ...requestBody, messages: requestBody.messages ? '[Messages Array]' : undefined, prompt: requestBody.prompt ? '[Prompt String]' : undefined }));

    try {
        const response = await fetch(apiEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                // 对于非Ollama，添加Authorization头
                ...(config.provider !== 'ollama' && { 'Authorization': `Bearer ${config.apiKey}` })
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            let errorBody = '';
            try {
                errorBody = await response.text();
                console.error('API 错误响应体:', errorBody);
                const errorJson = JSON.parse(errorBody); // 尝试解析为JSON
                // 提取更具体的错误信息
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
                // 如果解析JSON失败或已抛出错误，使用原始文本
                if (e instanceof Error) throw e; // 重新抛出已处理的错误
                throw new Error(`API 请求失败: ${response.status} ${response.statusText}. 响应: ${errorBody || '无法读取响应体'}`);
            }
        }

        // 处理流式响应
        if (onProgress && response.body) {
            const reader = response.body.getReader();
            const decoder = new TextDecoder('utf-8');
            let accumulatedResponse = '';
            let buffer = ''; // 用于处理跨块的JSON对象

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                
                buffer += decoder.decode(value, { stream: true });
                
                // 对于标准 SSE (OpenAI/DeepSeek)
                if (config.provider !== 'ollama') {
                    const lines = buffer.split('\n');
                    buffer = lines.pop() || ''; // 保留下次可能不完整的行

                    for (const line of lines) {
                        if (line.startsWith('data: ')) {
                            const data = line.substring(6).trim();
                            if (data === '[DONE]') {
                                break; // 流结束
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
                // 对于 Ollama 的流式响应 (通常是 NDJSON)
                else {
                    const jsonLines = buffer.split('\n');
                    buffer = jsonLines.pop() || ''; // 保留可能不完整的行

                    for (const jsonLine of jsonLines) {
                        if (jsonLine.trim()) {
                            try {
                                const parsed = JSON.parse(jsonLine);
                                // Ollama 流式响应的结构通常是 { response: "chunk", done: false } 
                                // 或最后一条 { done: true, ... }
                                const chunk = parsed.response;
                                if (chunk) {
                                    accumulatedResponse += chunk;
                                    onProgress(accumulatedResponse);
                                }
                                if (parsed.done) {
                                     break; // Ollama 表示流结束
                                }
                            } catch (error) {
                                console.error('解析 Ollama NDJSON 数据块失败:', error, '原始行:', jsonLine);
                            }
                        }
                    }
                }
            }
            
            // 最后一次解码可能遗留的 buffer (虽然 SSE 通常以 \n\n 结尾)
            if (buffer.trim() && config.provider === 'ollama') {
                 try {
                     const parsed = JSON.parse(buffer);
                     const chunk = parsed.response;
                     if (chunk) {
                         accumulatedResponse += chunk;
                         onProgress(accumulatedResponse);
                     }
                 } catch (error) {
                     console.error('解析 Ollama 最终 buffer 失败:', error, 'Buffer:', buffer);
                 }
            }

            onProgress(accumulatedResponse + '\n[流结束]'); // 发送结束标记
            console.log("API 流式调用完成。");
            return accumulatedResponse;

        } 
        // 处理非流式响应
        else {
            const result = await response.json();
            console.log("API 非流式响应:", result);
            let content = '';
            if (config.provider !== 'ollama') {
                content = result.choices?.[0]?.message?.content || '';
            } else {
                 // Ollama 非流式响应通常在 response 字段
                content = result.response || '';
            }
            
            if (!content) {
                 console.warn('API 返回的响应没有有效内容。');
                 // 尝试返回原始 JSON 以便调试
                 return JSON.stringify(result, null, 2); 
            }
            console.log("API 非流式调用完成。");
            return content;
        }

    } catch (error) {
        console.error(`调用 ${config.provider} API 时出错:`, error);
        // 将错误信息传递给上层，以便显示给用户
        throw error instanceof Error ? error : new Error('调用 API 时发生未知错误');
    }
}
// ---------------------------------------------------------