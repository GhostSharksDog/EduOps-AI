import {ConditionOperator} from '@/shared/enums/index';
import {SegmentCondition, SegmentConditionGroup} from '@/modules/segment/domain/value-objects/index';

/**
 * 创建分群条件组命令
 */
export interface CreateSegmentConditionGroupCommand {
    /** 条件操作符：AND(与), OR(或) */
    operator: ConditionOperator;

    /** 条件列表，可以是单个条件或条件组 */
    conditions: Array<SegmentCondition | SegmentConditionGroup>;

    /** 创建人ID */
    createdBy: string;
}
