import 'server-only';
import {z} from 'zod';
import {queryOne} from '@/platform/database';

export const systemSettingsSchema = z.strictObject({
    sessionTimeout: z.number().min(5).max(1440),
    pageSize: z.number().min(10).max(100),
    language: z.enum(['zh-CN', 'en-US']),
    theme: z.enum(['light', 'dark', 'auto']),
});

type SystemSettings = z.infer<typeof systemSettingsSchema>;
type SettingsRecord = SystemSettings & Record<string, unknown>;

const defaultSettings: SystemSettings = {
    sessionTimeout: 30,
    pageSize: 20,
    language: 'zh-CN',
    theme: 'light',
};

export const systemSettingsService = {
    async get(organizationId: string): Promise<SettingsRecord> {
        // 缺省值只存在于返回结果；读取设置不创建或更新任何记录。
        const record = await queryOne<{config: Record<string, unknown> | null}>(
            'SELECT config FROM system_config WHERE owned_by=$1',
            [organizationId],
        );
        return {...defaultSettings, ...record?.config};
    },

    async update(organizationId: string, userId: string, input: unknown) {
        const changes = systemSettingsSchema.partial().parse(input);
        // 由数据库原子合并局部字段，保留alertRules等其他模块的配置。
        const record = await queryOne<{id: string; config: Record<string, unknown>}>(
            `INSERT INTO system_config(owned_by,config,created_by,updated_by,update_time)
             VALUES ($1,$2::jsonb || $3::jsonb,$4,$4,NOW()) ON CONFLICT (owned_by) DO UPDATE
             SET config=system_config.config || $3::jsonb,updated_by=$4,update_time=NOW()
             RETURNING id,config`,
            [organizationId, JSON.stringify(defaultSettings), JSON.stringify(changes), userId],
        );
        if (!record) throw new Error('设置保存后未返回结果，请重新读取确认');
        return {id: record.id, settings: {...defaultSettings, ...record.config}, changes};
    },
};
