/**
 * 本地统一设置服务
 * 使用灵枢笔记自己的后端API来管理设置
 */

// 动态API路径配置
const getApiBaseUrl = (): string => {
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    const currentHost = window.location.host;
    const currentProtocol = window.location.protocol;

    // 检查是否是本地环境（localhost或127.0.0.1）
    const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';

    // 检查是否是局域网IP地址（192.168.x.x, 10.x.x.x, 172.16-31.x.x）
    const isPrivateIP = /^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
                       /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
                       /^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/.test(hostname);

    if (isLocalhost) {
      // 本地开发环境：直接访问灵枢笔记后端
      return 'http://localhost:3001/api';
    } else if (isPrivateIP) {
      // 局域网IP访问：使用当前IP访问后端端口
      return `http://${hostname}:3001/api`;
    } else {
      // 外网环境：通过nginx代理访问
      return `/api`;
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
    // 使用NeuraLink-Notes的token键名
    const token = localStorage.getItem('token');
    return {
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : '',
    };
  }

  /**
   * 检查是否已登录
   */
  isLoggedIn(): boolean {
    // 使用NeuraLink-Notes的token键名
    const token = localStorage.getItem('token');
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