/**
 * 调度类型枚举
 * 用于导出任务的调度配置
 */
export enum ScheduleType {
  /** 立即执行 - 任务创建后立即执行 */
  IMMEDIATE = 'IMMEDIATE',
  /** 定时执行 - 按计划时间执行 */
  SCHEDULED = 'SCHEDULED'
}
