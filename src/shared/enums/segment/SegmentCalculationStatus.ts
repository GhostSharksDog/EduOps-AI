 /**
 * 分群计算状态枚举
 * 继承基础Status枚举的值
 */
import { Status } from '@/shared/enums/common/Status';

export enum SegmentCalculationStatus {
    /** 待计算 */
    PENDING = Status.PENDING,
    /** 计算中 */
    RUNNING = Status.RUNNING,
    /** 计算完成 */
    COMPLETED = Status.COMPLETED,
    /** 计算失败 */
    FAILED = Status.FAILED
}
