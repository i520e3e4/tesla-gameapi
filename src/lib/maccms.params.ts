/* eslint-disable @typescript-eslint/no-explicit-any */

// 苹果CMS V10 参数处理工具类

export interface MacCMSParams {
  // 基础参数
  ac?: string;          // 操作类型：list(列表), detail(详情), videolist(视频列表)
  t?: string;           // 分类ID
  pg?: string;          // 页码
  wd?: string;          // 搜索关键词
  ids?: string;         // 视频ID列表
  
  // 扩展参数
  h?: string;           // 小时数（最近更新）
  limit?: string;       // 每页数量
  order?: string;       // 排序方式
  by?: string;          // 排序字段
  class?: string;       // 分类
  area?: string;        // 地区
  lang?: string;        // 语言
  year?: string;        // 年份
  letter?: string;      // 首字母
  actor?: string;       // 演员
  director?: string;    // 导演
  tag?: string;         // 标签
  level?: string;       // 等级
  douban?: string;      // 豆瓣评分
  version?: string;     // 版本
  state?: string;       // 状态
  
  // 时间参数
  start?: string;       // 开始时间
  end?: string;         // 结束时间
  
  // 其他参数
  callback?: string;    // JSONP回调函数
  format?: string;      // 返回格式
}

export interface ProcessedParams {
  action: 'list' | 'detail' | 'search' | 'category';
  keyword?: string;
  page: number;
  limit: number;
  categoryId?: number;
  videoIds?: string[];
  filters: {
    area?: string;
    year?: string;
    order?: 'latest' | 'longest' | 'shortest' | 'top-rated' | 'most-viewed';
    timeRange?: {
      start?: Date;
      end?: Date;
    };
  };
}

export class MacCMSParamsProcessor {
  private static readonly DEFAULT_PAGE = 1;
  private static readonly DEFAULT_LIMIT = 20;
  private static readonly MAX_LIMIT = 100;
  private static readonly MIN_LIMIT = 1;

  /**
   * 处理苹果CMS参数
   * @param searchParams URL搜索参数
   * @returns 处理后的参数对象
   */
  static processParams(searchParams: URLSearchParams): ProcessedParams {
    const params: MacCMSParams = {};
    
    // 提取所有参数
    for (const [key, value] of searchParams.entries()) {
      params[key as keyof MacCMSParams] = value;
    }

    return this.parseParams(params);
  }

  /**
   * 解析参数对象
   * @param params 原始参数
   * @returns 处理后的参数
   */
  static parseParams(params: MacCMSParams): ProcessedParams {
    const action = this.determineAction(params);
    const page = this.parsePage(params.pg);
    const limit = this.parseLimit(params.limit);
    const keyword = this.parseKeyword(params.wd);
    const categoryId = this.parseCategoryId(params.t);
    const videoIds = this.parseVideoIds(params.ids);
    const filters = this.parseFilters(params);

    return {
      action,
      keyword,
      page,
      limit,
      categoryId,
      videoIds,
      filters
    };
  }

  /**
   * 确定操作类型
   * @param params 参数对象
   * @returns 操作类型
   */
  private static determineAction(params: MacCMSParams): 'list' | 'detail' | 'search' | 'category' {
    const ac = params.ac?.toLowerCase();
    
    // 根据ac参数确定操作类型
    if (ac === 'detail' || params.ids) {
      return 'detail';
    }
    
    if (ac === 'list' || ac === 'videolist') {
      // 如果有搜索关键词，则为搜索
      if (params.wd && params.wd.trim()) {
        return 'search';
      }
      // 如果请求分类信息
      if (params.t === '0' || ac === 'list') {
        return 'category';
      }
      return 'list';
    }
    
    // 默认根据参数判断
    if (params.wd && params.wd.trim()) {
      return 'search';
    }
    
    if (params.ids) {
      return 'detail';
    }
    
    return 'list';
  }

