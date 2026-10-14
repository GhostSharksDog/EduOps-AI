import {authMiddleware} from '@/modules/identity/server';
import {NextRequest, NextResponse} from 'next/server';
import {z} from 'zod';
import {recycleBinApplicationService, recycleBinOHSAdapter} from '@/modules/system/server';
import {log} from '@/platform/logger';
import {handleAPIError} from '@/platform/api-error-handler';

/**
 * 获取回收站列表
 * @description 获取回收站中的项目列表，支持分页、关键词搜索和类型过滤
 * @response recycleBinItemListSchema
 * @openapi
 */
export async function GET(request: NextRequest) {
    const authError = await authMiddleware(request);
    if (authError) return authError;

    try {
        const query = recycleBinOHSAdapter.fromRequestToListRecycleBinItemsQuery(request);
        const result = await recycleBinApplicationService.listRecycleBinItems(query);
        return NextResponse.json(result);
    } catch (error) {
        log.error('GET /api/recycle-bin - Error:', error);
        if (error instanceof z.ZodError) {
            return NextResponse.json({
                error: '参数验证失败',
                details: error.issues
            }, {status: 400});
        }
        return handleAPIError(error);
    }
}
