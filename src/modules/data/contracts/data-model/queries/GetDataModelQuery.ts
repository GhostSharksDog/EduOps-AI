import {TenantFilterOptions} from '@/platform/get-current-tenant';

export interface GetDataModelQuery {
    modelId: string;
    tenantFilter?: TenantFilterOptions;
}
