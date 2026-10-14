import {authMiddleware} from '@/modules/identity/server';
import {NextRequest, NextResponse} from 'next/server';
import {z} from 'zod';
import {tagCategoryApplicationService, tagCategoryOHSAdapter} from '@/modules/tag/server';
import {log} from '@/platform/logger';
import {handleAPIError} from '@/platform/api-error-handler';
import {withAudit} from '@/modules/system/server';


export async function POST(request: NextRequest) {
    const authError = await authMiddleware(request);
    if (authError) return authError;

    try {
        const command = await tagCategoryOHSAdapter.fromRequestToBatchDeleteCommand(request);
        const result = await tagCategoryApplicationService.batchDeleteCategories(command);
        await withAudit(request, { action: 'BATCH_DELETE', metadata: { count: result.deletedCount, ids: command.ids } });
        return NextResponse.json(result);
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({
                error: '参数验证失败',
                details: error.issues
            }, {status: 400});
        }

        log.error('POST /api/tag-categories/batch-delete - Error:', error);
        return handleAPIError(error);
    }
}
