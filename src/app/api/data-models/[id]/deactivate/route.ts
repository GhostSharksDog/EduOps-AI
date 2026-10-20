import {withCompanyRoute} from '@/modules/identity/server';
import {authMiddleware} from '@/modules/identity/server';
import {NextRequest, NextResponse} from 'next/server';
import {z} from 'zod';
import {dataModelApplicationService, dataModelOHSAdapter} from '@/modules/data/server';
import {dataModelSchema} from '@/modules/data/contracts';
import {handleAPIError} from '@/platform/api-error-handler';
import {withAudit} from '@/modules/system/server';

/**
 * 停用数据模型
 * @description 根据ID停用数据模型
 * @response dataModelSchema
 * @openapi
 */
async function PATCHHandler(
    request: NextRequest,
    {params}: { params: Promise<{ id: string }> }
) {
    const authError = await authMiddleware(request);
    if (authError) return authError;
    
    const {id} = await params;
    try {
        const command = dataModelOHSAdapter.fromRequestToDeactivateDataModelCommand(request, id);
        const result = await dataModelApplicationService.deactivateDataModel(command);
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

        return handleAPIError(error);
    }
}

export const PATCH=withCompanyRoute(PATCHHandler);
