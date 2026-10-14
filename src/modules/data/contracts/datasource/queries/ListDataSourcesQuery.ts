import {DataSourceStatus, DataSourceType} from '@/shared/enums/datasource/index';
import {TenantFilterOptions} from '@/platform/get-current-tenant';

export interface ListDataSourcesQuery {
    page?: number;
    pageSize?: number;
    type?: DataSourceType;
    status?: DataSourceStatus;
    keyword?: string;
    tenantFilter?: TenantFilterOptions;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
}
