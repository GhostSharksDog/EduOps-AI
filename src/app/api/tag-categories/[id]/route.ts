import {authMiddleware} from '@/modules/identity/server';
import {NextRequest, NextResponse} from 'next/server';
import {z} from 'zod';
import {tagCategoryApplicationService, tagCategoryOHSAdapter} from '@/modules/tag/server';
import {tagCategorySchema} from '@/modules/tag/contracts';
import {log} from '@/platform/logger';
import {handleAPIError} from '@/platform/api-error-handler';
import {withAudit} from '@/modules/system/server';
import {MESSAGES} from '@/shared/messages/index';

/**
 * 获取标签分类详情
 * @description 根据ID获取标签分类详情
 * @response tagCategorySchema
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
        const query = tagCategoryOHSAdapter.fromRequestToGetCategoryQuery(request);
        // Override categoryId from URL path
        const queryWithId = {...query, categoryId: id};
        const result = await tagCategoryApplicationService.getCategory(queryWithId);
        const validatedResult = tagCategorySchema.parse(result);
        return NextResponse.json(validatedResult);
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({
                error: '参数验证失败',
                details: error.issues
            }, {status: 400});
        }

        log.error('GET /api/tag-categories/[id] - Error:', error);
        return handleAPIError(error);
    }
}

/**
 * 更新标签分类
 * @description 根据ID更新标签分类信息
 * @body updateTagCategorySchema
 * @response tagCategorySchema
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
        const command = await tagCategoryOHSAdapter.fromRequestToUpdateCategoryCommand(request, id);
        const result = await tagCategoryApplicationService.updateCategory(command);
        await withAudit(request, { entityId: id });
        const validatedResult = tagCategorySchema.parse(result);
        return NextResponse.json(validatedResult);
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({
                error: '参数验证失败',
                details: error.issues
            }, {status: 400});
        }

        log.error('PUT /api/tag-categories/[id] - Error:', error);
        return handleAPIError(error);
    }
}

/**
 * 删除标签分类
 * @description 根据ID软删除标签分类
 * @response 204
 * @openapi
 */
export async function DELETE(
    request: NextRequest,
    {params}: { params: Promise<{ id: string }> }
) {
    const authError = await authMiddleware(request);
    if (authError) return authError;
    
    const {id} = await params;
    try {
        const command = tagCategoryOHSAdapter.fromRequestToDeleteCategoryCommand(request, id);
        await tagCategoryApplicationService.deleteCategory(command);
        await withAudit(request, { entityId: id });
        return NextResponse.json({success: true, message: MESSAGES.API_RESPONSE.CATEGORY_DELETE_SUCCESS});
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({
                error: '参数验证失败',
                details: error.issues
            }, {status: 400});
        }

        log.error('DELETE /api/tag-categories/[id] - Error:', error);
        return handleAPIError(error);
    }
}
