import {z} from 'zod';

export const createBitmapTableSchema = z.strictObject({
    entityType: z
        .string()
        .trim()
        .min(1, '实体类型名称不能为空')
        .max(50, '实体类型名称不能超过50个字符')
        .regex(/^[A-Z][A-Z0-9_]*$/, '实体类型名称必须以大写字母开头，只能包含大写字母、数字和下划线')
        .describe('实体类型名称（用于展示，如 USER, ORDER）'),
    
    entityTypeId: z
        .string()
        .uuid('实体类型ID必须是有效的UUID')
        .describe('实体类型ID（来自项目内部实体类型配置）'),
    
    totalBits: z
        .number()
        .int('总位数必须是整数')
        .min(8, '总位数最小为8')
        .max(256, '总位数最大为256')
        .default(64)
        .optional()
        .describe('总位数（默认64）'),
    // 新增：显示名称（名称可选，用于业务展示）
    name: z.string().max(255).optional(),
    // 新增：描述信息
    description: z.string().optional(),
});

export type CreateBitmapTableDTO = z.infer<typeof createBitmapTableSchema>;
