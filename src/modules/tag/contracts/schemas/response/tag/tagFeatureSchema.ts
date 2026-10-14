import {z} from 'zod';
import {TagType} from '@/shared/enums/index';

/**
 * 标签扩展特性 response schema
 * 用于定义 tag.version.feature (JSONB) 的结构
 */
export const tagFeatureSchema = z.object({
    /** 标签类型 - 简单标签或计算标签 */
    tagType: z.enum(TagType).optional().describe('标签类型')
}).passthrough();

/**
 * 标签扩展特性类型
 */
export type TagFeatureVO = z.infer<typeof tagFeatureSchema>;
