import {riskSegmentRouteAuth as authMiddleware} from '@/modules/segment/server';
import {NextRequest, NextResponse} from 'next/server';
import {z} from 'zod';
import {segmentOHSAdapter, segmentQueryApplicationService} from '@/modules/segment/server';
import {segmentSchema} from '@/modules/segment/contracts';
import {log} from '@/platform/logger';
import {handleAPIError} from '@/platform/api-error-handler';
/**
 * 获取分群详情
 * @description 根据ID获取分群详情
 * @response segmentSchema
 * @openapi
 */
export async function GET(
    request: NextRequest,
    {params}: { params: Promise<{ id: string }> }
) {
    const authError = await authMiddleware(request);
    if (authError) return authError;
    
    const {id} = await params;
    try {
        const query = segmentOHSAdapter.fromRequestToGetSegmentQuery(request, id);
        const result = await segmentQueryApplicationService.getSegment({...query,id:z.uuid().parse(id)});
        const validatedResult = segmentSchema.parse(result);
        return NextResponse.json(validatedResult);
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({
                error: '参数验证失败',
                details: error.issues
            }, {status: 400});
        }

        log.error('GET /api/segments/[id] - Error:', error);
        return handleAPIError(error);
    }
}
