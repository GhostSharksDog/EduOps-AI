import {withCompanyRoute} from '@/modules/identity/server';
import { NextRequest, NextResponse } from 'next/server';
import {getTagRefreshMonitorService} from '@/modules/tag/server';
import { log } from '@/platform/logger';
import {authMiddleware, getCurrentUser} from '@/modules/identity/server';
import { handleAPIError } from '@/platform/api-error-handler';

/**
 * GET /api/admin/tag-monitor/errors
 *
 * 获取未解决的刷新错误列表
 */
async function GETHandler(request: NextRequest) {
  const authError = await authMiddleware(request);
  if (authError) return authError;
  const user=getCurrentUser(request);
  if(!user)return NextResponse.json({error:'请先登录'},{status:401});

  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '100', 10);

    if (isNaN(limit) || limit < 1 || limit > 1000) {
      return NextResponse.json(
        { error: '无效的 limit 参数' },
        { status: 400 }
      );
    }

    const service = getTagRefreshMonitorService();
    const errors = await service.getUnresolvedErrors(limit,{tenantId:user.ownedBy});

    return NextResponse.json({
      success: true,
      data: errors,
      total: errors.length,
    });
  } catch (error) {
    log.error('GET /api/admin/tag-monitor/errors - Error:', error);
    return handleAPIError(error);
  }
}

export const GET=withCompanyRoute(GETHandler);
