import {z} from 'zod';

// 测试数据源连接响应schema
export const testDataSourceConnectionResponseSchema = z.strictObject({
    success: z.boolean().describe('连接测试是否成功'),
    message: z.string().describe('测试结果消息'),
    details: z.record(z.string(), z.unknown()).optional().describe('详细信息'),
});

// 导出TypeScript类型
export type TestDataSourceConnectionResponseVO = z.infer<typeof testDataSourceConnectionResponseSchema>;
