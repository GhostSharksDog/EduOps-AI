import {z} from 'zod';
import {RecycleBinItemType} from '@/shared/enums/RecycleBinItemType';

// 回收站项目响应schema
export const recycleBinItemSchema = z.strictObject({
    id: z.uuid().describe('项目ID'),
    type: z.enum(RecycleBinItemType).describe('项目类型'),
    name: z.string().trim().describe('项目名称'),
    description: z.string().trim().optional().nullable().describe('项目描述'),
    deletedAt: z.iso.datetime().describe('删除时间'),
    deletedBy: z.uuid().optional().nullable().describe('删除人ID'),
    originalData: z.record(z.string(), z.unknown()).describe('原始数据'),
});

// 导出TypeScript类型
export type RecycleBinItemVO = z.infer<typeof recycleBinItemSchema>;
