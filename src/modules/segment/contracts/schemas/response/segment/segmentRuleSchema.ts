import {z} from 'zod';
import {ConditionOperator, SegmentConditionOperator, SegmentRuleType, SegmentConditionType} from '@/shared/enums/index';
import {featureSchema} from '@/shared/schemas/common/featureSchema';

/**
 * 分群规则响应 schema
 */
export const segmentRuleSchema = z.strictObject({
    id: z.uuid().describe('规则ID'),
    name: z.string().trim().optional().describe('规则名称'),
    ownedBy: z.uuid().describe('当前所有者ID'),
    description: z.string().trim().optional().describe('描述'),
    segmentationId: z.uuid().describe('关联的分群ID'),
    ruleType: z.enum(SegmentRuleType).describe('规则类型'),
    operator: z.enum(SegmentConditionOperator).describe('运算符'),
    leftOperand: z.string().trim().describe('左操作数（标签ID或属性名）'),
    rightOperand: z.union([
        z.string().trim(),
        z.number(),
        z.boolean(),
        z.array(z.union([z.string().trim(), z.number()])).default([]),
    ]).describe('右操作数（比较值）'),
    logicOperator: z.enum(ConditionOperator).optional().describe('逻辑运算符'),
    parentRuleId: z.uuid().optional().describe('父规则ID'),
    priority: z.int().min(0).default(0).describe('优先级'),
    conditions: z.array(z.strictObject({
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
        conditionType: z.nativeEnum(SegmentConditionType).describe('条件类型'),
        /** 运算符：AND, OR, GT, LT, EQ, IN 等 */
        operator: z.nativeEnum(SegmentConditionOperator).optional().describe('比较操作符'),
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
        createTime: z.string().optional().describe('创建时间'),
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
    })).default([]).describe('子条件'),
    feature: featureSchema,
    isDeleted: z.boolean().optional().describe('是否删除'),
    createTime: z.string().optional().describe('创建时间'),
    updateTime: z.string().optional().describe('更新时间'),
    deleteTime: z.string().optional().describe('删除时间'),
    createdBy: z.uuid().optional().describe('创建人ID'),
    updatedBy: z.uuid().optional().describe('更新人ID'),
    deletedBy: z.uuid().optional().describe('删除人ID'),
});

// 导出类型（VO后缀，符合响应Schema规范）
export type SegmentRuleVO = z.infer<typeof segmentRuleSchema>;
