import {z} from 'zod';

export const tagValueResultSchema = z.strictObject({
    entityId: z.string(),
    value: z.unknown(),
    calculatedAt: z.string().optional(),
});

export type TagValueResultVO = z.infer<typeof tagValueResultSchema>;

export const tagValueBatchResponseSchema = z.strictObject({
    data: z.array(tagValueResultSchema),
});

export type TagValueBatchResponseVO = z.infer<typeof tagValueBatchResponseSchema>;

export const tagValueSingleResponseSchema = z.strictObject({
    data: tagValueResultSchema,
});

export type TagValueSingleResponseVO = z.infer<typeof tagValueSingleResponseSchema>;

/** @deprecated Use tagValueResultSchema instead */
export const TagValueResultSchema = tagValueResultSchema;
/** @deprecated Use tagValueBatchResponseSchema instead */
export const TagValueBatchResponseSchema = tagValueBatchResponseSchema;
/** @deprecated Use tagValueSingleResponseSchema instead */
export const TagValueSingleResponseSchema = tagValueSingleResponseSchema;
