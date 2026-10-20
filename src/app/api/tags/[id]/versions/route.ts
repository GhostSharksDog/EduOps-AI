import {withCompanyRoute} from '@/modules/identity/server';
import {NextRequest, NextResponse} from 'next/server';
import {z} from 'zod';
import {riskTagRouteAuth as authMiddleware} from '@/modules/tag/server';
import {tagApplicationService, tagOHSAdapter} from '@/modules/tag/server';
import {tagVersionListSchema, tagVersionSchema} from '@/modules/tag/contracts';
import {log} from '@/platform/logger';
import {handleAPIError} from '@/platform/api-error-handler';
import {withAudit} from '@/modules/system/server';

/**
 * 获取标签版本列表
 * @description 根据标签ID获取所有版本列表
 * @response tagVersionListSchema
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
        const query = tagOHSAdapter.fromRequestToListTagVersionsQuery(request, id);
        const result = await tagApplicationService.listTagVersions(query);
        const validatedResult = tagVersionListSchema.parse(result);
        return NextResponse.json(validatedResult);
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({
                error: '参数验证失败',
                details: error.issues
            }, {status: 400});
        }

        log.error('GET /api/tags/[id]/versions - Error:', error);
        return handleAPIError(error);
    }
}

/**
 * 创建标签版本
 * @description 根据标签ID创建新版本
 * @body createTagVersionSchema
 * @response tagVersionListSchema
 * @openapi
 */
async function POSTHandler(
    request: NextRequest,
    {params}: { params: Promise<{ id: string }> }
) {
    const authError = await authMiddleware(request);
    if (authError) return authError;
    
    const {id} = await params;
    try {
        const command = await tagOHSAdapter.fromRequestToCreateTagVersionCommand(request, id);
        const result = await tagApplicationService.createTagVersion(command);
        await withAudit(request, { entityId: id });
        const validatedResult = tagVersionSchema.parse(result);
        return NextResponse.json(validatedResult, {status: 201});
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({
                error: '参数验证失败',
                details: error.issues
            }, {status: 400});
        }

        log.error('POST /api/tags/[id]/versions - Error:', error);
        return handleAPIError(error);
    }
}

export const GET=withCompanyRoute(GETHandler);
export const POST=withCompanyRoute(POSTHandler);
