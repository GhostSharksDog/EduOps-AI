import {authMiddleware} from '@/modules/identity/server';
import {NextRequest, NextResponse} from 'next/server';
import {z} from 'zod';
import {recycleBinApplicationService, recycleBinOHSAdapter} from '@/modules/system/server';
import {batchRestoreRecycleBinItemsResponseSchema} from '@/modules/system/contracts';
import {log} from '@/platform/logger';
import {handleAPIError} from '@/platform/api-error-handler';
import {withAudit} from '@/modules/system/server';

/**
 * 批量恢复回收站项目
 * @description 将多个项目从回收站中恢复
 * @body batchRestoreRecycleBinItemsSchema
 * @response batchRestoreRecycleBinItemsResponseSchema
 * @openapi
 */
export async function POST(request: NextRequest) {
    const authError = await authMiddleware(request);
    if (authError) return authError;

    try {
        const command = await recycleBinOHSAdapter.fromRequestToBatchRestoreRecycleBinItemsCommand(request);
        const result = await recycleBinApplicationService.batchRestoreRecycleBinItems(command);
        await withAudit(request);
        const validatedResponse = batchRestoreRecycleBinItemsResponseSchema.parse(result);
        return NextResponse.json(validatedResponse);
    } catch (error) {
        log.error('POST /api/recycle-bin/batch-restore - Error:', error);
        if (error instanceof z.ZodError) {
            return NextResponse.json({
                error: '参数验证失败',
                details: error.issues
            }, {status: 400});
        }
        return handleAPIError(error);
    }
}
