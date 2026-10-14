import {z} from 'zod';
import {segmentFeatureResponseSchema} from '@/modules/segment/contracts/schemas/response/segment/segmentFeatureResponseSchema';

/**
 * 分群成员响应 schema - 对应 segment_member 表
 */
export const segmentMemberSchema = z.strictObject({
    /** 唯一标识符 */
    id: z.uuid().describe('唯一标识符'),
    /** 名称 */
    name: z.string().optional().describe('名称'),
    /** 当前所有者ID */
    ownedBy: z.uuid().describe('当前所有者ID'),
    /** 描述 */
    description: z.string().optional().describe('描述'),
    /** 关联分群ID */
    segmentId: z.uuid().describe('关联分群ID'),
    /** 成员ID（用户ID） */
    memberId: z.string().describe('成员ID'),
    /** 加入时间 */
    joinTime: z.string().describe('加入时间'),
    /** 加入方式：RULE(规则命中), UPLOAD(导入), MANUAL(手动) */
    joinMethod: z.string().describe('加入方式'),
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
export type SegmentMemberVO = z.infer<typeof segmentMemberSchema>;
