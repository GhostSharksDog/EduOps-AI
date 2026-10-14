import {z} from 'zod';

/**
 * 分群增长分析请求Schema
 * 用于分析分群成员的增长趋势
 */
export const segmentGrowthAnalysisSchema = z.strictObject({
    /**
     * 分群ID
     */
    segmentId: z.string().uuid('分群ID必须是有效的UUID').describe('分群ID'),

    /**
     * 开始日期
     */
    startDate: z.coerce.date().describe('开始日期'),

    /**
     * 结束日期
     */
    endDate: z.coerce.date().describe('结束日期'),

    /**
     * 时间间隔：day(天), week(周), month(月)
     */
    interval: z.enum(['day', 'week', 'month']).describe('时间间隔')
});

/**
 * 分群增长分析请求DTO类型
 */
export type SegmentGrowthAnalysisDTO = z.infer<typeof segmentGrowthAnalysisSchema>;