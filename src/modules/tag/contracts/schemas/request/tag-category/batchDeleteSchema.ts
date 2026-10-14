import {z} from 'zod';

export const batchDeleteTagCategoriesSchema = z.object({
    ids: z.array(z.string().uuid())
        .min(1, '至少选择一个分类')
        .max(100, '单次最多删除 100 个分类'),
});

export type BatchDeleteTagCategoriesDTO = z.infer<typeof batchDeleteTagCategoriesSchema>;
