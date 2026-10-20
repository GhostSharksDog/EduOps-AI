import {withCompanyRoute} from '@/modules/identity/server';
import {authMiddleware} from '@/modules/identity/server';
import {NextRequest, NextResponse} from 'next/server';
import {z} from 'zod';
import {dataModelApplicationService, dataModelOHSAdapter} from '@/modules/data/server';
import {dataModelSchema} from '@/modules/data/contracts';
import {log} from '@/platform/logger';
import {handleAPIError} from '@/platform/api-error-handler';
import {withAudit} from '@/modules/system/server';
import {MESSAGES} from '@/shared/messages/index';
/**
 * 获取单个数据模型
 * @description 根据ID获取数据模型详情
 * @response dataModelSchema
 * @openapi
 */
async function GETHandler(
    request: NextRequest,
    {params}: { params: Promise<{ id: string }> }
) {
    const authError = await authMiddleware(request);
    if (authError) return authError;
    
    const {id} = await params;
    try {
        const query = dataModelOHSAdapter.fromRequestToGetDataModelQuery(request, id);
        const result = await dataModelApplicationService.getDataModel(query);
        const validatedResult = dataModelSchema.parse(result);
        return NextResponse.json(validatedResult);
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({
                error: '参数验证失败',
                details: error.issues
            }, {status: 400});
        }

        log.error('GET /api/data-models/[id] - Error:', error);
        return handleAPIError(error);
    }
}

/**
 * 更新数据模型
 * @description 根据ID更新数据模型信息
 * @body updateDataModelSchema
 * @response dataModelSchema
 * @openapi
 */
async function PUTHandler(
    request: NextRequest,
    {params}: { params: Promise<{ id: string }> }
) {
    const authError = await authMiddleware(request);
    if (authError) return authError;
    
    const {id} = await params;
    try {
        const command = await dataModelOHSAdapter.fromRequestToUpdateDataModelCommand(request, id);
        const result = await dataModelApplicationService.updateDataModel(command);
        await withAudit(request, { entityId: id });
        const validatedResult = dataModelSchema.parse(result);
        return NextResponse.json(validatedResult);
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({
                error: '参数验证失败',
                details: error.issues
            }, {status: 400});
        }

        log.error('PUT /api/data-models/[id] - Error:', error);
        return handleAPIError(error);
    }
}

/**
 * 删除数据模型
 * @description 根据ID软删除数据模型
 * @response 204
 * @openapi
 */
async function DELETEHandler(
    request: NextRequest,
    {params}: { params: Promise<{ id: string }> }
) {
    const authError = await authMiddleware(request);
    if (authError) return authError;
    
    const {id} = await params;
    try {
        const command = dataModelOHSAdapter.fromRequestToDeleteDataModelCommand(request, id);
        await dataModelApplicationService.deleteDataModel(command);
        await withAudit(request, { entityId: id });
        return NextResponse.json({success: true, message: MESSAGES.API_RESPONSE.DATAMODEL_DELETE_SUCCESS});
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({
                error: '参数验证失败',
                details: error.issues
            }, {status: 400});
        }

        log.error('DELETE /api/data-models/[id] - Error:', error);
        return handleAPIError(error);
    }
}

export const GET=withCompanyRoute(GETHandler);
export const PUT=withCompanyRoute(PUTHandler);
export const DELETE=withCompanyRoute(DELETEHandler);
