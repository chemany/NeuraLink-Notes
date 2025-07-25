/**
 * 自动同步服务
 * 负责前端的自动刷新和数据同步
 */

import { cleanupOrphanedNotesApi } from './richNoteService';

export class AutoSyncService {
  private static instance: AutoSyncService;
  private syncInterval: NodeJS.Timeout | null = null;
  private isEnabled: boolean = true;
  private syncIntervalMs: number = 5 * 60 * 1000; // 5分钟
  private listeners: Map<string, Set<() => void>> = new Map();

  private constructor() {
    this.startAutoSync();
  }

  public static getInstance(): AutoSyncService {
    if (!AutoSyncService.instance) {
      AutoSyncService.instance = new AutoSyncService();
    }
    return AutoSyncService.instance;
  }

  /**
   * 启动自动同步
   */
  public startAutoSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    if (!this.isEnabled) {
      console.log('[AutoSync] 自动同步已禁用');
      return;
    }

    console.log(`[AutoSync] 启动自动同步，间隔: ${this.syncIntervalMs / 1000}秒`);
    
    this.syncInterval = setInterval(async () => {
      await this.performSync();
    }, this.syncIntervalMs);

    // 启动后延迟30秒执行第一次同步
    setTimeout(async () => {
      await this.performSync();
    }, 30000);
  }

  /**
   * 停止自动同步
   */
  public stopAutoSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    console.log('[AutoSync] 自动同步已停止');
  }

  /**
   * 设置同步间隔
   */
  public setSyncInterval(intervalMs: number): void {
    this.syncIntervalMs = intervalMs;
    if (this.isEnabled) {
      this.startAutoSync(); // 重启同步以应用新间隔
    }
  }

  /**
   * 启用/禁用自动同步
   */
  public setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    if (enabled) {
      this.startAutoSync();
    } else {
      this.stopAutoSync();
    }
  }

  /**
   * 执行同步操作
   */
  private async performSync(): Promise<void> {
    try {
      console.log('[AutoSync] 执行自动同步检查...');
      
      // 调用后端的文件同步API
      const result = await cleanupOrphanedNotesApi();
      
      if (result.cleaned > 0) {
        console.log(`[AutoSync] 自动同步完成，清理了 ${result.cleaned} 个孤立记录`);
        
        // 通知所有监听器数据已更新
        this.notifyListeners('data-updated');
        
        // 显示通知（可选）
        if (typeof window !== 'undefined' && window.dispatchEvent) {
          window.dispatchEvent(new CustomEvent('auto-sync-completed', {
            detail: { cleaned: result.cleaned, message: result.message }
          }));
        }
      } else {
        console.log('[AutoSync] 自动同步检查完成，无需清理');
      }
    } catch (error) {
      console.error('[AutoSync] 自动同步失败:', error);
      
      // 通知监听器同步失败
      this.notifyListeners('sync-error');
    }
  }

  /**
   * 手动触发同步
   */
  public async triggerManualSync(): Promise<{ cleaned: number; message: string }> {
    console.log('[AutoSync] 手动触发同步...');
    try {
      const result = await cleanupOrphanedNotesApi();
      
      // 通知监听器数据已更新
      this.notifyListeners('data-updated');
      
      return result;
    } catch (error) {
      console.error('[AutoSync] 手动同步失败:', error);
      this.notifyListeners('sync-error');
      throw error;
    }
  }

  /**
   * 添加事件监听器
   */
  public addEventListener(event: string, callback: () => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  }

  /**
   * 移除事件监听器
   */
  public removeEventListener(event: string, callback: () => void): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.delete(callback);
    }
  }

  /**
   * 通知所有监听器
   */
  private notifyListeners(event: string): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.forEach(callback => {
        try {
          callback();
        } catch (error) {
          console.error(`[AutoSync] 监听器回调执行失败:`, error);
        }
      });
    }
  }

  /**
   * 获取当前状态
   */
  public getStatus(): {
    isEnabled: boolean;
    syncIntervalMs: number;
    isRunning: boolean;
  } {
    return {
      isEnabled: this.isEnabled,
      syncIntervalMs: this.syncIntervalMs,
      isRunning: this.syncInterval !== null
    };
  }
}

// 导出单例实例
export const autoSyncService = AutoSyncService.getInstance();

// 在浏览器环境中自动启动
if (typeof window !== 'undefined') {
  // 页面加载完成后启动自动同步
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      autoSyncService.startAutoSync();
    });
  } else {
    autoSyncService.startAutoSync();
  }

  // 页面卸载时停止自动同步
  window.addEventListener('beforeunload', () => {
    autoSyncService.stopAutoSync();
  });
}