  /**
   * 解析页码
   * @param pageStr 页码字符串
   * @returns 页码数字
   */
  private static parsePage(pageStr?: string): number {
    if (!pageStr) return this.DEFAULT_PAGE;
    
    const page = parseInt(pageStr, 10);
    return isNaN(page) || page < 1 ? this.DEFAULT_PAGE : page;
  }

  /**
   * 解析每页数量
   * @param limitStr 数量字符串
   * @returns 数量数字
   */
  private static parseLimit(limitStr?: string): number {
    if (!limitStr) return this.DEFAULT_LIMIT;
    
    const limit = parseInt(limitStr, 10);
    
    if (isNaN(limit)) return this.DEFAULT_LIMIT;
    if (limit < this.MIN_LIMIT) return this.MIN_LIMIT;
    if (limit > this.MAX_LIMIT) return this.MAX_LIMIT;
    
    return limit;
  }

  /**
   * 解析搜索关键词
   * @param keyword 关键词字符串
   * @returns 清理后的关键词
   */
  private static parseKeyword(keyword?: string): string | undefined {
    if (!keyword || !keyword.trim()) return undefined;
    
    return keyword
      .trim()
      .replace(/[<>"'&]/g, '') // 移除HTML特殊字符
      .replace(/\s+/g, ' ') // 合并多个空格
      .substring(0, 100); // 限制长度
  }

  /**
   * 解析分类ID
   * @param categoryStr 分类ID字符串
   * @returns 分类ID数字
   */
  private static parseCategoryId(categoryStr?: string): number | undefined {
    if (!categoryStr) return undefined;
    
    const categoryId = parseInt(categoryStr, 10);
    return isNaN(categoryId) ? undefined : categoryId;
  }

  /**
   * 解析视频ID列表
   * @param idsStr ID字符串
   * @returns ID数组
   */
  private static parseVideoIds(idsStr?: string): string[] | undefined {
    if (!idsStr || !idsStr.trim()) return undefined;
    
    return idsStr
      .split(/[,，;；\s]+/) // 支持多种分隔符
      .map(id => id.trim())
      .filter(id => id.length > 0 && /^[a-zA-Z0-9]+$/.test(id)) // 验证ID格式
      .slice(0, 10); // 限制数量
  }

  /**
   * 解析过滤条件
   * @param params 参数对象
   * @returns 过滤条件
   */
  private static parseFilters(params: MacCMSParams) {
    const filters: ProcessedParams['filters'] = {};
    
    // 地区过滤
    if (params.area && params.area.trim()) {
      filters.area = params.area.trim();
    }
    
    // 年份过滤
    if (params.year && params.year.trim()) {
      const year = parseInt(params.year, 10);
      if (!isNaN(year) && year >= 1900 && year <= new Date().getFullYear()) {
        filters.year = params.year;
      }
    }
    
    // 排序方式
    filters.order = this.parseOrder(params.order, params.by);
    
    // 时间范围
    const timeRange = this.parseTimeRange(params.start, params.end, params.h);
    if (timeRange) {
      filters.timeRange = timeRange;
    }
    
    return filters;
  }

  /**
   * 解析排序方式
   * @param order 排序参数
   * @param by 排序字段
   * @returns 标准化的排序方式
   */
  private static parseOrder(
    order?: string, 
    by?: string
  ): 'latest' | 'longest' | 'shortest' | 'top-rated' | 'most-viewed' {
    const orderStr = (order || by || '').toLowerCase();
    
    switch (orderStr) {
      case 'time':
      case 'addtime':
      case 'latest':
      case 'desc':
        return 'latest';
      case 'duration':
      case 'long':
      case 'longest':
        return 'longest';
      case 'short':
      case 'shortest':
        return 'shortest';
      case 'score':
      case 'rate':
      case 'rating':
      case 'top':
        return 'top-rated';
      case 'hits':
      case 'views':
      case 'popular':
        return 'most-viewed';
      default:
        return 'latest';
    }
  }

  /**
   * 解析时间范围
   * @param start 开始时间
   * @param end 结束时间
   * @param hours 小时数
   * @returns 时间范围对象
   */
  private static parseTimeRange(
    start?: string, 
    end?: string, 
    hours?: string
  ): { start?: Date; end?: Date } | undefined {
    const timeRange: { start?: Date; end?: Date } = {};
    
    // 如果指定了小时数，计算相对时间
    if (hours) {
      const hoursNum = parseInt(hours, 10);
      if (!isNaN(hoursNum) && hoursNum > 0 && hoursNum <= 8760) { // 最多一年
        const now = new Date();
        timeRange.end = now;
        timeRange.start = new Date(now.getTime() - hoursNum * 60 * 60 * 1000);
        return timeRange;
      }
    }
    
    // 解析开始时间
    if (start) {
      const startDate = this.parseDate(start);
      if (startDate) {
        timeRange.start = startDate;
      }
    }
    
    // 解析结束时间
    if (end) {
      const endDate = this.parseDate(end);
      if (endDate) {
        timeRange.end = endDate;
      }
    }
    
    return Object.keys(timeRange).length > 0 ? timeRange : undefined;
  }

  /**
   * 解析日期字符串
   * @param dateStr 日期字符串
   * @returns 日期对象
   */
  private static parseDate(dateStr: string): Date | undefined {
    try {
      // 支持多种日期格式
      const _formats = [
        /^(\d{4})-(\d{2})-(\d{2})$/, // YYYY-MM-DD
        /^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})$/, // YYYY-MM-DD HH:mm:ss
        /^(\d{4})\/(\d{2})\/(\d{2})$/, // YYYY/MM/DD
        /^(\d{10})$/, // Unix timestamp (seconds)
        /^(\d{13})$/, // Unix timestamp (milliseconds)
      ];
      
      // Unix timestamp
      if (/^\d{10}$/.test(dateStr)) {
        return new Date(parseInt(dateStr) * 1000);
      }
      
      if (/^\d{13}$/.test(dateStr)) {
        return new Date(parseInt(dateStr));
      }
      
      // 标准日期格式
      const date = new Date(dateStr);
      return isNaN(date.getTime()) ? undefined : date;
    } catch {
      return undefined;
    }
  }

