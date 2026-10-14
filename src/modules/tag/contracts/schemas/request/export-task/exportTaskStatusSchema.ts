import {z} from 'zod';
import {ExportTaskStatus} from '@/shared/enums/tag/ExportTaskStatus';

/**
 * 导出任务状态更新Schema
 * 用于更新导出任务的状态
 */
export const exportTaskStatusSchema = z.strictObject({
    /**
     * 任务ID
     */
    taskId: z.string().uuid('任务ID必须是有效的UUID').describe('任务ID'),

    /**
     * 新状态
     */
    status: z.nativeEnum(ExportTaskStatus).describe('任务状态'),

    /**
     * 状态更新原因（可选）
     */
    reason: z.string().trim().optional().describe('状态更新原因'),

    /**
     * 错误信息（仅当状态为FAILED时需要）
     */
    errorMessage: z.string().trim().optional().describe('错误信息'),

    /**
     * 完成信息（仅当状态为COMPLETED时需要）
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
 * 导出任务状态更新DTO类型
 */
export type ExportTaskStatusDTO = z.infer<typeof exportTaskStatusSchema>;