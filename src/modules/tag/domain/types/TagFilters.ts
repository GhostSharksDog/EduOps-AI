import {ComparisonOperator, SortOrder} from '@/shared/enums/index';
import type {TenantFilterOptions} from '@/platform/get-current-tenant';

/**
 * Tag category filter for querying categories
 */
export interface TagCategoryFilter {
    tenantFilter?: TenantFilterOptions;
    parentId?: string;
    keyword?: string;
    skip?: number;
    take?: number;
    sortBy?: string;
    sortOrder?: SortOrder;
}

/**
 * Tag query filter for searching tags
 */
export interface TagQueryFilter {
    ownedBy?: string;
    tenantFilter?: {tenantId?: string};
    categoryId?: string;
    type?: string;
    status?: string;
    name?: string;
    ids?: string[];
    isPublic?: boolean;
    skip?: number;
    take?: number;
    sortOrder?: SortOrder;
}

/**
 * Tag value filter for querying tag values
 */
export interface TagValueFilter {
    value?: unknown;
    operator?: ComparisonOperator;
    skip?: number;
    take?: number;
}

/**
 * Result from findWithoutTagValue
 */
export interface EntityIdResult {
    entityId: string;
}
