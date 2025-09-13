/* eslint-disable @typescript-eslint/no-explicit-any */

// Eporner API 响应类型定义
export interface EpornerVideo {
  id: string;
  title: string;
  keywords: string;
  views: number;
  rate: number;
  url: string;
  embed: string;
  added: string;
  length_sec: number;
  default_thumb: {
    src: string;
    width: number;
    height: number;
  };
  thumbs: Array<{
    src: string;
    width: number;
    height: number;
  }>;
}

export interface EpornerSearchResponse {
  total_count: number;
  current_page: number;
  total_pages: number;
  videos: EpornerVideo[];
}

export interface EpornerDetailResponse extends EpornerVideo {
  // 详情接口返回的是单个视频对象
}

// Eporner API 客户端类
export class EpornerClient {
  private readonly baseUrl = 'https://www.eporner.com/api/v2/video';
  private readonly defaultHeaders = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Accept': 'application/json',
  };
  private readonly timeout = 10000; // 10秒超时

  /**
   * 搜索视频
   * @param query 搜索关键词
   * @param page 页码，默认为1
   * @param perPage 每页数量，默认为60
   * @param order 排序方式，默认为latest
   * @returns 搜索结果
   */
  async search(
    query: string,
    page: number = 1,
    perPage: number = 60,
    order: 'latest' | 'longest' | 'shortest' | 'top-rated' | 'most-viewed' = 'latest'
  ): Promise<EpornerSearchResponse> {
    const params = new URLSearchParams({
      query: query.trim(),
      per_page: perPage.toString(),
      page: page.toString(),
      thumbsize: 'big',
      order,
      gay: '0', // 排除同性内容
      lq: '1', // 包含低质量内容
      format: 'json'
    });

    const url = `${this.baseUrl}/search/?${params.toString()}`;
    return this.makeRequest<EpornerSearchResponse>(url);
  }

  /**
   * 根据ID获取视频详情
   * @param id 视频ID
   * @returns 视频详情
   */
  async getVideoById(id: string): Promise<EpornerDetailResponse> {
    const params = new URLSearchParams({
      id: id.trim(),
      thumbsize: 'big',
      format: 'json'
    });

    const url = `${this.baseUrl}/id/?${params.toString()}`;
    return this.makeRequest<EpornerDetailResponse>(url);
  }

  /**
   * 获取已删除的视频列表
   * @param page 页码，默认为1
   * @param perPage 每页数量，默认为60
   * @returns 已删除视频列表
   */
  async getRemovedVideos(
    page: number = 1,
    perPage: number = 60
  ): Promise<{ videos: Array<{ id: string; deleted: string }> }> {
    const params = new URLSearchParams({
      per_page: perPage.toString(),
      page: page.toString(),
      format: 'json'
    });

    const url = `${this.baseUrl}/removed/?${params.toString()}`;
    return this.makeRequest(url);
  }

  /**
   * 发起HTTP请求的通用方法
   * @param url 请求URL
   * @returns 响应数据
   */
  private async makeRequest<T = any>(url: string): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        headers: this.defaultHeaders,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Eporner API请求失败: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      // 检查API返回的错误
      if (data.error) {
        throw new Error(`Eporner API错误: ${data.error}`);
      }

      return data as T;
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Error('Eporner API请求超时');
        }
        throw error;
      }
      
      throw new Error('Eporner API请求失败');
    }
  }

  /**
   * 验证视频ID格式
   * @param id 视频ID
   * @returns 是否有效
   */
  static isValidVideoId(id: string): boolean {
    // Eporner视频ID通常是字母数字组合
    return /^[a-zA-Z0-9]+$/.test(id.trim());
  }

  /**
   * 清理搜索关键词
   * @param query 原始关键词
   * @returns 清理后的关键词
   */
  static sanitizeQuery(query: string): string {
    return query
      .trim()
      .replace(/[<>"'&]/g, '') // 移除可能的HTML字符
      .substring(0, 100); // 限制长度
  }

  /**
   * 获取视频缩略图URL
   * @param video 视频对象
   * @param size 缩略图尺寸偏好
   * @returns 缩略图URL
   */
  static getThumbnailUrl(video: EpornerVideo, size: 'small' | 'medium' | 'large' = 'large'): string {
    if (video.default_thumb?.src) {
      return video.default_thumb.src;
    }

    if (video.thumbs && video.thumbs.length > 0) {
      // 根据尺寸偏好选择缩略图
      const sortedThumbs = video.thumbs.sort((a, b) => {
        const aSize = a.width * a.height;
        const bSize = b.width * b.height;
        
        if (size === 'small') {
          return aSize - bSize; // 升序，选择最小的
        } else if (size === 'large') {
          return bSize - aSize; // 降序，选择最大的
        } else {
          // medium: 选择中等大小的
          const targetSize = 300 * 200; // 目标尺寸
          const aDiff = Math.abs(aSize - targetSize);
          const bDiff = Math.abs(bSize - targetSize);
          return aDiff - bDiff;
        }
      });
      
      return sortedThumbs[0].src;
    }

    return ''; // 没有可用的缩略图
  }

  /**
   * 格式化视频时长
   * @param seconds 秒数
   * @returns 格式化的时长字符串
   */
  static formatDuration(seconds: number): string {
    if (!seconds || seconds <= 0) {
      return '未知';
    }

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    } else {
      return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
  }

  /**
   * 格式化视频添加时间
   * @param dateString 日期字符串
   * @returns 格式化的日期
   */
  static formatAddedDate(dateString: string): string {
    try {
      const date = new Date(dateString);
      return date.toISOString().split('T')[0]; // 返回 YYYY-MM-DD 格式
    } catch {
      return dateString; // 如果解析失败，返回原字符串
    }
  }
}

// 导出默认实例
export const epornerClient = new EpornerClient();