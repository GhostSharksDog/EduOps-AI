import {z} from 'zod';
import {tagCategorySchema} from '@/modules/tag/contracts/schemas/response/tag-category/tagCategorySchema';
import {pagedResponseSchema} from '@/shared/schemas/common/pagedResponseSchema';

// 标签分类列表schema - 使用pagedResponseSchema作为基础
export const tagCategoryListSchema = pagedResponseSchema(tagCategorySchema);

// 导出对应的类型
export type TagCategoryListVO = z.infer<typeof tagCategoryListSchema>;