/**
 * ClickHouse Parser Strategy - Regex-based parser for ClickHouse CREATE TABLE statements
 */

import type { IDialectParser } from '@/platform/sql-parser/interfaces/IDialectParser';
import type { ParseResult, ParsedColumn } from '@/platform/sql-parser/types/index';
import { DataType } from '@/shared/enums/data-models/DataType';
import { preprocessSQL } from '@/platform/sql-parser/utils/stripComments';

/**
 * Map ClickHouse data type to DataType enum
 */
export function mapClickHouseDataType(sqlType: string): DataType {
    const normalizedType = sqlType.trim().toUpperCase();

    // Extract base type for parameterized types
    const baseTypeMatch = normalizedType.match(/^(\w+)/);
    const baseType = baseTypeMatch ? baseTypeMatch[1] : normalizedType;

    // Integer types (UInt8-256, Int8-256)
    if (/^(U?INT)(8|16|32|64|128|256)$/.test(baseType)) {
        return DataType.NUMBER;
    }

    // Float types
    if (baseType === 'FLOAT32' || baseType === 'FLOAT64') {
        return DataType.NUMBER;
    }

    // Decimal types
    if (baseType === 'DECIMAL' || /^DECIMAL(32|64|128|256)$/.test(baseType)) {
        return DataType.NUMBER;
    }

    // Boolean
    if (baseType === 'BOOL' || baseType === 'BOOLEAN') {
        return DataType.BOOLEAN;
    }

    // Date types
    if (baseType === 'DATE' || baseType === 'DATE32') {
        return DataType.DATE;
    }

    // DateTime types
    if (baseType === 'DATETIME' || baseType === 'DATETIME64') {
        return DataType.DATETIME;
    }

    // Array type
    if (baseType === 'ARRAY') {
        return DataType.ARRAY;
    }

    // Map/Tuple/Nested - complex types
    if (baseType === 'MAP' || baseType === 'TUPLE' || baseType === 'NESTED') {
        return DataType.OBJECT;
    }

    // Nullable - extract inner type
    if (baseType === 'NULLABLE') {
        const innerTypeMatch = normalizedType.match(/NULLABLE\s*\(\s*(.+?)\s*\)/i);
        if (innerTypeMatch) {
            return mapClickHouseDataType(innerTypeMatch[1]);
        }
        return DataType.STRING;
    }

    // LowCardinality - extract inner type
    if (baseType === 'LOWCARDINALITY') {
        const innerTypeMatch = normalizedType.match(/LOWCARDINALITY\s*\(\s*(.+?)\s*\)/i);
        if (innerTypeMatch) {
            return mapClickHouseDataType(innerTypeMatch[1]);
        }
        return DataType.STRING;
    }

    // SimpleAggregateFunction - extract inner type
    if (baseType === 'SIMPLEAGGREGATEFUNCTION') {
        const innerTypeMatch = normalizedType.match(/SIMPLEAGGREGATEFUNCTION\s*\([^,]+,\s*(.+?)\s*\)/i);
        if (innerTypeMatch) {
            return mapClickHouseDataType(innerTypeMatch[1]);
        }
        return DataType.NUMBER;
    }

    // AggregateFunction - typically numeric
    if (baseType === 'AGGREGATEFUNCTION') {
        return DataType.NUMBER;
    }

    // String types (default for most other types)
    return DataType.STRING;
}

/**
 * Extract length from type like FixedString(100), Decimal(10,2)
 */
function extractTypeParams(sqlType: string): { length?: number; precision?: number; scale?: number } {
    const result: { length?: number; precision?: number; scale?: number } = {};

    // Match single parameter: Type(100)
    const singleParamMatch = sqlType.match(/\((\d+)\)/);
    if (singleParamMatch) {
        result.length = parseInt(singleParamMatch[1], 10);
    }

    // Match two parameters: Type(10, 2)
    const doubleParamMatch = sqlType.match(/\((\d+)\s*,\s*(\d+)\)/);
    if (doubleParamMatch) {
        result.precision = parseInt(doubleParamMatch[1], 10);
        result.scale = parseInt(doubleParamMatch[2], 10);
        delete result.length; // Clear length as this is precision/scale
    }

    return result;
}

