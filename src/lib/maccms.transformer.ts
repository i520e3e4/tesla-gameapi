/* eslint-disable @typescript-eslint/no-explicit-any */
import { EpornerSearchResponse,EpornerVideo } from './eporner.client';

// 苹果CMS V10 数据结构定义
export interface MacCMSVideo {
  vod_id: number;
  vod_name: string;
  vod_sub: string;
  vod_en: string;
  vod_status: number;
  vod_letter: string;
  vod_color: string;
  vod_tag: string;
  vod_class: string;
  vod_pic: string;
  vod_pic_thumb: string;
  vod_pic_slide: string;
  vod_pic_screenshot: string;
  vod_actor: string;
  vod_director: string;
  vod_writer: string;
  vod_behind: string;
  vod_blurb: string;
  vod_remarks: string;
  vod_pubdate: string;
  vod_total: number;
  vod_serial: string;
  vod_tv: string;
  vod_weekday: string;
  vod_area: string;
  vod_lang: string;
  vod_year: string;
  vod_version: string;
  vod_state: string;
  vod_author: string;
  vod_jumpurl: string;
  vod_tpl: string;
  vod_tpl_play: string;
  vod_tpl_down: string;
  vod_isend: number;
  vod_lock: number;
  vod_level: number;
  vod_copyright: number;
  vod_points: number;
  vod_points_play: number;
  vod_points_down: number;
  vod_hits: number;
  vod_hits_day: number;
  vod_hits_week: number;
  vod_hits_month: number;
  vod_duration: string;
  vod_up: number;
  vod_down: number;
  vod_score: string;
  vod_score_all: number;
  vod_score_num: number;
  vod_time: string;
  vod_time_add: string;
  vod_time_hits: string;
  vod_time_make: string;
  vod_trysee: number;
  vod_douban_id: number;
  vod_douban_score: string;
  vod_reurl: string;
  vod_rel_vod: string;
  vod_rel_art: string;
  vod_pwd: string;
  vod_pwd_url: string;
  vod_pwd_play: string;
  vod_pwd_play_url: string;
  vod_pwd_down: string;
  vod_pwd_down_url: string;
  vod_content: string;
  vod_play_from: string;
  vod_play_server: string;
  vod_play_note: string;
  vod_play_url: string;
  vod_down_from: string;
  vod_down_server: string;
  vod_down_note: string;
  vod_down_url: string;
  vod_plot: number;
  vod_plot_name: string;
  vod_plot_detail: string;
  type_id: number;
  type_name: string;
  group_id: number;
}

export interface MacCMSResponse {
  code: number;
  msg: string;
  page: number;
  pagecount: number;
  limit: number;
  total: number;
  list: MacCMSVideo[];
  class?: MacCMSCategory[];
}

export interface MacCMSCategory {
  type_id: number;
  type_name: string;
  type_en: string;
  type_sort: number;
  type_mid: number;
  type_pid: number;
  type_status: number;
}

// 数据转换器类
export class MacCMSTransformer {
  private static readonly DEFAULT_TYPE_ID = 3; // 默认分类ID（伦理片）
  private static readonly DEFAULT_TYPE_NAME = '伦理片';
  private static readonly DEFAULT_AREA = '欧美';
  private static readonly DEFAULT_LANG = '英语';

  /**
   * 将Eporner搜索结果转换为苹果CMS格式
   * @param epornerResponse Eporner API响应
   * @param page 当前页码
   * @param limit 每页数量
   * @returns 苹果CMS格式的响应
   */
  static transformSearchResponse(
    epornerResponse: EpornerSearchResponse,
    page = 1,
     limit = 20
  ): MacCMSResponse {
    const videos = epornerResponse.videos || [];
    const transformedVideos = videos.map((video, index) => 
      this.transformVideo(video, (page - 1) * limit + index + 1)
    );

    return {
      code: 1,
      msg: '数据列表',
      page: epornerResponse.current_page || page,
      pagecount: epornerResponse.total_pages || Math.ceil(epornerResponse.total_count / limit),
      limit: limit,
      total: epornerResponse.total_count || videos.length,
      list: transformedVideos
    };
  }

  /**
   * 将单个Eporner视频详情转换为苹果CMS格式
   * @param video Eporner视频对象
   * @returns 苹果CMS格式的响应
   */
  static transformVideoDetail(video: EpornerVideo): MacCMSResponse {
    const transformedVideo = this.transformVideo(video, parseInt(video.id, 36) || 1);
    
    return {
      code: 1,
      msg: '数据列表',
      page: 1,
      pagecount: 1,
      limit: 1,
      total: 1,
      list: [transformedVideo]
    };
  }

