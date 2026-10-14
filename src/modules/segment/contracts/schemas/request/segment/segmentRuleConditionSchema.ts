import {z} from 'zod';
import {SegmentConditionOperator, SegmentConditionType} from '@/shared/enums/index';
import {featureSchema} from '@/shared/schemas/common/featureSchema';

/**
 * 分群规则条件请求 schema - 对应 segment_condition 表
 */
export const segmentRuleConditionSchema = z.strictObject({
    /** 条件ID */
    id: z.uuid('条件ID必须是有效的UUID').optional().describe('条件ID'),
    /** 条件名称 */
    name: z.string().trim().optional().describe('条件名称'),
    /** 当前所有者ID */
    ownedBy: z.uuid('当前所有者ID必须是有效的UUID').describe('当前所有者ID'),
    /** 描述 */
    description: z.string().trim().optional().describe('描述'),
    /** 关联分群ID */
    ruleId: z.uuid('关联分群ID必须是有效的UUID').describe('关联分群ID'),
    /** 父条件ID (用于构建条件树) */
    parentId: z.uuid('父条件ID必须是有效的UUID').optional().describe('父条件ID'),
    /** 条件类型：GROUP(组合), CRITERIA(原子规则) */
    conditionType: z.enum(SegmentConditionType).describe('条件类型'),
    /** 运算符：AND, OR, GT, LT, EQ, IN 等 */
    operator: z.enum(SegmentConditionOperator).optional().describe('比较操作符'),
    /** 字段名 (属性名或标签ID) - 对应 segment_condition.field_name */
    fieldName: z.string().trim().optional().describe('字段名'),
    /** 字段值 - 对应 segment_condition.field_value (JSONB) */
    fieldValue: z.union([
        z.string().trim(),
        z.number(),
        z.boolean(),
        z.array(z.union([z.string().trim(), z.number()])).default([]),
    ]).optional().describe('字段值'),
    /** 扩展特性 - 对应 segment_condition.feature (JSONB) */
    feature: featureSchema,
    /** 是否删除 - 对应 segment_condition.is_deleted */
    isDeleted: z.boolean().optional().describe('是否删除')
});

// 导出TypeScript类型
export type SegmentRuleConditionDTO = z.infer<typeof segmentRuleConditionSchema>;
