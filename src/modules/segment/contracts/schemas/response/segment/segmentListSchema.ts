import {z} from 'zod';
import {segmentSchema} from '@/modules/segment/contracts/schemas/response/segment/segmentSchema';
import {pagedResponseSchema} from '@/shared/schemas/common/pagedResponseSchema';

/**
 * 分群列表响应 schema - 使用pagedResponseSchema作为基础
 */
export const segmentListSchema = pagedResponseSchema(segmentSchema);

// 导出类型（VO后缀，符合响应Schema规范）
export type SegmentListVO = z.infer<typeof segmentListSchema>;
