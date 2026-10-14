import {z} from 'zod';
import {featureSchema} from '@/shared/schemas/common/featureSchema';

// 创建标签分类schema
export const createTagCategorySchema = z.strictObject({
    name: z.string().trim().min(1, '分类名称不能为空').max(50, '分类名称不能超过50个字符').describe('分类名称'),
    parentId: z.uuid('父分类ID必须是有效的UUID').optional().nullable().describe('父分类ID'),
    description: z.string().trim().optional().describe('分类描述'),
    orderIndex: z.number().int().optional().default(0).describe('排序索引'),
    feature: featureSchema,
});

// 导出TypeScript类型
export type CreateTagCategoryDTO = z.infer<typeof createTagCategorySchema>;