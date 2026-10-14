// 标签持久化对象类型
// TagValue 已删除 - 直接查询 ClickHouse 目标表
export type {Tag, TagCategory, TagVersion, TagExportTask} from '../row-types';

// 导入共享枚举类型
import {ExportTaskStatus, TagStatus} from '@/shared/enums/index';

// 扩展shared目录中的TagValueType枚举，添加额外的类型
export enum TagValueType {
    // 基础类型（与shared保持一致）
    STRING = 'STRING',
    NUMBER = 'NUMBER',
    BOOLEAN = 'BOOLEAN',
    DATE = 'DATE',

    // 扩展类型（shared目录中没有的类型）
    TIME_RANGE = 'TIME_RANGE',
    RESOURCE_USAGE = 'RESOURCE_USAGE',
    SCORE_DISTRIBUTION = 'SCORE_DISTRIBUTION',
    BEHAVIOR = 'BEHAVIOR'
}

export {TagStatus, ExportTaskStatus};
