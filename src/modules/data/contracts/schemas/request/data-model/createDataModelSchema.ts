import {z} from 'zod';
import {DataModelStatus} from '@/shared/enums/data-models/DataModelStatus';
import {modelColumnCreateSchema} from '@/modules/data/contracts/schemas/request/data-model/modelColumnCreateSchema';
import {featureSchema} from '@/shared/schemas/common/featureSchema';

// 创建数据模型 schema
export const createDataModelSchema = z.strictObject({
    name: z.string().trim().min(1, '模型名称不能为空').max(255, '模型名称不能超过255个字符').describe('模型名称'),
    description: z.string().trim().optional().describe('模型描述'),
    datasourceId: z.uuid('数据源ID必须是有效的UUID').describe('数据源ID'),
    tableName: z.string().trim().max(255, '表名不能超过255个字符').optional().describe('表名'),
    status: z.enum(DataModelStatus)
        .default(DataModelStatus.DRAFT)
        .describe('模型状态'),
    columns: z.array(modelColumnCreateSchema).default([]).describe('列定义列表'),
    feature: featureSchema.optional(),
    ownedBy: z.uuid('所有者ID必须是有效的UUID').describe('所有者ID'),
});

// 导出类型（DTO 后缀，符合请求 Schema 规范）
export type CreateDataModelDTO = z.infer<typeof createDataModelSchema>;
