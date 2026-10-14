import {z} from 'zod';
import {tagValueSchema} from '@/modules/tag/contracts/schemas/response/tag/tagValueSchema';

/**
 * 实体标签值响应schema
 * 对应 EntityTagValueVO
 */
export const entityTagValueSchema = z.strictObject({
    entityId: z.string().describe('实体ID'),
    tags: z.array(tagValueSchema).describe('标签值列表'),
});

// 导出类型（VO后缀，符合响应Schema规范）
export type EntityTagValueVO = z.infer<typeof entityTagValueSchema>;