  /**
   * 将单个Eporner视频转换为苹果CMS格式
   * @param video Eporner视频对象
   * @param vodId 视频ID（用于苹果CMS）
   * @returns 苹果CMS格式的视频对象
   */
  static transformVideo(video: EpornerVideo, vodId: number): MacCMSVideo {
    const currentTime = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const addedDate = this.formatDate(video.added);
    const duration = this.formatDuration(video.length_sec);
    const thumbnail = this.getThumbnailUrl(video);
    const playUrl = this.generatePlayUrl(video);
    
    // 清理和处理标题
    const cleanTitle = this.cleanTitle(video.title);
    const firstLetter = this.getFirstLetter(cleanTitle);
    
    // 处理关键词作为标签
    const tags = this.processTags(video.keywords);
    
    // 生成内容描述
    const content = this.generateContent(video);

    return {
      vod_id: vodId,
      vod_name: cleanTitle,
      vod_sub: '',
      vod_en: this.generateEnglishName(cleanTitle),
      vod_status: 1,
      vod_letter: firstLetter,
      vod_color: '',
      vod_tag: tags,
      vod_class: '',
      vod_pic: thumbnail,
      vod_pic_thumb: thumbnail,
      vod_pic_slide: thumbnail,
      vod_pic_screenshot: this.generateScreenshots(video),
      vod_actor: '未知',
      vod_director: '未知',
      vod_writer: '',
      vod_behind: '',
      vod_blurb: cleanTitle,
      vod_remarks: `时长:${duration}`,
      vod_pubdate: addedDate,
      vod_total: 1,
      vod_serial: '1',
      vod_tv: '',
      vod_weekday: '',
      vod_area: this.DEFAULT_AREA,
      vod_lang: this.DEFAULT_LANG,
      vod_year: new Date(video.added).getFullYear().toString(),
      vod_version: '',
      vod_state: '完结',
      vod_author: 'Eporner',
      vod_jumpurl: '',
      vod_tpl: '',
      vod_tpl_play: '',
      vod_tpl_down: '',
      vod_isend: 1,
      vod_lock: 0,
      vod_level: 0,
      vod_copyright: 0,
      vod_points: 0,
      vod_points_play: 0,
      vod_points_down: 0,
      vod_hits: video.views || 0,
      vod_hits_day: 0,
      vod_hits_week: 0,
      vod_hits_month: 0,
      vod_duration: duration,
      vod_up: Math.floor((video.rate || 0) * 10), // 转换评分为点赞数
      vod_down: 0,
      vod_score: (video.rate || 0).toFixed(1),
      vod_score_all: Math.floor((video.rate || 0) * 10),
      vod_score_num: 1,
      vod_time: currentTime,
      vod_time_add: addedDate + ' 00:00:00',
      vod_time_hits: currentTime,
      vod_time_make: currentTime,
      vod_trysee: 0,
      vod_douban_id: 0,
      vod_douban_score: '',
      vod_reurl: '',
      vod_rel_vod: '',
      vod_rel_art: '',
      vod_pwd: '',
      vod_pwd_url: '',
      vod_pwd_play: '',
      vod_pwd_play_url: '',
      vod_pwd_down: '',
      vod_pwd_down_url: '',
      vod_content: content,
      vod_play_from: 'Eporner',
      vod_play_server: 'no',
      vod_play_note: '',
      vod_play_url: playUrl,
      vod_down_from: '',
      vod_down_server: '',
      vod_down_note: '',
      vod_down_url: '',
      vod_plot: 0,
      vod_plot_name: '',
      vod_plot_detail: '',
      type_id: this.DEFAULT_TYPE_ID,
      type_name: this.DEFAULT_TYPE_NAME,
      group_id: 0
    };
  }

  /**
   * 生成分类列表
   * @returns 苹果CMS格式的分类列表
   */
  static generateCategories(): MacCMSCategory[] {
    return [
      {
        type_id: 3,
        type_name: '伦理片',
        type_en: 'ethics',
        type_sort: 3,
        type_mid: 1,
        type_pid: 0,
        type_status: 1
      }
    ];
  }