  /**
   * 验证参数有效性
   * @param params 处理后的参数
   * @returns 验证结果
   */
  static validateParams(params: ProcessedParams): { valid: boolean; error?: string } {
    // 验证搜索关键词
    if (params.action === 'search' && !params.keyword) {
      return { valid: false, error: '搜索关键词不能为空' };
    }
    
    // 验证视频ID
    if (params.action === 'detail' && (!params.videoIds || params.videoIds.length === 0)) {
      return { valid: false, error: '视频ID不能为空' };
    }
    
    // 验证页码
    if (params.page < 1) {
      return { valid: false, error: '页码必须大于0' };
    }
    
    // 验证每页数量
    if (params.limit < this.MIN_LIMIT || params.limit > this.MAX_LIMIT) {
      return { valid: false, error: `每页数量必须在${this.MIN_LIMIT}-${this.MAX_LIMIT}之间` };
    }
    
    return { valid: true };
  }

  /**
   * 生成缓存键
   * @param params 处理后的参数
   * @returns 缓存键
   */
  static generateCacheKey(params: ProcessedParams): string {
    const keyParts = [
      `action:${params.action}`,
      `page:${params.page}`,
      `limit:${params.limit}`
    ];
    
    if (params.keyword) {
      keyParts.push(`keyword:${params.keyword}`);
    }
    
    if (params.categoryId) {
      keyParts.push(`category:${params.categoryId}`);
    }
    
    if (params.videoIds) {
      keyParts.push(`ids:${params.videoIds.join(',')}`);
    }
    
    if (params.filters.area) {
      keyParts.push(`area:${params.filters.area}`);
    }
    
    if (params.filters.year) {
      keyParts.push(`year:${params.filters.year}`);
    }
    
    if (params.filters.order) {
      keyParts.push(`order:${params.filters.order}`);
    }
    
    return keyParts.join('|');
  }
}