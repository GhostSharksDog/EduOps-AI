import {z} from 'zod';

export const updateBitmapTableStatusSchema = z.strictObject({
    status: z
        .enum(['ACTIVE', 'INACTIVE'])
        .describe('表状态'),
});

export type UpdateBitmapTableStatusDTO = z.infer<typeof updateBitmapTableStatusSchema>;
