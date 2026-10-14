/**
 * 分群条件类型枚举 - 对应 segment_condition.condition_type
 */
export enum SegmentConditionType {
    /** 组合条件（AND/OR嵌套） */
    GROUP = 'GROUP',
    /** 原子规则 */
    CRITERIA = 'CRITERIA',
    /** 标签条件 */
    TAG = 'TAG',
    /** 属性条件 */
    PROFILE = 'PROFILE',
    /** 行为条件 */
    BEHAVIOR = 'BEHAVIOR'
}
