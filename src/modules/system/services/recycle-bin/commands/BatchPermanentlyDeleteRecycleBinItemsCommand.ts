import {z} from 'zod';
import { TenantFilterOptions } from '@/platform/get-current-tenant';
import { RecycleBinItemType } from '@/shared/enums/RecycleBinItemType';

export const BatchPermanentlyDeleteRecycleBinItemsCommandSchema = z.strictObject({
    ids: z.array(z.strictObject({
        id: z.string().describe('项目ID'),
        type: z.nativeEnum(RecycleBinItemType).describe('项目类型')
    })).describe('项目列表'),
    deletedBy: z.string().describe('删除人ID'),
    ownedBy: z.string().optional().describe('租户ID'),
    tenantFilter: z.custom<TenantFilterOptions>().optional().describe('租户过滤条件')
});

export type BatchPermanentlyDeleteRecycleBinItemsCommand = z.infer<typeof BatchPermanentlyDeleteRecycleBinItemsCommandSchema>;