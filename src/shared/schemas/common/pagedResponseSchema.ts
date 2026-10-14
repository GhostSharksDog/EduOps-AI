import {z} from 'zod';

/**
 * 分页响应Schema
 * 用于包装分页查询的响应数据
 * @description 与旧版 PagedVO 保持兼容，使用扁平结构
 */
export const pagedResponseSchema = <T extends z.ZodTypeAny>(itemSchema: T) =>
    z.strictObject({
        /**
         * 数据列表
         */
        items: z.array(itemSchema).describe('数据列表'),

        /**
         * 总记录数
         */
        totalCount: z.number().int().min(0).describe('总记录数'),

        /**
         * 当前页码
         */
        page: z.number().int().min(1).describe('当前页码'),

        /**
         * 每页记录数
         */
        pageSize: z.number().int().min(1).describe('每页记录数'),

        /**
         * 总页数
         */
        totalPages: z.number().int().min(0).describe('总页数')
    });

/**
 * 分页响应类型
 * @description 与旧版 PagedVO 保持兼容，使用扁平结构
 */
export type PagedVO<T> = z.infer<ReturnType<typeof pagedResponseSchema<z.ZodType<T>>>>;
