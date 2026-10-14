import {z} from 'zod';
import {DataType} from '@/shared/enums/data-models/DataType';
import {featureSchema} from '@/shared/schemas/common/featureSchema';

// 列操作类型
export const ColumnOperationEnum = z.enum(['CREATE', 'UPDATE', 'DELETE']);
export type ColumnOperationType = z.infer<typeof ColumnOperationEnum>;

// 列更新 schema
export const modelColumnUpdateSchema = z.strictObject({
    operation: ColumnOperationEnum.optional().describe('操作类型'),
    columnId: z.uuid('列ID必须是有效的UUID').optional().describe('列ID (UPDATE/DELETE时必填)'),
    name: z.string().trim().max(255, '列名不能超过255个字符').optional().describe('列名'),
    displayName: z.string().trim().max(255, '显示名称不能超过255个字符').optional().describe('显示名称'),
    dataType: z.enum(DataType).optional().describe('数据类型'),
    length: z.int().min(1, '长度必须大于0').max(1000, '长度不能超过1000').optional().describe('长度'),
    precision: z.int().min(1, '精度必须大于0').max(38, '精度不能超过38').optional().describe('精度'),
    scale: z.int().min(0, '小数位数不能小于0').max(38, '小数位数不能超过38').optional().describe('小数位数'),
    defaultValue: z.unknown().optional().describe('默认值'),
    description: z.string().trim().optional().describe('描述'),
    orderIndex: z.int().min(0).optional().describe('排序索引'),
    isNullable: z.boolean().optional().describe('是否允许为空'),
    isPrimaryKey: z.boolean().optional().describe('是否为主键'),
    ownedBy: z.uuid('所有者ID必须是有效的UUID').optional().describe('所有者ID'),
    feature: featureSchema.optional(),
}).superRefine((data, ctx) => {
    // 验证：DELETE 和 UPDATE 必须有 columnId
    if ((data.operation === 'DELETE' || data.operation === 'UPDATE') && !data.columnId) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `${data.operation} 操作必须提供 columnId`,
            path: ['columnId'],
        });
    }
    // 验证：CREATE 不能有 columnId
    if (data.operation === 'CREATE' && data.columnId) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'CREATE 操作不应提供 columnId',
            path: ['columnId'],
        });
    }
    // 主键验证
    if (data.isPrimaryKey === true && data.isNullable === true) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: '主键字段不能为空',
            path: ['isNullable'],
        });
    }
});

// 导出TypeScript类型
export type ModelColumnUpdateDTO = z.infer<typeof modelColumnUpdateSchema>;
