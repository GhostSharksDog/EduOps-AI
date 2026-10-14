import {z} from 'zod';

/**
 * 分群条件值 schema - 对应 segment_condition.field_value (JSONB)
 */
export const segmentConditionValueSchema = z.union([
    z.string().trim(),
    z.number(),
    z.boolean(),
    z.array(z.union([z.string().trim(), z.number()])),
]);

// 导出TypeScript类型
export type SegmentConditionValueDTO = z.infer<typeof segmentConditionValueSchema>;
