import { RecycleBinItemType } from '@/shared/enums/RecycleBinItemType';
import { TenantFilterOptions } from '@/platform/get-current-tenant';

export interface RestoreRecycleBinItemCommand {
    id: string;
    type: RecycleBinItemType;
    restoredBy: string;
    ownedBy?: string;
    tenantFilter?: TenantFilterOptions;
}
