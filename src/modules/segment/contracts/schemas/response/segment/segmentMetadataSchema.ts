import {z} from 'zod';
import {segmentFeatureResponseSchema} from '@/modules/segment/contracts/schemas/response/segment/segmentFeatureResponseSchema';

/**
 * 分群元数据响应 schema - 包含审计字段
 */
export const segmentMetadataSchema = z.strictObject({
    createTime: z.iso.datetime('创建时间必须是有效的日期时间格式').describe('创建时间'),
    createdBy: z.uuid('创建人ID必须是有效的UUID').nullish().describe('创建人ID'),
    updateTime: z.iso.datetime('更新时间必须是有效的日期时间格式').nullish().describe('更新时间'),
    updatedBy: z.uuid('更新人ID必须是有效的UUID').nullish().describe('更新人ID'),
    deleteTime: z.iso.datetime('删除时间必须是有效的日期时间格式').nullish().describe('删除时间'),
    deletedBy: z.uuid('删除人ID必须是有效的UUID').nullish().describe('删除人ID'),
    description: z.string().trim().nullish().describe('描述'),
    tags: z.array(z.string().trim()).default([]).describe('标签列表'),
    businessOwner: z.uuid('业务负责人ID必须是有效的UUID').nullish().describe('业务负责人'),
    technicalOwner: z.uuid('技术负责人ID必须是有效的UUID').nullish().describe('技术负责人'),
    feature: segmentFeatureResponseSchema.nullish().describe('扩展特性')
});

// 导出类型（VO后缀，符合响应Schema规范）
export type SegmentMetadataVO = z.infer<typeof segmentMetadataSchema>;
