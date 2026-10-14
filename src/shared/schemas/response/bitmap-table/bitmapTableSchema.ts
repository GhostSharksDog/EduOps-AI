import {z} from 'zod';
import {Status} from '@/shared/enums/common/Status';
export const bitInfoSchema = z.strictObject({
    index: z.number().int().describe('位号'),
    tagId: z.string().uuid().optional().nullable().describe('标签ID'),
    tagName: z.string().optional().nullable().describe('标签名称'),
    enumValue: z.string().optional().nullable().describe('枚举值（ENUM类型标签）'),
});

export type BitInfoVO = z.infer<typeof bitInfoSchema>;

export const bitmapTableSchema = z.strictObject({
    id: z.string().uuid().describe('表ID'),
    tableName: z.string().describe('ClickHouse表名'),
    name: z.string().max(255).optional().nullable().describe('显示名称(用户自定义,用于业务识别)'),
    description: z.string().optional().nullable().describe('描述说明'),
    entityType: z.string().describe('实体类型名称'),
    entityTypeId: z.string().uuid().describe('实体类型ID'),
    ownedBy: z.string().describe('租户ID'),
    totalBits: z.number().int().describe('总位数'),
    usedBits: z.array(z.number().int()).describe('已使用的位数组'),
    status: z.enum(['ACTIVE', 'INACTIVE']).describe('状态'),
    createTime: z.string().describe('创建时间'),
    updateTime: z.string().optional().nullable().describe('更新时间'),
});

export type BitmapTableVO = z.infer<typeof bitmapTableSchema>;
