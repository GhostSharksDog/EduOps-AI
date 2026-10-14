/**
 * SQL Dialect Parser Strategy Interface
 * Defines the contract for dialect-specific SQL parsers
 */

import type { ParseResult, ParseViewResult, SqlDialect } from '@/platform/sql-parser/types/index';

/**
 * Strategy interface for SQL dialect-specific parsers
 * Each implementation handles the nuances of a specific SQL dialect
 */
export interface IDialectParser {
    /** The dialect this parser handles */
    readonly dialect: SqlDialect;

    /**
     * Parse a CREATE TABLE SQL statement
     * @param sql - The SQL statement to parse
     * @returns Parsed result with table name, comment, and columns
     */
    parse(sql: string): ParseResult;

    /**
     * Validate a CREATE TABLE SQL statement
     * @param sql - The SQL statement to validate
     * @returns Array of validation errors (empty if valid)
     */
    validate(sql: string): string[];

    /**
     * Parse a CREATE VIEW SQL statement
     * @param sql - The SQL statement to parse
     * @returns Parsed result with view name, comment, columns, and select statement
     */
    parseView?(sql: string): ParseViewResult;
}
