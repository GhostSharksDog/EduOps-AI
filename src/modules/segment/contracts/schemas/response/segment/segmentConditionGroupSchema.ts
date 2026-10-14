import {z} from 'zod';
import {ConditionOperator, SegmentConditionType} from '@/shared/enums/index';
import {segmentRuleConditionSchema} from '@/modules/segment/contracts/schemas/response/segment/segmentRuleConditionSchema';
import {featureSchema} from '@/shared/schemas/common/featureSchema';

/**
 * 分群条件组合响应 schema - 对应 segment_condition 表的 GROUP 类型
 */
export const segmentConditionGroupSchema = z.lazy(() => {
    const schema: z.ZodType<object> = z.strictObject({
        /** 条件组ID */
        id: z.uuid().optional().describe('条件组ID'),
        /** 条件名称 */
        name: z.string().trim().optional().describe('条件名称'),
        /** 当前所有者ID */
        ownedBy: z.uuid().describe('当前所有者ID'),
        /** 描述 */
        description: z.string().trim().optional().describe('描述'),
        /** 关联分群ID */
        ruleId: z.uuid().describe('关联分群ID'),
        /** 父条件ID */
        parentId: z.uuid().optional().describe('父条件ID'),
        /** 条件类型：GROUP(组合) */
        conditionType: z.literal(SegmentConditionType.GROUP).describe('条件类型'),
        /** 组合操作符：AND, OR */
        operator: z.enum(ConditionOperator).describe('组合操作符'),
        /** 条件列表（可递归嵌套） */
        conditions: z.array(z.union([segmentRuleConditionSchema, z.lazy(() => schema)])).min(1).describe('条件列表'),
        /** 扩展特性 */
        feature: featureSchema,
        /** 是否删除 */
        isDeleted: z.boolean().optional().describe('是否删除'),
        /** 创建时间 */
        createTime: z.string().optional().describe('创建时间'),
        /** 更新时间 */
        updateTime: z.string().optional().describe('更新时间'),
        /** 删除时间 */
        deleteTime: z.string().optional().describe('删除时间'),
        /** 创建人ID */
        createdBy: z.uuid().optional().describe('创建人ID'),
        /** 更新人ID */
        updatedBy: z.uuid().optional().describe('更新人ID'),
    });
    return schema;
});

// 导出类型（VO后缀，符合响应Schema规范）
export type SegmentConditionGroupVO = z.infer<typeof segmentConditionGroupSchema>;
