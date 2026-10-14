import {z} from 'zod';
import {DataType} from '@/shared/enums/data-models/DataType';
import {baseSchema} from '@/shared/schemas/common/baseSchema';
import {featureSchema} from '@/shared/schemas/common/featureSchema';

// 列响应schema
export const modelColumnSchema = baseSchema.extend({
    modelId: z.string().optional().describe('模型ID'),
    name: z.string().trim().describe('列名'),
    displayName: z.string().trim().optional().describe('显示名称'),
    dataType: z.enum(DataType).describe('数据类型'),
    length: z.int().optional().describe('长度'),
    precision: z.int().optional().describe('精度'),
    scale: z.int().optional().describe('小数位数'),
    defaultValue: z.unknown().optional().describe('默认值'),
    description: z.string().trim().optional().describe('描述'),
    orderIndex: z.int().describe('排序索引'),
    isNullable: z.boolean().describe('是否允许为空'),
    isPrimaryKey: z.boolean().describe('是否为主键'),
    feature: featureSchema.describe('扩展特性'),
}).superRefine((data, ctx) => {
    if (data.isPrimaryKey && data.isNullable) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: '主键字段不能为空',
            path: ['isNullable'],
        });
    }
});

// 导出TypeScript类型
export type ModelColumnVO = z.infer<typeof modelColumnSchema>;
