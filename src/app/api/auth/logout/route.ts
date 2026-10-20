import {withCompanyRoute} from '@/modules/identity/server';
import {NextRequest, NextResponse} from 'next/server';
import {authMiddleware, getCurrentUser} from '@/modules/identity/server';
import {log} from '@/platform/logger';
import {withAudit} from '@/modules/system/server';
import {MESSAGES} from '@/shared/messages/index';

/**
 * 登出接口
 * @description 用户登出系统，记录审计日志
 * @openapi
 */
async function POSTHandler(request: NextRequest) {
    const authError = await authMiddleware(request);
    if (authError) return authError;

    try {
        const user = getCurrentUser(request);
        
        if (user) {
            await withAudit(request, {
                action: 'LOGOUT',
                entity: 'Session',
                entityId: user.id,
                actor: {
                    id: user.id,
                    username: user.username,
                    realName: user.realName,
                    email: user.email,
                    role: user.role,
                },
            });
        }

        return NextResponse.json({
            success: true,
            message: MESSAGES.API_RESPONSE.LOGOUT_SUCCESS,
        });
    } catch (error) {
        log.error('POST /api/auth/logout - Error:', error);
        return NextResponse.json({
            error: error instanceof Error ? error.message : MESSAGES.AUTH.LOGOUT_FAILED,
        }, {status: 500});
    }
}

export const POST=withCompanyRoute(POSTHandler);
