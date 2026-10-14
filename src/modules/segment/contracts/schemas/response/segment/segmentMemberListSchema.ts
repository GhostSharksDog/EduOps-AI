import {z} from 'zod';
import {segmentMemberSchema} from '@/modules/segment/contracts/schemas/response/segment/segmentMemberSchema';
import {pagedResponseSchema} from '@/shared/schemas/common/pagedResponseSchema';

/**
 * 分群成员列表响应 schema - 使用pagedResponseSchema作为基础
 */
export const segmentMemberListSchema = pagedResponseSchema(segmentMemberSchema);

// 导出类型（VO后缀，符合响应Schema规范）
export type SegmentMemberListVO = z.infer<typeof segmentMemberListSchema>;
