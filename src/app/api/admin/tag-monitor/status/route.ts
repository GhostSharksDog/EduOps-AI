import { NextRequest, NextResponse } from 'next/server';
import {getTagRefreshMonitorService} from '@/modules/tag/server';
import { log } from '@/platform/logger';
import {authMiddleware, getCurrentUser} from '@/modules/identity/server';
import { handleAPIError } from '@/platform/api-error-handler';

/**
 * GET /api/admin/tag-monitor/status
 *
 * 获取所有标签的刷新状态
 */
export async function GET(request: NextRequest) {
  // Security: Require authentication for admin endpoints
  const authError = await authMiddleware(request);
  if (authError) return authError;
  const user=getCurrentUser(request);
  if(!user)return NextResponse.json({error:'请先登录'},{status:401});

  try {
    const service = getTagRefreshMonitorService();
    const statuses = await service.checkAllRefreshStatus({tenantId:user.ownedBy});

    return NextResponse.json({
      success: true,
      data: statuses,
      total: statuses.length,
    });
  } catch (error) {
    log.error('GET /api/admin/tag-monitor/status - Error:', error);
    return handleAPIError(error);
  }
}
