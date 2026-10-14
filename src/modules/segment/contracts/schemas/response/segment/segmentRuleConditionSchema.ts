import {z} from 'zod';
import {SegmentConditionOperator, SegmentConditionType} from '@/shared/enums/index';
import {featureSchema} from '@/shared/schemas/common/featureSchema';

/**
 * 分群规则条件响应 schema - 对应 segment_condition 表
 */
export const segmentRuleConditionSchema = z.strictObject({
    /** 唯一标识符 */
    id: z.uuid().describe('唯一标识符'),
    /** 条件名称 */
    name: z.string().trim().optional().describe('条件名称'),
    /** 当前所有者ID */
    ownedBy: z.uuid().describe('当前所有者ID'),
    /** 描述 */
    description: z.string().trim().optional().describe('描述'),
    /** 关联分群ID */
    ruleId: z.uuid().describe('关联分群ID'),
    /** 父条件ID (用于构建条件树) */
    parentId: z.uuid().optional().describe('父条件ID'),
    /** 条件类型：GROUP(组合), CRITERIA(原子规则) */
    conditionType: z.enum(SegmentConditionType).describe('条件类型'),
    /** 运算符：AND, OR, GT, LT, EQ, IN 等 */
    operator: z.enum(SegmentConditionOperator).optional().describe('运算符'),
    /** 字段名 (属性名或标签ID) */
    fieldName: z.string().trim().optional().describe('字段名'),
    /** 字段值 */
    fieldValue: z.union([
        z.string().trim(),
        z.number(),
        z.boolean(),
        z.array(z.union([z.string().trim(), z.number()])).default([]),
    ]).optional().describe('字段值'),
    /** 扩展特性 */
    feature: featureSchema,
    /** 是否删除 */
    isDeleted: z.boolean().describe('是否删除'),
    /** 创建时间 */
    createTime: z.string().describe('创建时间'),
    /** 更新时间 */
    updateTime: z.string().optional().describe('更新时间'),
    /** 删除时间 */
    deleteTime: z.string().optional().describe('删除时间'),
    /** 创建人ID */
    createdBy: z.uuid().optional().describe('创建人ID'),
    /** 更新人ID */
    updatedBy: z.uuid().optional().describe('更新人ID'),
    /** 删除人ID */
    deletedBy: z.uuid().optional().describe('删除人ID'),
});

// 导出类型（VO后缀，符合响应Schema规范）
export type SegmentRuleConditionVO = z.infer<typeof segmentRuleConditionSchema>;
