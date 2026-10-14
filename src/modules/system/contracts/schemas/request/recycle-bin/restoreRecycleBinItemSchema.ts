import {z} from 'zod';
import {RecycleBinItemType} from '@/shared/enums/RecycleBinItemType';

export const restoreRecycleBinItemSchema = z.strictObject({
    type: z.nativeEnum(RecycleBinItemType).describe('项目类型'),
});

// 导出TypeScript类型
export type RestoreRecycleBinItemDTO = z.infer<typeof restoreRecycleBinItemSchema>;
