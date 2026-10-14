import {z} from 'zod';

// 批量恢复回收站项目响应schema
export const batchRestoreRecycleBinItemsResponseSchema = z.strictObject({
    success: z.boolean().describe('批量恢复操作是否成功'),
    restoredCount: z.int().min(0).describe('已恢复数量'),
});

// 导出TypeScript类型
export type BatchRestoreRecycleBinItemsVO = z.infer<typeof batchRestoreRecycleBinItemsResponseSchema>;
