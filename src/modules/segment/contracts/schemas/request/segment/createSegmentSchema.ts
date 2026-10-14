import {z} from 'zod';
import {SegmentCalculationPeriod, SegmentCalculationType, SegmentType} from '@/shared/enums/index';
import {segmentConditionGroupSchema} from '@/modules/segment/contracts/schemas/request/segment/segmentConditionGroupSchema';
import {segmentRuleSchema} from '@/modules/segment/contracts/schemas/request/segment/segmentRuleSchema';
import {segmentFeatureSchema} from '@/modules/segment/contracts/schemas/request/segment/segmentFeatureSchema';

/**
 * 创建分群请求 schema - 对应 segment 表
 * 规则配置说明：至少需要配置一个条件组或规则列表
 */
export const createSegmentSchema = z.strictObject({
    /** 分群名称 - 对应 segment.name */
    name: z.string().trim().min(1, '分群名称不能为空').max(255, '分群名称不能超过255个字符').describe('分群名称'),
    /** 当前所有者ID - 对应 segment.owned_by */
    ownedBy: z.uuid('当前所有者ID必须是有效的UUID').describe('当前所有者ID'),
    /** 分群描述 - 对应 segment.description */
    description: z.string().trim().max(5000, '分群描述不能超过5000个字符').optional().describe('分群描述'),
    /** 实体类型：USER(用户), DEVICE(设备) - 对应 segment.entity_type */
    entityType: z.enum(SegmentType).describe('实体类型'),
    /** 计算类型：REALTIME(实时), OFFLINE(离线) - 对应 segment.compute_type */
    calculationType: z.enum(SegmentCalculationType).describe('计算类型'),
    /** 调度配置 - 对应 segment.schedule_config (JSONB) */
    scheduleConfig: segmentFeatureSchema.optional().describe('调度配置'),
    /** 计算周期：DAILY(每日), WEEKLY(每周), MONTHLY(每月), MANUAL(手动) */
    calculationPeriod: z.enum(SegmentCalculationPeriod).optional().describe('计算周期'),
    /** 条件组合（与 rules 二选一） - 对应 segment_condition 表 */
    conditionGroup: segmentConditionGroupSchema.optional().describe('条件组合'),
    /** 规则列表（与 conditionGroup 二选一） - 对应 segment_condition 表 */
    rules: z.array(segmentRuleSchema).min(1, '至少需要配置一条规则').default([]).describe('规则列表'),
    /** 扩展特性 - 对应 segment.feature (JSONB) */
    feature: segmentFeatureSchema.optional().describe('扩展特性'),
    /** 创建人ID - 对应 segment.created_by */
    createdBy: z.uuid('创建人ID必须是有效的UUID').optional().describe('创建人ID')
}).refine(data => {
    // 条件组和规则至少有一个
    return data.conditionGroup !== undefined || (data.rules && data.rules.length > 0);
}, {
    message: '分群至少需要配置一个条件组或规则',
    path: ['conditionGroup'],
});

// 导出TypeScript类型
export type CreateSegmentDTO = z.infer<typeof createSegmentSchema>;
