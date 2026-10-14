import { NextRequest, NextResponse } from 'next/server';
import {riskTagRouteAuth as authMiddleware} from '@/modules/tag/server';
import {getTagActivationApplicationService} from '@/modules/tag/server';
import {ResumeTagCommand} from '@/modules/tag/server';
import { log } from '@/platform/logger';
import { handleAPIError } from '@/platform/api-error-handler';
import {withAudit} from '@/modules/system/server';
import { config } from '@/platform/config/index';
import {MESSAGES} from '@/shared/messages/index';

/**
 * POST /api/tags/:tagId/resume
 * 
 * 恢复标签 - 恢复物化视图刷新
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = await authMiddleware(request);
  if (authError) return authError;

  const { id: tagId } = await params;

  try {
    const service = getTagActivationApplicationService();
    const userId = request.headers.get('x-user-id') ?? config.system.userId;
    const command = new ResumeTagCommand(tagId, userId);
    await service.resumeTag(command);

    await withAudit(request, { entityId: tagId, action: 'RESTORE' });
    return NextResponse.json({
      success: true,
      message: MESSAGES.API_RESPONSE.TAG_RESUMED
    });
  } catch (error) {
    log.error('POST /api/tags/[id]/resume - Error:', error);
    return handleAPIError(error);
  }
}
