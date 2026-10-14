import {z} from 'zod';
import {tagSchema} from '@/modules/tag/contracts/schemas/response/tag/tagSchema';
import {pagedResponseSchema} from '@/shared/schemas/common/pagedResponseSchema';

// 标签列表schema - 使用pagedResponseSchema作为基础
export const tagListSchema = pagedResponseSchema(tagSchema);

// 导出类型（VO后缀，符合响应Schema规范）
export type TagListVO = z.infer<typeof tagListSchema>;