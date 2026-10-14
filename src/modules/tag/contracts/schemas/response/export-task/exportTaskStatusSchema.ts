import {z} from 'zod';
import {ExportTaskStatus} from '@/shared/enums/tag/ExportTaskStatus';

/**
 * 导出任务状态响应Schema
 * 用于返回导出任务的状态信息
 */
export const exportTaskStatusSchema = z.strictObject({
    /**
     * 任务ID
     */
    taskId: z.string().uuid().describe('任务ID'),

    /**
     * 任务状态
     */
    status: z.nativeEnum(ExportTaskStatus).describe('任务状态'),

    /**
     * 状态更新时间
     */
    statusUpdateTime: z.iso.datetime().describe('状态更新时间'),

    /**
     * 状态更新原因
     */
    reason: z.string().optional().describe('状态更新原因'),

    /**
     * 错误信息
     */
    errorMessage: z.string().optional().describe('错误信息'),

    /**
     * 完成信息
     */
    completionInfo: z.strictObject({
        /**
         * 导出文件路径
         */
        filePath: z.string().describe('导出文件路径'),

        /**
         * 导出记录数
         */
        recordCount: z.number().int().min(0).describe('导出记录数'),

        /**
         * 导出耗时（毫秒）
         */
        duration: z.number().min(0).describe('导出耗时')
    }).optional().describe('完成信息')
});

/**
 * 导出任务状态响应VO类型
 */
export type ExportTaskStatusVO = z.infer<typeof exportTaskStatusSchema>;