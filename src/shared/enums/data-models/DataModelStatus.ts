 /**
 * 数据模型状态枚举
 * 继承基础Status枚举的值
 */
import { Status } from '@/shared/enums/common/Status';

export enum DataModelStatus {
    /** 草稿 */
    DRAFT = Status.DRAFT,
    /** 激活 */
    ACTIVE = Status.ACTIVE,
    /** 停用 */
    INACTIVE = Status.INACTIVE
}
