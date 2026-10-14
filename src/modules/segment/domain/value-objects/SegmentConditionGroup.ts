import {ConditionOperator} from '@/shared/enums/index';
import {SegmentCondition} from '@/modules/segment/domain/index';

// 分群条件组合接口
export interface SegmentConditionGroup {
    operator: ConditionOperator;
    conditions: Array<SegmentCondition | SegmentConditionGroup>;
}
