import { NextRequest, NextResponse } from 'next/server';
import {riskTagRouteAuth as authMiddleware} from '@/modules/tag/server';
import {getTagActivationApplicationService} from '@/modules/tag/server';
import {DeactivateTagCommand} from '@/modules/tag/server';
import { log } from '@/platform/logger';
import { handleAPIError } from '@/platform/api-error-handler';
import {withAudit} from '@/modules/system/server';
import { config } from '@/platform/config/index';
import {MESSAGES} from '@/shared/messages/index';

interface DeactivateRequestBody {
  releaseBit?: boolean;
  reason?: string;
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = await authMiddleware(request);
  if (authError) return authError;

  const { id: tagId } = await params;

  try {
    let body: DeactivateRequestBody = {};
    try {
      body = await request.json() as DeactivateRequestBody;
    } catch {
    }

    const service = getTagActivationApplicationService();
    const userId = request.headers.get('x-user-id') ?? config.system.userId;
    const command = new DeactivateTagCommand(
      tagId,
      userId,
      body.releaseBit ?? false,
      body.reason
    );
    await service.deactivateTag(command);

    await withAudit(request, { 
      entityId: tagId,
      metadata: {
        releaseBit: body.releaseBit ?? false,
        reason: body.reason
      }
    });
    return NextResponse.json({
      success: true,
      message: MESSAGES.API_RESPONSE.TAG_DEACTIVATED
    });
  } catch (error) {
    log.error('PUT /api/tags/[id]/deactivate - Error:', error);
    return handleAPIError(error);
  }
}
