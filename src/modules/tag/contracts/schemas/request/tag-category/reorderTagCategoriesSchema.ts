import {z} from 'zod';

// 重新排序标签分类schema
export const reorderTagCategoriesSchema = z.strictObject({
    categoryIds: z.array(z.uuid('分类ID必须是有效的UUID')).default([]).describe('分类ID数组'),
    orderIndex: z.array(z.int()).default([]).describe('排序值数组'),
});

// 导出TypeScript类型
export type ReorderTagCategoriesDTO = z.infer<typeof reorderTagCategoriesSchema>;