import {z} from 'zod';
import {TagStatus} from '@/shared/enums/tag/TagStatus';

// 更新标签状态schema
export const updateTagStatusSchema = z.strictObject({
    id: z.uuid('标签ID必须是有效的UUID').describe('标签ID'),
    status: z.enum(TagStatus).describe('目标状态'),
});

// 导出TypeScript类型
export type UpdateTagStatusDTO = z.infer<typeof updateTagStatusSchema>;