  /**
   * 清理视频标题
   * @param title 原始标题
   * @returns 清理后的标题
   */
  private static cleanTitle(title: string): string {
    return title
      .replace(/[<>"'&]/g, '') // 移除HTML特殊字符
      .replace(/\s+/g, ' ') // 合并多个空格
      .trim()
      .substring(0, 100); // 限制长度
  }

  /**
   * 获取标题首字母
   * @param title 标题
   * @returns 首字母
   */
  private static getFirstLetter(title: string): string {
    const firstChar = title.charAt(0).toUpperCase();
    return /[A-Z]/.test(firstChar) ? firstChar : '#';
  }

  /**
   * 生成英文名称
   * @param title 中文标题
   * @returns 英文名称
   */
  private static generateEnglishName(title: string): string {
    // 简单的英文名生成逻辑
    return title.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '-');
  }

  /**
   * 处理标签
   * @param keywords 关键词字符串
   * @returns 处理后的标签
   */
  private static processTags(keywords: string): string {
    if (!keywords) return '';
    
    return keywords
      .split(/[,，;；\s]+/) // 按多种分隔符分割
      .filter(tag => tag.trim().length > 0)
      .slice(0, 10) // 限制标签数量
      .map(tag => tag.trim())
      .join(',');
  }

  /**
   * 格式化日期
   * @param dateString 日期字符串
   * @returns 格式化的日期
   */
  private static formatDate(dateString: string): string {
    try {
      const date = new Date(dateString);
      return date.toISOString().split('T')[0]; // YYYY-MM-DD
    } catch {
      return new Date().toISOString().split('T')[0];
    }
  }

  /**
   * 格式化时长
   * @param seconds 秒数
   * @returns 格式化的时长
   */
  private static formatDuration(seconds: number): string {
    if (!seconds || seconds <= 0) return '未知';
    
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
   * 获取缩略图URL
   * @param video 视频对象
   * @returns 缩略图URL
   */
  private static getThumbnailUrl(video: EpornerVideo): string {
    if (video.default_thumb?.src) {
      return video.default_thumb.src;
    }
    
    if (video.thumbs && video.thumbs.length > 0) {
      // 选择最大的缩略图
      const largestThumb = video.thumbs.reduce((prev, current) => {
        const prevSize = prev.width * prev.height;
        const currentSize = current.width * current.height;
        return currentSize > prevSize ? current : prev;
      });
      return largestThumb.src;
    }
    
    return '';
  }

  /**
   * 生成截图列表
   * @param video 视频对象
   * @returns 截图URL列表
   */
  private static generateScreenshots(video: EpornerVideo): string {
    const screenshots: string[] = [];
    
    // 添加默认缩略图
    if (video.default_thumb?.src) {
      screenshots.push(video.default_thumb.src);
    }
    
    // 添加其他缩略图
    if (video.thumbs && video.thumbs.length > 0) {
      video.thumbs.forEach(thumb => {
        if (thumb.src && !screenshots.includes(thumb.src)) {
          screenshots.push(thumb.src);
        }
      });
    }
    
    return screenshots.slice(0, 5).join('||'); // 最多5张截图，用||分隔
  }

  /**
   * 生成播放URL
   * @param video 视频对象
   * @returns 播放URL
   */
  private static generatePlayUrl(video: EpornerVideo): string {
    // 苹果CMS播放URL格式：播放源$播放地址
    const playName = `第1集`;
    const playUrl = video.embed || video.url || '';
    
    return `${playName}$${playUrl}`;
  }

  /**
   * 生成内容描述
   * @param video 视频对象
   * @returns 内容描述
   */
  private static generateContent(video: EpornerVideo): string {
    const parts: string[] = [];
    
    parts.push(`<p><strong>视频标题：</strong>${video.title}</p>`);
    
    if (video.keywords) {
      parts.push(`<p><strong>关键词：</strong>${video.keywords}</p>`);
    }
    
    parts.push(`<p><strong>时长：</strong>${this.formatDuration(video.length_sec)}</p>`);
    parts.push(`<p><strong>观看次数：</strong>${video.views?.toLocaleString() || '未知'}</p>`);
    
    if (video.rate) {
      parts.push(`<p><strong>评分：</strong>${video.rate.toFixed(1)}/10</p>`);
    }
    
    parts.push(`<p><strong>添加时间：</strong>${this.formatDate(video.added)}</p>`);
    parts.push(`<p><strong>来源：</strong>Eporner</p>`);
    
    return parts.join('\n');
  }

  /**
   * 生成错误响应
   * @param message 错误信息
   * @param code 错误代码
   * @returns 错误响应
   */
  static generateErrorResponse(message: string, code = 0): MacCMSResponse {
    return {
      code,
      msg: message,
      page: 1,
      pagecount: 0,
      limit: 20,
      total: 0,
      list: []
    };
  }

  /**
   * 生成空响应
   * @param message 消息
   * @returns 空响应
   */
  static generateEmptyResponse(message = '暂无数据'): MacCMSResponse {
    return {
      code: 1,
      msg: message,
      page: 1,
      pagecount: 0,
      limit: 20,
      total: 0,
      list: []
    };
  }
}