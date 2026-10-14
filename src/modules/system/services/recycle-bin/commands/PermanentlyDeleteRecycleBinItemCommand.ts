import { RecycleBinItemType } from '@/shared/enums/RecycleBinItemType';
import { TenantFilterOptions } from '@/platform/get-current-tenant';

export interface PermanentlyDeleteRecycleBinItemCommand {
    id: string;
    type: RecycleBinItemType;
    deletedBy: string;
    ownedBy?: string;
    tenantFilter?: TenantFilterOptions;
}
