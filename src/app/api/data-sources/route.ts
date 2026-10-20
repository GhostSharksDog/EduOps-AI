import {withCompanyRoute} from '@/modules/identity/server';
import {authMiddleware} from '@/modules/identity/server';
import {NextRequest, NextResponse} from 'next/server';
import {z} from 'zod';
import {dataSourceApplicationService, dataSourceOHSAdapter} from '@/modules/data/server';
import {dataSourceListSchema, dataSourceSchema} from '@/modules/data/contracts';
import {log} from '@/platform/logger';
import {handleAPIError} from '@/platform/api-error-handler';
import {withAudit} from '@/modules/system/server';

/**
 * 获取数据源列表
 * @description 分页获取数据源列表，支持按类型、状态、关键词筛选
 * @params listDataSourcesSchema
 * @response dataSourceListSchema
 * @openapi
 */
async function GETHandler(request: NextRequest) {
    const authError = await authMiddleware(request);
    if (authError) return authError;

    try {
        const query = dataSourceOHSAdapter.fromRequestToListDataSourcesQuery(request);
        const result = await dataSourceApplicationService.listDataSources(query);
        const validatedResult = dataSourceListSchema.parse(result);


        return NextResponse.json(validatedResult);
    } catch (error) {
        log.error('GET /api/data-sources - Error:', error);

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
 * 创建数据源
 * @description 创建新的数据源，支持MySQL、PostgreSQL、ClickHouse等类型
 * @body createDataSourceSchema
 * @response 201 dataSourceSchema
 * @openapi
 */
async function POSTHandler(request: NextRequest) {
    const authError = await authMiddleware(request);
    if (authError) return authError;

    try {
        const command = await dataSourceOHSAdapter.fromRequestToCreateDataSourceCommand(request);
        const result = await dataSourceApplicationService.createDataSource(command);
        await withAudit(request, { entityId: result.id });
        const validatedResult = dataSourceSchema.parse(result);

        return NextResponse.json(validatedResult, {status: 201});
    } catch (error) {
        log.error('POST /api/data-sources - Error:', error);

        if (error instanceof z.ZodError) {
            return NextResponse.json({
                error: '参数验证失败',
                details: error.issues
            }, {status: 400});
        }

        return handleAPIError(error);
    }
}

export const GET=withCompanyRoute(GETHandler);
export const POST=withCompanyRoute(POSTHandler);
