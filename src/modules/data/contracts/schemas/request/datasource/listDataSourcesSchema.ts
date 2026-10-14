import {z} from 'zod';
import {DataSourceStatus, DataSourceType, QueryDirection} from '@/shared/enums/index';

// 数据源列表查询参数schema
export const listDataSourcesSchema = z.strictObject({
    page: z.int().min(1, '页码必须大于0').default(1).optional().describe('页码'),
    pageSize: z.int().min(1, '每页数量必须大于0').max(10000, '每页数量不能超过10000').default(10).optional().describe('每页数量'),
    type: z.enum(DataSourceType).optional().describe('数据源类型筛选'),
    status: z.enum(DataSourceStatus).optional().describe('数据源状态筛选'),
    keyword: z.string().trim().optional().describe('关键词搜索'),
    sortBy: z.string().trim().optional().describe('排序字段'),
    sortOrder: z.enum(QueryDirection).default(QueryDirection.DESC).optional().describe('排序方向'),
});

// 导出TypeScript类型
export type ListDataSourcesDTO = z.infer<typeof listDataSourcesSchema>;
