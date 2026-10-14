import {z} from 'zod';

// 删除数据模型响应schema
export const deleteDataModelResponseSchema = z.strictObject({
    success: z.boolean().describe('操作是否成功'),
    message: z.string().trim().describe('操作消息'),
});

// 导出TypeScript类型
export type DeleteDataModelResponseVO = z.infer<typeof deleteDataModelResponseSchema>;
