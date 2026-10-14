import {ListRecycleBinItemsQuery} from '@/modules/system/services/recycle-bin/queries/index';
import {
    BatchPermanentlyDeleteRecycleBinItemsCommand,
    BatchRestoreRecycleBinItemsCommand,
    PermanentlyDeleteRecycleBinItemCommand,
    RestoreRecycleBinItemCommand
} from '@/modules/system/services/recycle-bin/commands/index';
import {RecycleBinItemListVO} from '@/modules/system/contracts/schemas/response/recycle-bin/index';

export interface RecycleBinApplicationService {
    listRecycleBinItems(query: ListRecycleBinItemsQuery): Promise<RecycleBinItemListVO>;

    restoreRecycleBinItem(command: RestoreRecycleBinItemCommand): Promise<{ success: boolean }>;

    permanentlyDeleteRecycleBinItem(command: PermanentlyDeleteRecycleBinItemCommand): Promise<{ success: boolean }>;

    batchRestoreRecycleBinItems(command: BatchRestoreRecycleBinItemsCommand): Promise<{
        success: boolean;
        restoredCount: number
    }>;

    batchPermanentlyDeleteRecycleBinItems(command: BatchPermanentlyDeleteRecycleBinItemsCommand): Promise<{
        success: boolean;
        deletedCount: number
    }>;
}
