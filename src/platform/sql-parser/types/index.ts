/**
 * SQL Parser Types
 * Shared types for SQL dialect parsers
 */

import type { DataType } from '@/shared/enums/data-models/DataType';

/**
 * Parsed column information
 */
export interface ParsedColumn {
    name: string;
    dataType: string;
    mappedDataType: DataType;
    length?: number;
    precision?: number;
    scale?: number;
    isNullable: boolean;
    isPrimaryKey: boolean;
    description?: string;
    orderIndex: number;
}

/**
 * Parsed table result
 */
export interface ParseResult {
    tableName: string;
    tableComment?: string;
    columns: ParsedColumn[];
}

/**
 * Parsed view result
 */
export interface ParseViewResult {
    viewName: string;
    viewComment?: string;
    columns: ParsedColumn[];
    selectStatement: string;
}

/**
 * Supported SQL dialects
 */
export type SqlDialect = 'mysql' | 'postgresql' | 'clickhouse';

/**
 * Statement type for parsing
 */
export type StatementType = 'table' | 'view';
