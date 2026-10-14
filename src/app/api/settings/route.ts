import {authMiddleware, getCurrentUser} from '@/modules/identity/server';
import {NextRequest, NextResponse} from 'next/server';
import {z} from 'zod';
import {log} from '@/platform/logger';
import {handleAPIError} from '@/platform/api-error-handler';
import {queryOne} from '@/platform/database';
import {withAudit} from '@/modules/system/server';
import {config} from '@/platform/config/index';

const configSchema = z.strictObject({
    sessionTimeout: z.number().min(5).max(1440),
    pageSize: z.number().min(10).max(100),
    language: z.enum(['zh-CN', 'en-US']),
    theme: z.enum(['light', 'dark', 'auto']),
});

type SystemConfigType = z.infer<typeof configSchema>;

const defaultConfig: SystemConfigType = {
    sessionTimeout: 30,
    pageSize: 20,
    language: 'zh-CN',
    theme: 'light',
};

async function getOrCreateConfig(ownedBy: string): Promise<SystemConfigType> {
    const record=await queryOne(`INSERT INTO system_config(owned_by,config) VALUES ($1,$2::jsonb)
      ON CONFLICT (owned_by) DO UPDATE SET owned_by=EXCLUDED.owned_by RETURNING config`,[ownedBy,JSON.stringify(defaultConfig)]);
    return {...defaultConfig,...record?.config};
}

/**
 * 获取系统设置
 * @description 获取当前租户的系统配置
 * @openapi
 */
export async function GET(request: NextRequest) {
    const authError = await authMiddleware(request);
    if (authError) return authError;

    try {
        const user = getCurrentUser(request);
        const tenantId = user?.ownedBy ?? config.system.userId;
        const configData = await getOrCreateConfig(tenantId);

        return NextResponse.json(configData);
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
export async function PUT(request: NextRequest) {
    const authError = await authMiddleware(request);
    if (authError) return authError;

    try {
        const user = getCurrentUser(request);
        const tenantId = user?.ownedBy ?? config.system.userId;
        const body = await request.json();
        
        const validated = configSchema.partial().parse(body);
        const record=await queryOne(`INSERT INTO system_config(owned_by,config,created_by,updated_by,update_time)
          VALUES ($1,$2::jsonb || $3::jsonb,$4,$4,NOW()) ON CONFLICT (owned_by) DO UPDATE
          SET config=system_config.config || $3::jsonb,updated_by=$4,update_time=NOW() RETURNING id,config`,
          [tenantId,JSON.stringify(defaultConfig),JSON.stringify(validated),user?.id??null]);
        const updatedConfig={...defaultConfig,...record?.config};
        await withAudit(request,{entityId:record?.id,metadata:{changes:validated}});

        log.info('SystemConfig updated');

        return NextResponse.json(updatedConfig);
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
