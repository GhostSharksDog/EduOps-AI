import {z} from 'zod';
import {SortOrder} from '@/shared/enums/index';

/**
 * 分页查询参数Schema
 * 用于处理通用的分页、排序和筛选参数
 */
export const paginationQuerySchema = z.strictObject({
    /**
     * 当前页码
     */
    page: z.coerce.number().int().min(1).default(1).describe('当前页码'),

    /**
     * 每页记录数
     */
    pageSize: z.coerce.number().int().min(1).max(10000).default(10).describe('每页记录数'),

    /**
     * 排序字段
     */
    sortBy: z.string().trim().optional().describe('排序字段'),

    /**
     * 排序方向
     */
    sortOrder: z.enum(SortOrder).default(SortOrder.ASC).describe('排序方向'),

    /**
     * 搜索关键词
     */
    keyword: z.string().trim().optional().describe('搜索关键词'),

    /**
     * 筛选条件
     */
    filters: z.record(z.string(), z.unknown()).optional().describe('筛选条件'),

    /**
     * 包含关系
     */
    include: z.array(z.string()).optional().describe('包含关系')
});

/**
 * 分页查询参数DTO类型
 */
export type PaginationQueryDTO = z.infer<typeof paginationQuerySchema>;

/**
 * 分页响应Schema
 * 用于包装分页查询的响应数据
 */
export const paginationResponseSchema = <T extends z.ZodTypeAny>(itemSchema: T) =>
    z.strictObject({
        /**
         * 数据列表
         */
        items: z.array(itemSchema).describe('数据列表'),

        /**
         * 分页信息
         */
        pagination: z.strictObject({
            /**
             * 当前页码
             */
            page: z.number().int().min(1).describe('当前页码'),

            /**
             * 每页记录数
             */
            pageSize: z.number().int().min(1).describe('每页记录数'),

            /**
             * 总记录数
             */
            total: z.number().int().min(0).describe('总记录数'),

            /**
             * 总页数
             */
            totalPages: z.number().int().min(1).describe('总页数')
        }).describe('分页信息')
    });

/**
 * 分页响应类型
 */
export type PaginationResponse<T> = z.infer<ReturnType<typeof paginationResponseSchema<z.ZodType<T>>>>