import { TagValueType } from '@/shared/enums/tag/TagValueType';
import { getClickHouseColumnType, getOrderByClause } from '@/platform/ddl/tagValueTypeMappings';
import type {DimensionColumn} from '@/modules/tag/contracts';
import {
    getAggregateColumnDDLType,
    getAggregateConfig,
    type AggregateFunctionConfig,
} from '@/platform/ddl/aggregateFunctionMappings';

/** DDL 生成时的表类型 */
export type DDLTableType = 'PHYSICAL_TABLE' | 'VIEW' | 'INTERMEDIATE';

export interface DDLGenerateOptions {
    /** 目标表名 */
    tableName: string;
    /** 实体类型代码，如 'USER', 'DEVICE'（仅作注释，不写入 DEFAULT） */
    entityTypeCode: string;
    /** 项目内部实体类型 UUID，写入 entity_type_id 列的 DEFAULT */
    entityTypeId: string;
    /** 标签值类型 (PHYSICAL_TABLE/VIEW 必填，INTERMEDIATE 可选) */
    tagValueType?: TagValueType;
    /** 表类型，默认 PHYSICAL_TABLE（向后兼容） */
    tableType?: DDLTableType;
    /** 维度列定义 (SimpleWithDimensions / INTERMEDIATE 必填) */
    dimensionColumns?: DimensionColumn[];
    /** 聚合函数名，如 'uniq', 'count' (INTERMEDIATE 必填) */
    aggregateFunctionName?: string;
}

export interface DDLGenerateResult {
    /** 完整的 CREATE TABLE DDL 语句 */
    sql: string;
    /** 生成方式标记 */
    generatedBy: 'AUTO';
    /** 使用的标签值类型 (PHYSICAL_TABLE/VIEW 返回，INTERMEDIATE 可选) */
    tagValueType?: TagValueType;
    /** 列定义列表 */
    columns: DDLColumnDefinition[];
    /** 维度列定义 (有维度列时返回) */
    dimensionColumns?: DimensionColumn[];
    /** 聚合函数配置 (INTERMEDIATE 时返回) */
    aggregateConfig?: AggregateFunctionConfig;
    /** 表类型 */
    tableType: DDLTableType;
}

export interface DDLColumnDefinition {
    name: string;
    type: string;
    defaultExpression?: string;
    comment?: string;
}

function formatColumnsDDL(columns: DDLColumnDefinition[]): string {
    return columns
        .map((col) => {
            let line = `    ${col.name} ${col.type}`;
            if (col.defaultExpression) {
                line += ` DEFAULT ${col.defaultExpression}`;
            }
            if (col.comment) {
                line += ` COMMENT '${col.comment}'`;
            }
            return line;
        })
        .join(',\n');
}

function buildDimensionOrderBy(dimensionColumns: DimensionColumn[]): string {
    const dimNames = dimensionColumns.map((col) => col.name);
    return `(${dimNames.join(', ')}, entity_id)`;
}

/**
 * 根据标签值类型自动生成 ClickHouse 目标表 DDL
 *
 * 支持三种表类型:
 * - Simple: 基础 4 列模板 (PHYSICAL_TABLE/VIEW, 无维度列)
 * - SimpleWithDimensions: 基础列 + 维度列 (PHYSICAL_TABLE/VIEW, 有维度列)
 * - INTERMEDIATE: 聚合中间表 (AggregatingMergeTree + AggregateFunction 列)
 */
export function generateTargetTableDDL(options: DDLGenerateOptions): DDLGenerateResult {
    const {
        tableName,
        entityTypeCode,
        entityTypeId,
        tagValueType,
        tableType = 'PHYSICAL_TABLE',
        dimensionColumns,
        aggregateFunctionName,
    } = options;

    // 固定前两列
    const fixedColumns: DDLColumnDefinition[] = [
        { name: 'entity_id', type: 'String', comment: '实体ID' },
        {
            name: 'entity_type_id',
            type: 'LowCardinality(String)',
            defaultExpression: `'${entityTypeId}'`,
            comment: `实体类型ID (${entityTypeCode})`,
        },
    ];

    // INTERMEDIATE 表
    if (tableType === 'INTERMEDIATE') {
        return generateIntermediateDDL(
            tableName, fixedColumns, dimensionColumns ?? [], aggregateFunctionName,
        );
    }

    // PHYSICAL_TABLE / VIEW — 需要 tagValueType
    if (!tagValueType) {
        throw new Error('PHYSICAL_TABLE/VIEW 类型必须提供 tagValueType');
    }

    const tagValueColumnType = getClickHouseColumnType(tagValueType);

    // 有维度列 → SimpleWithDimensions
    if (dimensionColumns && dimensionColumns.length > 0) {
        return generateSimpleWithDimensionsDDL(
            tableName, fixedColumns, tagValueColumnType, tagValueType, dimensionColumns, tableType,
        );
    }

    // 简单表 (向后兼容)
    return generateSimpleDDL(tableName, fixedColumns, tagValueColumnType, tagValueType, tableType);
}

/**
 * Case A: Simple — 基础 4 列模板 (向后兼容)
 */
