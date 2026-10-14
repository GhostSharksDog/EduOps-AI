import {z} from 'zod';

const batchDeleteFailedItemSchema = z.strictObject({
    id: z.uuid().describe('分类ID'),
    name: z.string().describe('分类名称'),
    reason: z.string().describe('失败原因'),
});

export const batchDeleteTagCategoriesResponseSchema = z.strictObject({
    success: z.boolean().describe('批量删除操作是否成功'),
    deletedCount: z.int().min(0).describe('已删除数量'),
    message: z.string().optional().describe('操作消息'),
    failedItems: z.array(batchDeleteFailedItemSchema).optional().describe('删除失败的项'),
});

export type BatchDeleteTagCategoriesVO = z.infer<typeof batchDeleteTagCategoriesResponseSchema>;
export type BatchDeleteFailedItemVO = z.infer<typeof batchDeleteFailedItemSchema>;
