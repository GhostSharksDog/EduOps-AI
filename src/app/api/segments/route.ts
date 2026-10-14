import {authMiddleware,getCurrentUser} from '@/modules/identity/server';
import {NextRequest, NextResponse} from 'next/server';
import {z} from 'zod';
import {segmentOHSAdapter, segmentQueryApplicationService} from '@/modules/segment/server';
import {log} from '@/platform/logger';
import {handleAPIError} from '@/platform/api-error-handler';

/**
 * 获取分群列表
 * @description 获取分群列表，支持分页和筛选
 * @response segmentListSchema
 * @openapi
 */
export async function GET(request: NextRequest) {
    const authError = await authMiddleware(request);
    if (authError) return authError;

    try {
        const query = segmentOHSAdapter.fromRequestToListSegmentsQuery(request);
        query.ownedBy=getCurrentUser(request)!.ownedBy;
        const result = await segmentQueryApplicationService.listSegments({...query,page:query.pagination?.page,pageSize:query.pagination?.pageSize});
        return NextResponse.json(result);
    } catch (error) {
        log.error('GET /api/segments - Error:', error);
        if (error instanceof z.ZodError) {
            return NextResponse.json({
                error: '参数验证失败',
                details: error.issues
            }, {status: 400});
        }
        return handleAPIError(error);
    }
}
