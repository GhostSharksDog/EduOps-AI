import {z} from 'zod';

/**
 * 分群统计信息响应 schema
 */
export const segmentStatisticsSchema = z.strictObject({
    totalMembers: z.int().min(0).describe('总成员数'),
    estimatedMembers: z.int().min(0).optional().describe('预估成员数'),
    lastCalculatedAt: z.string().optional().describe('最后计算时间'),
    calculationDuration: z.int().min(0).optional().describe('计算时长（毫秒）'),
    memberGrowth: z.number().optional().describe('成员增长率'),
    calculationVersion: z.string().optional().describe('当前计算版本号')
});

// 导出类型（VO后缀，符合响应Schema规范）
export type SegmentStatisticsVO = z.infer<typeof segmentStatisticsSchema>;
