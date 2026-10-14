import {authMiddleware} from '@/modules/identity/server';
import {NextRequest, NextResponse} from 'next/server';
import {z} from 'zod';
import {recycleBinApplicationService, recycleBinOHSAdapter} from '@/modules/system/server';
import {log} from '@/platform/logger';
import {handleAPIError} from '@/platform/api-error-handler';
import {withAudit} from '@/modules/system/server';
import {MESSAGES} from '@/shared/messages/index';

/**
 * 批量永久删除回收站项目
 * @description 批量永久删除回收站中的项目
 * @body { ids: string[] }
 * @response 204
 * @openapi
 */
export async function DELETE(request: NextRequest) {
    const authError = await authMiddleware(request);
    if (authError) return authError;

    try {
        const command = await recycleBinOHSAdapter.fromRequestToBatchPermanentlyDeleteRecycleBinItemsCommand(request);
        const results = await recycleBinApplicationService.batchPermanentlyDeleteRecycleBinItems(command);
        await withAudit(request, { action: 'BATCH_DELETE', metadata: { count: results.deletedCount } });
        return NextResponse.json({
            success: true,
            message: MESSAGES.API_RESPONSE.BATCH_DELETE_SUCCESS,
            deletedCount: results.deletedCount
        });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({
                error: '参数验证失败',
                details: error.issues
            }, {status: 400});
        }

        log.error('DELETE /api/recycle-bin/batch - Error:', error);
        return handleAPIError(error);
    }
}
