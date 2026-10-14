import {z} from 'zod';
import {featureSchema} from '@/shared/schemas/common/featureSchema';

// 基础schema - 包含通用字段
export const baseSchema = z.strictObject({
    id: z.uuid('ID必须是有效的UUID').describe('唯一标识符'),
    ownedBy: z.uuid('所属者ID必须是有效的UUID').nullish().describe('当前所有者'),
    isDeleted: z.boolean().describe('是否删除'),
    createTime: z.iso.datetime('创建时间必须是有效的日期时间格式').describe('创建时间'),
    updateTime: z.iso.datetime('更新时间必须是有效的日期时间格式').nullish().describe('更新时间'),
    deleteTime: z.iso.datetime('删除时间必须是有效的日期时间格式').nullish().describe('删除时间'),
    createdBy: z.uuid('创建人ID必须是有效的UUID').nullish().describe('创建人ID'),
    updatedBy: z.uuid('更新人ID必须是有效的UUID').nullish().describe('更新人ID'),
    deletedBy: z.uuid('删除人ID必须是有效的UUID').nullish().describe('删除人ID'),
});

// 可扩展基础schema
export const extensibleBaseSchema = baseSchema.extend({
    description: z.string().trim().nullish().describe('描述'),
    feature: featureSchema,
});

// 导出类型（符合 VO 规范）
export type BaseVO = z.infer<typeof baseSchema>;
export type ExtensibleBaseVO = z.infer<typeof extensibleBaseSchema>;

// 向后兼容别名（已废弃）
/** @deprecated Use BaseVO instead */
export type BaseSchema = BaseVO;
/** @deprecated Use ExtensibleBaseVO instead */
export type ExtensibleBaseSchema = ExtensibleBaseVO;
