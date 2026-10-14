import {z} from 'zod';

export const batchDeleteTagCategoriesSchema = z.strictObject({
    ids: z.array(z.uuid('分类ID必须是有效的UUID'))
        .min(1, '至少选择一个分类')
        .describe('要删除的分类ID列表'),
});

export type BatchDeleteTagCategoriesDTO = z.infer<typeof batchDeleteTagCategoriesSchema>;
