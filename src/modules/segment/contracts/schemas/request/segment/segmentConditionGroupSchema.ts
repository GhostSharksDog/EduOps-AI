import {z, ZodType} from 'zod';
import {ConditionOperator, SegmentConditionType} from '@/shared/enums/index';
import {segmentRuleConditionSchema} from '@/modules/segment/contracts/schemas/request/segment/segmentRuleConditionSchema';
import {featureSchema} from '@/shared/schemas/common/featureSchema';

/**
 * 分群条件组合请求 schema - 递归结构
 */
export const segmentConditionGroupSchema: ZodType<object> = z.lazy(() => z.strictObject({
    /** 条件组ID */
    id: z.uuid('条件组ID必须是有效的UUID').optional().describe('条件组ID'),
    /** 条件名称 */
    name: z.string().trim().optional().describe('条件名称'),
    /** 当前所有者ID */
    ownedBy: z.uuid('当前所有者ID必须是有效的UUID').describe('当前所有者ID'),
    /** 描述 */
    description: z.string().trim().optional().describe('描述'),
    /** 关联分群ID */
    ruleId: z.uuid('关联分群ID必须是有效的UUID').describe('关联分群ID'),
    /** 父条件ID */
    parentId: z.uuid('父条件ID必须是有效的UUID').optional().describe('父条件ID'),
    /** 条件类型：GROUP(组合) */
    conditionType: z.literal(SegmentConditionType.GROUP).describe('条件类型'),
    /** 组合操作符：AND, OR */
    operator: z.enum(ConditionOperator).describe('组合操作符'),
    /** 条件列表（可递归嵌套） */
    conditions: z.array(z.union([segmentRuleConditionSchema, segmentConditionGroupSchema])).min(1, '至少需要配置一个条件').default([]).describe('条件列表'),
    /** 扩展特性 */
    feature: featureSchema,
    /** 是否删除 */
    isDeleted: z.boolean().optional().describe('是否删除')
}));

// 导出TypeScript类型
export type SegmentConditionGroupDTO = z.infer<typeof segmentConditionGroupSchema>;
