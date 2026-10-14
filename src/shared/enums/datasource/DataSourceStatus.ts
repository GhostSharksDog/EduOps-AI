 /**
 * 数据源状态枚举
 * 继承基础Status枚举的值
 */
import { Status } from '@/shared/enums/common/Status';

export enum DataSourceStatus {
    /** 启用 */
    ACTIVE = Status.ACTIVE,
    /** 禁用 */
    DISABLED = Status.DISABLED
}

export const DataSourceStatusOptions = [
    {value: DataSourceStatus.ACTIVE, label: '已启用'},
    {value: DataSourceStatus.DISABLED, label: '已禁用'}
];
