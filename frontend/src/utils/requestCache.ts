// API请求缓存管理器
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

class RequestCache {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private pendingRequests: Map<string, Promise<any>> = new Map();
  
  // 默认缓存时间（毫秒）
  private defaultTTL = 5 * 60 * 1000; // 5分钟

  // 生成缓存键
  private getCacheKey(url: string, params?: any): string {
    const paramStr = params ? JSON.stringify(params) : '';
    return `${url}:${paramStr}`;
  }

  // 获取缓存数据
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) return null;
    
    // 检查是否过期
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data as T;
  }

  // 设置缓存数据
  set<T>(key: string, data: T, ttl?: number): void {
    const expiresAt = Date.now() + (ttl || this.defaultTTL);
    
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      expiresAt,
    });
  }

  // 清除特定缓存
  invalidate(pattern?: string): void {
    if (!pattern) {
      this.cache.clear();
      return;
    }

    // 清除匹配模式的缓存
    const keysToDelete: string[] = [];
    this.cache.forEach((_, key) => {
      if (key.includes(pattern)) {
        keysToDelete.push(key);
      }
    });

    keysToDelete.forEach(key => this.cache.delete(key));
  }

  // 带缓存的请求封装
  async request<T>(
    url: string,
    fetcher: () => Promise<T>,
    options?: {
      params?: any;
      ttl?: number;
      forceRefresh?: boolean;
    }
  ): Promise<T> {
    const { params, ttl, forceRefresh = false } = options || {};
    const cacheKey = this.getCacheKey(url, params);

    // 如果不强制刷新，尝试从缓存获取
    if (!forceRefresh) {
      const cachedData = this.get<T>(cacheKey);
      if (cachedData !== null) {
        console.log(`[Cache] Hit for ${url}`);
        return cachedData;
      }
    }

    // 检查是否有正在进行的相同请求
    const pendingRequest = this.pendingRequests.get(cacheKey);
    if (pendingRequest) {
      console.log(`[Cache] Reusing pending request for ${url}`);
      return pendingRequest;
    }

    // 发起新请求
    console.log(`[Cache] Miss for ${url}, fetching...`);
    const requestPromise = fetcher()
      .then(data => {
        // 缓存成功的响应
        this.set(cacheKey, data, ttl);
        this.pendingRequests.delete(cacheKey);
        return data;
      })
      .catch(error => {
        // 清除失败的请求
        this.pendingRequests.delete(cacheKey);
        throw error;
      });

    // 记录正在进行的请求
    this.pendingRequests.set(cacheKey, requestPromise);
    
    return requestPromise;
  }

  // 预加载数据
  async prefetch<T>(
    url: string,
    fetcher: () => Promise<T>,
    options?: {
      params?: any;
      ttl?: number;
    }
  ): Promise<void> {
    const { params, ttl } = options || {};
    const cacheKey = this.getCacheKey(url, params);

    // 如果已有缓存，不预加载
    if (this.get(cacheKey) !== null) {
      return;
    }

    try {
      const data = await fetcher();
      this.set(cacheKey, data, ttl);
    } catch (error) {
      console.error(`[Cache] Prefetch failed for ${url}:`, error);
    }
  }

  // 获取缓存统计
  getStats(): {
    size: number;
    entries: string[];
    totalBytes: number;
  } {
    const entries = Array.from(this.cache.keys());
    const totalBytes = entries.reduce((sum, key) => {
      const entry = this.cache.get(key);
      return sum + JSON.stringify(entry).length;
    }, 0);

    return {
      size: this.cache.size,
      entries,
      totalBytes,
    };
  }

  // 清理过期缓存
  cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    this.cache.forEach((entry, key) => {
      if (now > entry.expiresAt) {
        keysToDelete.push(key);
      }
    });

    keysToDelete.forEach(key => this.cache.delete(key));
    console.log(`[Cache] Cleaned up ${keysToDelete.length} expired entries`);
  }

  // 启动自动清理
  startAutoCleanup(interval: number = 60000): () => void {
    const intervalId = setInterval(() => {
      this.cleanup();
    }, interval);

    // 返回停止函数
    return () => clearInterval(intervalId);
  }
}

// 导出单例
export const requestCache = new RequestCache();

// React Hook for cached requests
import { useState, useEffect } from 'react';

export function useCachedRequest<T>(
  url: string,
  fetcher: () => Promise<T>,
  options?: {
    params?: any;
    ttl?: number;
    forceRefresh?: boolean;
    enabled?: boolean;
  }
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const { params, ttl, forceRefresh = false, enabled = true } = options || {};

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;

    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        const result = await requestCache.request(url, fetcher, {
          params,
          ttl,
          forceRefresh,
        });

        if (!cancelled) {
          setData(result);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err as Error);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      cancelled = true;
    };
  }, [url, JSON.stringify(params), forceRefresh, enabled]);

  return { data, loading, error, refetch: () => useCachedRequest(url, fetcher, { ...options, forceRefresh: true }) };
}