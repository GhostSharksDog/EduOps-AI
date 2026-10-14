import {z} from 'zod';
import {extensibleBaseSchema} from '@/shared/schemas/index';
import {ExportTaskStatus} from '@/shared/enums/index';
import {ExportFormat} from '@/shared/enums/common/ExportFormat';
import {EncodingType} from '@/shared/enums/common/EncodingType';
import {ScheduleType} from '@/shared/enums/common/ScheduleType';

/**
 * 导出任务响应Schema
 * 用于返回导出任务的详细信息
 */
export const exportTaskSchema = extensibleBaseSchema.extend({
    /**
     * 任务名称
     */
    name: z.string().describe('任务名称'),

    /**
     * 导出类型
     */
    exportType: z.nativeEnum(ExportFormat).describe('导出类型'),

    /**
     * 导出数据源
     */
    dataSourceId: z.string().uuid().describe('数据源ID'),

    /**
     * 导出数据模型
     */
    dataModelId: z.string().uuid().describe('数据模型ID'),

    /**
     * 导出字段配置
     */
    fields: z.array(z.string()).describe('导出字段'),

    /**
     * 导出条件
     */
    conditions: z.record(z.string(), z.unknown()).optional().describe('导出条件'),

    /**
     * 导出文件配置
     */
    fileConfig: z.strictObject({
        /**
         * 文件名称
         */
        fileName: z.string().describe('文件名'),

        /**
         * 是否包含表头
         */
        includeHeader: z.boolean().describe('是否包含表头'),

        /**
         * 编码格式
         */
        encoding: z.nativeEnum(EncodingType).describe('编码格式')
    }).describe('文件配置'),

    /**
     * 导出调度配置
     */
    scheduleConfig: z.strictObject({
        /**
         * 调度类型
         */
        scheduleType: z.nativeEnum(ScheduleType).describe('调度类型'),

        /**
         * 执行时间
         */
        executeTime: z.string().datetime().optional().describe('执行时间'),

        /**
         * 重复规则
         */
        repeatRule: z.string().optional().describe('重复规则')
    }).describe('调度配置'),

    /**
     * 任务状态
     */
    status: z.nativeEnum(ExportTaskStatus).describe('任务状态'),

    /**
     * 执行信息
     */
    executionInfo: z.strictObject({
        /**
         * 开始时间
         */
        startTime: z.string().datetime().optional().describe('开始时间'),

        /**
         * 结束时间
         */
        endTime: z.string().datetime().optional().describe('结束时间'),

        /**
         * 导出记录数
         */
        recordCount: z.number().int().min(0).optional().describe('导出记录数'),

        /**
         * 导出文件路径
         */
        filePath: z.string().optional().describe('导出文件路径'),

        /**
         * 错误信息
         */
        errorMessage: z.string().optional().describe('错误信息')
    }).optional().describe('执行信息')
});

/**
 * 导出任务响应VO类型
 */
export type ExportTaskVO = z.infer<typeof exportTaskSchema>;