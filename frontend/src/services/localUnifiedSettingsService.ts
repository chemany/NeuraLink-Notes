/**
 * 本地统一设置服务
 * 使用灵枢笔记自己的后端API来管理设置
 */

// 动态API路径配置
const getApiBaseUrl = (): string => {
  if (typeof window !== 'undefined') {
    const currentHost = window.location.host;
    const currentProtocol = window.location.protocol;
    
    // 本地开发环境：直接访问灵枢笔记后端
    if (currentHost === 'localhost:3000' || currentHost === '127.0.0.1:3000') {
      return 'http://localhost:3001/api';
    } 
    // 外网环境：通过nginx代理访问
    else {
      return `${currentProtocol}//${currentHost}/notepads/api`;
    }
  }
  
  // 服务端环境默认值
  return 'http://localhost:3001/api';
};

class LocalUnifiedSettingsService {
  /**
   * 获取Authorization头
   */
  private getAuthHeaders(): HeadersInit {
    // 修复：使用正确的令牌键名，与统一设置服务保持一致
    const token = localStorage.getItem('calendar_unified_token');
    return {
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : '',
    };
  }

  /**
   * 检查是否已登录
   */
  isLoggedIn(): boolean {
    // 修复：使用正确的令牌键名
    const token = localStorage.getItem('calendar_unified_token');
    return !!token;
  }

  /**
   * 获取默认模型配置
   */
  async getDefaultModels(): Promise<any> {
    try {
      const apiBaseUrl = getApiBaseUrl();
      const response = await fetch(`${apiBaseUrl}/unified-settings/default-models`, {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const result = await response.json();
      return result.success ? result.data : null;
    } catch (error) {
      console.error('获取默认模型配置失败:', error);
      return null;
    }
  }

  /**
   * 获取LLM设置
   */
  async getLLMSettingsFromFile(): Promise<any> {
    try {
      const apiBaseUrl = getApiBaseUrl();
      const response = await fetch(`${apiBaseUrl}/unified-settings/llm`, {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const result = await response.json();
      return result.success ? result.data : null;
    } catch (error) {
      console.error('获取LLM设置失败:', error);
      return null;
    }
  }

  /**
   * 保存LLM设置
   */
  async saveLLMSettingsToFile(provider: string, settings: any): Promise<any> {
    try {
      const apiBaseUrl = getApiBaseUrl();
      const response = await fetch(`${apiBaseUrl}/unified-settings/llm`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ provider, settings }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('保存LLM设置失败:', (error as Error).message);
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * 获取Embedding设置
   */
  async getEmbeddingSettingsFromFile(): Promise<any> {
    try {
      const apiBaseUrl = getApiBaseUrl();
      const response = await fetch(`${apiBaseUrl}/unified-settings/embedding`, {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const result = await response.json();
      return result.success ? { data: result.data } : null;
    } catch (error) {
      console.error('获取Embedding设置失败:', error);
      return null;
    }
  }

  /**
   * 保存Embedding设置
   */
  async saveEmbeddingSettingsToFile(settings: any): Promise<any> {
    try {
      const apiBaseUrl = getApiBaseUrl();
      const response = await fetch(`${apiBaseUrl}/unified-settings/embedding`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(settings),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('保存Embedding设置失败:', (error as Error).message);
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * 获取Reranking设置
   */
  async getRerankingSettingsFromFile(): Promise<any> {
    try {
      const apiBaseUrl = getApiBaseUrl();
      const response = await fetch(`${apiBaseUrl}/unified-settings/reranking`, {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const result = await response.json();
      return result.success ? { data: result.data } : null;
    } catch (error) {
      console.error('获取Reranking设置失败:', error);
      return null;
    }
  }

  /**
   * 保存Reranking设置
   */
  async saveRerankingSettingsToFile(settings: any): Promise<any> {
    try {
      const apiBaseUrl = getApiBaseUrl();
      const response = await fetch(`${apiBaseUrl}/unified-settings/reranking`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(settings),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('保存Reranking设置失败:', (error as Error).message);
      return { success: false, error: (error as Error).message };
    }
  }
}

const localUnifiedSettingsService = new LocalUnifiedSettingsService();
export default localUnifiedSettingsService;