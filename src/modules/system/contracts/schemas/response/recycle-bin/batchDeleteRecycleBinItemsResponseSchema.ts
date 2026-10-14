import {z} from 'zod';

// 批量删除回收站项目响应schema
export const batchDeleteRecycleBinItemsResponseSchema = z.strictObject({
    success: z.boolean().describe('批量删除操作是否成功'),
    deletedCount: z.int().min(0).describe('已删除数量'),
});

// 导出TypeScript类型
export type BatchDeleteRecycleBinItemsVO = z.infer<typeof batchDeleteRecycleBinItemsResponseSchema>;
