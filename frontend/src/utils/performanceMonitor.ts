// 性能监控工具
class PerformanceMonitor {
  private marks: Map<string, number> = new Map();
  private measures: Map<string, number[]> = new Map();

  // 开始计时
  start(label: string): void {
    if (typeof window === 'undefined') return;
    this.marks.set(label, performance.now());
  }

  // 结束计时并记录
  end(label: string): number {
    if (typeof window === 'undefined') return 0;
    
    const startTime = this.marks.get(label);
    if (!startTime) {
      console.warn(`No start mark found for ${label}`);
      return 0;
    }

    const duration = performance.now() - startTime;
    
    // 记录测量结果
    if (!this.measures.has(label)) {
      this.measures.set(label, []);
    }
    this.measures.get(label)?.push(duration);

    // 如果时间超过阈值，发出警告
    if (duration > 100) {
      console.warn(`[Performance] ${label} took ${duration.toFixed(2)}ms`);
    }

    this.marks.delete(label);
    return duration;
  }

  // 获取平均时间
  getAverage(label: string): number {
    const measurements = this.measures.get(label);
    if (!measurements || measurements.length === 0) return 0;
    
    const sum = measurements.reduce((a, b) => a + b, 0);
    return sum / measurements.length;
  }

  // 获取报告
  getReport(): string {
    const report: string[] = ['=== Performance Report ==='];
    
    this.measures.forEach((measurements, label) => {
      const avg = this.getAverage(label);
      const max = Math.max(...measurements);
      const min = Math.min(...measurements);
      
      report.push(
        `${label}: avg=${avg.toFixed(2)}ms, min=${min.toFixed(2)}ms, max=${max.toFixed(2)}ms (${measurements.length} samples)`
      );
    });

    return report.join('\n');
  }

  // 清除所有记录
  clear(): void {
    this.marks.clear();
    this.measures.clear();
  }
}

// 导出单例
export const perfMonitor = new PerformanceMonitor();

// React组件性能监控Hook
export function usePerformanceMonitor(componentName: string) {
  if (typeof window === 'undefined') return;

  // 监控组件渲染时间
  perfMonitor.start(`${componentName}_render`);
  
  // 组件卸载时结束计时
  if (typeof window !== 'undefined') {
    requestAnimationFrame(() => {
      perfMonitor.end(`${componentName}_render`);
    });
  }
}

// 监控异步操作
export async function monitorAsync<T>(
  label: string,
  asyncFn: () => Promise<T>
): Promise<T> {
  perfMonitor.start(label);
  try {
    const result = await asyncFn();
    return result;
  } finally {
    perfMonitor.end(label);
  }
}

// 防抖优化工具
export function debounceWithPerf<T extends (...args: any[]) => any>(
  fn: T,
  delay: number,
  label?: string
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout;
  
  return (...args: Parameters<T>) => {
    if (label) perfMonitor.start(`${label}_debounced`);
    
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      fn(...args);
      if (label) perfMonitor.end(`${label}_debounced`);
    }, delay);
  };
}

// 节流优化工具
export function throttleWithPerf<T extends (...args: any[]) => any>(
  fn: T,
  limit: number,
  label?: string
): (...args: Parameters<T>) => void {
  let inThrottle = false;
  
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      if (label) perfMonitor.start(`${label}_throttled`);
      
      fn(...args);
      inThrottle = true;
      
      setTimeout(() => {
        inThrottle = false;
        if (label) perfMonitor.end(`${label}_throttled`);
      }, limit);
    }
  };
}