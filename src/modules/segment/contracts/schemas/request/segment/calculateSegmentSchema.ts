import {z} from 'zod';
import {SegmentCalculationType} from '@/shared/enums/index';

/**
 * 分群计算请求 schema
 */
export const calculateSegmentSchema = z.strictObject({
    /** 分群ID */
    id: z.uuid('分群ID必须是有效的UUID').describe('分群ID'),
    /** 计算类型 */
    calculationType: z.enum(SegmentCalculationType).describe('计算类型'),
    /** 当前所有者ID */
    ownedBy: z.uuid('当前所有者ID必须是有效的UUID').describe('当前所有者ID')
});

// 导出TypeScript类型
export type CalculateSegmentDTO = z.infer<typeof calculateSegmentSchema>;
