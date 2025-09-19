import { NextResponse } from 'next/server';

import { getCacheTime, getConfig } from '@/lib/config';
import { searchFromApi } from '@/lib/downstream';

export const runtime = 'edge';

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

    // 只获取标记为成人内容的API站点
    const adultApiSites = config.SourceConfig.filter((site) =>
      !site.disabled && site.is_adult === true
    );

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
    const searchPromises = adultApiSites.map((site) => searchFromApi(site, query));
    const results = await Promise.all(searchPromises);
    const flattenedResults = results.flat();

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
        hasMore: endIndex < flattenedResults.length
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
