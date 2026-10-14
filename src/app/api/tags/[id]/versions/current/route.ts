import {NextRequest, NextResponse} from 'next/server';
import {z} from 'zod';
import {riskTagRouteAuth as authMiddleware} from '@/modules/tag/server';
import {tagApplicationService, tagOHSAdapter} from '@/modules/tag/server';
import {tagSchema} from '@/modules/tag/contracts';
import {log} from '@/platform/logger';
import {handleAPIError} from '@/platform/api-error-handler';

/**
 * 设置当前版本
 * @description 为标签设置当前版本
 * @response tagSchema
 * @openapi
 */
export async function PUT(
    request: NextRequest,
    {params}: { params: Promise<{ id: string }> }
) {
    const authError = await authMiddleware(request);
    if (authError) return authError;
    
    const {id} = await params;
    try {
        const command = await tagOHSAdapter.fromRequestToSetCurrentVersionCommand(request, id);
        const result = await tagApplicationService.setCurrentVersion(command);
        const validatedResult = tagSchema.parse(result);
        return NextResponse.json(validatedResult);
    } catch (error) {
        log.error('PUT /api/tags/[id]/versions/current - Error:', error);
        if (error instanceof z.ZodError) {
            return NextResponse.json({
                error: '参数验证失败',
                details: error.issues
            }, {status: 400});
        }
        return handleAPIError(error);
    }
}
