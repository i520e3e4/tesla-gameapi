import { NextRequest, NextResponse } from 'next/server';

import { getCacheTime } from '@/lib/config';
import { EpornerClient,epornerClient } from '@/lib/eporner.client';
import { 
  MacCMSCacheManager, 
  MacCMSErrorHandler, 
  MacCMSPerformanceMonitor,
  MacCMSRetryHandler} from '@/lib/maccms.cache';
import { MacCMSParamsProcessor } from '@/lib/maccms.params';
import { MacCMSTransformer } from '@/lib/maccms.transformer';

export const runtime = 'edge';

// 苹果CMS V10兼容接口
export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const operation = 'maccms_api_request';
  
  try {
    const searchParams = request.nextUrl.searchParams;
    const params = MacCMSParamsProcessor.processParams(searchParams);
    
    // 验证参数
    const validation = MacCMSParamsProcessor.validateParams(params);
    if (!validation.valid) {
      const error = MacCMSErrorHandler.handleValidationError(validation.error!);
      MacCMSErrorHandler.logError(error, 'Parameter Validation');
      const errorResponse = MacCMSErrorHandler.createErrorResponse(error);
      return MacCMSCacheManager.createCachedResponse(errorResponse, 'error');
    }
    
    const cacheTime = await getCacheTime();
    
    // 根据操作类型分发请求
    let response: NextResponse;
    switch (params.action) {
      case 'search':
        response = await handleVideoSearch(params, cacheTime);
        break;
      
      case 'detail':
        response = await handleVideoDetail(params, cacheTime);
        break;
      
      case 'list':
        response = await handleVideoList(params, cacheTime);
        break;
      
      case 'category':
        response = await handleCategoryList(cacheTime);
        break;
      
      default: {
        const error = MacCMSErrorHandler.handleValidationError('不支持的操作类型');
        MacCMSErrorHandler.logError(error, 'Action Validation');
        const errorResponse = MacCMSErrorHandler.createErrorResponse(error);
        return MacCMSCacheManager.createCachedResponse(errorResponse, 'error');
      }
    }
    
    // 记录性能指标
    MacCMSPerformanceMonitor.recordExecutionTime(operation, startTime);
    MacCMSPerformanceMonitor.recordExecutionTime(`${operation}_${params.action}`, startTime);
    
    return response;
  } catch (error) {
    const errorDetail = MacCMSErrorHandler.handleApiError(error);
    MacCMSErrorHandler.logError(errorDetail, 'MacCMS API');
    
    // 记录错误性能指标
    MacCMSPerformanceMonitor.recordExecutionTime(`${operation}_error`, startTime);
    
    const errorResponse = MacCMSErrorHandler.createErrorResponse(errorDetail);
    return MacCMSCacheManager.createCachedResponse(errorResponse, 'error');
  }
}

// 处理视频搜索
async function handleVideoSearch(params: any, _cacheTime: number) {
  const startTime = Date.now();
  
  if (!params.keyword) {
    const error = MacCMSErrorHandler.handleValidationError('请提供搜索关键词');
    const errorResponse = MacCMSErrorHandler.createErrorResponse(error);
    return MacCMSCacheManager.createCachedResponse(errorResponse, 'error');
  }

  // 清理搜索关键词
  const cleanQuery = EpornerClient.sanitizeQuery(params.keyword);
  if (!cleanQuery) {
    const error = MacCMSErrorHandler.handleValidationError('搜索关键词无效');
    const errorResponse = MacCMSErrorHandler.createErrorResponse(error);
    return MacCMSCacheManager.createCachedResponse(errorResponse, 'error');
  }

  try {
    // 使用重试机制调用eporner API进行搜索
    const results = await MacCMSRetryHandler.withRetry(async () => {
      return await epornerClient.search(
        cleanQuery,
        params.page,
        Math.min(params.limit, 60), // eporner API最大支持60条
        params.filters.order || 'latest'
      );
    }, 3, 1000);
    
    // 转换为苹果CMS格式
    const maccmsData = MacCMSTransformer.transformSearchResponse(results, params.page, params.limit);
    
    // 记录性能指标
    MacCMSPerformanceMonitor.recordExecutionTime('video_search', startTime);
    
    return MacCMSCacheManager.createCachedResponse(maccmsData, 'search');
  } catch (error) {
    const errorDetail = MacCMSErrorHandler.handleApiError(error);
    MacCMSErrorHandler.logError(errorDetail, 'Video Search');
    
    const errorResponse = MacCMSErrorHandler.createErrorResponse(errorDetail);
    return MacCMSCacheManager.createCachedResponse(errorResponse, 'error');
  }
}

