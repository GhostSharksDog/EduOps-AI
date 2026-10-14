import {authMiddleware} from '@/modules/identity/server';
import {NextRequest, NextResponse} from 'next/server';
import {z} from 'zod';
import {tagCategoryApplicationService, tagCategoryOHSAdapter} from '@/modules/tag/server';
import type {TagCategoryVO} from '@/modules/tag/contracts';
import {log} from '@/platform/logger';
import {handleAPIError} from '@/platform/api-error-handler';
import {withAudit} from '@/modules/system/server';

/**
 * 移动标签分类
 * @description 将标签分类移动到新的父分类
 * @body moveTagCategorySchema
 * @response tagCategorySchema
 * @openapi
 */
export async function POST(request: NextRequest) {
    const authError = await authMiddleware(request);
    if (authError) return authError;

    try {
        const command = await tagCategoryOHSAdapter.fromRequestToMoveCategoryCommand(request);
        const result: TagCategoryVO = await tagCategoryApplicationService.moveCategory(command);
        await withAudit(request, { entityId: result.id });
        return NextResponse.json(result);
    } catch (error) {
        log.error('POST /api/tag-categories/move - Error:', error);

        if (error instanceof z.ZodError) {
            return NextResponse.json({
                error: '参数验证失败',
                details: error.issues
            }, {status: 400});
        }

        return handleAPIError(error);
    }
}
