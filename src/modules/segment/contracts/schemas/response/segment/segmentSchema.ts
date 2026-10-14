import {z} from 'zod';
import {SegmentCalculationType, SegmentStatus, SegmentType} from '@/shared/enums/index';
import {extensibleBaseSchema} from '@/shared/schemas/common/index';
import {segmentConditionGroupSchema} from '@/modules/segment/contracts/schemas/response/segment/segmentConditionGroupSchema';
import {segmentRuleSchema} from '@/modules/segment/contracts/schemas/response/segment/segmentRuleSchema';
import {segmentFeatureResponseSchema} from '@/modules/segment/contracts/schemas/response/segment/segmentFeatureResponseSchema';
import {segmentStatisticsSchema} from '@/modules/segment/contracts/schemas/response/segment/segmentStatisticsSchema';

/**
 * 分群响应schema - 对应segment表
 */
export const segmentSchema = extensibleBaseSchema.extend({
    /** 分群名称 */
    name: z.string().trim().min(1, '分群名称不能为空').describe('分群名称'),
    /** 分群描述 */
    description: z.string().trim().optional().describe('分群描述'),
    /** 实体类型：USER(用户), DEVICE(设备) */
    entityType: z.enum(SegmentType, {
        message: '实体类型无效'
    }).optional().describe('实体类型'),
    /** 计算类型：REALTIME(实时), OFFLINE(离线) */
    computeType: z.enum(SegmentCalculationType, {
        message: '计算类型无效'
    }).optional().describe('计算类型'),
    /** 状态：DRAFT(草稿), ACTIVE(激活), INACTIVE(停用) */
    status: z.enum(SegmentStatus, {
        message: '状态无效'
    }).optional().describe('状态'),
    /** 调度配置（如Cron表达式） */
    scheduleConfig: segmentFeatureResponseSchema.nullish().describe('调度配置'),
    /** 最后计算时间 */
    lastCalculationTime: z.iso.datetime('最后计算时间必须是有效的日期时间格式').nullish().describe('最后计算时间'),
    /** 扩展特性 */
    feature: segmentFeatureResponseSchema.nullish().describe('扩展特性'),
    /** 条件组合（可选，与rules二选一） */
    conditionGroup: segmentConditionGroupSchema.nullish().describe('条件组合'),
    /** 规则列表（可选，与conditionGroup二选一） */
    rules: z.array(segmentRuleSchema).default([]).describe('规则列表'),
    /** 统计信息 */
    statistics: segmentStatisticsSchema.nullish().describe('统计信息'),
    /** 成员数量 */
    memberCount: z.int().min(0, '成员数量不能为负数').optional().describe('成员数量'),
    /** 下次计算时间 */
    nextCalculationTime: z.iso.datetime('下次计算时间必须是有效的日期时间格式').nullish().describe('下次计算时间')
}).strict();

// 导出类型（VO后缀，符合响应Schema规范）
export type SegmentVO = z.infer<typeof segmentSchema>;
export type SegmentListItemVO = SegmentVO;
