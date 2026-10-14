import {z} from 'zod';
import {SegmentCalculationStatus} from '@/shared/enums/index';
import {segmentFeatureResponseSchema} from '@/modules/segment/contracts/schemas/response/segment/segmentFeatureResponseSchema';

/**
 * 分群计算日志响应 schema - 对应 segment_calculation_task 表
 */
export const segmentCalculationLogSchema = z.strictObject({
    /** 唯一标识符 */
    id: z.uuid().describe('唯一标识符'),
    /** 任务名称 */
    name: z.string().optional().describe('任务名称'),
    /** 当前所有者ID */
    ownedBy: z.uuid().describe('当前所有者ID'),
    /** 描述 */
    description: z.string().optional().describe('描述'),
    /** 关联分群ID */
    segmentId: z.uuid().describe('关联分群ID'),
    /** 开始时间 */
    startTime: z.string().optional().describe('开始时间'),
    /** 结束时间 */
    endTime: z.string().optional().describe('结束时间'),
    /** 任务状态：PENDING, RUNNING, SUCCESS, FAILED */
    status: z.enum(SegmentCalculationStatus).describe('任务状态'),
    /** 计算结果数量 */
    resultCount: z.int().min(0).default(0).describe('计算结果数量'),
    /** 错误信息 */
    errorMessage: z.string().optional().describe('错误信息'),
    /** 扩展特性 */
    feature: segmentFeatureResponseSchema.optional().describe('扩展特性'),
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
    deletedBy: z.uuid().optional().describe('删除人ID')
});

// 导出类型（VO后缀，符合响应Schema规范）
export type SegmentCalculationLogVO = z.infer<typeof segmentCalculationLogSchema>;
