import { TenantFilterOptions } from '@/platform/get-current-tenant';
import { RecycleBinItemType } from '@/shared/enums/RecycleBinItemType';

export interface BatchRestoreRecycleBinItemsCommand {
    ids: Array<{
        id: string;
        type: RecycleBinItemType;
    }>;
    restoredBy: string;
    ownedBy?: string;
    tenantFilter?: TenantFilterOptions;
}
