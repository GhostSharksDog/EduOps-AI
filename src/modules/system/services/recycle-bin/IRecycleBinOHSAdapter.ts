import {NextRequest} from 'next/server';
import {ListRecycleBinItemsQuery} from '@/modules/system/services/recycle-bin/queries/index';
import {
    BatchPermanentlyDeleteRecycleBinItemsCommand,
    BatchRestoreRecycleBinItemsCommand,
    PermanentlyDeleteRecycleBinItemCommand,
    RestoreRecycleBinItemCommand
} from '@/modules/system/services/recycle-bin/commands/index';

export interface IRecycleBinOHSAdapter {
    fromRequestToListRecycleBinItemsQuery(request: NextRequest): ListRecycleBinItemsQuery;

    fromRequestToRestoreRecycleBinItemCommand(request: NextRequest, id: string): Promise<RestoreRecycleBinItemCommand>;

    fromRequestToPermanentlyDeleteRecycleBinItemCommand(request: NextRequest, id: string): PermanentlyDeleteRecycleBinItemCommand;

    fromRequestToBatchRestoreRecycleBinItemsCommand(request: NextRequest): Promise<BatchRestoreRecycleBinItemsCommand>;

    fromRequestToBatchPermanentlyDeleteRecycleBinItemsCommand(request: NextRequest): Promise<BatchPermanentlyDeleteRecycleBinItemsCommand>;
}