// 处理视频详情
async function handleVideoDetail(params: any, _cacheTime: number) {
  const startTime = Date.now();
  
  if (!params.videoIds || params.videoIds.length === 0) {
    const error = MacCMSErrorHandler.handleValidationError('请提供视频ID');
    const errorResponse = MacCMSErrorHandler.createErrorResponse(error);
    return MacCMSCacheManager.createCachedResponse(errorResponse, 'error');
  }

  try {
    const videoList = [];
    
    // 处理多个视频ID
    for (const id of params.videoIds.slice(0, 10)) { // 限制最多10个
      try {
        // 使用重试机制获取视频详情
        const detail = await MacCMSRetryHandler.withRetry(async () => {
          return await epornerClient.getVideoById(id);
        }, 2, 500); // 详情请求使用较少的重试次数
        
        const transformedVideo = MacCMSTransformer.transformVideo(detail, parseInt(id, 36) || 1);
        videoList.push(transformedVideo);
      } catch (error) {
        const errorDetail = MacCMSErrorHandler.handleApiError(error);
        MacCMSErrorHandler.logError(errorDetail, `Video Detail ${id}`);
        // 继续处理其他视频，不中断整个请求
      }
    }
    
    if (videoList.length === 0) {
      const error = MacCMSErrorHandler.handleValidationError('未找到有效的视频数据');
      const errorResponse = MacCMSErrorHandler.createErrorResponse(error);
      return MacCMSCacheManager.createCachedResponse(errorResponse, 'error');
    }
    
    const maccmsData = {
      code: 1,
      msg: '数据列表',
      page: 1,
      pagecount: 1,
      limit: videoList.length,
      total: videoList.length,
      list: videoList
    };
    
    // 记录性能指标
    MacCMSPerformanceMonitor.recordExecutionTime('video_detail', startTime);
    
    return MacCMSCacheManager.createCachedResponse(maccmsData, 'detail');
  } catch (error) {
    const errorDetail = MacCMSErrorHandler.handleApiError(error);
    MacCMSErrorHandler.logError(errorDetail, 'Video Detail');
    
    const errorResponse = MacCMSErrorHandler.createErrorResponse(errorDetail);
    return MacCMSCacheManager.createCachedResponse(errorResponse, 'error');
  }
}



// 处理视频列表
async function handleVideoList(params: any, _cacheTime: number) {
  const startTime = Date.now();
  
  try {
    // 默认搜索热门内容
    const defaultQuery = 'popular';
    
    // 使用重试机制获取视频列表
    const results = await MacCMSRetryHandler.withRetry(async () => {
      return await epornerClient.search(
        defaultQuery,
        params.page,
        Math.min(params.limit, 60),
        params.filters.order || 'latest'
      );
    }, 3, 1000);
    
    const maccmsData = MacCMSTransformer.transformSearchResponse(results, params.page, params.limit);
    
    // 记录性能指标
    MacCMSPerformanceMonitor.recordExecutionTime('video_list', startTime);
    
    return MacCMSCacheManager.createCachedResponse(maccmsData, 'search');
  } catch (error) {
    const errorDetail = MacCMSErrorHandler.handleApiError(error);
    MacCMSErrorHandler.logError(errorDetail, 'Video List');
    
    const errorResponse = MacCMSErrorHandler.createErrorResponse(errorDetail);
    return MacCMSCacheManager.createCachedResponse(errorResponse, 'error');
  }
}

// 处理分类列表
async function handleCategoryList(_cacheTime: number) {
  const startTime = Date.now();
  
  try {
    // 返回固定的分类列表
    const categories = MacCMSTransformer.generateCategories();
    
    const categoryData = {
      code: 1,
      msg: '数据列表',
      page: 1,
      pagecount: 1,
      limit: categories.length,
      total: categories.length,
      class: categories
    };
    
    // 记录性能指标
    MacCMSPerformanceMonitor.recordExecutionTime('category_list', startTime);
    
    return MacCMSCacheManager.createCachedResponse(categoryData, 'category');
  } catch (error) {
    const errorDetail = MacCMSErrorHandler.handleApiError(error);
    MacCMSErrorHandler.logError(errorDetail, 'Category List');
    
    const errorResponse = MacCMSErrorHandler.createErrorResponse(errorDetail);
    return MacCMSCacheManager.createCachedResponse(errorResponse, 'error');
  }
}

