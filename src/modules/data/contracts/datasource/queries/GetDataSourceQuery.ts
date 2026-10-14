import {TenantFilterOptions} from '@/platform/get-current-tenant';

export interface GetDataSourceQuery {
    id: string;
    tenantFilter?: TenantFilterOptions;
}
