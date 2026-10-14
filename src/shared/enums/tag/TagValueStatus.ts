 /**
 * 标签值状态枚举
 * 继承基础Status枚举的值
 */
import { Status } from '@/shared/enums/common/Status';

export enum TagValueStatus {
    /** 有效 */
    VALID = Status.VALID,
    /** 无效 */
    INVALID = Status.INVALID,
    /** 缺失 */
    MISSING = Status.MISSING
}
