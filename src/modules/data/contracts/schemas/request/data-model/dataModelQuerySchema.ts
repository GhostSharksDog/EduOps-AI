import {z} from 'zod';
import {DataModelStatus} from '@/shared/enums/data-models/DataModelStatus';

// 数据模型查询参数 schema
export const dataModelQuerySchema = z.strictObject({
    name: z.string().trim().optional().describe('模型名称（模糊匹配）'),
    status: z.enum(DataModelStatus).optional().describe('模型状态'),
    datasourceId: z.uuid('数据源ID必须是有效的UUID').optional().describe('数据源ID'),
    page: z.coerce.number().min(1).default(1).describe('页码'),
    pageSize: z.coerce.number().min(1).max(10000).default(20).describe('每页条数'),
});

// 导出TypeScript类型
export type DataModelQueryDTO = z.infer<typeof dataModelQuerySchema>;
