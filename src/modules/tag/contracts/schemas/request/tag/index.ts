// 标签相关的schema索引文件
export {tagRuleSchema} from '@/modules/tag/contracts/schemas/request/tag/tagRuleSchema';
export {createTagSchema, type CreateTagDTO} from '@/modules/tag/contracts/schemas/request/tag/createTagSchema';
export {updateTagSchema, type UpdateTagDTO} from '@/modules/tag/contracts/schemas/request/tag/updateTagSchema';
export {createTagVersionSchema, type CreateTagVersionDTO} from '@/modules/tag/contracts/schemas/request/tag/createTagVersionSchema';
export {updateTagVersionSchema, type UpdateTagVersionDTO} from '@/modules/tag/contracts/schemas/request/tag/updateTagVersionSchema';
export {setCurrentVersionSchema} from '@/modules/tag/contracts/schemas/request/tag/setCurrentVersionSchema';
export {updateTagStatusSchema} from '@/modules/tag/contracts/schemas/request/tag/updateTagStatusSchema';
export {tagCountQuerySchema, type TagCountQueryDTO} from '@/modules/tag/contracts/schemas/request/tag/tagCountQuerySchema';
export {
  getMvStatusQuerySchema,
  getErrorLogsQuerySchema,
  resolveErrorParamsSchema,
  type GetMvStatusQueryDTO,
  type GetErrorLogsQueryDTO,
  type ResolveErrorParamsDTO,
} from '@/modules/tag/contracts/schemas/request/tag/monitorQuerySchema';
export {TagBitmapSyncRequestSchema, type TagBitmapSyncRequest} from '@/modules/tag/contracts/schemas/request/tag/TagBitmapSyncRequestSchema';