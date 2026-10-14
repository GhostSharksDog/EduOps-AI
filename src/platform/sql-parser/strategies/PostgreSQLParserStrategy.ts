/**
 * PostgreSQL Parser Strategy - Implements IDialectParser for PostgreSQL
 */

import {
    PostgreSQL,
    PostgreSqlParserVisitor,
} from 'dt-sql-parser';
import {
    ColumnCreateTableContext,
    TableElementContext,
    Column_defContext,
    CreateViewContext,
} from 'dt-sql-parser/dist/lib/postgresql/PostgreSqlParser';
import {DataType} from '@/shared/enums/data-models/DataType';
import type {IDialectParser} from '@/platform/sql-parser/interfaces/IDialectParser';
import type {ParseResult, ParseViewResult, ParsedColumn} from '@/platform/sql-parser/types/index';
import {preprocessSQL} from '@/platform/sql-parser/utils/stripComments';

/**
 * Map SQL data type to DataType enum
 */
function mapDataType(sqlType: string): DataType {
    const upperType = sqlType.toUpperCase();

    if (/\b(CHAR|VARCHAR|TEXT|TINYTEXT|MEDIUMTEXT|LONGTEXT|NVARCHAR|NCHAR|NVARCHAR)\b/.test(upperType)) {
        return DataType.STRING;
    }
    if (/\b(INT|INTEGER|BIGINT|SMALLINT|TINYINT|FLOAT|DOUBLE|DECIMAL|NUMERIC|REAL)\b/.test(upperType)) {
        return DataType.NUMBER;
    }
    if (/\b(BOOL|BOOLEAN|BIT)\b/.test(upperType)) {
        return DataType.BOOLEAN;
    }
    if (/\bDATE\b/.test(upperType) && !/\b(DATETIME|TIMESTAMP)\b/.test(upperType)) {
        return DataType.DATE;
    }
    if (/\b(DATETIME|TIMESTAMP|TIME)\b/.test(upperType)) {
        return DataType.DATETIME;
    }
    if (/\b(JSON|ARRAY)\b/.test(upperType)) {
        return DataType.ARRAY;
    }
    if (/\b(BLOB|BINARY|VARBINARY|GEOMETRY|OBJECT)\b/.test(upperType)) {
        return DataType.OBJECT;
    }
    return DataType.STRING;
}

/**
 * Extract length/precision/scale from data type string
 */
function parseDataTypeLength(sqlType: string): {length?: number; precision?: number; scale?: number} {
    const result: {length?: number; precision?: number; scale?: number} = {};

    const lengthMatch = sqlType.match(/\((\d+)\)/);
    if (lengthMatch) {
        result.length = parseInt(lengthMatch[1], 10);
    }

    const decimalMatch = sqlType.match(/\((\d+),\s*(\d+)\)/);
    if (decimalMatch) {
        result.precision = parseInt(decimalMatch[1], 10);
        result.scale = parseInt(decimalMatch[2], 10);
    }

    return result;
}

/**
 * Extract column comment from column definition context
 */
