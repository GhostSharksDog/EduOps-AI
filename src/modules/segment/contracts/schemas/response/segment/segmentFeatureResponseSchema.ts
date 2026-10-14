import {z} from 'zod';

/**
 * 分群扩展特性响应 schema
 */
export const segmentFeatureResponseSchema = z.record(z.string(), z.unknown()).describe('扩展特性');

export type SegmentFeatureVO = z.infer<typeof segmentFeatureResponseSchema>;
