import {z} from 'zod';
import {bitmapTableSchema, bitInfoSchema} from '@/shared/schemas/response/bitmap-table/bitmapTableSchema';

export const bitmapTableDetailSchema = z.strictObject({
    ...bitmapTableSchema.shape,
    bits: z.array(bitInfoSchema).describe('所有位的详细信息'),
});

export type BitmapTableDetailVO = z.infer<typeof bitmapTableDetailSchema>;
