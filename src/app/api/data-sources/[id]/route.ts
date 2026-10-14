import {authMiddleware} from '@/modules/identity/server';
import {NextRequest, NextResponse} from 'next/server';
import {z} from 'zod';
import {dataSourceApplicationService, dataSourceOHSAdapter} from '@/modules/data/server';
import {dataSourceSchema} from '@/modules/data/contracts';
import {log} from '@/platform/logger';
import {handleAPIError} from '@/platform/api-error-handler';
import {withAudit} from '@/modules/system/server';
import {MESSAGES} from '@/shared/messages/index';
/**
 * 获取数据源详情
 * @description 根据ID获取数据源详情
 * @response dataSourceSchema
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
        const query = dataSourceOHSAdapter.fromRequestToGetDataSourceQuery(request, id);
        const result = await dataSourceApplicationService.getDataSource(query);
        const validatedResult = dataSourceSchema.parse(result);
        return NextResponse.json(validatedResult);
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({
                error: '参数验证失败',
                details: error.issues
            }, {status: 400});
        }

        log.error('GET /api/data-sources/[id] - Error:', error);
        return handleAPIError(error);
    }
}

/**
 * 更新数据源
 * @description 根据ID更新数据源信息
 * @body updateDataSourceSchema
 * @response dataSourceSchema
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
        const command = await dataSourceOHSAdapter.fromRequestToUpdateDataSourceCommand(request, id);
        const result = await dataSourceApplicationService.updateDataSource(command);
        await withAudit(request, { entityId: id });
        const validatedResult = dataSourceSchema.parse(result);
        return NextResponse.json(validatedResult);
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({
                error: '参数验证失败',
                details: error.issues
            }, {status: 400});
        }

        log.error('PUT /api/data-sources/[id] - Error:', error);
        return handleAPIError(error);
    }
}

/**
 * 删除数据源
 * @description 根据ID软删除数据源
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
        const command = dataSourceOHSAdapter.fromRequestToDeleteDataSourceCommand(request, id);
        await dataSourceApplicationService.deleteDataSource(command);
        await withAudit(request, { entityId: id });
        return NextResponse.json({success: true, message: MESSAGES.API_RESPONSE.DATASOURCE_DELETE_SUCCESS});
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({
                error: '参数验证失败',
                details: error.issues
            }, {status: 400});
        }

        log.error('DELETE /api/data-sources/[id] - Error:', error);
        return handleAPIError(error);
    }
}