import {z} from 'zod';

// 恢复回收站项目响应schema
export const restoreRecycleBinItemResponseSchema = z.strictObject({
    success: z.boolean().describe('恢复操作是否成功'),
});

// 导出TypeScript类型
export type RestoreRecycleBinItemVO = z.infer<typeof restoreRecycleBinItemResponseSchema>;
