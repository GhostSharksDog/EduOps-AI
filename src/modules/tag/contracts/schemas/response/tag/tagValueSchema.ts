import {z} from 'zod';
import {TagValueStatus} from '@/shared/enums/tag/TagValueStatus';

/**
 * 标签值响应schema
 * 对应 TagValueVO
 */
export const tagValueSchema = z.strictObject({
    id: z.uuid('ID必须是有效的UUID').describe('标签值ID'),
    tagId: z.uuid('标签ID必须是有效的UUID').describe('关联的标签ID'),
    tagName: z.string().describe('标签名称'),
    entityId: z.string().describe('实体ID'),
    value: z.any().describe('标签值'),
    calculatedAt: z.date().describe('计算时间'),
    calculatedVersion: z.string().describe('计算版本'),
    status: z.enum(TagValueStatus).describe('标签值状态'),
});

// 导出类型（VO后缀，符合响应Schema规范）
export type TagValueVO = z.infer<typeof tagValueSchema>;
