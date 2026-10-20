import {withCompanyRoute} from '@/modules/identity/server';
import {riskTagRouteAuth as authMiddleware} from '@/modules/tag/server';
import {NextRequest, NextResponse} from 'next/server';
import {z} from 'zod';
import {tagApplicationService, tagOHSAdapter} from '@/modules/tag/server';
import {getTagActivationApplicationService} from '@/modules/tag/server';
import {tagSchema} from '@/modules/tag/contracts';
import {log} from '@/platform/logger';
import {handleAPIError} from '@/platform/api-error-handler';
import {AppException} from '@/shared/errors/base.exception';
import {withAudit} from '@/modules/system/server';
import {MESSAGES} from '@/shared/messages/index';
/**
 * 获取标签详情
 * @description 根据ID获取标签详情，包含当前版本信息
 * @response tagSchema
 * @openapi
 */
async function GETHandler(
    request: NextRequest,
    {params}: { params: Promise<{ id: string }> }
) {
    const authError = await authMiddleware(request);
    if (authError) return authError;
    
    const {id} = await params;
    try {
        const query = tagOHSAdapter.fromRequestToGetTagQuery(request, id);
        const result = await tagApplicationService.getTag(query);
        const validatedResult = tagSchema.parse(result);
        return NextResponse.json(validatedResult);
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({
                error: '参数验证失败',
                details: error.issues
            }, {status: 400});
        }

        log.error('GET /api/tags/[id] - Error:', error);
        return handleAPIError(error);
    }
}

/**
 * 更新标签
 * @description 根据ID更新标签信息
 * @body updateTagSchema
 * @response tagSchema
 * @openapi
 */
async function PUTHandler(
    request: NextRequest,
    {params}: { params: Promise<{ id: string }> }
) {
    const authError = await authMiddleware(request);
    if (authError) return authError;
    
    const {id} = await params;
    try {
        const command = await tagOHSAdapter.fromRequestToUpdateTagCommand(request, id);
        const result = await tagApplicationService.updateTag(command);
        await withAudit(request, { entityId: id });
        const validatedResult = tagSchema.parse(result);
        return NextResponse.json(validatedResult);
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({
                error: '参数验证失败',
                details: error.issues
            }, {status: 400});
        }

        log.error('PUT /api/tags/[id] - Error:', error);
        if (error instanceof AppException) {
            log.error('PUT /api/tags/[id] - AppException details:', {
                code: error.code,
                httpStatus: error.httpStatus,
                message: error.message,
                details: error.details,
            });
        }
        return handleAPIError(error);
    }
}

/**
 * 删除标签
 * @description 根据ID软删除标签
 * @response 204
 * @openapi
 */
async function DELETEHandler(
    request: NextRequest,
    {params}: { params: Promise<{ id: string }> }
) {
    const authError = await authMiddleware(request);
    if (authError) return authError;
    
    const {id} = await params;
    try {
        const command = await tagOHSAdapter.fromRequestToDeleteTagCommand(request, id);
        const activationService = getTagActivationApplicationService();
        await activationService.deleteTag({ tagId: command.tagId, userId: command.deletedBy });
        await withAudit(request, { entityId: id });
        return NextResponse.json({success: true, message: MESSAGES.API_RESPONSE.TAG_DELETE_SUCCESS});
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({
                error: '参数验证失败',
                details: error.issues
            }, {status: 400});
        }

        log.error('DELETE /api/tags/[id] - Error:', error);
        return handleAPIError(error);
    }
}

export const GET=withCompanyRoute(GETHandler);
export const PUT=withCompanyRoute(PUTHandler);
export const DELETE=withCompanyRoute(DELETEHandler);
