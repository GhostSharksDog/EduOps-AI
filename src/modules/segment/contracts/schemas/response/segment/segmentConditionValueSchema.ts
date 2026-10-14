import {z} from 'zod';

/**
 * 分群条件值 schema - 对应 segment_condition.field_value (JSONB)
 */
export const segmentConditionValueSchema = z.union([
    z.string().trim(),
    z.number(),
    z.boolean(),
    z.array(z.union([z.string().trim(), z.number()])).default([]),
]).describe('条件值，支持字符串、数字、布尔值或数组');

// 导出类型（VO后缀，符合响应Schema规范）
export type SegmentConditionValueVO = z.infer<typeof segmentConditionValueSchema>;
