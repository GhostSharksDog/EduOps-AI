import {z} from 'zod';
import {RecycleBinItemType} from '@/shared/enums/RecycleBinItemType';

// 批量删除回收站项目schema
export const batchDeleteRecycleBinItemsSchema = z.strictObject({
    ids: z.array(z.strictObject({
        id: z.uuid('项目ID必须是有效的UUID').describe('项目ID'),
        type: z.nativeEnum(RecycleBinItemType).describe('项目类型'),
    })).default([]).describe('要删除的项目列表'),
});

// 导出TypeScript类型
export type BatchDeleteRecycleBinItemsDTO = z.infer<typeof batchDeleteRecycleBinItemsSchema>;
