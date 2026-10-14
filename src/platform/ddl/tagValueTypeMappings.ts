import { TagValueType } from '@/shared/enums/tag/TagValueType';
/**
 * TagValueType 到 ClickHouse 列类型的映射
 */
export const TAG_VALUE_TYPE_TO_CLICKHOUSE: Record<TagValueType, string> = {
  [TagValueType.STRING]: 'String',
  [TagValueType.NUMBER]: 'Float64',
  [TagValueType.BOOLEAN]: 'UInt8',
  [TagValueType.DATE]: 'Date',
  [TagValueType.DATETIME]: 'DateTime',
  [TagValueType.ENUM]: 'String',
} as const;

/**
 * TagValueType 对应的 ORDER BY 子句
 * - STRING/NUMBER/BOOLEAN: 只按 entity_id 排序
 * - DATE/DATETIME: 按 entity_id + tag_value 排序（支持范围查询)
 */
export const TAG_VALUE_TYPE_ORDER_BY: Record<TagValueType, string> = {
  [TagValueType.STRING]: '(entity_id)',
  [TagValueType.NUMBER]: '(entity_id)',
  [TagValueType.BOOLEAN]: '(entity_id)',
  [TagValueType.DATE]: '(entity_id, tag_value)',
  [TagValueType.DATETIME]: '(entity_id, tag_value)',
  [TagValueType.ENUM]: '(entity_id)',
} as const;

/**
 * 获取 ClickHouse 列类型
 */
export function getClickHouseColumnType(tagValueType: TagValueType): string {
  return TAG_VALUE_TYPE_TO_CLICKHOUSE[tagValueType];
}

/**
 * 获取 ORDER BY 子句
 */
export function getOrderByClause(tagValueType: TagValueType): string {
  return TAG_VALUE_TYPE_ORDER_BY[tagValueType];
}
