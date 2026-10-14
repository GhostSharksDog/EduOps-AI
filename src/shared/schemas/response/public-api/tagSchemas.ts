import { z } from 'zod';
import { tagValueResultSchema } from '@/modules/tag/contracts/schemas/response/tag/tagValueResultSchema';

export const publicTagSchema = z.object({
    id: z.string().uuid(),
    name: z.string(),
    description: z.string().nullable(),
    dataType: z.string(),
    status: z.string(),
    updateCycle: z.string(),
    category: z.object({
        id: z.string().uuid(),
        name: z.string(),
    }).nullable(),
    currentVersion: z.object({
        id: z.string().uuid(),
        version: z.string(),
        createdAt: z.string(),
    }).nullable(),
    createdAt: z.string(),
    updatedAt: z.string(),
}).strict();

export type PublicTagVO = z.infer<typeof publicTagSchema>;

export const publicTagListResponseSchema = z.strictObject({
    items: z.array(publicTagSchema),
    totalCount: z.number().int(),
    page: z.number().int(),
    pageSize: z.number().int(),
    totalPages: z.number().int(),
});

export type PublicTagListResponseVO = z.infer<typeof publicTagListResponseSchema>;

export const publicTagValuesResponseSchema = z.strictObject({
    tagId: z.string().uuid(),
    tagName: z.string(),
    version: z.string().nullable(),
    data: z.array(tagValueResultSchema),
});

export type PublicTagValuesResponseVO = z.infer<typeof publicTagValuesResponseSchema>;