function extractColumnComment(columnDef: Column_defContext): string | undefined {
    if (!columnDef || !columnDef.children) return undefined;

    for (const child of columnDef.children) {
        const text = child.getText();
        if (text.toUpperCase().startsWith('COMMENT')) {
            const commentMatch = text.match(/COMMENT\s+['"](.*?)['"]/i);
            if (commentMatch) return commentMatch[1];
            const simpleMatch = text.match(/COMMENT\s+['"]([^'"]+)['"]/i);
            if (simpleMatch) return simpleMatch[1];
        }
    }
    return undefined;
}

/**
 * Extract table comment from CREATE TABLE context
 */
function extractTableComment(ctx: ColumnCreateTableContext): string | undefined {
    if (!ctx || !ctx.children) return undefined;

    for (const child of ctx.children) {
        const text = child.getText();
        if (text.toUpperCase().startsWith('COMMENT')) {
            const commentMatch = text.match(/COMMENT\s*=\s*['"](.*?)['"]/i)
                || text.match(/COMMENT\s+['"](.*?)['"]/i);
            if (commentMatch) return commentMatch[1];
        }
    }
    return undefined;
}

/**
 * PostgreSQL Parser Strategy
 */
export class PostgreSQLParserStrategy implements IDialectParser {
    readonly dialect = 'postgresql' as const;

    private parser: PostgreSQL;

    constructor() {
        this.parser = new PostgreSQL();
    }

    /**
     * Get the SQL dialect
     */
    getDialect(): 'mysql' | 'postgresql' {
        return 'postgresql';
    }

    /**
     * Validate SQL before parsing
     */
    validate(sql: string): string[] {
        try {
            return this.parser.validate(sql).map(err => err.message);
        } catch (error) {
            return [error instanceof Error ? error.message : 'Unknown validation error'];
        }
    }

    /**
     * Parse CREATE TABLE SQL statement
     */
    parse(sql: string): ParseResult {
        const processedSQL = preprocessSQL(sql);
        const parseTree = this.parser.parse(processedSQL);

        // Extract table name
        class TableNameVisitor extends PostgreSqlParserVisitor<string> {
            defaultResult(): string {
                return '';
            }

            aggregateResult(aggregate: string, nextResult: string): string {
                return aggregate || nextResult || '';
            }

            visitColumnCreateTable = (ctx: ColumnCreateTableContext): string => {
                return ctx.tableNameCreate()?.getText() || '';
            };
        }

        // Extract table comment
        class TableCommentVisitor extends PostgreSqlParserVisitor<string> {
            defaultResult(): string {
                return '';
            }

            aggregateResult(aggregate: string, nextResult: string): string {
                return aggregate || nextResult || '';
            }

            visitCreateTable = (ctx: ColumnCreateTableContext): string => {
                return extractTableComment(ctx) || '';
            };
        }

        // Extract columns
        class ColumnVisitor extends PostgreSqlParserVisitor<ParsedColumn[]> {
            private primaryKeys: Set<string> = new Set();

            defaultResult(): ParsedColumn[] {
                return [];
            }

            aggregateResult(aggregate: ParsedColumn[], nextResult: ParsedColumn[]): ParsedColumn[] {
                return [...aggregate, ...nextResult];
            }

            visitColumnCreateTable = (ctx: ColumnCreateTableContext): ParsedColumn[] => {
                if (!ctx) return [];

                // PostgreSQL: Constraints are embedded in table elements via constraintElem()
                // We need to process table elements to find PRIMARY KEY constraints
                const columns: ParsedColumn[] = [];
                const tel = ctx.tableElementList?.();
                if (!tel) return [];

                const tableElements = tel.tableElement?.() || [];
                
                // First pass: collect PRIMARY KEY constraints from constraintElem
                for (const element of tableElements) {
                    const constraintElem = element.constraintElem?.();
                    if (constraintElem) {
                        const constraintText = constraintElem.getText().toUpperCase();
                        if (constraintText.includes('PRIMARY KEY') || constraintText.includes('PRIMARYKEY')) {
                            const pkMatch = constraintText.match(/PRIMARY\s*KEY\s*\(([^)]+)\)/i);
                            if (pkMatch) {
                                const pkColumns = pkMatch[1].split(',').map((col: string) =>
                                    col.trim().replace(/[`"]/g, ''));
                                pkColumns.forEach((col: string) => this.primaryKeys.add(col.toLowerCase()));
                            }
                        }
                    }
                }

                // Second pass: process columns
                tableElements.forEach((element: TableElementContext, index: number) => {
                    const elementText = element.getText().toUpperCase();

                    if (elementText.startsWith('PRIMARY KEY') ||
                        elementText.startsWith('PRIMARYKEY') ||
                        elementText.startsWith('FOREIGN KEY') ||
                        elementText.startsWith('UNIQUE') ||
                        elementText.startsWith('CHECK') ||
                        elementText.startsWith('CONSTRAINT')) {
                        return;
                    }

                    const columnDef = element.column_def?.();
                    if (!columnDef) return;

                    // PostgreSQL: column name is in columnDef.columnNameCreate
                    const columnName = columnDef.columnNameCreate?.()?.getText() || '';
                    if (!columnName) return;

                    // PostgreSQL: data type is in columnDef.typename
                    const sqlType = columnDef.typename?.()?.getText() || '';
                    const {length, precision, scale} = parseDataTypeLength(sqlType);

                    const columnConstraints = columnDef.colConstraint?.() || [];
                    let isNullable = true;
                    let isPrimaryKey = this.primaryKeys.has(columnName.toLowerCase());

                    for (const constraint of columnConstraints) {
                        const constraintText = constraint.getText().toUpperCase();
                        if (constraintText.includes('NOT NULL') || constraintText.includes('NOTNULL')) {
                            isNullable = false;
                        }
                        if (constraintText.includes('PRIMARY KEY') || constraintText.includes('PRIMARYKEY')) {
                            isPrimaryKey = true;
                        }
                    }

                    const description = extractColumnComment(columnDef);

                    columns.push({
                        name: columnName,
                        dataType: sqlType,
                        mappedDataType: mapDataType(sqlType),
                        length,
                        precision,
                        scale,
                        isNullable,
                        isPrimaryKey,
                        description,
                        orderIndex: index,
                    });
                });

                return columns;
            };

            visitTableElement = (_ctx: TableElementContext): ParsedColumn[] => {
                return [];
            };
        }

        const tableNameVisitor = new TableNameVisitor();
        const tableCommentVisitor = new TableCommentVisitor();
        const columnVisitor = new ColumnVisitor();

        const tableName = tableNameVisitor.visit(parseTree) || '';
        const tableComment = tableCommentVisitor.visit(parseTree) || '';
        const columns = columnVisitor.visit(parseTree) || [];

        return {
            tableName,
            tableComment: tableComment || undefined,
            columns,
        };
    }

    parseView(sql: string): ParseViewResult {
        const processedSQL = preprocessSQL(sql);
        const parseTree = this.parser.parse(processedSQL);

        class ViewNameVisitor extends PostgreSqlParserVisitor<string> {
            defaultResult(): string {
                return '';
            }

            aggregateResult(aggregate: string, nextResult: string): string {
                return aggregate || nextResult || '';
            }

            visitCreateView = (ctx: CreateViewContext): string => {
                const anyCtx = ctx as unknown as Record<string, () => { getText: () => string }>;
                return anyCtx.viewNameCreate?.()?.getText() || '';
            };
        }

        class ViewColumnVisitor extends PostgreSqlParserVisitor<ParsedColumn[]> {
            defaultResult(): ParsedColumn[] {
                return [];
            }

            aggregateResult(aggregate: ParsedColumn[], nextResult: ParsedColumn[]): ParsedColumn[] {
                return [...aggregate, ...nextResult];
            }

            visitCreateView = (ctx: CreateViewContext): ParsedColumn[] => {
                const anyCtx = ctx as unknown as Record<string, () => unknown>;
                const columnListCreate = anyCtx.columnListCreate?.() as Record<string, () => unknown[]> | undefined;
                const optColumnList = anyCtx.optColumnList?.() as Record<string, () => unknown[]> | undefined;
                
                if (columnListCreate) {
                    const columns = columnListCreate.columnNameCreate?.() || [];
                    return (columns as Record<string, () => string>[]).map((col, index: number) => ({
                        name: col.getText?.() || '',
                        dataType: 'UNKNOWN',
                        mappedDataType: DataType.STRING,
                        isNullable: true,
                        isPrimaryKey: false,
                        orderIndex: index,
                    }));
                }

                if (optColumnList) {
                    const columnList = optColumnList.columnNameCreate?.() || [];
                    if (columnList.length > 0) {
                        return (columnList as Record<string, () => string>[]).map((col, index: number) => ({
                            name: col.getText?.() || '',
                            dataType: 'UNKNOWN',
                            mappedDataType: DataType.STRING,
                            isNullable: true,
                            isPrimaryKey: false,
                            orderIndex: index,
                        }));
                    }
                }

                const selectStmt = anyCtx.selectStmt?.() as Record<string, () => string> | undefined;
                const selectText = selectStmt?.getText?.() || '';
                const columnMatches = selectText.match(/SELECT\s+(.+?)\s+FROM/i);
                if (columnMatches) {
                    const selectColumns = columnMatches[1].split(',').map((col: string) => {
                        const trimmed = col.trim();
                        const aliasMatch = trimmed.match(/\s+AS\s+(\w+)$/i) || trimmed.match(/\s+(\w+)$/i);
                        return aliasMatch ? aliasMatch[1] : trimmed;
                    });
                    return selectColumns.map((colName: string, index: number) => ({
                        name: colName.trim(),
                        dataType: 'UNKNOWN',
                        mappedDataType: DataType.STRING,
                        isNullable: true,
                        isPrimaryKey: false,
                        orderIndex: index,
                    }));
                }

                const simpleColumnMatch = selectText.match(/SELECT(.+?)FROM/i);
                if (simpleColumnMatch) {
                    const columnsStr = simpleColumnMatch[1].replace(/\s+/g, ' ').trim();
                    const selectColumns = columnsStr.split(',').map((col: string) => col.trim());
                    return selectColumns.map((colName: string, index: number) => ({
                        name: colName,
                        dataType: 'UNKNOWN',
                        mappedDataType: DataType.STRING,
                        isNullable: true,
                        isPrimaryKey: false,
                        orderIndex: index,
                    }));
                }

                return [];
            };
        }

        class SelectStatementVisitor extends PostgreSqlParserVisitor<string> {
            defaultResult(): string {
                return '';
            }

            aggregateResult(aggregate: string, nextResult: string): string {
                return aggregate || nextResult || '';
            }

            visitCreateView = (ctx: CreateViewContext): string => {
                const anyCtx = ctx as unknown as Record<string, () => { getText: () => string }>;
                return anyCtx.selectStmt?.()?.getText() || '';
            };
        }

        const viewNameVisitor = new ViewNameVisitor();
        const columnVisitor = new ViewColumnVisitor();
        const selectVisitor = new SelectStatementVisitor();

        const viewName = viewNameVisitor.visit(parseTree) || '';
        const columns = columnVisitor.visit(parseTree) || [];
        const selectStatement = selectVisitor.visit(parseTree) || '';

        return {
            viewName,
            columns,
            selectStatement,
        };
    }
}
