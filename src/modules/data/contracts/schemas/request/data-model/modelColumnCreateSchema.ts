import {z} from 'zod';
import {DataType} from '@/shared/enums/data-models/DataType';
import {featureSchema} from '@/shared/schemas/common/featureSchema';

// 列创建 schema
export const modelColumnCreateSchema = z.strictObject({
    name: z.string().trim().min(1, '列名不能为空').max(255, '列名不能超过255个字符').describe('列名'),
    displayName: z.string().trim().max(255, '显示名称不能超过255个字符').optional().describe('显示名称'),
    dataType: z.enum(DataType).describe('数据类型'),
    length: z.int().min(1, '长度必须大于0').max(1000, '长度不能超过1000').optional().describe('长度'),
    precision: z.int().min(1, '精度必须大于0').max(38, '精度不能超过38').optional().describe('精度'),
    scale: z.int().min(0, '小数位数不能小于0').max(38, '小数位数不能超过38').optional().describe('小数位数'),
    defaultValue: z.unknown().optional().describe('默认值'),
    description: z.string().trim().optional().describe('描述'),
    orderIndex: z.int().min(0).default(0).describe('排序索引'),
    isNullable: z.boolean().default(true).describe('是否允许为空'),
    isPrimaryKey: z.boolean().default(false).describe('是否为主键'),
    ownedBy: z.uuid('所有者ID必须是有效的UUID').optional().describe('所有者ID'),
    feature: featureSchema.optional(),
}).superRefine((data, ctx) => {
    if (data.isPrimaryKey && data.isNullable) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: '主键字段不能为空',
            path: ['isNullable'],
        });
    }
});

// 导出类型（DTO 后缀，符合请求 Schema 规范）
export type ModelColumnCreateDTO = z.infer<typeof modelColumnCreateSchema>;
