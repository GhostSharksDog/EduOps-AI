import {z} from 'zod';
import {featureSchema} from '@/shared/schemas/common/featureSchema';

// 更新标签分类schema
export const updateTagCategorySchema = z.strictObject({
    id: z.uuid('分类ID必须是有效的UUID').describe('分类ID'),
    name: z.string().trim().min(1, '分类名称不能为空').max(50, '分类名称不能超过50个字符').optional().describe('分类名称'),
    parentId: z.uuid().optional().nullable().describe('父分类ID'),
    description: z.string().trim().optional().describe('分类描述'),
    orderIndex: z.int().optional().describe('排序索引'),
    feature: featureSchema,
});

// 导出TypeScript类型
export type UpdateTagCategoryDTO = z.infer<typeof updateTagCategorySchema>;