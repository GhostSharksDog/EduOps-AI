// 标签相关的response schema索引文件
export {tagSchema, type TagVO} from '@/modules/tag/contracts/schemas/response/tag/tagSchema';
export {tagListSchema, type TagListVO} from '@/modules/tag/contracts/schemas/response/tag/tagListSchema';
export {tagRuleSchema} from '@/modules/tag/contracts/schemas/response/tag/tagRuleSchema';
export {tagVersionSchema, type TagVersionVO} from '@/modules/tag/contracts/schemas/response/tag/tagVersionSchema';
export {tagVersionListSchema} from '@/modules/tag/contracts/schemas/response/tag/tagVersionListSchema';
export {tagValueSchema, type TagValueVO} from '@/modules/tag/contracts/schemas/response/tag/tagValueSchema';
export {entityTagValueSchema, type EntityTagValueVO} from '@/modules/tag/contracts/schemas/response/tag/entityTagValueSchema';
export {tagFeatureSchema, type TagFeatureVO} from '@/modules/tag/contracts/schemas/response/tag/tagFeatureSchema';
export {
  mvStatusSchema,
  mvStatusReportSchema,
  mvStatusReportListSchema,
  errorLogSchema,
  errorLogListSchema,
  type MvStatus,
  type MvStatusReportVO,
  type ErrorLogVO,
} from '@/modules/tag/contracts/schemas/response/tag/monitorSchema';
export {
  tagValueResultSchema,
  type TagValueResultVO,
  tagValueBatchResponseSchema,
  type TagValueBatchResponseVO,
  tagValueSingleResponseSchema,
  type TagValueSingleResponseVO,
  TagValueResultSchema,
  TagValueBatchResponseSchema,
  TagValueSingleResponseSchema,
} from '@/modules/tag/contracts/schemas/response/tag/tagValueResultSchema';
export {TagBitmapSyncResponseSchema, type TagBitmapSyncResponse} from '@/modules/tag/contracts/schemas/response/tag/TagBitmapSyncResponseSchema';