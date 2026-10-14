import {z} from 'zod';

// 通用 JSON 值类型
// This allows schemas to be used in both client and server contexts
export type FeatureJsonValue = string | number | boolean | null | FeatureJsonValue[] | { [key: string]: FeatureJsonValue };

const jsonValueSchema: z.ZodType<FeatureJsonValue> = z.lazy(() =>
    z.union([
        z.string(),
        z.number(),
        z.boolean(),
        z.null(),
        z.array(jsonValueSchema),
        z.record(z.string(), jsonValueSchema),
    ])
);

export const featureSchema = jsonValueSchema.optional().describe('扩展特性');
