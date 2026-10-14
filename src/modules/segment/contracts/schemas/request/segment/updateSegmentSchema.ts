import {z} from 'zod';
import {SegmentCalculationPeriod, SegmentCalculationType, SegmentType} from '@/shared/enums/index';
import {segmentConditionGroupSchema} from '@/modules/segment/contracts/schemas/request/segment/segmentConditionGroupSchema';
import {segmentRuleSchema} from '@/modules/segment/contracts/schemas/request/segment/segmentRuleSchema';
import {segmentFeatureSchema} from '@/modules/segment/contracts/schemas/request/segment/segmentFeatureSchema';

/**
 * 更新分群请求 schema - 对应 segment 表
 */
export const updateSegmentSchema = z.strictObject({
    /** 分群ID - 对应 segment.id */
    id: z.uuid('分群ID必须是有效的UUID').describe('分群ID'),
    /** 分群名称 - 对应 segment.name */
    name: z.string().trim().min(1, '分群名称不能为空').max(255, '分群名称不能超过255个字符').optional().describe('分群名称'),
    /** 当前所有者ID - 对应 segment.owned_by */
    ownedBy: z.uuid('当前所有者ID必须是有效的UUID').describe('当前所有者ID'),
    /** 分群描述 - 对应 segment.description */
    description: z.string().trim().max(5000, '分群描述不能超过5000个字符').optional().describe('分群描述'),
    /** 实体类型 - 对应 segment.entity_type */
    entityType: z.enum(SegmentType).optional().describe('实体类型'),
    /** 计算类型 - 对应 segment.compute_type */
    calculationType: z.enum(SegmentCalculationType).optional().describe('计算类型'),
    /** 调度配置 - 对应 segment.schedule_config (JSONB) */
    scheduleConfig: segmentFeatureSchema.optional().describe('调度配置'),
    /** 计算周期 */
    calculationPeriod: z.enum(SegmentCalculationPeriod).optional().describe('计算周期'),
    /** 条件组合 - 对应 segment_condition 表 */
    conditionGroup: segmentConditionGroupSchema.optional().describe('条件组合'),
    /** 规则列表 - 对应 segment_condition 表 */
    rules: z.array(segmentRuleSchema).default([]).describe('规则列表'),
    /** 扩展特性 - 对应 segment.feature (JSONB) */
    feature: segmentFeatureSchema.optional().describe('扩展特性'),
    /** 更新人ID - 对应 segment.updated_by */
    updatedBy: z.uuid('更新人ID必须是有效的UUID').optional().describe('更新人ID')
}).refine(data => Object.keys(data).length > 2, {
    message: '至少需要一个更新字段'
});

// 导出TypeScript类型
export type UpdateSegmentDTO = z.infer<typeof updateSegmentSchema>;
