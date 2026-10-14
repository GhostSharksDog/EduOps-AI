import {DataModelStatus} from '@/shared/enums/index';
import {TenantFilterOptions} from '@/platform/get-current-tenant';

export interface ListDataModelsQuery {
    page: number;
    pageSize: number;
    name?: string;
    status?: DataModelStatus;
    datasourceId?: string;
    tenantFilter?: TenantFilterOptions;
}
