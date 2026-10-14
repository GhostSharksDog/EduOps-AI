import {z} from 'zod';
import {pagedResponseSchema} from '@/shared/schemas/common/pagedResponseSchema';
import {dataSourceSchema} from '@/modules/data/contracts/schemas/response/datasource/dataSourceSchema';

// 数据源列表响应schema - 使用pagedResponseSchema作为基础
export const dataSourceListSchema = pagedResponseSchema(dataSourceSchema);

// 导出TypeScript类型
export type DataSourceListVO = z.infer<typeof dataSourceListSchema>;