/**
 * Remove surrounding quotes from identifier (backticks or double quotes)
 */
function unquoteIdentifier(id: string): string {
    if ((id.startsWith('`') && id.endsWith('`')) ||
        (id.startsWith('"') && id.endsWith('"'))) {
        return id.slice(1, -1);
    }
    return id;
}

/**
 * Extract table name from CREATE TABLE statement
 */
function extractTableName(sql: string): string {
    // Match CREATE [OR REPLACE] [MATERIALIZED] [TEMPORARY] TABLE [IF NOT EXISTS] [database.]tablename
    // Handle quoted identifiers: `name` or "name" (can contain hyphens, spaces, etc.)
    const tableMatch = sql.match(/CREATE\s+(?:OR\s+REPLACE\s+)?(?:MATERIALIZED\s+)?(?:TEMPORARY\s+)?(?:DICTIONARY\s+)?(?:VIEW\s+)?TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:[\w]+\.)?(`[^`]+`|"[^"]+"|[\w]+)/i);
    if (tableMatch) {
        return unquoteIdentifier(tableMatch[1]);
    }

    // Try VIEW without TABLE keyword
    const viewMatch = sql.match(/CREATE\s+(?:OR\s+REPLACE\s+)?(?:MATERIALIZED\s+)?VIEW\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:[\w]+\.)?(`[^`]+`|"[^"]+"|[\w]+)/i);
    if (viewMatch) {
        return unquoteIdentifier(viewMatch[1]);
    }

    return '';
}

/**
 * Extract table comment
 */
function extractTableComment(sql: string): string | undefined {
    // ClickHouse uses COMMENT 'text' after table definition
    const commentMatch = sql.match(/COMMENT\s+'([^']*)'/i);
    return commentMatch ? commentMatch[1] : undefined;
}

/**
 * Parse column list string into ParsedColumn array
 */
