import {ComparisonOperator} from '@/shared/enums/index';
import {ConditionValue} from '@/modules/segment/domain/types/index';

/**
 * 创建分群条件命令
 */
export interface CreateSegmentConditionCommand {
    /** 标签ID */
    tagId: string;

    /** 比较操作符 */
    operator: ComparisonOperator;

    /** 条件值 */
    value: ConditionValue;

    /** 值类型 */
    valueType: string;

    /** 创建人ID */
    createdBy: string;
}
