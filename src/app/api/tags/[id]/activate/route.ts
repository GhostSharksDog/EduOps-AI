import { NextRequest, NextResponse } from 'next/server';
import {riskTagRouteAuth as authMiddleware} from '@/modules/tag/server';
import {getTagActivationApplicationService} from '@/modules/tag/server';
import {ActivateTagCommand} from '@/modules/tag/server';
import { log } from '@/platform/logger';
import { handleAPIError } from '@/platform/api-error-handler';
import {withAudit} from '@/modules/system/server';
import { config } from '@/platform/config/index';

/**
 * PUT /api/tags/:tagId/activate
 * 
 * 激活标签 - 开始物化视图刷新
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = await authMiddleware(request);
  if (authError) return authError;

  const { id: tagId } = await params;

  try {
    const service = getTagActivationApplicationService();
    const userId = request.headers.get('x-user-id') ?? config.system.userId;
    const command = new ActivateTagCommand(tagId, userId);

    const result = await service.activateTag(command);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || '激活失败' },
        { status: 400 }
      );
    }

    await withAudit(request, { entityId: tagId });
    return NextResponse.json({
      success: true,
      mvNames: result.mvNames,
      targetTableNames: result.targetTableNames,
      bitPosition: result.bitPosition,
      bitmapTableId: result.bitmapTableId,
    });
  } catch (error) {
    log.error('PUT /api/tags/[id]/activate - Error:', error);
    return handleAPIError(error);
  }
}