// 从Eporner API获取数据
async function _fetchFromEporner(endpoint: string, params: Record<string, string>) {
  const baseUrl = 'https://www.eporner.com/api/v2/video';
  let url = '';
  
  switch (endpoint) {
    case 'search':
      url = `${baseUrl}/search?query=${encodeURIComponent(params.query || '')}&per_page=60&page=${params.page || '1'}&thumbsize=big&order=latest&gay=0&lq=1&format=json`;
      break;
    case 'id':
      url = `${baseUrl}/id?id=${params.id}&thumbsize=big&format=json`;
      break;
    default:
      throw new Error('不支持的Eporner端点');
  }
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);
  
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'application/json',
      },
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`Eporner API请求失败: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

// 将Eporner数据转换为苹果CMS格式
function _convertEpornerToMaccms(epornerData: any, type: 'search' | 'detail' | 'list') {
  if (!epornerData) {
    return {
      code: 1,
      msg: '数据列表',
      page: 1,
      pagecount: 1,
      limit: '20',
      total: 0,
      list: []
    };
  }
  
  let videos: any[] = [];
  let total = 0;
  let currentPage = 1;
  let totalPages = 1;
  
  if (type === 'detail' && epornerData.id) {
    // 单个视频详情
    videos = [convertSingleVideo(epornerData)];
    total = 1;
  } else if (epornerData.videos && Array.isArray(epornerData.videos)) {
    // 视频列表
    videos = epornerData.videos.map(convertSingleVideo);
    total = epornerData.total_count || videos.length;
    currentPage = epornerData.current_page || 1;
    totalPages = epornerData.total_pages || 1;
  }
  
  return {
    code: 1,
    msg: '数据列表',
    page: currentPage,
    pagecount: totalPages,
    limit: '60',
    total: total,
    list: videos
  };
}

// 转换单个视频数据
function convertSingleVideo(video: any) {
  const duration = video.length_sec ? Math.floor(video.length_sec / 60) : 0;
  const year = video.added ? new Date(video.added).getFullYear() : new Date().getFullYear();
  
  return {
    vod_id: video.id || '',
    vod_name: video.title || '',
    vod_sub: '',
    vod_en: '',
    vod_status: 1,
    vod_letter: '',
    vod_color: '',
    vod_tag: video.keywords || '',
    vod_class: '成人',
    vod_pic: video.default_thumb?.src || '',
    vod_pic_thumb: video.default_thumb?.src || '',
    vod_pic_slide: '',
    vod_pic_screenshot: '',
    vod_actor: '',
    vod_director: '',
    vod_writer: '',
    vod_behind: '',
    vod_blurb: '',
    vod_remarks: `${duration}分钟`,
    vod_pubdate: video.added || '',
    vod_total: 1,
    vod_serial: '',
    vod_tv: '',
    vod_weekday: '',
    vod_area: '',
    vod_lang: '',
    vod_year: year,
    vod_version: '',
    vod_state: '',
    vod_author: '',
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
    vod_duration: video.length_sec || 0,
    vod_up: 0,
    vod_down: 0,
    vod_score: video.rate || 0,
    vod_score_all: 0,
    vod_score_num: 0,
    vod_time: video.added || '',
    vod_time_add: Math.floor(Date.now() / 1000),
    vod_time_hits: Math.floor(Date.now() / 1000),
    vod_time_make: Math.floor(Date.now() / 1000),
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
    vod_content: video.title || '',
    vod_play_from: 'eporner',
    vod_play_server: 'no',
    vod_play_note: '',
    vod_play_url: `第1集$${video.embed || video.url || ''}`,
    vod_down_from: '',
    vod_down_server: '',
    vod_down_note: '',
    vod_down_url: '',
    type_id: 1,
    type_name: '成人',
    type_pid: 0,
    group_id: 0
  };
}

// 根据分类ID获取查询关键词
function _getCategoryQuery(categoryId: string): string {
  const categoryMap: Record<string, string> = {
    '1': 'european american', // 欧美
    '2': 'japanese', // 日本
    '3': 'asian', // 亚洲
    '4': 'chinese', // 国产
  };
  
  return categoryMap[categoryId] || '';
}