import {z} from 'zod';

/**
 * 分群增长历史记录
 */
const segmentGrowthHistorySchema = z.strictObject({
    date: z.string().describe('日期'),
    memberCount: z.int().min(0).describe('成员数量'),
    growthCount: z.int().describe('增长数量'),
    growthRate: z.number().describe('增长率')
});

/**
 * 分群增长报告响应 Schema
 */
export const segmentGrowthReportSchema = z.strictObject({
    segmentId: z.string().uuid().describe('分群ID'),
    totalMembers: z.int().min(0).describe('总成员数'),
    growthRate: z.number().describe('增长率'),
    history: z.array(segmentGrowthHistorySchema).default([]).describe('增长历史')
});

export type SegmentGrowthReportVO = z.infer<typeof segmentGrowthReportSchema>;