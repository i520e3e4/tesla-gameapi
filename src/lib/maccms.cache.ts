/**
 * 苹果CMS V10 缓存和错误处理工具
 */

import { NextResponse } from 'next/server';

// 缓存配置接口
export interface CacheConfig {
  defaultTTL: number; // 默认缓存时间（秒）
  searchTTL: number;  // 搜索结果缓存时间
  detailTTL: number;  // 详情页缓存时间
  categoryTTL: number; // 分类缓存时间
  errorTTL: number;   // 错误响应缓存时间
}

// 错误类型枚举
export enum ErrorType {
  VALIDATION = 'VALIDATION_ERROR',
  API_ERROR = 'API_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  RATE_LIMIT = 'RATE_LIMIT_ERROR',
  TIMEOUT = 'TIMEOUT_ERROR',
  UNKNOWN = 'UNKNOWN_ERROR'
}

// 错误详情接口
export interface ErrorDetail {
  type: ErrorType;
  message: string;
  code?: string;
  details?: any;
  timestamp: number;
}

// 缓存管理器
export class MacCMSCacheManager {
  private static config: CacheConfig = {
    defaultTTL: 300,    // 5分钟
    searchTTL: 600,     // 10分钟
    detailTTL: 1800,    // 30分钟
    categoryTTL: 3600,  // 1小时
    errorTTL: 60        // 1分钟
  };

  /**
   * 获取缓存时间
   */
  static getCacheTime(type: 'search' | 'detail' | 'category' | 'error' | 'default'): number {
    switch (type) {
      case 'search':
        return this.config.searchTTL;
      case 'detail':
        return this.config.detailTTL;
      case 'category':
        return this.config.categoryTTL;
      case 'error':
        return this.config.errorTTL;
      default:
        return this.config.defaultTTL;
    }
  }

  /**
   * 生成缓存键
   */
  static generateCacheKey(prefix: string, params: Record<string, any>): string {
    const sortedParams = Object.keys(params)
      .sort()
      .map(key => `${key}=${encodeURIComponent(String(params[key]))}`)
      .join('&');
    
    return `maccms:${prefix}:${Buffer.from(sortedParams).toString('base64')}`;
  }

  /**
   * 创建带缓存头的响应
   */
  static createCachedResponse(data: any, cacheType: 'search' | 'detail' | 'category' | 'error' | 'default'): NextResponse {
    const cacheTime = this.getCacheTime(cacheType);
    
    return NextResponse.json(data, {
      headers: {
        'Cache-Control': `public, max-age=${cacheTime}, s-maxage=${cacheTime}`,
        'CDN-Cache-Control': `public, s-maxage=${cacheTime}`,
        'Vercel-CDN-Cache-Control': `public, s-maxage=${cacheTime}`,
        'X-Cache-Type': cacheType,
        'X-Cache-TTL': cacheTime.toString(),
      },
    });
  }
}

// 错误处理器
export class MacCMSErrorHandler {
  /**
   * 创建错误详情
   */
  static createError(type: ErrorType, message: string, details?: any): ErrorDetail {
    return {
      type,
      message,
      details,
      timestamp: Date.now()
    };
  }

  /**
   * 处理API错误
   */
  static handleApiError(error: any): ErrorDetail {
    if (error.name === 'AbortError' || error.code === 'ABORT_ERR') {
      return this.createError(ErrorType.TIMEOUT, '请求超时，请稍后重试');
    }
    
    if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      return this.createError(ErrorType.NETWORK_ERROR, '网络连接失败');
    }
    
    if (error.response?.status === 429) {
      return this.createError(ErrorType.RATE_LIMIT, '请求过于频繁，请稍后重试');
    }
    
    if (error.response?.status >= 400 && error.response?.status < 500) {
      return this.createError(ErrorType.API_ERROR, '请求参数错误');
    }
    
    if (error.response?.status >= 500) {
      return this.createError(ErrorType.API_ERROR, '服务器内部错误');
    }
    
    return this.createError(ErrorType.UNKNOWN, '未知错误，请稍后重试', {
      originalError: error.message
    });
  }

  /**
   * 处理验证错误
   */
  static handleValidationError(message: string, details?: any): ErrorDetail {
    return this.createError(ErrorType.VALIDATION, message, details);
  }

  /**
   * 创建错误响应
   */
  static createErrorResponse(error: ErrorDetail): any {
    return {
      code: 0,
      msg: error.message,
      page: 1,
      pagecount: 0,
      limit: 0,
      total: 0,
      list: [],
      error: {
        type: error.type,
        timestamp: error.timestamp,
        ...(error.details && { details: error.details })
      }
    };
  }

  /**
   * 记录错误日志
   */
  static logError(error: ErrorDetail, context?: string): void {
    const logData = {
      timestamp: new Date(error.timestamp).toISOString(),
      type: error.type,
      message: error.message,
      context: context || 'MacCMS API',
      ...(error.details && { details: error.details })
    };
    
    console.error('[MacCMS Error]', JSON.stringify(logData, null, 2));
  }
}

// 重试机制
export class MacCMSRetryHandler {
  /**
   * 带重试的异步函数执行
   */
  static async withRetry<T>(
    fn: () => Promise<T>,
    maxRetries = 3,
    delay = 1000,
    backoff = 2
  ): Promise<T> {
    let lastError: any;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        
        // 如果是最后一次尝试，直接抛出错误
        if (attempt === maxRetries) {
          throw error;
        }
        
        // 某些错误不需要重试
        if (this.shouldNotRetry(error)) {
          throw error;
        }
        
        // 等待后重试
        const waitTime = delay * Math.pow(backoff, attempt - 1);
        await this.sleep(waitTime);
        
        console.warn(`[MacCMS Retry] 第${attempt}次重试失败，${waitTime}ms后进行第${attempt + 1}次尝试`);
      }
    }
    
    throw lastError;
  }

  /**
   * 判断是否不应该重试
   */
  private static shouldNotRetry(error: any): boolean {
    // 4xx错误通常不需要重试
    if (error.response?.status >= 400 && error.response?.status < 500) {
      return true;
    }
    
    // 验证错误不需要重试
    if (error.type === ErrorType.VALIDATION) {
      return true;
    }
    
    return false;
  }

  /**
   * 睡眠函数
   */
  private static sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// 性能监控
export class MacCMSPerformanceMonitor {
  private static metrics: Map<string, number[]> = new Map();

  /**
   * 记录执行时间
   */
  static recordExecutionTime(operation: string, startTime: number): void {
    const duration = Date.now() - startTime;
    
    if (!this.metrics.has(operation)) {
      this.metrics.set(operation, []);
    }
    
    const times = this.metrics.get(operation)!;
    times.push(duration);
    
    // 只保留最近100次记录
    if (times.length > 100) {
      times.shift();
    }
    
    // 记录慢查询
    if (duration > 5000) { // 超过5秒
      console.warn(`[MacCMS Performance] 慢查询检测: ${operation} 耗时 ${duration}ms`);
    }
  }

  /**
   * 获取性能统计
   */
  static getStats(operation: string): { avg: number; min: number; max: number; count: number } | null {
    const times = this.metrics.get(operation);
    if (!times || times.length === 0) {
      return null;
    }
    
    const avg = times.reduce((sum, time) => sum + time, 0) / times.length;
    const min = Math.min(...times);
    const max = Math.max(...times);
    
    return { avg, min, max, count: times.length };
  }
}