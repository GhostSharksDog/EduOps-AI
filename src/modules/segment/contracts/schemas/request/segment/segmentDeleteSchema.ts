import {z} from 'zod';

/**
 * 删除分群请求Schema
 * 用于删除指定的分群
 */
export const segmentDeleteSchema = z.strictObject({
    /**
     * 分群ID
     */
    id: z.string().uuid('分群ID必须是有效的UUID').describe('分群ID'),

    /**
     * 删除人
     */
    deletedBy: z.string().uuid('删除人ID必须是有效的UUID').describe('删除人')
});

/**
 * 删除分群请求DTO类型
 */
export type SegmentDeleteDTO = z.infer<typeof segmentDeleteSchema>;