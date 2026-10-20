import {withCompanyRoute} from '@/modules/identity/server';
import { NextRequest, NextResponse } from 'next/server';
import {riskTagRouteAuth as authMiddleware} from '@/modules/tag/server';
import {getTagActivationApplicationService} from '@/modules/tag/server';
import {RebuildMvCommand} from '@/modules/tag/server';
import { log } from '@/platform/logger';
import { handleAPIError } from '@/platform/api-error-handler';
import {withAudit} from '@/modules/system/server';
import { config } from '@/platform/config/index';

/**
 * PUT /api/tags/:tagId/rebuild
 *
 * 根据当前版本重建物化视图（幂等操作）
 */
async function PUTHandler(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = await authMiddleware(request);
  if (authError) return authError;

  const { id: tagId } = await params;

  try {
    const service = getTagActivationApplicationService();
    const userId = request.headers.get('x-user-id') ?? config.system.userId;
    const command = new RebuildMvCommand(tagId, userId);

    const result = await service.rebuildMv(command);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || '重建失败' },
        { status: 400 }
      );
    }

    await withAudit(request, { entityId: tagId });
    return NextResponse.json({
      success: true,
      mvNames: result.mvNames,
      tableNames: result.tableNames,
    });
  } catch (error) {
    log.error('PUT /api/tags/[id]/rebuild - Error:', error);
    return handleAPIError(error);
  }
}

export const PUT=withCompanyRoute(PUTHandler);
