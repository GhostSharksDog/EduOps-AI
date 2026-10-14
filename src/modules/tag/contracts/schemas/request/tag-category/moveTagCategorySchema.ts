import {z} from 'zod';

// 移动标签分类schema
export const moveTagCategorySchema = z.strictObject({
    categoryId: z.uuid('要移动的分类ID必须是有效的UUID').describe('要移动的分类ID'),
    newParentId: z.uuid('新的父分类ID必须是有效的UUID').describe('新的父分类ID'),
});

// 导出TypeScript类型
export type MoveTagCategoryDTO = z.infer<typeof moveTagCategorySchema>;