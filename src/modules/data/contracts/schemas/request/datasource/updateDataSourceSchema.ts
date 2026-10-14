import {z} from 'zod';
import {DataSourceStatus} from '@/shared/enums/index';
import {featureSchema} from '@/shared/schemas/common/featureSchema';
import {hostRegex} from '@/modules/data/contracts/schemas/request/datasource/createDataSourceSchema';

export const updateDataSourceSchema = z.strictObject({
    name: z.string().trim().min(1).max(255).optional(),
    host: z.string().trim().min(1).regex(hostRegex, '主机地址格式不正确，必须是有效的IP地址或域名').optional(),
    port: z.int().min(1).max(65535).optional(),
    databaseName: z.string().trim().min(1).optional(),
    username: z.string().trim().min(1).optional(),
    password: z.string().min(0).max(255).optional(),
    status: z.enum(DataSourceStatus).optional(),
    description: z.string().trim().optional(),
    feature: featureSchema.optional(),
});

// 导出TypeScript类型
export type UpdateDataSourceDTO = z.infer<typeof updateDataSourceSchema>;
