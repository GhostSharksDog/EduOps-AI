import {z} from 'zod';
import {modelColumnUpdateSchema} from '@/modules/data/contracts/schemas/request/data-model/modelColumnUpdateSchema';
import {featureSchema} from '@/shared/schemas/common/featureSchema';

// 更新数据模型 schema
export const updateDataModelSchema = z.strictObject({
    id: z.uuid('模型ID必须是有效的UUID').describe('模型ID'),
    name: z.string().trim().max(255, '模型名称不能超过255个字符').optional().describe('模型名称'),
    description: z.string().trim().optional().describe('模型描述'),
    tableName: z.string().trim().max(255, '表名不能超过255个字符').optional().describe('表名'),
    columns: z.array(modelColumnUpdateSchema).default([]).describe('列定义列表'),
    feature: featureSchema.optional(),
    ownedBy: z.uuid('所有者ID必须是有效的UUID').optional().describe('所有者ID'),
});

// 导出TypeScript类型
export type UpdateDataModelDTO = z.infer<typeof updateDataModelSchema>;
