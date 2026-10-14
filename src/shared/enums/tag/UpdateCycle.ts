/**
 * 标签更新周期枚举
 */
export enum UpdateCycle {
    /** 经确认的不可变计算快照 */
    SNAPSHOT = 'SNAPSHOT',
    /** 实时更新 */
    REALTIME = 'REALTIME',
    /** 每小时更新 */
    HOURLY = 'HOURLY',
    /** 每日更新 */
    DAILY = 'DAILY',
    /** 每周更新 */
    WEEKLY = 'WEEKLY',
    /** 每月更新 */
    MONTHLY = 'MONTHLY'
}