function parseColumnList(columnList: string): ParsedColumn[] {
    const columns: ParsedColumn[] = [];
    
    // Remove SQL comments
    let cleaned = columnList.replace(/--[^\n]*/g, ' ');
    cleaned = cleaned.replace(/\/\*[\s\S]*?\*\//g, ' ');

    // Split by comma, but handle nested parentheses (Array, Map, Tuple, etc.)
    const columnDefs: string[] = [];
    let current = '';
    let parenDepth = 0;
    
    for (const char of cleaned) {
        if (char === '(') parenDepth++;
        else if (char === ')') parenDepth--;
        else if (char === ',' && parenDepth === 0) {
            columnDefs.push(current.trim());
            current = '';
            continue;
        }
        current += char;
    }
    if (current.trim()) {
        columnDefs.push(current.trim());
    }

    // Parse each column definition
    let orderIndex = 0;
    for (const def of columnDefs) {
        const column = parseColumnDefinition(def, orderIndex);
        if (column) {
            columns.push(column);
            orderIndex++;
        }
    }

    return columns;
}

/**
 * Parse a single column definition
 */
function parseColumnDefinition(def: string, orderIndex: number): ParsedColumn | null {
    // Skip constraint definitions (PRIMARY KEY, INDEX, etc.)
    const upperDef = def.toUpperCase().trim();
    if (upperDef.startsWith('PRIMARY KEY') ||
        upperDef.startsWith('INDEX') ||
        upperDef.startsWith('CONSTRAINT') ||
        upperDef.startsWith('ORDER BY') ||
        upperDef.startsWith('SAMPLE BY') ||
        upperDef.startsWith('PARTITION BY')) {
        return null;
    }

    // Match: name Type [DEFAULT ...] [MATERIALIZED ...] [ALIAS ...] [COMMENT '...']
    // Handle quoted identifiers and complex types with parentheses
    
    // First, extract comment if present
    let description: string | undefined;
    const commentMatch = def.match(/COMMENT\s+'([^']*)'/i);
    if (commentMatch) {
        description = commentMatch[1];
    }

    // Remove comment, DEFAULT, MATERIALIZED, ALIAS clauses for type extraction
    let cleanDef = def.replace(/COMMENT\s+'[^']*'/i, '');
    cleanDef = cleanDef.replace(/DEFAULT\s+[^\s,]+(\s+|$)/gi, ' ');
    cleanDef = cleanDef.replace(/DEFAULT\s+'[^']*'/gi, ' ');
    cleanDef = cleanDef.replace(/MATERIALIZED\s+\S+/gi, ' ');
    cleanDef = cleanDef.replace(/ALIAS\s+\S+/gi, ' ');
    cleanDef = cleanDef.trim();

    // Now parse: name Type
    // Handle quoted identifiers
    let nameMatch: RegExpMatchArray | null;
    
    // Try backticks first
    nameMatch = cleanDef.match(/^`([^`]+)`\s+(.+)/);
    if (!nameMatch) {
        // Try double quotes
        nameMatch = cleanDef.match(/^"([^"]+)"\s+(.+)/);
    }
    if (!nameMatch) {
        // Try unquoted
        nameMatch = cleanDef.match(/^(\w+)\s+(.+)/);
    }

    if (!nameMatch) {
        return null;
    }

    const name = unquoteIdentifier(nameMatch[1]);
    const sqlType = nameMatch[2].trim();

    const { length, precision, scale } = extractTypeParams(sqlType);

    return {
        name,
        dataType: sqlType,
        mappedDataType: mapClickHouseDataType(sqlType),
        length,
        precision,
        scale,
        isNullable: true, // ClickHouse columns are nullable by default unless NOT NULL
        isPrimaryKey: false, // ClickHouse doesn't have inline PRIMARY KEY
        description,
        orderIndex,
    };
}

/**
 * Extract column definitions from CREATE TABLE statement
 */
function extractColumns(sql: string): ParsedColumn[] {
    // Find the content between first ( and ) before ENGINE or other clauses
    // Handle nested parentheses for complex types
    const parenMatch = sql.match(/\(([\s\S]*)\)\s*(?:ENGINE|$)/i);
    if (!parenMatch) {
        // Try without ENGINE keyword
        const parenMatchNoEngine = sql.match(/\(([\s\S]*)\)\s*(?:PRIMARY|ORDER|PARTITION|TTL|SETTINGS|COMMENT|$)/i);
        if (!parenMatchNoEngine) {
            return [];
        }
        return parseColumnList(parenMatchNoEngine[1]);
    }

    return parseColumnList(parenMatch[1]);
}

/**
 * ClickHouse Parser Strategy
 */
export class ClickHouseParserStrategy implements IDialectParser {
    readonly dialect = 'clickhouse';

    parse(sql: string): ParseResult {
        const processedSQL = preprocessSQL(sql);

        const tableName = extractTableName(processedSQL);
        const tableComment = extractTableComment(processedSQL);
        const columns = extractColumns(processedSQL);

        return {
            tableName,
            tableComment,
            columns,
        };
    }

    validate(sql: string): string[] {
        const errors: string[] = [];

        if (!sql || !sql.trim()) {
            errors.push('SQL 语句不能为空');
            return errors;
        }

        const processedSQL = preprocessSQL(sql);
        const upperSQL = processedSQL.toUpperCase();

        // Check for CREATE TABLE/VIEW/DICTIONARY keywords
        if (!upperSQL.includes('CREATE')) {
            errors.push('SQL 必须包含 CREATE 语句');
        }

        // Basic syntax checks
        if (!upperSQL.includes('TABLE') && !upperSQL.includes('VIEW') && !upperSQL.includes('DICTIONARY')) {
            errors.push('SQL 必须包含 TABLE、VIEW 或 DICTIONARY 关键字');
        }

        // Check for opening parenthesis
        if (upperSQL.includes('TABLE') && !processedSQL.includes('(')) {
            errors.push('CREATE TABLE 必须在括号中定义列');
        }

        return errors;
    }
}
