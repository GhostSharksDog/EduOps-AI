import {ConditionValue} from '@/modules/segment/domain/types/index';
import {ComparisonOperator} from '@/shared/enums/index';

// 单个分群条件接口
/**
 * 分群条件值对�?
 *
 * 架构交互:
 * 1. 定义了分群的原子筛选逻辑�?
 * 2. `tagId` 字段是对 Tag 模块�?"软引�? (Soft Reference)�?
 * 3. 运行时通过 ACL 或服务调用获取对应的 TagValue 进行计算�?
 */
export interface SegmentCondition {
    id: string;

    /**
     * 关联的标签ID (Soft Reference to Tag Domain)
     */
    tagId: string;        // 关联的标签ID
    operator: ComparisonOperator;
    value: ConditionValue;
    valueType: string;    // 值类型：string, number, boolean, date, array
}
