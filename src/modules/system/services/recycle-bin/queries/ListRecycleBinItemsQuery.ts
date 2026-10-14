import {z} from 'zod';
import {TenantFilterOptions} from '@/platform/get-current-tenant';
import {RecycleBinItemType} from '@/shared/enums/RecycleBinItemType';

export const ListRecycleBinItemsQuerySchema = z.strictObject({
    page: z.int().min(1).optional().describe('页码'),
    pageSize: z.int().min(1).max(100).optional().describe('每页数量'),
    keyword: z.string().trim().optional().describe('关键词搜索'),
    type: z.nativeEnum(RecycleBinItemType).optional().describe('项目类型'),
    deletedFrom: z.string().datetime().optional().describe('删除开始时间'),
    deletedTo: z.string().datetime().optional().describe('删除结束时间'),
    tenantFilter: z.custom<TenantFilterOptions>().optional().describe('租户过滤条件')
});

export type ListRecycleBinItemsQuery = z.infer<typeof ListRecycleBinItemsQuerySchema>;
