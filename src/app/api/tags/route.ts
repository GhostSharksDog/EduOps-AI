import {withCompanyRoute} from '@/modules/identity/server';
import {NextRequest, NextResponse} from 'next/server';
import {z} from 'zod';
import {tagApplicationService, tagOHSAdapter} from '@/modules/tag/server';
import {log} from '@/platform/logger';
import {authMiddleware,getCurrentUser} from '@/modules/identity/server';
import {handleAPIError} from '@/platform/api-error-handler';
import {withAudit} from '@/modules/system/server';

/**
 * 获取标签列表
 * @description 获取带分页和过滤的标签列表
 * @response tagListSchema
 * @openapi
 */
async function GETHandler(request: NextRequest) {
    const authError = await authMiddleware(request);
    if (authError) return authError;
    
    try {
        const query = tagOHSAdapter.fromRequestToListTagsQuery(request);
        query.ownedBy = getCurrentUser(request)!.ownedBy;
        const result = await tagApplicationService.listTags(query);
        return NextResponse.json(result);
    } catch (error) {
        log.error('GET /api/tags - Error:', error);
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
 * 创建标签
 * @description 使用提供的信息创建新标签
 * @response 201
 * @openapi
 */
async function POSTHandler(request: NextRequest) {
    const authError = await authMiddleware(request);
    if (authError) return authError;
    
    try {
        const command = await tagOHSAdapter.fromRequestToCreateTagCommand(request);
        log.info('POST /api/tags - command.rule:', { hasRule: !!command.rule, ruleType: command.rule?.ruleType, hasRuleContent: !!command.rule?.ruleContent });
        const result = await tagApplicationService.createTag(command);
        log.info('POST /api/tags - created tag:', { id: result.id, hasCurrentVersion: !!result.currentVersion, currentVersionId: result.currentVersion?.id });
        await withAudit(request, { entityId: result.id });
        return NextResponse.json(result, {status: 201});
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({
                error: '参数验证失败',
                details: error.issues
            }, {status: 400});
        }
        log.error('POST /api/tags - Error:', error);
        return handleAPIError(error);
    }
}

export const GET=withCompanyRoute(GETHandler);
export const POST=withCompanyRoute(POSTHandler);
