import {z} from 'zod';

export const segmentEstimateSchema = z.strictObject({
    count: z.number().int().min(0),
});

export type SegmentEstimateVO = z.infer<typeof segmentEstimateSchema>;

/** @deprecated Use segmentEstimateSchema instead */
export const SegmentEstimateSchema = segmentEstimateSchema;
