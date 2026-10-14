import {z} from 'zod';

export const TagBitmapSyncRequestSchema = z.strictObject({
    forceFullSync: z.boolean().default(false).describe('是否强制全量同步'),
});

export type TagBitmapSyncRequest = z.infer<typeof TagBitmapSyncRequestSchema>;
