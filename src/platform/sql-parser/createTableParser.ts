/**
 * SQL Parser Service - Parse CREATE TABLE statements to extract table structure
 * Uses Strategy pattern to support multiple SQL dialects with clean separation of concerns.
 */

import type { ParseResult, ParseViewResult, SqlDialect } from '@/platform/sql-parser/types/index';
import { MySQLParserStrategy } from '@/platform/sql-parser/strategies/MySQLParserStrategy';
import { PostgreSQLParserStrategy } from '@/platform/sql-parser/strategies/PostgreSQLParserStrategy';
import { ClickHouseParserStrategy } from '@/platform/sql-parser/strategies/ClickHouseParserStrategy';
import type { IDialectParser } from '@/platform/sql-parser/interfaces/IDialectParser';
import { preprocessSQL } from '@/platform/sql-parser/utils/stripComments';

// Re-export types from types/index.ts for backward compatibility
export type { ParsedColumn, ParseResult, ParseViewResult, SqlDialect, StatementType } from '@/platform/sql-parser/types/index';

/**
 * Get the appropriate parser strategy for the given dialect
 */
function getParserStrategy(dialect: SqlDialect): IDialectParser {
    switch (dialect) {
        case 'mysql':
            return new MySQLParserStrategy();
        case 'postgresql':
            return new PostgreSQLParserStrategy();
        case 'clickhouse':
            return new ClickHouseParserStrategy();
        default:
            throw new Error(`不支持的 SQL 方言: ${dialect}`);
    }
}

/**
 * Parse CREATE TABLE SQL statement
 * @param sql - CREATE TABLE SQL statement
 * @param dialect - SQL dialect ('mysql' or 'postgresql')
 * @returns Parsed result with table name, comment, and columns
 */
export function parseCreateTable(sql: string, dialect: SqlDialect): ParseResult {
    if (!sql || !sql.trim()) {
        throw new Error('SQL 语句不能为空');
    }

    const processedSQL = preprocessSQL(sql);
    if (!processedSQL.toUpperCase().startsWith('CREATE TABLE')) {
        throw new Error('仅支持 CREATE TABLE 语句');
    }

    const strategy = getParserStrategy(dialect);
    return strategy.parse(sql);
}

/**
 * Validate CREATE TABLE SQL without parsing
 * @param sql - CREATE TABLE SQL statement
 * @param dialect - SQL dialect
 * @returns Validation errors (empty if valid)
 */
export function validateCreateTable(sql: string, dialect: SqlDialect): string[] {
    const strategy = getParserStrategy(dialect);
    return strategy.validate(sql);
}

/**
 * Parse CREATE VIEW SQL statement
 * @param sql - CREATE VIEW SQL statement
 * @param dialect - SQL dialect ('mysql' or 'postgresql')
 * @returns Parsed result with view name, columns, and select statement
 */
export function parseCreateView(sql: string, dialect: SqlDialect): ParseViewResult {
    if (!sql || !sql.trim()) {
        throw new Error('SQL 语句不能为空');
    }

    const processedSQL = preprocessSQL(sql);
    const upperSQL = processedSQL.toUpperCase();
    if (!upperSQL.startsWith('CREATE VIEW') && !upperSQL.startsWith('CREATE RECURSIVE VIEW')) {
        throw new Error('仅支持 CREATE VIEW 语句');
    }

    const strategy = getParserStrategy(dialect);
    if (!strategy.parseView) {
        throw new Error(`该 SQL 方言不支持 VIEW 解析: ${dialect}`);
    }
    return strategy.parseView(sql);
}
