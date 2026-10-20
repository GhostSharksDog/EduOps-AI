import {authMiddleware, getCurrentUser, withCompanyRoute} from '@/modules/identity/server';
import {NextRequest, NextResponse} from 'next/server';
import {z} from 'zod';
import {log} from '@/platform/logger';
import {handleAPIError} from '@/platform/api-error-handler';
import {systemSettingsService, withAudit} from '@/modules/system/server';

/**
 * 获取系统设置
 * @description 获取当前租户的系统配置
 * @openapi
 */
async function GETHandler(request: NextRequest) {
    const authError = await authMiddleware(request);
    if (authError) return authError;
    const user = getCurrentUser(request);
    if (!user?.id || !user.ownedBy) {
        return NextResponse.json({error: '缺少有效公司身份，请重新登录'}, {status: 401});
    }

    try {
        return NextResponse.json(await systemSettingsService.get(user.ownedBy), {
            headers: {'Cache-Control': 'private, no-store'},
        });
    } catch (error) {
        log.error('GET /api/settings - Error:', error);
        return handleAPIError(error);
    }
}

/**
 * 更新系统设置
 * @description 更新当前租户的系统配置（部分更新）
 * @openapi
 */
async function PUTHandler(request: NextRequest) {
    const authError = await authMiddleware(request);
    if (authError) return authError;
    const user = getCurrentUser(request);
    if (!user?.id || !user.ownedBy) {
        return NextResponse.json({error: '缺少有效公司身份，请重新登录'}, {status: 401});
    }

    try {
        const result = await systemSettingsService.update(user.ownedBy, user.id, await request.json());
        await withAudit(request, {
            entity: 'SystemConfig',
            entityId: result.id,
            metadata: {changes: result.changes},
        });

        log.info('SystemConfig updated');

        return NextResponse.json(result.settings, {headers: {'Cache-Control': 'private, no-store'}});
    } catch (error) {
        log.error('PUT /api/settings - Error:', error);

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
export const PUT=withCompanyRoute(PUTHandler);
