import {z} from 'zod';
import {segmentCalculationLogSchema} from '@/modules/segment/contracts/schemas/response/segment/segmentCalculationLogSchema';

/**
 * 分群计算结果响应 schema
 */
export const segmentCalculationResultSchema = z.strictObject({
    success: z.boolean().describe('是否计算成功'),
    segmentationId: z.string().uuid().describe('分群ID'),
    calculationVersion: z.string().describe('计算版本号'),
    memberCount: z.int().min(0).describe('成员数量'),
    calculationDuration: z.int().min(0).describe('计算时长（毫秒）'),
    log: segmentCalculationLogSchema.optional().describe('计算日志')
});

// 导出类型（VO后缀，符合响应Schema规范）
export type SegmentCalculationResultVO = z.infer<typeof segmentCalculationResultSchema>;
