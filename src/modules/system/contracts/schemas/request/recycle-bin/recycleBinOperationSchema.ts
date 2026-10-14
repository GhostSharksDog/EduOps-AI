import {z} from 'zod';
import {RecycleBinItemType} from '@/shared/enums/RecycleBinItemType';

export const RestoreItemSchema = z.strictObject({
    id: z.string(),
    type: z.nativeEnum(RecycleBinItemType),
});

export type RestoreItemDTO = z.infer<typeof RestoreItemSchema>;

export const BatchOperationSchema = z.strictObject({
    ids: z.array(RestoreItemSchema),
});

export type BatchOperationDTO = z.infer<typeof BatchOperationSchema>;
