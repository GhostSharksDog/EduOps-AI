import {z} from 'zod';
import {RecycleBinItemType} from '@/shared/enums/RecycleBinItemType';

// 批量恢复回收站项目schema
export const batchRestoreRecycleBinItemsSchema = z.strictObject({
    ids: z.array(z.strictObject({
        id: z.uuid('项目ID必须是有效的UUID').describe('项目ID'),
        type: z.nativeEnum(RecycleBinItemType).describe('项目类型'),
    })).min(1, '至少需要一个项目').describe('要恢复的项目列表'),
});

// 导出TypeScript类型
export type BatchRestoreRecycleBinItemsDTO = z.infer<typeof batchRestoreRecycleBinItemsSchema>;
