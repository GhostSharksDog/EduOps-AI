import {withCompanyRoute} from '@/modules/identity/server';
import {authMiddleware} from '@/modules/identity/server';
import {NextRequest, NextResponse} from 'next/server';
import {z} from 'zod';
import {recycleBinApplicationService, recycleBinOHSAdapter} from '@/modules/system/server';
import {log} from '@/platform/logger';
import {handleAPIError} from '@/platform/api-error-handler';
import {withAudit} from '@/modules/system/server';
import {MESSAGES} from '@/shared/messages/index';

/**
 * 恢复回收站项目
 * @description 根据ID恢复回收站中的项目
 * @response 204
 * @openapi
 */
async function POSTHandler(
    request: NextRequest,
    {params}: { params: Promise<{ id: string }> }
) {
    const authError = await authMiddleware(request);
    if (authError) return authError;
    
    const {id} = await params;
    try {
        const command = await recycleBinOHSAdapter.fromRequestToRestoreRecycleBinItemCommand(request, id);
         
        const _result = await recycleBinApplicationService.restoreRecycleBinItem(command);
        await withAudit(request, { entityId: id });
        return NextResponse.json({success: true, message: MESSAGES.API_RESPONSE.RESTORE_SUCCESS});
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({
                error: '参数验证失败',
                details: error.issues
            }, {status: 400});
        }

        log.error('POST /api/recycle-bin/[id]/restore - Error:', error);
        return handleAPIError(error);
    }
}

export const POST=withCompanyRoute(POSTHandler);
