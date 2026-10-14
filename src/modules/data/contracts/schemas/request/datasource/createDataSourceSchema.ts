import {z} from 'zod';
import {DataSourceStatus, DataSourceType} from '@/shared/enums/index';
import {featureSchema} from '@/shared/schemas/common/featureSchema';

// IP地址或域名格式验证正则
export const hostRegex = /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}|(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;

// 创建数据源请求schema
export const createDataSourceSchema = z.strictObject({
    name: z.string().trim().min(1, '数据源名称不能为空').max(255, '数据源名称不能超过255个字符').describe('数据源名称'),
    type: z.enum(DataSourceType).describe('数据源类型'),
    host: z.string().trim().min(1, '主机地址不能为空').regex(hostRegex, '主机地址格式不正确，必须是有效的IP地址或域名').describe('主机地址'),
    port: z.int().min(1, '端口号必须大于0').max(65535, '端口号不能超过65535').describe('端口号'),
    databaseName: z.string().trim().min(1, '数据库名称不能为空').max(255, '数据库名称不能超过255个字符').describe('数据库名称'),
    username: z.string().trim().min(1, '用户名不能为空').max(255, '用户名不能超过255个字符').describe('数据库用户名'),
    password: z.string().min(1, '密码不能为空').max(255, '密码不能超过255个字符').describe('数据库密码'),
    status: z.enum(DataSourceStatus).default(DataSourceStatus.DISABLED).describe('数据源状态'),
    description: z.string().trim().optional().describe('数据源描述'),
    feature: featureSchema,
});

// 导出TypeScript类型
export type CreateDataSourceDTO = z.infer<typeof createDataSourceSchema>;
