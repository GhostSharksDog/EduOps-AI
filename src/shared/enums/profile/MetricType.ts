/**
 * 指标类型枚举
 */
export enum MetricType {
    /** 计数 */
    COUNT = 'COUNT',
    /** 求和 */
    SUM = 'SUM',
    /** 平均值 */
    AVG = 'AVG',
    /** 最小值 */
    MIN = 'MIN',
    /** 最大值 */
    MAX = 'MAX',
    /** 去重计数 */
    DISTINCT_COUNT = 'DISTINCT_COUNT',
    /** 百分位 */
    PERCENTILE = 'PERCENTILE',
    /** 自定义指标 */
    CUSTOM = 'CUSTOM'
}
