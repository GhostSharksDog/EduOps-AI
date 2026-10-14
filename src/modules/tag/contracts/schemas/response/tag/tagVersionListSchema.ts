import {z} from 'zod';
import {tagVersionSchema} from '@/modules/tag/contracts/schemas/response/tag/tagVersionSchema';
import {pagedResponseSchema} from '@/shared/schemas/common/pagedResponseSchema';

// 标签版本列表schema - 使用pagedResponseSchema作为基础
export const tagVersionListSchema = pagedResponseSchema(tagVersionSchema);

// 导出类型（VO后缀，符合响应Schema规范）
export type TagVersionListVO = z.infer<typeof tagVersionListSchema>;