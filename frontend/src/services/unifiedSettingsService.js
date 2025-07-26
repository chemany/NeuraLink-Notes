/**
 * 统一设置服务客户端
 * 与统一设置服务API进行通信
 */

class UnifiedSettingsService {
    constructor() {
        this.token = null;
        this.loadToken();
        
        // 调试信息：显示当前使用的API路径
        console.log('[UnifiedSettingsService] 使用的API路径:', this.getApiBase());
        console.log('[UnifiedSettingsService] 当前环境:', {
            host: typeof window !== 'undefined' ? window.location.host : 'server-side',
            protocol: typeof window !== 'undefined' ? window.location.protocol : 'unknown'
        });
    }

    // 从localStorage加载令牌和用户信息
    loadToken() {
        if (typeof window !== 'undefined') {
            this.token = localStorage.getItem('calendar_unified_token');
            const userStr = localStorage.getItem('calendar_unified_user');
            if (userStr) {
                try {
                    this.currentUser = JSON.parse(userStr);
                } catch {
                    console.warn('解析用户信息失败');
                }
            }
        }
    }

    // 保存令牌到localStorage
    saveToken(token) {
        this.token = token;
        if (typeof window !== 'undefined') {
            localStorage.setItem('calendar_unified_token', token);
        }
    }

    // 保存用户信息
    saveUser(user) {
        this.currentUser = user;
        if (typeof window !== 'undefined') {
            localStorage.setItem('calendar_unified_user', JSON.stringify(user));
        }
    }

    // 清除令牌
    clearToken() {
        this.token = null;
        if (typeof window !== 'undefined') {
            localStorage.removeItem('calendar_unified_token');
            localStorage.removeItem('calendar_unified_user');
        }
    }

    // 获取当前令牌
    getToken() {
        return this.token;
    }

    // 获取请求头
    getAuthHeaders() {
        const headers = {
            'Content-Type': 'application/json',
        };
        
        if (this.token) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }
        
