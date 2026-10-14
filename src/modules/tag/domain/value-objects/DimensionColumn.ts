import type { AggregateFunctionConfig } from '@/platform/ddl/aggregateFunctionMappings';

/**
 * 维度列值对象
 * 
 * 描述 INTERMEDIATE 目标表或 SIMPLE 表的维度列定义。
 * 每个维度列对应 ClickHouse 表中的一个非业务核心列（非 entity_id / tag_value）。
 */
export interface DimensionColumn {
  /** 列名 */
  name: string;
  /** ClickHouse 类型，如 'String', 'UInt64', 'LowCardinality(String)' */
  type: string;
  /** 默认值表达式，如 "'USER'", "now()" */
  defaultExpression?: string;
  /** 列注释 */
  comment?: string;
}

/**
 * 维度列推断结果
 * 
 * 通过 DESCRIBE (SELECT ...) 从 SQL 推断出的列信息。
 */
export interface InferColumnsResult {
  /** 推断出的维度列列表 */
  dimensionColumns: DimensionColumn[];
  /** tag_value 列信息 */
  tagValueColumn: { name: string; type: string };
  /** 建议的 ORDER BY 列名列表 */
  suggestedOrderBy: string[];
}

// AggregateFunctionConfig 已在 lib/ddl/aggregateFunctionMappings.ts 中统一定义
// 此处仅 import 引用，避免两处定义不一致
export type { AggregateFunctionConfig };
