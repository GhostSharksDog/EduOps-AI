import {z} from 'zod';

export const TagBitmapSyncResponseSchema = z.object({
    success: z.boolean(),
    syncType: z.enum(['FULL', 'INCREMENTAL']).optional(),
    syncedCount: z.number().optional(),
    durationMs: z.number().optional(),
    error: z.string().optional(),
});

export type TagBitmapSyncResponse = z.infer<typeof TagBitmapSyncResponseSchema>;
