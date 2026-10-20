import {withCompanyRoute} from '@/modules/identity/server';
import { NextRequest, NextResponse } from 'next/server';
import {riskTagRouteAuth as authMiddleware} from '@/modules/tag/server';
import {getTagActivationApplicationService} from '@/modules/tag/server';
import {DeprecateTagCommand} from '@/modules/tag/server';
import { log } from '@/platform/logger';
import { handleAPIError } from '@/platform/api-error-handler';
import {withAudit} from '@/modules/system/server';
import { config } from '@/platform/config/index';
import { MESSAGES } from '@/shared/messages/index';

interface DeprecateRequestBody {
  reason?: string;
}

async function POSTHandler(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = await authMiddleware(request);
  if (authError) return authError;

  const { id: tagId } = await params;

  try {
    let body: DeprecateRequestBody = {};
    try {
      body = await request.json() as DeprecateRequestBody;
    } catch {
    }

    const service = getTagActivationApplicationService();
    const userId = request.headers.get('x-user-id') ?? config.system.userId;
    const command = new DeprecateTagCommand(tagId, userId, body.reason);
    await service.deprecateTag(command);

    await withAudit(request, {
      entityId: tagId,
      metadata: {
        reason: body.reason
      }
    });
    return NextResponse.json({
      success: true,
      message: MESSAGES.API_RESPONSE.TAG_DEPRECATED
    });
  } catch (error) {
    log.error('POST /api/tags/[id]/deprecate - Error:', error);
    return handleAPIError(error);
  }
}

export const POST=withCompanyRoute(POSTHandler);
