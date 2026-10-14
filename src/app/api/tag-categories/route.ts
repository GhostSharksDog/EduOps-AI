import {authMiddleware} from '@/modules/identity/server';
import {NextRequest, NextResponse} from 'next/server';
import {z} from 'zod';
import {tagCategoryApplicationService, tagCategoryOHSAdapter} from '@/modules/tag/server';
import {log} from '@/platform/logger';
import {handleAPIError} from '@/platform/api-error-handler';
import {withAudit} from '@/modules/system/server';

/**
 * 获取标签分类列表
 * @description 获取带分页和过滤的标签分类列表
 * @response tagCategoryListSchema
 * @openapi
 */
export async function GET(request: NextRequest) {
    const authError = await authMiddleware(request);
    if (authError) return authError;

    try {
        const query = tagCategoryOHSAdapter.fromRequestToListCategoriesQuery(request);
        const result = await tagCategoryApplicationService.listCategories(query);
        return NextResponse.json(result);
    } catch (error) {
        log.error('GET /api/tag-categories - Error:', error);
        if (error instanceof z.ZodError) {
            return NextResponse.json({
                error: '参数验证失败',
                details: error.issues
            }, {status: 400});
        }
        return handleAPIError(error);
    }
}

/**
 * 创建标签分类
 * @description 使用提供的信息创建新标签分类
 * @body createTagCategorySchema
 * @response 201
 * @openapi
 */
export async function POST(request: NextRequest) {
    const authError = await authMiddleware(request);
    if (authError) return authError;

    try {
        const command = await tagCategoryOHSAdapter.fromRequestToCreateCategoryCommand(request);
        const result = await tagCategoryApplicationService.createCategory(command);
        await withAudit(request, { entityId: result.id });
        return NextResponse.json(result, {status: 201});
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({
                error: '参数验证失败',
                details: error.issues
            }, {status: 400});
        }
        log.error('POST /api/tag-categories - Error:', error);
        return handleAPIError(error);
    }
}