function generateSimpleDDL(
    tableName: string,
    fixedColumns: DDLColumnDefinition[],
    tagValueColumnType: string,
    tagValueType: TagValueType,
    tableType: DDLTableType = 'PHYSICAL_TABLE',
): DDLGenerateResult {
    const columns: DDLColumnDefinition[] = [
        ...fixedColumns,
        { name: 'tag_value', type: tagValueColumnType, comment: '标签值' },
        { name: 'update_time', type: 'DateTime', defaultExpression: 'now()', comment: '更新时间' },
    ];

    const orderBy = getOrderByClause(tagValueType);
    const sql = buildSimpleSQL(tableName, formatColumnsDDL(columns), orderBy, tableType);

    return {
        sql,
        generatedBy: 'AUTO',
        tagValueType,
        columns,
        tableType,
    };
}

/**
 * Case B: SimpleWithDimensions — 基础列 + 维度列
 */
function generateSimpleWithDimensionsDDL(
    tableName: string,
    fixedColumns: DDLColumnDefinition[],
    tagValueColumnType: string,
    tagValueType: TagValueType,
    dimensionColumns: DimensionColumn[],
    tableType: DDLTableType = 'PHYSICAL_TABLE',
): DDLGenerateResult {
    const dimColumnDefs: DDLColumnDefinition[] = dimensionColumns.map((dim) => ({
        name: dim.name,
        type: dim.type,
        ...(dim.defaultExpression ? { defaultExpression: dim.defaultExpression } : {}),
        ...(dim.comment ? { comment: dim.comment } : {}),
    }));

    const columns: DDLColumnDefinition[] = [
        ...fixedColumns,
        ...dimColumnDefs,
        { name: 'tag_value', type: tagValueColumnType, comment: '标签值' },
        { name: 'update_time', type: 'DateTime', defaultExpression: 'now()', comment: '更新时间' },
    ];

    const orderBy = buildDimensionOrderBy(dimensionColumns);
    const sql = buildSimpleSQL(tableName, formatColumnsDDL(columns), orderBy, tableType);

    return {
        sql,
        generatedBy: 'AUTO',
        tagValueType,
        columns,
        dimensionColumns,
        tableType,
    };
}

/**
 * Case C: INTERMEDIATE — AggregatingMergeTree 聚合中间表
 */
function generateIntermediateDDL(
    tableName: string,
    fixedColumns: DDLColumnDefinition[],
    dimensionColumns: DimensionColumn[],
    aggregateFunctionName?: string,
): DDLGenerateResult {
    if (!aggregateFunctionName) {
        throw new Error('INTERMEDIATE 类型必须提供 aggregateFunctionName');
    }
    if (dimensionColumns.length === 0) {
        throw new Error('INTERMEDIATE 类型必须提供 dimensionColumns');
    }

    const aggregateColumnType = getAggregateColumnDDLType(aggregateFunctionName);
    const aggregateConfig = getAggregateConfig(aggregateFunctionName);

    if (!aggregateConfig) {
        throw new Error(`未知的聚合函数: ${aggregateFunctionName}`);
    }

    const dimColumnDefs: DDLColumnDefinition[] = dimensionColumns.map((dim) => ({
        name: dim.name,
        type: dim.type,
        ...(dim.defaultExpression ? { defaultExpression: dim.defaultExpression } : {}),
        ...(dim.comment ? { comment: dim.comment } : {}),
    }));

    const columns: DDLColumnDefinition[] = [
        ...fixedColumns,
        ...dimColumnDefs,
        { name: 'tag_value', type: aggregateColumnType, comment: '标签值' },
        { name: 'update_time', type: 'DateTime', defaultExpression: 'now()', comment: '更新时间' },
    ];

    const orderBy = buildDimensionOrderBy(dimensionColumns);
    const sql = `CREATE TABLE IF NOT EXISTS ${tableName}
(
${formatColumnsDDL(columns)}
)
ENGINE = AggregatingMergeTree()
ORDER BY ${orderBy}
SETTINGS index_granularity = 8192;`;

    return {
        sql,
        generatedBy: 'AUTO',
        columns,
        dimensionColumns,
        aggregateConfig,
        tableType: 'INTERMEDIATE',
    };
}

function buildSimpleSQL(tableName: string, columnsDDL: string, orderBy: string, tableType: DDLTableType = 'PHYSICAL_TABLE'): string {
    const engine = tableType === 'VIEW' ? 'ReplacingMergeTree()' : 'MergeTree()';
    return `CREATE TABLE IF NOT EXISTS ${tableName}
(
${columnsDDL}
)
ENGINE = ${engine}
ORDER BY ${orderBy}
SETTINGS index_granularity = 8192;`;
}

/**
 * 将 DDLGenerateResult 序列化为 JSON 字符串（存入数据库的 createTableSql 字段)
 */
export function serializeDDLResult(result: DDLGenerateResult): string {
    return JSON.stringify(result, null, 2);
}

/**
 * 从 JSON 字符串反序列化 DDLGenerateResult
 * 兼容旧数据：如果字符串不是 JSON 格式,返回 null
 */
export function deserializeDDLResult(jsonString: string): DDLGenerateResult | null {
    try {
        const parsed = JSON.parse(jsonString);
        if (parsed && typeof parsed === 'object' && 'sql' in parsed && 'generatedBy' in parsed) {
            return parsed as DDLGenerateResult;
        }
        return null;
    } catch {
        return null;
    }
}
