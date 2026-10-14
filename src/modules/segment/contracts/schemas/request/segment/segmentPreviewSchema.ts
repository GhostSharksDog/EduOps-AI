import {z} from 'zod';
import {segmentConditionGroupSchema} from '@/modules/segment/contracts/schemas/request/segment/segmentConditionGroupSchema';

/**
 * 预览分群请求Schema
 * 用于预览分群的成员数据
 */
export const segmentPreviewSchema = z.strictObject({
    /**
     * 条件组
     */
    conditionGroup: segmentConditionGroupSchema
});

/**
 * 预览分群请求DTO类型
 */
export type SegmentPreviewDTO = z.infer<typeof segmentPreviewSchema>;