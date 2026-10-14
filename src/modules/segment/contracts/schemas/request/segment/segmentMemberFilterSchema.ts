import {z} from 'zod';
import {SegmentType} from '@/shared/enums/index';

/**
 * 分群成员筛选请求 schema - 对应 segment_member 表
 */
export const segmentMemberFilterSchema = z.strictObject({
    /** 成员类型 */
    memberType: z.enum(SegmentType).optional().describe('成员类型'),
    /** 加入时间起始 */
    joinedAfter: z.coerce.date().optional().describe('加入时间起始'),
    /** 加入时间结束 */
    joinedBefore: z.coerce.date().optional().describe('加入时间结束')
});

// 导出TypeScript类型
export type SegmentMemberFilterDTO = z.infer<typeof segmentMemberFilterSchema>;
