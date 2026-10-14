import {z} from 'zod';
import {bitmapTableSchema} from '@/shared/schemas/response/bitmap-table/bitmapTableSchema';

export const bitmapTableListSchema = z.strictObject({
    items: z.array(bitmapTableSchema).describe('Bitmap表列表'),
    total: z.number().int().describe('总数'),
});

export type BitmapTableListVO = z.infer<typeof bitmapTableListSchema>;
