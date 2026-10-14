import {z} from 'zod';

// 删除数据模型 schema
export const deleteDataModelSchema = z.strictObject({
    id: z.uuid('模型ID必须是有效的UUID').describe('模型ID'),
});

// 导出TypeScript类型
export type DeleteDataModelDTO = z.infer<typeof deleteDataModelSchema>;
