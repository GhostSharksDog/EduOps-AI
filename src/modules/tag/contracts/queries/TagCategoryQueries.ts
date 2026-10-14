import {TenantFilterOptions} from '@/platform/get-current-tenant';

/**
 * 获取标签分类查询
 */
export interface GetTagCategoryQuery {
    categoryId: string;
    tenantFilter?: TenantFilterOptions;
}

/**
 * 列出标签分类查询
 */
export interface ListTagCategoriesQuery {
    parentId?: string;
    page?: number;
    pageSize?: number;
    keyword?: string;
    tenantFilter?: TenantFilterOptions;
}
