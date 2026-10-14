import {z} from 'zod';
import {TagStatus, TagValueType} from '@/shared/enums/index';

// 标签统计查询schema
export const tagCountQuerySchema = z.strictObject({
    valueType: z.enum(TagValueType).optional().describe('标签值类型'),
    categoryId: z.uuid('分类ID必须是有效的UUID').optional().describe('标签分类ID'),
    status: z.enum(TagStatus).optional().describe('标签状态：DRAFT(草稿), ACTIVE(激活), INACTIVE(停用), DEPRECATED(废弃)'),
});

// 导出类型（DTO 后缀，符合请求 Schema 规范）
export type TagCountQueryDTO = z.infer<typeof tagCountQuerySchema>;
