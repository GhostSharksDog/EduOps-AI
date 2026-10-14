/**
 * ClickHouse 聚合函数配置映射表
 * 
 * 统一定义 10 个聚合函数的 State/Merge 组合器、列类型、存储方式。
 * 用于 INTERMEDIATE 目标表的 DDL 生成和数据写入。
 * 
 * @see docs/superpowers/specs/intermediate-target-table-and-dimension-columns.md §3.4
 */

/** 聚合函数配置项 */
export interface AggregateFunctionConfig {
  /** 聚合函数名，如 'count', 'uniq' */
  functionName: string;
  /** State 组合器，如 'countState' */
  stateCombinator: string;
  /** Merge 组合器，如 'countMerge' */
  mergeCombinator: string;
  /** ClickHouse 列类型，如 'AggregateFunction(count)' */
  columnType: string;
  /** 存储方式: binary(二进制状态) 或 native(原始类型) */
  storageMethod: 'binary' | 'native';
}

/**
 * 聚合函数查找表
 * 
 * ⚠️ 使用 satisfies 而非 as const（as const 与 Record 不兼容）
 */
export const AGGREGATE_FUNCTION_MAPPINGS = {
  count:          { functionName: 'count',          stateCombinator: 'countState',          mergeCombinator: 'countMerge',          columnType: 'AggregateFunction(count)', storageMethod: 'binary' },
  sum:            { functionName: 'sum',            stateCombinator: 'sumState',            mergeCombinator: 'sumMerge',            columnType: 'SimpleAggregateFunction(sum, UInt64)', storageMethod: 'native' },
  uniq:           { functionName: 'uniq',           stateCombinator: 'uniqState',           mergeCombinator: 'uniqMerge',           columnType: 'AggregateFunction(uniq, UInt64)', storageMethod: 'binary' },
  uniqExact:      { functionName: 'uniqExact',      stateCombinator: 'uniqExactState',      mergeCombinator: 'uniqExactMerge',      columnType: 'AggregateFunction(uniqExact, UInt64)', storageMethod: 'binary' },
  avg:            { functionName: 'avg',            stateCombinator: 'avgState',            mergeCombinator: 'avgMerge',            columnType: 'AggregateFunction(avg, Float64)', storageMethod: 'binary' },
  min:            { functionName: 'min',            stateCombinator: 'minState',            mergeCombinator: 'minMerge',            columnType: 'SimpleAggregateFunction(min, Float64)', storageMethod: 'native' },
  max:            { functionName: 'max',            stateCombinator: 'maxState',            mergeCombinator: 'maxMerge',            columnType: 'SimpleAggregateFunction(max, Float64)', storageMethod: 'native' },
  groupArray:     { functionName: 'groupArray',     stateCombinator: 'groupArrayState',     mergeCombinator: 'groupArrayMerge',     columnType: 'AggregateFunction(groupArray, String)', storageMethod: 'binary' },
  groupUniqArray: { functionName: 'groupUniqArray', stateCombinator: 'groupUniqArrayState', mergeCombinator: 'groupUniqArrayMerge', columnType: 'AggregateFunction(groupUniqArray, String)', storageMethod: 'binary' },
  anyLast:        { functionName: 'anyLast',        stateCombinator: 'anyLastState',        mergeCombinator: 'anyLastMerge',        columnType: 'SimpleAggregateFunction(anyLast, String)', storageMethod: 'native' },
} satisfies Record<string, AggregateFunctionConfig>;

/**
 * 根据函数名获取聚合配置
 */
export function getAggregateConfig(functionName: string): AggregateFunctionConfig | undefined {
  return AGGREGATE_FUNCTION_MAPPINGS[functionName as keyof typeof AGGREGATE_FUNCTION_MAPPINGS];
}

/**
 * 根据函数名获取 ClickHouse DDL 列类型
 */
export function getAggregateColumnDDLType(functionName: string): string {
  const config = getAggregateConfig(functionName);
  if (!config) {
    throw new Error(`未知的聚合函数: ${functionName}`);
  }
  return config.columnType;
}

/**
 * 生成 Merge 表达式，如 uniqMerge(state_col)
 */
export function getMergeExpression(functionName: string, columnName: string): string {
  const config = getAggregateConfig(functionName);
  if (!config) {
    throw new Error(`未知的聚合函数: ${functionName}`);
  }
  return `${config.mergeCombinator}(${columnName})`;
}

/**
 * 获取所有支持的聚合函数名称列表
 */
export function getAllAggregateFunctionNames(): string[] {
  return Object.keys(AGGREGATE_FUNCTION_MAPPINGS);
}
