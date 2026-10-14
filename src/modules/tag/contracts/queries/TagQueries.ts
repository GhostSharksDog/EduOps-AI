import {TagStatus} from '@/shared/enums/index';
import {TenantFilterOptions} from '@/platform/get-current-tenant';

/**
 * 获取标签查询
 */
export interface GetTagQuery {
    tagId: string;
    tenantFilter?: TenantFilterOptions;
}

/**
 * 列出标签查询
 */
export interface ListTagsQuery {
    ownedBy?: string;
    isPublic?: boolean;
    page?: number;
    pageSize?: number;
    categoryId?: string;
    type?: 'SIMPLE' | 'CALCULATED';
    status?: TagStatus;
    keyword?: string;
    tenantFilter?: TenantFilterOptions;
    [key: string]: unknown;
}

/**
 * 列出标签版本查询
 */
export interface ListTagVersionsQuery {
    tagId: string;
    page?: number;
    pageSize?: number;
}

/**
 * 搜索标签查询
 */
export interface SearchTagsQuery {
    /** 仅由服务端身份赋值；用于机构私有标签列表。 */
    ownedBy?: string;
    isPublic?: boolean;
    tenantFilter?: TenantFilterOptions;
    name?: string;
    type?: 'SIMPLE' | 'CALCULATED';
    valueType?: string;
    categoryId?: string;
    status?: TagStatus;
    createdBy?: string;
    technicalOwner?: string;
    businessOwner?: string;
    page?: number;
    pageSize?: number;
}

/**
 * 按分类获取标签查�?
 */
export interface GetTagsByCategoryQuery {
    categoryId: string;
    page?: number;
    pageSize?: number;
}

/**
 * 按类型获取标签查�?
 */
export interface GetTagsByTypeQuery {
    type: 'SIMPLE' | 'CALCULATED';
    page?: number;
    pageSize?: number;
}

/**
 * 按状态获取标签查�?
 */
export interface GetTagsByStatusQuery {
    status: TagStatus;
    page?: number;
    pageSize?: number;
}

/**
 * 统计标签数量查询
 */
export interface CountTagsQuery {
    ownedBy?: string;
    isPublic?: boolean;
    tenantFilter?: TenantFilterOptions;
    type?: 'SIMPLE' | 'CALCULATED';
    valueType?: string;
    categoryId?: string;
    status?: TagStatus;
    name?: string;
}

/**
 * 导出标签查询
 */
export interface ExportTagsQuery {
    type?: 'SIMPLE' | 'CALCULATED';
    valueType?: string;
    categoryId?: string;
    status?: TagStatus;
    format: string;
}
