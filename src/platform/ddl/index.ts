export { generateTargetTableDDL, serializeDDLResult, deserializeDDLResult } from '@/platform/ddl/generateTargetTableDDL';
export type { DDLGenerateOptions, DDLGenerateResult, DDLColumnDefinition, DDLTableType } from '@/platform/ddl/generateTargetTableDDL';
export { TAG_VALUE_TYPE_TO_CLICKHOUSE, TAG_VALUE_TYPE_ORDER_BY, getClickHouseColumnType, getOrderByClause } from '@/platform/ddl/tagValueTypeMappings';
export {
  AGGREGATE_FUNCTION_MAPPINGS,
  getAggregateConfig,
  getAggregateColumnDDLType,
  getMergeExpression,
  getAllAggregateFunctionNames,
} from '@/platform/ddl/aggregateFunctionMappings';
export type { AggregateFunctionConfig } from '@/platform/ddl/aggregateFunctionMappings';
