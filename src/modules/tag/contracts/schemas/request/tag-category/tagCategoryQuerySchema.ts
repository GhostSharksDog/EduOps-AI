import {z} from 'zod';

export const TagCategoryQuerySchema = z.strictObject({
    page: z.number().int().min(1),
    pageSize: z.number().int().min(1),
    keyword: z.string().optional(),
    parentId: z.string().nullable().optional(),
});

export type TagCategoryQueryDTO = z.infer<typeof TagCategoryQuerySchema>;
