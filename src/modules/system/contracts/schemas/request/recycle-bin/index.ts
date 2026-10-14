// 回收站请求schema索引文件
export {listRecycleBinItemsQuerySchema} from '@/modules/system/contracts/schemas/request/recycle-bin/listRecycleBinItemsQuerySchema';
export type {ListRecycleBinItemsQueryDTO} from '@/modules/system/contracts/schemas/request/recycle-bin/listRecycleBinItemsQuerySchema';
export {restoreRecycleBinItemSchema} from '@/modules/system/contracts/schemas/request/recycle-bin/restoreRecycleBinItemSchema';
export type {RestoreRecycleBinItemDTO} from '@/modules/system/contracts/schemas/request/recycle-bin/restoreRecycleBinItemSchema';
export {batchDeleteRecycleBinItemsSchema} from '@/modules/system/contracts/schemas/request/recycle-bin/batchDeleteRecycleBinItemsSchema';
export type {BatchDeleteRecycleBinItemsDTO} from '@/modules/system/contracts/schemas/request/recycle-bin/batchDeleteRecycleBinItemsSchema';
export {batchRestoreRecycleBinItemsSchema} from '@/modules/system/contracts/schemas/request/recycle-bin/batchRestoreRecycleBinItemsSchema';
export type {BatchRestoreRecycleBinItemsDTO} from '@/modules/system/contracts/schemas/request/recycle-bin/batchRestoreRecycleBinItemsSchema';
export {RestoreItemSchema, type RestoreItemDTO, BatchOperationSchema, type BatchOperationDTO} from '@/modules/system/contracts/schemas/request/recycle-bin/recycleBinOperationSchema';
