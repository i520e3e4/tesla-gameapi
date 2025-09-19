import { NextResponse } from 'next/server';

import { getCacheTime, getConfig } from '@/lib/config';
import { SearchResult } from '@/lib/types';

export const runtime = 'edge';

// 专门处理成人内容API的函数
async function searchFromAdultApi(apiSite: any, query: string): Promise<SearchResult[]> {
  try {
    let apiUrl = apiSite.api;
    
    // 检查API格式，JSON格式的API不需要搜索参数
    const isJsonApi = apiSite.api.includes('/api/json.php');
    
    if (!isJsonApi) {
      // 标准格式的API需要添加搜索参数
      apiUrl = apiSite.api + '?ac=videolist&wd=' + encodeURIComponent(query);
    }
    
    // 添加超时处理
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 增加到10秒

    const response = await fetch(apiUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Cache-Control': 'no-cache',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(`成人内容API响应异常 (${apiSite.name}): ${response.status} ${response.statusText}`);
      return [];
    }

    const data = await response.json();
    if (
      !data ||
      !data.list ||
      !Array.isArray(data.list) ||
      data.list.length === 0
    ) {
      console.warn(`成人内容API数据为空 (${apiSite.name})`);
      return [];
    }

    // 处理结果
    const results = data.list.map((item: any) => {
      let episodes: string[] = [];

      // 使用正则表达式从 vod_play_url 提取 m3u8 链接
      if (item.vod_play_url) {
        const m3u8Matches = item.vod_play_url.match(/https?:\/\/[^\s]+\.m3u8[^\s]*/g);
        if (m3u8Matches) {
          episodes = m3u8Matches;
        }
      }

      return {
        id: item.vod_id || '',
        title: item.vod_name || '',
        poster: item.vod_pic || '',
        year: item.vod_year || '',
        type_name: item.type_name || '',
        episodes: episodes,
        source: apiSite.name || '',
        source_name: apiSite.name || '',
        desc: item.vod_content || item.vod_blurb || '',
      } as SearchResult;
    });

    console.log(`成人内容API成功 (${apiSite.name}): 获取到 ${results.length} 条数据`);
    return results;
  } catch (error) {
    console.error(`成人内容API错误 (${apiSite.name}):`, error);
    return [];
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q') || '热门';
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '20');
  const authToken = request.headers.get('x-adult-auth');

  // 检查成人内容访问权限
  if (!authToken || authToken !== 'authenticated') {
    return NextResponse.json(
      { error: '需要成人内容验证' },
      { 
        status: 403,
        headers: {
          'Content-Type': 'application/json',
        }
      }
    );
  }

  try {
    const config = await getConfig();

    // 只获取标记为成人内容的API站点，按优先级排序
    const adultApiSites = config.SourceConfig
      .filter((site) => !site.disabled && site.is_adult === true)
      .sort((a, b) => (a.priority || 999) - (b.priority || 999));

    if (adultApiSites.length === 0) {
      return NextResponse.json(
        { results: [], total: 0, page, limit },
        {
          headers: {
            'Cache-Control': 'public, max-age=300, s-maxage=300',
            'CDN-Cache-Control': 'public, s-maxage=300',
            'Vercel-CDN-Cache-Control': 'public, s-maxage=300',
          },
        }
      );
    }

    // 并行搜索所有成人内容站点
    const searchPromises = adultApiSites.map((site) => searchFromAdultApi(site, query));
    const results = await Promise.all(searchPromises);
    const flattenedResults = results.flat();

    // 统计API站点使用情况
    const apiStats = results.map((result, index) => ({
      site: adultApiSites[index].name,
      count: result.length,
      success: result.length > 0
    }));

    // 按时间排序（如果有时间字段）
    flattenedResults.sort((a, b) => {
      const timeA = new Date(a.year || '2020').getTime();
      const timeB = new Date(b.year || '2020').getTime();
      return timeB - timeA;
    });

    // 分页处理
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedResults = flattenedResults.slice(startIndex, endIndex);

    const cacheTime = await getCacheTime();

    return NextResponse.json(
      {
        results: paginatedResults,
        total: flattenedResults.length,
        page,
        limit,
        hasMore: endIndex < flattenedResults.length,
        apiStats: apiStats,
        totalApis: adultApiSites.length,
        successfulApis: apiStats.filter(stat => stat.success).length
      },
      {
        headers: {
          'Cache-Control': `public, max-age=${cacheTime}, s-maxage=${cacheTime}`,
          'CDN-Cache-Control': `public, s-maxage=${cacheTime}`,
          'Vercel-CDN-Cache-Control': `public, s-maxage=${cacheTime}`,
        },
      }
    );
  } catch (error) {
    return NextResponse.json({ error: '获取成人内容失败' }, { status: 500 });
  }
}
