import {NextRequest} from 'next/server';
import {paginationSchema} from '@/shared/schemas/common/paginationSchema';
import {IRecycleBinOHSAdapter} from '@/modules/system/services/recycle-bin/IRecycleBinOHSAdapter';
import {ListRecycleBinItemsQuery} from '@/modules/system/services/recycle-bin/queries/index';
import {
    BatchPermanentlyDeleteRecycleBinItemsCommand,
    BatchRestoreRecycleBinItemsCommand,
    PermanentlyDeleteRecycleBinItemCommand,
    RestoreRecycleBinItemCommand
} from '@/modules/system/services/recycle-bin/commands/index';
import {
    batchDeleteRecycleBinItemsSchema,
    batchRestoreRecycleBinItemsSchema,
    restoreRecycleBinItemSchema
} from '@/modules/system/contracts/schemas/request/recycle-bin/index';
import {getCurrentUserId} from '@/modules/identity/server';
import {getCurrentTenantId, createTenantFilter} from '@/platform/get-current-tenant';
import {RecycleBinItemType} from '@/shared/enums/index';

export class RecycleBinOHSAdapterImpl implements IRecycleBinOHSAdapter {
    public fromRequestToListRecycleBinItemsQuery(request: NextRequest): ListRecycleBinItemsQuery {
        const searchParams = request.nextUrl.searchParams;
        const typeValue = searchParams.get('type');
        const type = typeValue && Object.values(RecycleBinItemType).includes(typeValue as RecycleBinItemType)
            ? typeValue as RecycleBinItemType
            : undefined;
        const tenantId = getCurrentTenantId(request);
        return {
            page: paginationSchema.parse({ page: parseInt(searchParams.get('page') || '1', 10), pageSize: parseInt(searchParams.get('pageSize') || '10', 10) }).page,
            pageSize: paginationSchema.parse({ page: parseInt(searchParams.get('page') || '1', 10), pageSize: parseInt(searchParams.get('pageSize') || '10', 10) }).pageSize,
            keyword: searchParams.get('keyword') || undefined,
            type,
            deletedFrom: searchParams.get('deletedFrom') || undefined,
            deletedTo: searchParams.get('deletedTo') || undefined,
            tenantFilter: createTenantFilter(tenantId)
        };
    }

    public async fromRequestToRestoreRecycleBinItemCommand(request: NextRequest, id: string): Promise<RestoreRecycleBinItemCommand> {
        const body = await request.json();
        const dto = restoreRecycleBinItemSchema.parse(body);
        const userId = getCurrentUserId(request);
        if (!userId) {
            throw new Error('请求中未找到用户ID');
        }
        const tenantId = getCurrentTenantId(request);
        const command: RestoreRecycleBinItemCommand = {
            id,
            type: dto.type,
            restoredBy: userId,
            ownedBy: tenantId,
            tenantFilter: createTenantFilter(tenantId)
        };
        return command;
    }

    public fromRequestToPermanentlyDeleteRecycleBinItemCommand(request: NextRequest, id: string): PermanentlyDeleteRecycleBinItemCommand {
        const searchParams = request.nextUrl.searchParams;
        const typeValue = searchParams.get('type');
        const type = typeValue && Object.values(RecycleBinItemType).includes(typeValue as RecycleBinItemType)
            ? typeValue as RecycleBinItemType
            : undefined;
        const userId = getCurrentUserId(request);
        if (!userId) {
            throw new Error('请求中未找到用户ID');
        }
        if (!type) {
            throw new Error('类型为必填项');
        }
        const tenantId = getCurrentTenantId(request);
        const command: PermanentlyDeleteRecycleBinItemCommand = {
            id,
            type,
            deletedBy: userId,
            ownedBy: tenantId,
            tenantFilter: createTenantFilter(tenantId)
        };
        return command;
    }

    public async fromRequestToBatchRestoreRecycleBinItemsCommand(request: NextRequest): Promise<BatchRestoreRecycleBinItemsCommand> {
        const body = await request.json();
        const dto = batchRestoreRecycleBinItemsSchema.parse(body);
        const userId = getCurrentUserId(request);
        if (!userId) {
            throw new Error('请求中未找到用户ID');
        }
        const tenantId = getCurrentTenantId(request);
        const command: BatchRestoreRecycleBinItemsCommand = {
            ids: dto.ids,
            restoredBy: userId,
            ownedBy: tenantId,
            tenantFilter: createTenantFilter(tenantId)
        };
        return command;
    }

    public async fromRequestToBatchPermanentlyDeleteRecycleBinItemsCommand(request: NextRequest): Promise<BatchPermanentlyDeleteRecycleBinItemsCommand> {
        const body = await request.json();
        const dto = batchDeleteRecycleBinItemsSchema.parse(body);
        const userId = getCurrentUserId(request);
        if (!userId) {
            throw new Error('请求中未找到用户ID');
        }
        const tenantId = getCurrentTenantId(request);
        const command: BatchPermanentlyDeleteRecycleBinItemsCommand = {
            ids: dto.ids,
            deletedBy: userId,
            ownedBy: tenantId,
            tenantFilter: createTenantFilter(tenantId)
        };
        return command;
    }
}
