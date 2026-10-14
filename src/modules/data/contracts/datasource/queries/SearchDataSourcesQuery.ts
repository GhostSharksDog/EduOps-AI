import {DataSourceStatus, DataSourceType} from '@/shared/enums/datasource/index';
import {TenantFilterOptions} from '@/platform/get-current-tenant';

export interface SearchDataSourcesQuery {
    keyword?: string;
    type?: DataSourceType;
    status?: DataSourceStatus;
    ownedBy?: string;
    page?: number;
    pageSize?: number;
    tenantFilter?: TenantFilterOptions;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
}
