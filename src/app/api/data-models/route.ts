import {withCompanyRoute} from '@/modules/identity/server';
import {authMiddleware} from '@/modules/identity/server';
import {NextRequest, NextResponse} from 'next/server';
import {z} from 'zod';
import {dataModelApplicationService, dataModelOHSAdapter} from '@/modules/data/server';
import {dataModelListSchema} from '@/modules/data/contracts';
import {log} from '@/platform/logger';
import {handleAPIError} from '@/platform/api-error-handler';
import {withAudit} from '@/modules/system/server';

/**
 * 获取数据模型列表
 * @description 获取数据模型列表，支持分页和筛选
 * @response dataModelListSchema
 * @openapi
 */
async function GETHandler(request: NextRequest) {
    const authError = await authMiddleware(request);
    if (authError) return authError;

    try {
        const query = dataModelOHSAdapter.fromRequestToListDataModelsQuery(request);
        const result = await dataModelApplicationService.listDataModels(query);
        const validatedResult = dataModelListSchema.parse(result);
        return NextResponse.json(validatedResult);
    } catch (error) {
        log.error('GET /api/data-models - Error:', error);

        if (error instanceof z.ZodError) {
            return NextResponse.json({
                error: '参数验证失败',
                details: error.issues
            }, {status: 400});
        }

        return handleAPIError(error);
    }
}

/**
 * 创建数据模型
 * @description 使用提供的信息创建一个新的数据模型
 * @response 201
 * @openapi
 */
async function POSTHandler(request: NextRequest) {
    const authError = await authMiddleware(request);
    if (authError) return authError;

    try {
        const command = await dataModelOHSAdapter.fromRequestToCreateDataModelCommand(request);
        const result = await dataModelApplicationService.createDataModel(command);
        await withAudit(request, { entityId: result.id });
        return NextResponse.json(result, {status: 201});
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({
                error: '参数验证失败',
                details: error.issues
            }, {status: 400});
        }

        log.error('POST /api/data-models - Error:', error);
        return handleAPIError(error);
    }
}

export const GET=withCompanyRoute(GETHandler);
export const POST=withCompanyRoute(POSTHandler);