        return headers;
    }

    // 处理API响应
    async handleResponse(response) {
        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: '网络错误' }));
            throw new Error(error.error || '请求失败');
        }
        return response.json();
    }

    // 用户认证相关方法
    async register(userData) {
        try {
            const response = await fetch(this.getApiBase() + '/auth/register', {
                method: 'POST',
                headers: this.getAuthHeaders(),
                body: JSON.stringify(userData)
            });
            
            return this.handleResponse(response);
        } catch (error) {
            console.error('注册错误:', error);
            throw error;
        }
    }

    async login(email, password) {
        try {
            const response = await fetch(this.getApiBase() + '/auth/login', {
                method: 'POST',
                headers: this.getAuthHeaders(),
                body: JSON.stringify({ email, password })
            });
            
            const result = await this.handleResponse(response);
            
            if (result.accessToken) {
                this.saveToken(result.accessToken);
                this.saveUser(result.user);
            }
            
            return result;
        } catch (error) {
            console.error('登录错误:', error);
            throw error;
        }
    }

    async verifyToken() {
        try {
            if (!this.token) {
                return { valid: false };
            }

            const response = await fetch(this.getApiBase() + '/auth/verify', {
                headers: this.getAuthHeaders()
            });
            
            return this.handleResponse(response);
        } catch (error) {
            console.error('令牌验证错误:', error);
            this.clearToken();
            return { valid: false };
        }
    }

    async refreshToken() {
        try {
            if (!this.token) {
                throw new Error('没有可刷新的令牌');
            }

            const response = await fetch(this.getApiBase() + '/auth/refresh', {
                method: 'POST',
                headers: this.getAuthHeaders()
            });
            
            const result = await this.handleResponse(response);
            
            if (result.accessToken) {
                this.saveToken(result.accessToken);
                this.saveUser(result.user);
            }
            
            return result;
        } catch (error) {
            console.error('刷新令牌错误:', error);
            this.clearToken();
            throw error;
        }
    }

    async getCurrentUser() {
        try {
            const response = await fetch(this.getApiBase() + '/auth/me', {
                headers: this.getAuthHeaders()
            });
            
            return this.handleResponse(response);
        } catch (error) {
            console.error('获取用户信息错误:', error);
            throw error;
        }
    }

    async logout() {
        try {
            if (this.token) {
                await fetch(this.getApiBase() + '/auth/logout', {
                    method: 'POST',
                    headers: this.getAuthHeaders()
                });
            }
        } catch (error) {
            console.error('注销错误:', error);
        } finally {
            this.clearToken();
        }
    }

    // 设置管理相关方法

    // 获取全局AI设置
    async getGlobalSettings(category) {
        try {
            const response = await fetch(this.getApiBase() + '/settings/global/' + category, {
                headers: this.getAuthHeaders()
            });
            
            return this.handleResponse(response);
        } catch (error) {
            console.error(`获取全局${category}设置错误:`, error);
            throw error;
        }
    }

    // 保存全局AI设置
    async saveGlobalSettings(category, configData) {
        try {
            const response = await fetch(this.getApiBase() + '/settings/global/' + category, {
                method: 'POST',
                headers: this.getAuthHeaders(),
                body: JSON.stringify(configData)
            });
            
            return this.handleResponse(response);
        } catch (error) {
            console.error(`保存全局${category}设置错误:`, error);
            throw error;
        }
    }

    // 获取Notebook LM应用设置
    async getAppSettings(category) {
        try {
            const response = await fetch(this.getApiBase() + '/settings/app/notebook_lm/' + category, {
                headers: this.getAuthHeaders()
            });
            
            return this.handleResponse(response);
        } catch (error) {
            console.error(`获取应用${category}设置错误:`, error);
            throw error;
        }
    }

    // 保存Notebook LM应用设置
    async saveAppSettings(category, configData) {
        try {
            const response = await fetch(this.getApiBase() + '/settings/app/notebook_lm/' + category, {
                method: 'POST',
                headers: this.getAuthHeaders(),
                body: JSON.stringify(configData)
            });
            
            return this.handleResponse(response);
        } catch (error) {
            console.error(`保存应用${category}设置错误:`, error);
            throw error;
        }
    }

    // 获取完整用户配置
    async getFullUserConfig() {
        try {
            const response = await fetch(this.getApiBase() + '/settings/full/notebook_lm', {
                headers: this.getAuthHeaders()
            });
            
            return this.handleResponse(response);
        } catch (error) {
            console.error('获取完整用户配置错误:', error);
            throw error;
        }
    }

    // 直接读取LLM设置文件（多提供商格式）- 使用统一设置服务
    async getLLMSettingsFromFile() {
        try {
            const response = await fetch(this.getApiBase() + '/file-settings/llm', {
                headers: this.getAuthHeaders()
            });

            return this.handleResponse(response);
        } catch (error) {
            console.error('读取LLM设置文件错误:', error);
            throw error;
        }
    }

    // 保存LLM设置到文件（多提供商格式）- 使用统一设置服务
    async saveLLMSettingsToFile(provider, settings) {
        try {
            const response = await fetch(this.getApiBase() + '/file-settings/llm', {
                method: 'POST',
                headers: this.getAuthHeaders(),
                body: JSON.stringify({ provider, settings })
            });

            return this.handleResponse(response);
        } catch (error) {
            console.error('保存LLM设置到文件错误:', error);
            throw error;
        }
    }

    // 获取默认模型配置
    async getDefaultModels() {
        try {
            const response = await fetch(this.getApiBase() + '/settings/default-models', {
                headers: this.getAuthHeaders()
            });
            
            return this.handleResponse(response);
        } catch (error) {
            console.error('获取默认模型配置错误:', error);
            throw error;
        }
    }

    // 获取embedding设置
    async getEmbeddingSettingsFromFile() {
        try {
            const response = await fetch(this.getApiBase() + '/file-settings/embedding', {
                headers: this.getAuthHeaders()
            });

            return this.handleResponse(response);
        } catch (error) {
            console.error('获取embedding设置错误:', error);
            throw error;
        }
    }

    // 保存embedding设置
    async saveEmbeddingSettingsToFile(settings) {
        try {
            const response = await fetch(this.getApiBase() + '/file-settings/embedding', {
                method: 'POST',
                headers: this.getAuthHeaders(),
                body: JSON.stringify(settings)
            });

            return this.handleResponse(response);
        } catch (error) {
            console.error('保存embedding设置错误:', error);
            throw error;
        }
    }

    // 获取reranking设置
    async getRerankingSettingsFromFile() {
        try {
            const response = await fetch(this.getApiBase() + '/file-settings/reranking', {
                headers: this.getAuthHeaders()
            });

            return this.handleResponse(response);
        } catch (error) {
            console.error('获取reranking设置错误:', error);
            throw error;
        }
    }

    // 保存reranking设置
    async saveRerankingSettingsToFile(settings) {
        try {
            const response = await fetch(this.getApiBase() + '/file-settings/reranking', {
                method: 'POST',
                headers: this.getAuthHeaders(),
                body: JSON.stringify(settings)
            });

            return this.handleResponse(response);
        } catch (error) {
            console.error('保存reranking设置错误:', error);
            throw error;
        }
    }

    // 批量保存设置
    async saveAllGlobalSettings(settingsData) {
        try {
            const response = await fetch(this.getApiBase() + '/settings/global/batch', {
                method: 'POST',
                headers: this.getAuthHeaders(),
                body: JSON.stringify(settingsData)
            });
            
            return this.handleResponse(response);
        } catch (error) {
            console.error('批量保存全局设置错误:', error);
            throw error;
        }
    }

    async saveAllAppSettings(settingsData) {
        try {
            const response = await fetch(this.getApiBase() + '/settings/app/notebook_lm/batch', {
                method: 'POST',
                headers: this.getAuthHeaders(),
                body: JSON.stringify(settingsData)
            });
            
            return this.handleResponse(response);
        } catch (error) {
            console.error('批量保存应用设置错误:', error);
            throw error;
        }
    }

    // 重置设置
    async resetGlobalSettings(category) {
        try {
            const response = await fetch(this.getApiBase() + '/settings/global/' + category, {
                method: 'DELETE',
                headers: this.getAuthHeaders()
            });
            
            return this.handleResponse(response);
        } catch (error) {
            console.error(`重置全局${category}设置错误:`, error);
            throw error;
        }
    }

    async resetAppSettings(category) {
        try {
            const response = await fetch(this.getApiBase() + '/settings/app/notebook_lm/' + category, {
                method: 'DELETE',
                headers: this.getAuthHeaders()
            });
            
            return this.handleResponse(response);
        } catch (error) {
            console.error(`重置应用${category}设置错误:`, error);
            throw error;
        }
    }

    // 检查是否已登录
    isLoggedIn() {
        return !!this.token;
    }

    // 获取存储的用户信息
    getStoredUser() {
        if (typeof window !== 'undefined') {
            const userStr = localStorage.getItem('calendar_unified_user');
            return userStr ? JSON.parse(userStr) : null;
        }
        return null;
    }

    // 智能API路径配置 - 动态计算
    getApiBase() {
        // 如果有环境变量配置，直接使用
        if (process.env.NEXT_PUBLIC_UNIFIED_SETTINGS_URL) {
            return process.env.NEXT_PUBLIC_UNIFIED_SETTINGS_URL;
        }

        // 如果在浏览器环境中，根据当前访问地址判断
        if (typeof window !== 'undefined') {
            const currentHost = window.location.host;
            const currentProtocol = window.location.protocol;

            // 仅在非生产环境输出详细日志
            if (process.env.NODE_ENV !== 'production') {
                console.log('[UnifiedSettingsService] 当前访问环境:', {
                    host: currentHost,
                    protocol: currentProtocol,
                    href: window.location.href
                });
            }

            // 如果是localhost或127.0.0.1的3000端口（本地开发）
            if (currentHost === 'localhost:3000' || currentHost === '127.0.0.1:3000') {
                if (process.env.NODE_ENV !== 'production') {
                    console.log('[UnifiedSettingsService] 检测到本地开发环境，使用独立统一设置服务');
                }
                return 'http://localhost:3002/api';
            }
            // 检查是否是局域网IP地址（192.168.x.x, 10.x.x.x, 172.16-31.x.x）
            else if (/^192\.168\.\d{1,3}\.\d{1,3}(:\d+)?$/.test(currentHost) ||
                     /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?$/.test(currentHost) ||
                     /^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}(:\d+)?$/.test(currentHost)) {
                // 局域网IP访问，连接到独立统一设置服务的3002端口
                const hostname = currentHost.split(':')[0]; // 去掉端口号，只保留IP
                const apiBase = `http://${hostname}:3002/api`;
                if (process.env.NODE_ENV !== 'production') {
                    console.log('[UnifiedSettingsService] 检测到局域网环境，使用独立统一设置服务:', apiBase);
                }
                return apiBase;
            }
            // 如果是通过nginx代理访问（外网环境）
            else {
                const apiBase = `${currentProtocol}//${currentHost}/unified-settings/api`;
                if (process.env.NODE_ENV !== 'production') {
                    console.log('[UnifiedSettingsService] 检测到外网环境，使用nginx代理:', apiBase);
                }
                return apiBase;
            }
        }

        // 服务端渲染时的默认值
        if (process.env.NODE_ENV !== 'production') {
            console.log('[UnifiedSettingsService] 服务端环境，使用默认配置');
        }
        return 'http://localhost:3002/api';
    }

    // 获取灵枢笔记后端的统一设置API路径
    getNotebookApiBase() {
        // 如果在浏览器环境中，根据当前访问地址判断
        if (typeof window !== 'undefined') {
            const currentHost = window.location.host;
            const currentProtocol = window.location.protocol;

            // 如果是localhost或127.0.0.1的3000端口（本地开发）
            if (currentHost === 'localhost:3000' || currentHost === '127.0.0.1:3000') {
                return 'http://localhost:3001/api/unified-settings';
            }
            // 检查是否是局域网IP地址
            else if (/^192\.168\.\d{1,3}\.\d{1,3}(:\d+)?$/.test(currentHost) ||
                     /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?$/.test(currentHost) ||
                     /^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}(:\d+)?$/.test(currentHost)) {
                // 局域网IP访问，连接到灵枢笔记后端的3001端口
                const hostname = currentHost.split(':')[0];
                return `http://${hostname}:3001/api/unified-settings`;
            }
            // 外网环境
            else {
                return `${currentProtocol}//${currentHost}/api/unified-settings`;
            }
        }

        // 服务端渲染时的默认值
        return 'http://localhost:3001/api/unified-settings';
    }
}

// 创建单例实例
const unifiedSettingsService = new UnifiedSettingsService();

export default unifiedSettingsService;