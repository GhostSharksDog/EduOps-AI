import {z} from 'zod';

/**
 * 分群刷新请求Schema
 * 用于手动刷新分群的成员数据
 */
export const segmentRefreshSchema = z.strictObject({
    /**
     * 分群ID
     */
    id: z.string().uuid('分群ID必须是有效的UUID').describe('分群ID'),

    /**
     * 是否强制刷新
     */
    force: z.boolean().default(false).describe('是否强制刷新')
});

/**
 * 刷新分群请求DTO类型
 */
export type SegmentRefreshDTO = z.infer<typeof segmentRefreshSchema>;