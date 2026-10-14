import {z} from 'zod';

/**
 * 导出分群请求Schema
 * 用于导出分群的成员数据
 */
export const segmentExportSchema = z.strictObject({
    /**
     * 分群ID
     */
    segmentId: z.string().uuid('分群ID必须是有效的UUID').describe('分群ID'),

    /**
     * 导出格式：csv或json
     */
    format: z.enum(['csv', 'json']).describe('导出格式')
});

/**
 * 导出分群请求DTO类型
 */
export type SegmentExportDTO = z.infer<typeof segmentExportSchema>;