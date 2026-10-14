import {z} from 'zod';
import {SortOrder} from '@/shared/enums/common/SortOrder';

export const paginationSchema = z.strictObject({
    page: z.number().int().min(1, 'Page must be greater than or equal to 1'),
    pageSize: z.number().int().min(1, 'Page size must be greater than or equal to 1').max(10000, 'Page size must not exceed 10000'),
    sortOrder: z.nativeEnum(SortOrder).optional().default(SortOrder.ASC)
});

export type PaginationSchema = z.infer<typeof paginationSchema>;
