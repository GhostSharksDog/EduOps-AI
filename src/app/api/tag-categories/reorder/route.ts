import {authMiddleware} from '@/modules/identity/server';
import {NextRequest, NextResponse} from 'next/server';
import {z} from 'zod';
import {tagCategoryApplicationService, tagCategoryOHSAdapter} from '@/modules/tag/server';
import {log} from '@/platform/logger';
import {handleAPIError} from '@/platform/api-error-handler';
import {withAudit} from '@/modules/system/server';

/**
 * 重新排序标签分类
 * @description 使用新的排序值重新排序多个标签分类
 * @body reorderTagCategoriesSchema
 * @response 204
 * @openapi
 */
export async function POST(request: NextRequest) {
    const authError = await authMiddleware(request);
    if (authError) return authError;

    try {
        const command = await tagCategoryOHSAdapter.fromRequestToReorderCategoriesCommand(request);
        await tagCategoryApplicationService.reorderCategories(command);
        await withAudit(request);
        return new NextResponse(null, {status: 204});
    } catch (error) {
        log.error('POST /api/tag-categories/reorder - Error:', error);

        if (error instanceof z.ZodError) {
            return NextResponse.json({
                error: '参数验证失败',
                details: error.issues
            }, {status: 400});
        }

        return handleAPIError(error);
    }
}
