import {z} from 'zod';
import {SegmentStatus} from '@/shared/enums/index';

/**
 * 变更分群状态请求Schema
 * 用于更新分群的状态
 */
export const segmentChangeStatusSchema = z.strictObject({
    /**
     * 分群ID
     */
    id: z.string().uuid('分群ID必须是有效的UUID').describe('分群ID'),

    /**
     * 目标状态：DRAFT(草稿), ACTIVE(激活), INACTIVE(停用), CALCULATING(计算中)
     */
    status: z.enum(SegmentStatus).describe('目标状态')
});

/**
 * 变更分群状态请求DTO类型
 */
export type SegmentChangeStatusDTO = z.infer<typeof segmentChangeStatusSchema>;