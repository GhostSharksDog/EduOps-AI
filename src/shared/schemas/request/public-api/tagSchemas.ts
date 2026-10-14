import { z } from 'zod';

export const listPublicTagsQuerySchema = z.strictObject({
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().positive().max(100).default(20),
    status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
    categoryId: z.string().uuid().optional(),
});

export type ListPublicTagsQuery = z.infer<typeof listPublicTagsQuerySchema>;

export const getPublicTagValuesQuerySchema = z.strictObject({
    entityIds: z.string().min(1, 'entityIds is required'),
    versionId: z.string().uuid().optional(),
});

export type GetPublicTagValuesQuery = z.infer<typeof getPublicTagValuesQuerySchema>;
