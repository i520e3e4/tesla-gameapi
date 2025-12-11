import { exec } from 'child_process';
import { promisify } from 'util';

import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';
import { getConfig } from '@/lib/config';

export const runtime = 'edge';

const execAsync = promisify(exec);

/**
 * 管理员手动触发配置同步接口
 * POST /api/server-config/sync
 */
export async function POST(request: NextRequest) {
  try {
    // 权限检查
    const authInfo = getAuthInfoFromCookie(request);
    if (!authInfo || !authInfo.username) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const username = authInfo.username;
    const config = await getConfig();

    // 检查是否是 owner 或 admin
    let isAdmin = false;
    if (username === process.env.USERNAME) {
      isAdmin = true;
    } else {
      const user = config.UserConfig.Users.find((u) => u.username === username);
      if (user && user.role === 'admin') {
        isAdmin = true;
      }
    }

    if (!isAdmin) {
      return NextResponse.json(
        { error: '需要管理员权限' },
        { status: 403 }
      );
    }

    // 获取配置源参数
    const body = await request.json().catch(() => ({}));
    const source = body.source || 'jin18';

    if (!['jin18', 'jingjian', 'full'].includes(source)) {
      return NextResponse.json(
        { error: '无效的配置源，可选: jin18, jingjian, full' },
        { status: 400 }
      );
    }

    console.log(`[Config Sync] 管理员触发同步，配置源: ${source}`);

    // 执行同步脚本
    const { stdout, stderr } = await execAsync(
      `node scripts/sync-api-config.js ${source}`,
      {
        cwd: process.cwd(),
        timeout: 30000, // 30秒超时
      }
    );

    if (stderr && !stderr.includes('warning')) {
      console.error('[Config Sync] Error:', stderr);
    }

    console.log('[Config Sync] Output:', stdout);

    // 解析输出以获取统计信息
    const stats = {
      success: true,
      source,
      timestamp: new Date().toISOString(),
      output: stdout,
    };

    return NextResponse.json({
      success: true,
      message: '配置同步成功',
      stats,
    });
  } catch (error) {
    console.error('[Config Sync] Failed:', error);

    const errorMessage =
      error instanceof Error ? error.message : '配置同步失败';

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}

/**
 * 获取同步状态
 * GET /api/server-config/sync
 */
export async function GET(request: NextRequest) {
  try {
    // 权限检查
    const authInfo = getAuthInfoFromCookie(request);
    if (!authInfo || !authInfo.username) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const username = authInfo.username;
    const config = await getConfig();

    // 检查是否是 owner 或 admin
    let isAdmin = false;
    if (username === process.env.USERNAME) {
      isAdmin = true;
    } else {
      const user = config.UserConfig.Users.find((u) => u.username === username);
      if (user && user.role === 'admin') {
        isAdmin = true;
      }
    }

    if (!isAdmin) {
      return NextResponse.json(
        { error: '需要管理员权限' },
        { status: 403 }
      );
    }

    // 读取配置文件信息
    const fs = await import('fs/promises');
    const path = await import('path');

    const configPath = path.join(process.cwd(), 'config.json');

    try {
      const stats = await fs.stat(configPath);
      const config = JSON.parse(await fs.readFile(configPath, 'utf-8'));

      const apiCount = Object.keys(config.api_site || {}).length;
      const localApiCount = Object.values(config.api_site || {}).filter(
        (api: any) => api._local === true
      ).length;

      return NextResponse.json({
        success: true,
        config: {
          lastModified: stats.mtime,
          totalApis: apiCount,
          localCustomApis: localApiCount,
          syncedApis: apiCount - localApiCount,
        },
      });
    } catch (err) {
      return NextResponse.json(
        { error: '无法读取配置文件' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('[Config Sync] Status check failed:', error);

    return NextResponse.json(
      { error: '获取同步状态失败' },
      { status: 500 }
    );
  }
}
