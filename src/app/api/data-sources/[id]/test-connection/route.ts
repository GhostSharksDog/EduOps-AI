import {withCompanyRoute} from '@/modules/identity/server';
import {authMiddleware} from '@/modules/identity/server';
import {NextRequest, NextResponse} from 'next/server';
import {dataSourceApplicationService, dataSourceOHSAdapter} from '@/modules/data/server';
import {testDataSourceConnectionResponseSchema} from '@/modules/data/contracts';
import {log} from '@/platform/logger';
import {handleAPIError} from '@/platform/api-error-handler';

/**
 * 测试特定数据源的连接
 * @description 通过数据源ID测试连接是否成功
 * @route {GET} /api/data-sources/[id]/test-connection
 * @response testDataSourceConnectionResponseSchema
 * @openapi
 */
async function GETHandler(request: NextRequest, {params}: { params: Promise<{ id: string }> }) {
    const authError = await authMiddleware(request);
    if (authError) return authError;
    
    const {id} = await params;
    try {
        const command = await dataSourceOHSAdapter.fromRequestToTestDataSourceConnectionQuery(request, id);
        const result = await dataSourceApplicationService.testConnection(command);
        const validatedResult = testDataSourceConnectionResponseSchema.parse(result);
        return NextResponse.json(validatedResult);
    } catch (error) {
        log.error('GET /api/data-sources/[id]/test-connection - Error:', error);
        return handleAPIError(error);
    }
}

export const GET=withCompanyRoute(GETHandler);
