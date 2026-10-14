import {z} from 'zod';
import {DataSourceStatus, DataSourceType} from '@/shared/enums/index';
import {featureSchema} from '@/shared/schemas/common/featureSchema';

// 数据源响应schema
export const dataSourceSchema = z.strictObject({
    id: z.uuid().describe('唯一标识符'),
    name: z.string().trim().describe('数据源名称'),
    type: z.enum(DataSourceType).describe('数据源类型'),
    host: z.string().trim().describe('主机地址'),
    port: z.int().describe('端口号'),
    databaseName: z.string().trim().describe('数据库名称'),
    username: z.string().trim().describe('数据库用户名'),
    status: z.enum(DataSourceStatus).describe('数据源状态'),
    ownedBy: z.uuid().optional().describe('当前所有者'),
    description: z.string().trim().optional().describe('数据源描述'),
    feature: featureSchema,
    isDeleted: z.boolean().describe('是否已删除'),
    recordCount: z.number().int().min(0).optional().describe('数据源记录数'),
    lastSync: z.string().optional().describe('最后同步时间'),
    createTime: z.iso.datetime('创建时间必须是有效的日期时间格式').describe('创建时间'),
    updateTime: z.iso.datetime('更新时间必须是有效的日期时间格式').optional().describe('更新时间'),
    deleteTime: z.iso.datetime('删除时间必须是有效的日期时间格式').optional().describe('删除时间'),
    createdBy: z.uuid().optional().describe('创建人'),
    updatedBy: z.uuid().optional().describe('更新人'),
    deletedBy: z.uuid().nullable().optional().describe('删除人'),
});

// 导出TypeScript类型
export type DataSourceVO = z.infer<typeof dataSourceSchema>;
