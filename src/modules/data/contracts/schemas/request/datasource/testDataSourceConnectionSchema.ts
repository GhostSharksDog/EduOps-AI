import {z} from 'zod';

// 测试数据源连接请求schema
export const testDataSourceConnectionSchema = z.strictObject({
    id: z.uuid('数据源ID必须是有效的UUID').describe('数据源ID'),
});

// 导出TypeScript类型
export type TestDataSourceConnectionDTO = z.infer<typeof testDataSourceConnectionSchema>;
