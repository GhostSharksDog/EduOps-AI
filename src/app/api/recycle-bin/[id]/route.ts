import {authMiddleware} from '@/modules/identity/server';
import {NextRequest, NextResponse} from 'next/server';
import {z} from 'zod';
import {recycleBinApplicationService, recycleBinOHSAdapter} from '@/modules/system/server';
import {restoreRecycleBinItemResponseSchema} from '@/modules/system/contracts';
import {log} from '@/platform/logger';
import { handleAPIError } from '@/platform/api-error-handler';

/**
 * 永久删除回收站项目
 * @description 从回收站中永久删除指定项目
 * @params id: string (路径参数)
 * @params type: string (查询参数)
 * @response restoreRecycleBinItemResponseSchema
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
        const command = recycleBinOHSAdapter.fromRequestToPermanentlyDeleteRecycleBinItemCommand(request, id);
        await recycleBinApplicationService.permanentlyDeleteRecycleBinItem(command);
        const response = {success: true};
        const validatedResponse = restoreRecycleBinItemResponseSchema.parse(response);
        return NextResponse.json(validatedResponse);
    } catch (error) {
        log.error('DELETE /api/recycle-bin/[id] - Error:', error);
        if (error instanceof z.ZodError) {
            return NextResponse.json({
                error: '参数验证失败',
                details: error.issues
            }, {status: 400});
        }
        return handleAPIError(error);
    }
}
