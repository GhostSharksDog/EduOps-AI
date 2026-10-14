/**
 * 逻辑运算符枚举
 */
export enum SegmentConditionOperator {
    /** 等于 */
    EQ = 'EQ',
    /** 不等于 */
    NEQ = 'NEQ',
    /** 大于 */
    GT = 'GT',
    /** 小于 */
    LT = 'LT',
    /** 大于等于 */
    GTE = 'GTE',
    /** 小于等于 */
    LTE = 'LTE',

    /** 包含于 */
    IN = 'IN',
    /** 不包含于 */
    NOT_IN = 'NOT_IN',

    /** 包含 */
    CONTAINS = 'CONTAINS',
    /** 不包含 */
    NOT_CONTAINS = 'NOT_CONTAINS',
    /** 以..开头 */
    STARTS_WITH = 'STARTS_WITH',
    /** 以..结尾 */
    ENDS_WITH = 'ENDS_WITH',

    /** 在..之间 */
    BETWEEN = 'BETWEEN',
    /** 模糊匹配 */
    LIKE = 'LIKE',
    /** 模糊不匹配 */
    NOT_LIKE = 'NOT_LIKE',

    /** 且 */
    AND = 'AND',
    /** 或 */
    OR = 'OR'
}
