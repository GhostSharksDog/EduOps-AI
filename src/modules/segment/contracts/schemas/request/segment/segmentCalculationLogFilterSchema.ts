import {z} from 'zod';
import {SegmentCalculationStatus} from '@/shared/enums/index';

/**
 * 分群计算日志筛选请求 schema - 对应 segment_calculation_task 表
 */
export const segmentCalculationLogFilterSchema = z.strictObject({
    /** 分群ID */
    segmentId: z.uuid('分群ID必须是有效的UUID').optional().describe('分群ID'),
    /** 页码 */
    page: z.number().int().min(1).default(1).optional().describe('页码'),
    /** 每页条数 */
    pageSize: z.number().int().min(1).default(20).optional().describe('每页条数'),
    /** 计算状态 */
    status: z.enum(SegmentCalculationStatus).optional().describe('计算状态'),
    /** 当前所有者ID */
    ownedBy: z.string().uuid('当前所有者ID必须是有效的UUID').optional().describe('当前所有者ID')
});

// 导出TypeScript类型
export type SegmentCalculationLogFilterDTO = z.infer<typeof segmentCalculationLogFilterSchema>;
