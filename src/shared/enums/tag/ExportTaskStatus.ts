 /**
 * 导出任务状态枚举
 * 继承基础Status枚举的值
 */
import { Status } from '@/shared/enums/common/Status';

export enum ExportTaskStatus {
    /** 待处理 */
    PENDING = Status.PENDING,
    /** 处理中 */
    RUNNING = Status.RUNNING,
    /** 已完成 */
    COMPLETED = Status.COMPLETED,
    /** 失败 */
    FAILED = Status.FAILED,
    /** 已取消 */
    CANCELLED = Status.CANCELLED
}
