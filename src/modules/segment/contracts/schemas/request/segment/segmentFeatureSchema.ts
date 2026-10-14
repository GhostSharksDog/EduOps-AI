import {z} from 'zod';

/**
 * 分群扩展特性 schema - 对应 segment.feature (JSONB)
 */
export const segmentFeatureSchema = z.strictObject({
    /** 计算调度配置 - 对应 segment.schedule_config */
    calculationSchedule: z.record(z.string(), z.unknown()).optional().describe('计算调度配置'),
    /** 标签列表 */
    tags: z.array(z.string().trim()).default([]).describe('标签列表'),
    /** 业务负责人ID */
    businessOwner: z.uuid('业务负责人ID必须是有效的UUID').optional().describe('业务负责人ID'),
    /** 技术负责人ID */
    technicalOwner: z.uuid('技术负责人ID必须是有效的UUID').optional().describe('技术负责人ID')
}).passthrough();

// 导出TypeScript类型
export type SegmentFeatureDTO = z.infer<typeof segmentFeatureSchema>;
