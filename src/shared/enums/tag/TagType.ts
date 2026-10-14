/**
 * 标签类型枚举
 * 区分简单标签和计算标签
 */
export enum TagType {
  /** 简单标签 - 直接从数据源获取的标签 */
  SIMPLE = 'SIMPLE',
  /** 计算标签 - 通过规则计算得出的标签 */
  CALCULATED = 'CALCULATED'
}
