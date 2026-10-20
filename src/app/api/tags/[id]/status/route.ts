import {withCompanyRoute} from '@/modules/identity/server';
import {NextRequest, NextResponse} from 'next/server';
import {z} from 'zod';
import {riskTagRouteAuth as authMiddleware} from '@/modules/tag/server';
import {tagApplicationService, tagOHSAdapter} from '@/modules/tag/server';
import {tagSchema} from '@/modules/tag/contracts';
import {log} from '@/platform/logger';
import {handleAPIError} from '@/platform/api-error-handler';
import {withAudit} from '@/modules/system/server';

/**
 * 更新标签状态
 * @description 更新标签的状态，支持激活、停用、废弃等状态变更
 * @response tagSchema
 * @openapi
 */
async function PATCHHandler(
    request: NextRequest,
    {params}: { params: Promise<{ id: string }> }
) {
    const authError = await authMiddleware(request);
    if (authError) return authError;
    
    const {id} = await params;
    try {
        const command = await tagOHSAdapter.fromRequestToUpdateTagStatusCommand(request, id);
        const result = await tagApplicationService.updateTagStatus(command);
        await withAudit(request, { entityId: id });
        const validatedResult = tagSchema.parse(result);
        return NextResponse.json(validatedResult);
    } catch (error) {
        log.error('PATCH /api/tags/[id]/status - Error:', error);
        if (error instanceof z.ZodError) {
            return NextResponse.json({
                error: '参数验证失败',
                details: error.issues
            }, {status: 400});
        }
        return handleAPIError(error);
    }
}

export const PATCH=withCompanyRoute(PATCHHandler);
