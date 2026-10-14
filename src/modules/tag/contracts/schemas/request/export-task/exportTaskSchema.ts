import {z} from 'zod';
import {ExportFormat} from '@/shared/enums/common/ExportFormat';
import {EncodingType} from '@/shared/enums/common/EncodingType';
import {ScheduleType} from '@/shared/enums/common/ScheduleType';

/**
 * 导出任务请求Schema
 * 用于创建和配置数据导出任务
 */
export const exportTaskSchema = z.strictObject({
    /**
     * 导出任务名称
     */
    name: z.string().trim().min(1, '任务名称不能为空').max(255, '任务名称不能超过255个字符').describe('任务名称'),

    /**
     * 导出类型
     */
    exportType: z.nativeEnum(ExportFormat).describe('导出类型'),

    /**
     * 导出数据源
     */
    dataSourceId: z.string().uuid('数据源ID必须是有效的UUID').describe('数据源ID'),

    /**
     * 导出数据模型
     */
    dataModelId: z.string().uuid('数据模型ID必须是有效的UUID').describe('数据模型ID'),

    /**
     * 导出字段配置
     */
    fields: z.array(z.string().min(1, '字段名不能为空')).min(1, '至少需要选择一个导出字段').describe('导出字段'),

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
        fileName: z.string().trim().min(1, '文件名不能为空').max(255, '文件名不能超过255个字符').describe('文件名'),

        /**
         * 是否包含表头
         */
        includeHeader: z.boolean().default(true).describe('是否包含表头'),

        /**
         * 编码格式
         */
        encoding: z.nativeEnum(EncodingType).default(EncodingType.UTF8).describe('编码格式')
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
         * 执行时间（仅定时执行时需要）
         */
        executeTime: z.iso.datetime().optional().describe('执行时间'),

        /**
         * 重复规则（可选）
         */
        repeatRule: z.string().optional().describe('重复规则')
    }).describe('调度配置')
});

/**
 * 导出任务请求DTO类型
 */
export type ExportTaskDTO = z.infer<typeof exportTaskSchema>;