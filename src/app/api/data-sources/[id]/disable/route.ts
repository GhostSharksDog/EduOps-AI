import {authMiddleware} from '@/modules/identity/server';
import {NextRequest, NextResponse} from 'next/server';
import {z} from 'zod';
import {dataSourceApplicationService, dataSourceOHSAdapter} from '@/modules/data/server';
import {dataSourceSchema} from '@/modules/data/contracts';
import {log} from '@/platform/logger';
import {handleAPIError} from '@/platform/api-error-handler';
import {withAudit} from '@/modules/system/server';

/**
 * 禁用数据源
 * @description 根据ID禁用数据源
 * @response dataSourceSchema
 * @openapi
 */
export async function POST(
    request: NextRequest,
    {params}: { params: Promise<{ id: string }> }
) {
    const authError = await authMiddleware(request);
    if (authError) return authError;
    
    try {
        const {id} = await params;
        const command = dataSourceOHSAdapter.fromRequestToDisableDataSourceCommand(request, id);

        const result = await dataSourceApplicationService.disableDataSource(command);
        await withAudit(request, { entityId: id });
        const validatedResult = dataSourceSchema.parse(result);

        return NextResponse.json(validatedResult);
    } catch (error) {
        log.error('POST /api/data-sources/[id]/disable - Error:', error);

        if (error instanceof z.ZodError) {
            return NextResponse.json({
                error: '参数验证失败',
                details: error.issues
            }, {status: 400});
        }

        return handleAPIError(error);
    }
}
