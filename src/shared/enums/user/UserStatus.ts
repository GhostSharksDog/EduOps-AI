 /**
 * 用户状态枚举
 * 表示用户的当前状态
 * 继承基础Status枚举的值
 */
import { Status } from '@/shared/enums/common/Status';

export enum UserStatus {
  /** 启用 - 用户可以正常使用系统 */
  ACTIVE = Status.ACTIVE,
  /** 禁用 - 用户账户被禁用 */
  INACTIVE = Status.INACTIVE,
  /** 锁定 - 用户因异常操作被锁定 */
  LOCKED = Status.LOCKED,
  /** 待处理 - 待处理的用户状态 */
  PENDING = Status.PENDING
}
