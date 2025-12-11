import { NextRequest, NextResponse } from 'next/server';

/**
 * CORS 代理接口
 * 用于代理被墙或有 CORS 限制的 API 请求
 * 
 * 使用方式:
 * GET /api/cors-proxy?url=<目标URL>
 * POST /api/cors-proxy?url=<目标URL> (带请求体)
 */

const TIMEOUT_MS = 10000; // 10秒超时
const MAX_RETRIES = 2;

interface ProxyRequestOptions {
  url: string;
  method: string;
  headers?: Record<string, string>;
  body?: string;
}

/**
 * 执行代理请求
 */
async function proxyRequest(
  options: ProxyRequestOptions,
  retries = 0
): Promise<Response> {
  const { url, method, headers, body } = options;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const response = await fetch(url, {
      method,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        ...headers,
      },
      body: method !== 'GET' && method !== 'HEAD' ? body : undefined,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    if (retries < MAX_RETRIES) {
      console.log(`Retry ${retries + 1}/${MAX_RETRIES} for ${url}`);
      await new Promise((resolve) => setTimeout(resolve, 500));
      return proxyRequest(options, retries + 1);
    }
    throw error;
  }
}

/**
 * GET 请求处理
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const targetUrl = searchParams.get('url');

  if (!targetUrl) {
    return NextResponse.json(
      { error: '缺少 url 参数' },
      { status: 400 }
    );
  }

  // 验证 URL 格式
  try {
    new URL(targetUrl);
  } catch {
    return NextResponse.json(
      { error: '无效的 URL 格式' },
      { status: 400 }
    );
  }

  try {
    console.log(`[CORS Proxy] GET ${targetUrl}`);

    const response = await proxyRequest({
      url: targetUrl,
      method: 'GET',
    });

    // 读取响应数据
    const data = await response.text();

    // 尝试解析为 JSON
    let contentType = 'application/json';
    let responseData: string | object = data;

    try {
      responseData = JSON.parse(data);
    } catch {
      // 如果不是 JSON，保持原始文本
      contentType = response.headers.get('content-type') || 'text/plain';
    }

    // 返回代理响应
    return new NextResponse(
      typeof responseData === 'string' ? responseData : JSON.stringify(responseData),
      {
        status: response.status,
        headers: {
          'Content-Type': contentType,
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          'Cache-Control': 'public, max-age=300', // 缓存5分钟
        },
      }
    );
  } catch (error) {
    console.error('[CORS Proxy] Error:', error);

    const errorMessage = error instanceof Error ? error.message : '代理请求失败';

    return NextResponse.json(
      { error: errorMessage },
      {
        status: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
        }
      }
    );
  }
}

/**
 * POST 请求处理
 */
export async function POST(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const targetUrl = searchParams.get('url');

  if (!targetUrl) {
    return NextResponse.json(
      { error: '缺少 url 参数' },
      { status: 400 }
    );
  }

  try {
    new URL(targetUrl);
  } catch {
    return NextResponse.json(
      { error: '无效的 URL 格式' },
      { status: 400 }
    );
  }

  try {
    console.log(`[CORS Proxy] POST ${targetUrl}`);

    const body = await request.text();
    const headers: Record<string, string> = {};

    // 转发 Content-Type
    const contentType = request.headers.get('content-type');
    if (contentType) {
      headers['Content-Type'] = contentType;
    }

    const response = await proxyRequest({
      url: targetUrl,
      method: 'POST',
      headers,
      body,
    });

    const data = await response.text();
    let responseData: string | object = data;
    let responseContentType = 'application/json';

    try {
      responseData = JSON.parse(data);
    } catch {
      responseContentType = response.headers.get('content-type') || 'text/plain';
    }

    return new NextResponse(
      typeof responseData === 'string' ? responseData : JSON.stringify(responseData),
      {
        status: response.status,
        headers: {
          'Content-Type': responseContentType,
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
      }
    );
  } catch (error) {
    console.error('[CORS Proxy] Error:', error);

    const errorMessage = error instanceof Error ? error.message : '代理请求失败';

    return NextResponse.json(
      { error: errorMessage },
      {
        status: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
        }
      }
    );
  }
}

/**
 * OPTIONS 请求处理（CORS 预检）
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  });
}
