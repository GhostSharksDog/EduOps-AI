import {withCompanyRoute} from '@/modules/identity/server';
import { NextRequest, NextResponse } from 'next/server';
import {getTagRefreshMonitorService} from '@/modules/tag/server';
import { log } from '@/platform/logger';
import {authMiddleware, getCurrentUser} from '@/modules/identity/server';
import { handleAPIError } from '@/platform/api-error-handler';
import {MESSAGES} from '@/shared/messages/index';

/**
 * POST /api/admin/tag-monitor/errors/[logId]/resolve
 *
 * 标记刷新错误为已解决
 */
async function POSTHandler(
  request: NextRequest,
  { params }: { params: Promise<{ logId: string }> }
) {
  const authError = await authMiddleware(request);
  if (authError) return authError;
  const user=getCurrentUser(request);
  if(!user)return NextResponse.json({error:'请先登录'},{status:401});

  const { logId } = await params;

  try {
    const service = getTagRefreshMonitorService();
    await service.markErrorResolved(logId,{tenantId:user.ownedBy});

    return NextResponse.json({
      success: true,
      message: MESSAGES.API_RESPONSE.ERROR_RESOLVED,
    });
  } catch (error) {
    log.error('POST /api/admin/tag-monitor/errors/[logId]/resolve - Error:', error);
    return handleAPIError(error);
  }
}

export const POST=withCompanyRoute(POSTHandler);
