import {z} from 'zod';

// 标签分类摘要schema
export const tagCategorySummarySchema = z.strictObject({
    id: z.uuid().describe('分类ID'),
    name: z.string().describe('分类名称'),
    path: z.string().describe('分类路径'),
});

// 导出对应的类型
export type TagCategorySummaryVO = z.infer<typeof tagCategorySummarySchema>;