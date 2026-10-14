import {z} from 'zod';
import {RecycleBinItemType} from '@/shared/enums/index';

// 回收站项目列表查询schema
export const listRecycleBinItemsQuerySchema = z.strictObject({
    page: z.int().min(1).optional().describe('页码'),
    pageSize: z.int().min(1).max(10000).optional().describe('每页数量'),
    keyword: z.string().trim().optional().describe('关键词搜索'),
    type: z.nativeEnum(RecycleBinItemType).optional().describe('项目类型'),
    deletedFrom: z.iso.datetime('删除起始时间必须是有效的日期时间格式').optional().describe('删除起始时间'),
    deletedTo: z.iso.datetime('删除结束时间必须是有效的日期时间格式').optional().describe('删除结束时间'),
});

// 导出TypeScript类型
export type ListRecycleBinItemsQueryDTO = z.infer<typeof listRecycleBinItemsQuerySchema>;
